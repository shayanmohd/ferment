/* Safe areas. The shell injects --sat and --sab; nothing may sit under the status bar
   or the navigation bar on any screen, including the camera and the sheet. */
const fs = require('fs');
const path = require('path');
const { withNative, check, report } = require('./lib');

const SEED = fs.readFileSync(path.join(__dirname, '..', 'store', 'seed.js'), 'utf8');
const SAT = 48, SAB = 34;

module.exports = async ({ page, shot, wait, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(SEED);
  // documentElement does not exist yet when this runs, so wait for the parser.
  await page.evaluateOnNewDocument((t, b) => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--sat', t + 'px');
      document.documentElement.style.setProperty('--sab', b + 'px');
    });
  }, SAT, SAB);
  await withNative(page);
  await wait(600);

  /* Two questions per screen. Does anything fixed sit under a bar, and can the scroller
     actually bring its last item clear of the navigation bar? Content merely below the fold
     is fine; content that cannot be scrolled out from under the bar is not. */
  const audit = () => page.evaluate((sat, sab) => {
    const H = window.innerHeight;
    const bad = { top: [], bottom: [] };
    const name = el => (el.id || (typeof el.className === 'string' ? el.className : el.tagName) || el.tagName) + '';

    // 1. fixed chrome and the top of every visible screen
    const shown = Array.prototype.filter.call(document.querySelectorAll('.view, .screen'),
      el => !el.hidden && el.getClientRects().length);
    for (const scr of shown) {
      for (const el of scr.querySelectorAll('h1, .topbar-t, .backbtn, .eyebrow, .iconbtn, .vhead')) {
        const r = el.getBoundingClientRect();
        if (r.height < 2 || r.bottom <= 0) continue;
        if (r.top < sat) bad.top.push(name(el) + ' @' + Math.round(r.top));
        break;
      }
    }
    const tabs = document.querySelector('#tabs');
    if (tabs && !tabs.hidden) {
      const labels = tabs.querySelectorAll('.tab i');
      for (const l of labels) {
        const r = l.getBoundingClientRect();
        if (r.bottom > H - sab) bad.bottom.push('tab label @' + Math.round(r.bottom));
      }
    }

    // 2. the scroller must be able to lift its last child clear of the bottom bar
    for (const scr of shown) {
      const sc = scr.querySelector('.scroller');
      if (!sc) continue;
      const wasTop = sc.scrollTop;
      sc.scrollTop = sc.scrollHeight;
      const kids = sc.children;
      const last = kids[kids.length - 1];
      if (last) {
        const r = last.getBoundingClientRect();
        if (r.bottom > H - sab) bad.bottom.push('scrolled-to-end ' + name(last) + ' @' + Math.round(r.bottom));
      }
      sc.scrollTop = wasTop;
    }
    return bad;
  }, SAT, SAB);

  const screens = [
    ['50-inset-kitchen', () => { App.setView('kitchen'); }],
    ['51-inset-recipes', () => { App.setView('recipes'); }],
    ['52-inset-cultures', () => { App.setView('cultures'); }],
    ['53-inset-guide', () => { App.setView('guide'); }],
    ['54-inset-batch', () => { App.setView('kitchen'); App.push({ screen: 'batch', id: 'b-kimchi' }); }],
    ['55-inset-culture', () => { App.setView('cultures'); App.push({ screen: 'culture', id: 'c-brenda' }); }],
    ['56-inset-recipe', () => { App.setView('recipes'); App.push({ screen: 'recipe', id: 'mead' }); }],
    ['57-inset-topic', () => { App.setView('guide'); App.push({ screen: 'topic', kind: 'triage', id: 't-mold' }); }],
    ['58-inset-settings', () => { App.setView('kitchen'); App.push({ screen: 'settings' }); }]
  ];

  for (const [name, fn] of screens) {
    await page.evaluate(fn);
    await wait(450);
    await shot(name);
    const bad = await audit();
    check(log, name.replace(/^\d+-inset-/, '') + ' clears both bars',
      bad.top.length === 0 && bad.bottom.length === 0, JSON.stringify(bad));
  }

  /* the sheet, which sits above everything */
  await page.evaluate(() => { App.setView('cultures'); App.push({ screen: 'culture', id: 'c-brenda' }); });
  await wait(400);
  await page.evaluate(() => document.querySelector('[data-act="schedule"]').click());
  await wait(400);
  await shot('59-inset-sheet');
  const sheet = await page.evaluate((sab) => {
    const p = document.querySelector('.sheet-panel');
    const last = p.querySelector('#sheetFoot .btn:last-child').getBoundingClientRect();
    return { gap: Math.round(window.innerHeight - last.bottom), sab: sab };
  }, SAB);
  check(log, 'the sheet keeps its buttons above the navigation bar', sheet.gap >= SAB, JSON.stringify(sheet));

  /* the camera, which is full bleed */
  await page.evaluate(() => { document.querySelector('#sheetX').click(); });
  await wait(200);
  await page.evaluate(() => document.querySelector('[data-act="photo"]').click());
  await wait(1600);
  await shot('60-inset-capture');
  const cap = await page.evaluate((sat, sab) => {
    const title = document.querySelector('#capTitle').getBoundingClientRect();
    const back = document.querySelector('#capBack').getBoundingClientRect();
    const shut = document.querySelector('#capShoot').getBoundingClientRect();
    return { titleTop: Math.round(title.top), backTop: Math.round(back.top),
             shutterBottom: Math.round(window.innerHeight - shut.bottom), sat: sat, sab: sab };
  }, SAT, SAB);
  check(log, 'the camera title clears the status bar', cap.titleTop >= SAT && cap.backTop >= SAT - 2, JSON.stringify(cap));
  check(log, 'the shutter clears the navigation bar', cap.shutterBottom >= SAB, JSON.stringify(cap));
  await page.evaluate(() => App.back());
  await wait(300);

  /* the toast */
  await page.evaluate(() => App.toast('Checking the toast sits above the bar.'));
  await wait(300);
  const toast = await page.evaluate((sab) => {
    const t = document.querySelector('#toast').getBoundingClientRect();
    return Math.round(window.innerHeight - t.bottom) >= sab;
  }, SAB);
  check(log, 'the toast clears the navigation bar', toast);

  report(log);
};
