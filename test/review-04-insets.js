/* Safe areas. The shell injects --sat and --sab; WebView padding does not move fixed content,
   so every fixed bar has to carry the inset itself. With a 48px status bar and a 34px navigation
   bar: no fixed chrome inside either band, the scroller must start below the status bar, and the
   bottom of a long screen must be reachable clear of the navigation bar. */

const { check, report, vclick, NATIVE, seedDump, seedPhotos, read } = require('./review-lib');

const SAT = 48, SAB = 34;
const INSETS = (t, b) => {
  const put = () => {
    if (!document.documentElement) return;
    document.documentElement.style.setProperty('--sat', t + 'px');
    document.documentElement.style.setProperty('--sab', b + 'px');
  };
  put();
  document.addEventListener('DOMContentLoaded', put);
};

/* Runs in the page. Measures the screen that is actually on top. */
function measure(sat, sab) {
  const H = window.innerHeight;
  const vis = el => {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const shown = sel => Array.prototype.slice.call(document.querySelectorAll(sel)).filter(vis);
  // the topmost screen: a pushed page, the capture screen, the welcome screen, or the live view
  const top = shown('.screen.capture')[0] || shown('.screen.page').pop() ||
              shown('#s-welcome')[0] || shown('.view')[0];
  const out = { screen: top ? top.id : 'none', bad: [] };
  const say = (what, el, why) => out.bad.push(what + ' ' + why + ' [' +
    (el.innerText || '').slice(0, 22).replace(/\s+/g, ' ') + ']');

  const sc = top.querySelector('.scroller');
  if (sc) {
    sc.scrollTop = 0;
    const first = Array.prototype.slice.call(sc.children).filter(vis)[0];
    if (first) {
      const r = first.getBoundingClientRect();
      if (r.top < sat) say('first content', first, 'top=' + Math.round(r.top) + ' < ' + sat);
    }
    // the very end of a long screen must come clear of the bar
    sc.scrollTop = sc.scrollHeight;
    const kids = Array.prototype.slice.call(sc.children).filter(vis);
    const last = kids[kids.length - 1];
    if (last) {
      const r = last.getBoundingClientRect();
      if (r.bottom > H - sab + 0.5) say('last content when scrolled to the end', last, 'bottom=' + Math.round(r.bottom));
    }
    sc.scrollTop = 0;
  }
  // fixed chrome
  for (const bar of shown('.topbar')) {
    for (const el of bar.querySelectorAll('button, span, svg')) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < sat) say('top bar control', el, 'top=' + Math.round(r.top));
    }
  }
  const tabs = shown('#tabs')[0];
  if (tabs) for (const el of tabs.querySelectorAll('button')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom > H - sab + 0.5) say('tab bar control', el, 'bottom=' + Math.round(r.bottom));
  }
  const foot = shown('.capfoot')[0];
  if (foot) {
    const r = foot.getBoundingClientRect();
    if (r.bottom > H - sab + 0.5) out.bad.push('camera footer bottom=' + Math.round(r.bottom));
  }
  const sheet = shown('.sheet-panel')[0];
  if (sheet) {
    const r = sheet.getBoundingClientRect();
    const btn = sheet.querySelector('.sheet-foot button');
    if (btn && btn.getBoundingClientRect().bottom > H - sab + 0.5)
      out.bad.push('sheet button bottom=' + Math.round(btn.getBoundingClientRect().bottom));
    if (r.top < sat) out.bad.push('sheet panel top=' + Math.round(r.top));
  }
  return out;
}

module.exports = async ({ page, shot, wait, errors, log }) => {
  const dump = read('ferment-100-dump.json');
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await seedDump(page, dump);
  await page.evaluateOnNewDocument(INSETS, SAT, SAB);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  await seedPhotos(page, dump);

  check(log, 'the insets are actually applied',
        await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sat').trim()) === SAT + 'px');

  const screens = [
    ['kitchen', () => App.setView('kitchen')],
    ['recipes', () => App.setView('recipes')],
    ['cultures', () => App.setView('cultures')],
    ['guide', () => App.setView('guide')],
    ['batch', () => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[0].id }); }],
    ['culture', () => { App.setView('cultures'); App.push({ screen: 'culture', id: Store.cultures()[0].id }); }],
    ['recipe', () => { App.setView('recipes'); App.push({ screen: 'recipe', id: 'mead' }); }],
    ['topic', () => { App.setView('guide'); App.push({ screen: 'topic', kind: 'triage', id: Content.TRIAGE[0].id }); }],
    ['settings', () => { App.setView('kitchen'); App.push({ screen: 'settings' }); }]
  ];

  for (const [name, fn] of screens) {
    await page.evaluate('(' + fn.toString() + ')()');
    await wait(500);
    await shot('r04-' + name);
    const m = await page.evaluate(measure, SAT, SAB);
    check(log, name + ' (' + m.screen + ') clears both bars', m.bad.length === 0, m.bad.slice(0, 3).join(' | '));
  }

  /* an open sheet */
  await page.evaluate(() => { App.setView('cultures'); });
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(400);
  await shot('r04-sheet');
  const ms = await page.evaluate(measure, SAT, SAB);
  check(log, 'an open sheet clears both bars', ms.bad.length === 0, ms.bad.slice(0, 3).join(' | '));
  await page.evaluate(() => App.back());
  await wait(300);

  /* the camera, which hides the tab bar and so carries its own bottom inset */
  await page.evaluate(() => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[0].id }); });
  await wait(500);
  await vclick(page, '.chip[data-act="photo"]');
  await wait(1500);
  await shot('r04-capture');
  const mc = await page.evaluate(measure, SAT, SAB);
  check(log, 'the camera clears both bars', mc.bad.length === 0, mc.bad.slice(0, 3).join(' | '));

  const toastCap = await page.evaluate(() => {
    App.toast('Test toast on the camera screen.');
    const r = document.querySelector('#toast').getBoundingClientRect();
    return { bottom: Math.round(r.bottom), h: window.innerHeight };
  });
  check(log, 'the toast clears the navigation bar on the camera screen',
        toastCap.bottom <= toastCap.h - SAB, JSON.stringify(toastCap));
  await shot('r04-capture-toast');

  await page.evaluate(() => { App.back(); App.setView('kitchen'); });
  await wait(400);
  const toastTabs = await page.evaluate(() => {
    App.toast('Test toast on a tabbed screen.');
    const t = document.querySelector('#toast').getBoundingClientRect();
    const n = document.querySelector('#tabs').getBoundingClientRect();
    return { toastBottom: Math.round(t.bottom), tabsTop: Math.round(n.top) };
  });
  check(log, 'the toast sits above the tab bar on a tabbed screen',
        toastTabs.toastBottom <= toastTabs.tabsTop, JSON.stringify(toastTabs));
  await shot('r04-kitchen-toast');

  /* the welcome screen, in a tab with no fixture seeder attached */
  const p2 = await page.browser().newPage();
  await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p2.on('pageerror', e => errors.push('welcome tab: ' + e.message));
  p2.on('console', m => { if (m.type() === 'error') errors.push('welcome tab: ' + m.text()); });
  await p2.evaluateOnNewDocument(INSETS, SAT, SAB);
  await p2.goto(page.url(), { waitUntil: 'networkidle0' });
  await p2.evaluate(() => localStorage.clear());
  await p2.reload({ waitUntil: 'networkidle0' });
  await wait(700);
  const onWelcome = await p2.evaluate(() => !document.querySelector('#s-welcome').hidden);
  check(log, 'the welcome screen was reached for the inset check', onWelcome);
  await p2.screenshot({ path: require('path').join(__dirname, 'shots-review', 'r04-welcome.png') });
  const mw = await p2.evaluate(measure, SAT, SAB);
  check(log, 'the welcome screen clears both bars', mw.bad.length === 0, mw.bad.slice(0, 3).join(' | '));
  await p2.close();

  check(log, 'the inset run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
