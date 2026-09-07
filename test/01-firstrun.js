/* First run: the welcome screen, each of the four paths, and every empty state. */
const { withNative, check, report } = require('./lib');

module.exports = async ({ page, shot, wait, text, click, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await withNative(page);

  // position:fixed elements have no offsetParent, so ask the layout engine directly.
  const vis = s => page.evaluate(x => {
    const el = document.querySelector(x);
    return !!(el && !el.hidden && el.getClientRects().length > 0);
  }, s);

  check(log, 'welcome shows on a clean install', await vis('#s-welcome'));
  check(log, 'tabs are hidden during first run', !(await vis('#tabs')));
  const paths = await page.$$eval('#welcomePaths button', b => b.length);
  check(log, 'four first-run paths', paths === 4, String(paths));
  await shot('01-welcome');

  // "Just looking" creates nothing.
  await click('#welcomePaths button:nth-child(4)');
  await wait(300);
  check(log, 'looking lands on the guide', await vis('#v-guide'));
  check(log, 'looking creates no data', await page.evaluate(() => Store.isEmpty()));
  await shot('02-guide-firstrun');

  // Every empty view reads.
  await page.evaluate(() => App.setView('kitchen'));
  await wait(250);
  await shot('03-kitchen-empty');
  const kt = await text('#kBody');
  check(log, 'kitchen empty state has words', /Nothing under your care/.test(kt), JSON.stringify(kt.slice(0, 40)));

  await page.evaluate(() => App.setView('cultures'));
  await wait(250);
  await shot('04-cultures-empty');

  await page.evaluate(() => App.setView('recipes'));
  await wait(250);
  await shot('05-ladder');
  const rungs = await page.$$eval('#rBody .rung', b => b.length);
  check(log, 'twelve recipes on the ladder', rungs === 12, String(rungs));

  // The onboarding flag survives, so the welcome does not come back.
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(400);
  check(log, 'welcome does not return after onboarding', !(await vis('#s-welcome')));
  check(log, 'kitchen is the landing view', await vis('#v-kitchen'));

  report(log);
};
