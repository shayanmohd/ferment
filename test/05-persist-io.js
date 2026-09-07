/* Persistence across a reload and across a brand new tab, the export and import round trip
   through both Native.saveFile and the browser download path, and the reminder rules. */
const fs = require('fs');
const path = require('path');
const { withNative, check, report } = require('./lib');

const SEED = fs.readFileSync(path.join(__dirname, '..', 'store', 'seed.js'), 'utf8');

module.exports = async ({ page, shot, wait, text, log, browser }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(SEED);
  await withNative(page);
  await wait(500);

  const snapshot = () => page.evaluate(() => ({
    cultures: Store.cultures().length,
    batches: Store.batches().length,
    logs: Store.cultures().concat(Store.batches()).reduce((a, o) => a + o.logs.length, 0)
  }));
  const before = await snapshot();
  check(log, 'the seeded notebook is there', before.cultures === 5 && before.batches === 5, JSON.stringify(before));

  /* ---------- reload ---------- */
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(400);
  const afterReload = await snapshot();
  check(log, 'a reload keeps everything', JSON.stringify(afterReload) === JSON.stringify(before), JSON.stringify(afterReload));

  /* ---------- a genuinely new tab, as if the app were killed and relaunched ---------- */
  const tab2 = await browser.newPage();
  await tab2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await tab2.goto(page.url(), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 700));
  const afterRelaunch = await tab2.evaluate(() => ({
    cultures: Store.cultures().length,
    batches: Store.batches().length,
    logs: Store.cultures().concat(Store.batches()).reduce((a, o) => a + o.logs.length, 0),
    brenda: Store.culture('c-brenda').name,
    peak: Store.risePeak(Store.culture('c-brenda')).ratio
  }));
  check(log, 'a fresh tab sees the same notebook', afterRelaunch.cultures === 5 && afterRelaunch.logs === before.logs, JSON.stringify(afterRelaunch));
  check(log, 'the rise peak survives a relaunch', afterRelaunch.peak === 2.46, String(afterRelaunch.peak));
  await tab2.close();

  /* ---------- export through the native bridge ---------- */
  await page.evaluate(() => { App.setView('kitchen'); App.push({ screen: 'settings' }); });
  await wait(500);
  await page.evaluate(() => document.querySelector('[data-act="exporttext"]').click());
  await wait(300);
  await page.evaluate(() => document.querySelector('[data-act="exportjson"]').click());
  await wait(300);
  const saved = await page.evaluate(() => window.__native.saved);
  check(log, 'the text export goes to Downloads', saved[0] && saved[0].name === 'ferment-notebook.txt' && saved[0].mime === 'text/plain', JSON.stringify(saved[0]));
  check(log, 'the backup goes to Downloads', saved[1] && saved[1].name === 'ferment-backup.json', JSON.stringify(saved[1]));

  const txt = await page.evaluate(() => Store.exportText());
  check(log, 'the text export names every culture', ['Brenda', 'Rye Brenda', 'Nell', 'Ferdinand'].every(n => txt.indexOf(n) >= 0));
  check(log, 'the text export carries the lineage', /Lineage: /.test(txt));
  check(log, 'the text export has no em or en dash', !/[–—]/.test(txt));

  /* ---------- the browser download path, with no Native ---------- */
  const web = await browser.newPage();
  await web.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await web.evaluateOnNewDocument(() => {
    window.__clicks = [];
    const real = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      window.__clicks.push({ download: this.download, href: String(this.href).slice(0, 5) });
      return real.call(this);
    };
  });
  await web.goto(page.url(), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const dl = await web.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    App.setView('kitchen'); App.push({ screen: 'settings' }); await w(400);
    document.querySelector('[data-act="exportjson"]').click(); await w(300);
    return { native: !!window.Native, clicks: window.__clicks, toast: document.querySelector('#toast').textContent };
  });
  check(log, 'without a native bridge the export falls back to a download', !dl.native && dl.clicks.length === 1, JSON.stringify(dl));
  check(log, 'the download is named and is an object URL', dl.clicks[0] && dl.clicks[0].download === 'ferment-backup.json' && dl.clicks[0].href === 'blob:', JSON.stringify(dl.clicks));

  /* ---------- import round trip ---------- */
  const round = await page.evaluate(() => {
    const json = Store.exportJSON();
    const before = { c: Store.cultures().length, b: Store.batches().length, unit: Store.settings().unit };
    Store.eraseAll();
    const empty = Store.isEmpty();
    const ok = Store.importJSON(json);
    const after = { c: Store.cultures().length, b: Store.batches().length, unit: Store.settings().unit };
    return { before, empty, ok, after, junk: Store.importJSON('not json at all'), half: Store.importJSON('{"batches":[]}') };
  });
  check(log, 'erase empties the notebook', round.empty === true);
  check(log, 'a backup restores every record', round.ok === true && JSON.stringify(round.before) === JSON.stringify(round.after), JSON.stringify(round));
  check(log, 'a file that is not JSON is refused', round.junk === false);
  check(log, 'a JSON file that is not a Ferment backup is refused', round.half === false);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  const restored = await snapshot();
  check(log, 'the restored notebook survives a reload', JSON.stringify(restored) === JSON.stringify(before), JSON.stringify(restored));

  /* ---------- the reminder plan ---------- */
  const plan = await page.evaluate(() => {
    const p = Store.reminderPlan();
    return {
      n: p.length,
      past: p.filter(x => x.at <= Date.now()).length,
      ids: new Set(p.map(x => x.id)).size,
      sorted: p.every((x, i) => i === 0 || x.at >= p[i - 1].at),
      titled: p.every(x => x.title && x.body),
      off: (Store.setSetting('notify', false), Store.reminderPlan().length)
    };
  });
  check(log, 'the plan never exceeds 64 entries', plan.n <= 64, String(plan.n));
  check(log, 'nothing is scheduled in the past', plan.past === 0);
  check(log, 'every alarm id is distinct', plan.ids === plan.n, plan.ids + ' of ' + plan.n);
  check(log, 'the plan is in time order', plan.sorted);
  check(log, 'every alarm has a title and a body', plan.titled);
  check(log, 'turning reminders off empties the plan', plan.off === 0, String(plan.off));
  const cancelled = await page.evaluate(() => { Store.setSetting('notify', true); App.refresh(); return window.__native.scheduled.length; });
  check(log, 'turning them back on schedules again', cancelled > 0, String(cancelled));

  // A busy notebook must still fit under the cap.
  const busy = await page.evaluate(() => {
    for (let i = 0; i < 30; i++) Store.addCulture({ name: 'Jar ' + i, kind: 'starter' });
    const p = Store.reminderPlan();
    return { n: p.length, past: p.filter(x => x.at <= Date.now()).length, cultures: Store.cultures().length };
  });
  check(log, 'thirty five cultures still fit the 64 alarm cap', busy.n <= 64 && busy.past === 0, JSON.stringify(busy));
  await wait(200);
  await web.close();
  report(log);
};
