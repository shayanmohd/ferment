/* First run on an empty device, then the whole happy path: every screen, real data on each,
   a reload, and a second reload after the tab has been thrown away. Zero page errors allowed. */

const { check, report, sheetBtn, vclick, byText, setVal, NATIVE } = require('./review-lib');

module.exports = async ({ page, shot, wait, text, errors, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await page.evaluate(() => indexedDB.deleteDatabase('ferment-photos'));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);

  /* ---------- first run ---------- */
  const welcome = await page.evaluate(() => {
    const w = document.querySelector('#s-welcome');
    return { shown: !!w && !w.hidden, tabs: document.querySelector('#tabs').hidden,
             paths: document.querySelectorAll('#welcomePaths [data-path]').length,
             mark: !!document.querySelector('#wm svg') };
  });
  check(log, 'the welcome screen is the first thing shown', welcome.shown && welcome.tabs);
  check(log, 'the welcome offers all four paths', welcome.paths === 4, String(welcome.paths));
  check(log, 'the app mark is drawn on onboarding', welcome.mark);
  await shot('r01-01-welcome');

  await vclick(page, '#welcomePaths [data-path="fresh"]');
  await wait(500);

  /* ---------- the empty states, drawn ---------- */
  await page.evaluate(() => App.setView('kitchen'));
  await wait(500);
  await shot('r01-02-kitchen-empty');
  const emptyK = await page.evaluate(() => ({
    illus: !!document.querySelector('#kBody .empty svg.illus'),
    text: document.querySelector('#kBody').innerText.slice(0, 60)
  }));
  check(log, 'the empty Kitchen is drawn, not text only', emptyK.illus, emptyK.text);

  await page.evaluate(() => App.setView('cultures'));
  await wait(400);
  await shot('r01-03-cultures-empty');
  check(log, 'the empty Cultures screen is drawn',
        await page.evaluate(() => !!document.querySelector('#cBody .empty svg.illus')));

  await page.evaluate(() => App.setView('recipes'));
  await wait(400);
  await shot('r01-04-recipes');
  check(log, 'the ladder lists twelve recipes',
        await page.evaluate(() => document.querySelectorAll('#rBody .rung').length) === 12);

  await page.evaluate(() => App.setView('guide'));
  await wait(400);
  await shot('r01-05-guide');
  check(log, 'the guide draws six triage plates',
        await page.evaluate(() => document.querySelectorAll('#gBody .platebtn svg.plate').length) === 6);

  /* ---------- a real batch ---------- */
  await page.evaluate(() => App.setView('recipes'));
  await wait(300);
  await vclick(page, '[data-recipe="sourdough-loaf"]');
  await wait(400);
  await shot('r01-06-recipe');
  const calcBefore = await text('#recipeBody table.lab');
  await vclick(page, '[data-calc="+"]');
  await wait(200);
  const calcAfter = await text('#recipeBody table.lab');
  check(log, 'the calculator moves the whole table', calcBefore !== calcAfter);

  await vclick(page, '[data-act="startbatch"]');
  await wait(300);
  await setVal(page, '#bn', 'Saturday loaf');
  await sheetBtn(page, 'Start it');
  await wait(600);
  await shot('r01-07-batch');
  check(log, 'starting a batch lands on the batch page',
        await page.evaluate(() => !document.querySelector('#s-batch').hidden));

  await vclick(page, '.task[data-task="0"]');
  await wait(200);
  await vclick(page, '.chip[data-log="temp"]');
  await wait(250); await setVal(page, '#lv', '24.5');
  await sheetBtn(page, 'Save'); await wait(400);
  await vclick(page, '.chip[data-log="temp"]');
  await wait(250); await setVal(page, '#lv', '23.5');
  await sheetBtn(page, 'Save'); await wait(400);
  await vclick(page, '.chip[data-log="temp"]');
  await wait(250); await setVal(page, '#lv', '21');
  await sheetBtn(page, 'Save'); await wait(500);
  await shot('r01-08-batch-chart');
  const chartLabels = await page.evaluate(() => {
    const t = Array.prototype.slice.call(document.querySelectorAll('#batchBody .chartwrap svg text.c-num'));
    return t.map(x => x.textContent);
  });
  check(log, 'the chart axis labels are the readings themselves',
        chartLabels.indexOf('24.5C') >= 0, JSON.stringify(chartLabels));

  /* ---------- a photograph through the camera ---------- */
  await vclick(page, '.chip[data-act="photo"]');
  await wait(1500);
  await shot('r01-09-capture');
  check(log, 'the viewfinder is live', await page.evaluate(() => {
    const v = document.querySelector('#camVideo');
    return !!(v && v.videoWidth > 0 && !v.paused);
  }));
  await vclick(page, '#capShoot');
  await wait(1200);
  const shots = await page.evaluate(() => document.querySelectorAll('#batchBody .strip .shotbtn').length);
  check(log, 'the shutter writes one photograph', shots === 1, String(shots));

  /* ---------- a culture, split, fed ---------- */
  await page.evaluate(() => App.setView('cultures'));
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(300);
  await setVal(page, '#cn', 'Doris');
  await sheetBtn(page, 'Add it');
  await wait(600);
  await shot('r01-10-culture');
  await vclick(page, '[data-act="feed"]');
  await wait(400);
  await vclick(page, '[data-act="split"]');
  await wait(300);
  await setVal(page, '#sn', 'Doris two');
  await sheetBtn(page, 'Split it');
  await wait(600);
  await shot('r01-11-split');
  const backAfterSplit = await page.evaluate(() => {
    App.back();
    const p = document.querySelector('#s-culture');
    return { page: !p.hidden, title: document.querySelector('#cultureTop').textContent };
  });
  check(log, 'backing out of a new offshoot lands on the parent jar',
        backAfterSplit.page && backAfterSplit.title === 'Doris', JSON.stringify(backAfterSplit));
  await wait(400);
  await shot('r01-12-lineage');
  check(log, 'the family tree has both jars',
        await page.evaluate(() => document.querySelectorAll('#cultureBody .tw .tw-node').length) === 2);

  /* ---------- persistence across a reload ---------- */
  const before = await page.evaluate(() => ({
    b: Store.batches().length, c: Store.cultures().length,
    logs: Store.batches()[0].logs.length, photos: Store.photoLogs(Store.batches()[0]).length
  }));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(600);
  const after = await page.evaluate(() => ({
    b: Store.batches().length, c: Store.cultures().length,
    logs: Store.batches()[0].logs.length, photos: Store.photoLogs(Store.batches()[0]).length,
    welcome: !document.querySelector('#s-welcome').hidden
  }));
  check(log, 'everything persists across a reload',
        JSON.stringify(before) === JSON.stringify({ b: after.b, c: after.c, logs: after.logs, photos: after.photos }),
        JSON.stringify(after));
  check(log, 'a returning user never sees onboarding again', !after.welcome);

  /* ---------- and across a brand new page object (the tab thrown away) ---------- */
  const page2 = await page.browser().newPage();
  await page2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page2.on('pageerror', e => errors.push('page2: ' + e.message));
  page2.on('console', m => { if (m.type() === 'error') errors.push('page2: ' + m.text()); });
  await page2.goto(page.url(), { waitUntil: 'networkidle0' });
  await wait(700);
  const fresh = await page2.evaluate(() => ({
    b: Store.batches().length, c: Store.cultures().length,
    kitchen: document.querySelector('#kBody').innerText
  }));
  check(log, 'a new tab reads the same notebook', fresh.b === after.b && fresh.c === after.c, JSON.stringify(fresh.b));
  check(log, 'the Kitchen lists the saved work', /Saturday loaf/.test(fresh.kitchen) && /Doris/.test(fresh.kitchen));
  await page2.close();

  await page.evaluate(() => App.setView('kitchen'));
  await wait(600);
  await shot('r01-13-kitchen-full');

  check(log, 'the whole first run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
