/* Two focused probes for suspicions the broad runs raised:
   1. an unbroken 600 character note, and what exactly overflows,
   2. the camera shutter tapped twice inside one animation frame, before the first
      write has resolved, which is what a genuinely fast double tap delivers. */

const { check, report, vclick, setVal, sheetBtn, NATIVE } = require('./review-lib');

module.exports = async ({ page, shot, wait, errors, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await page.evaluate(() => indexedDB.deleteDatabase('ferment-photos'));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  await vclick(page, '#welcomePaths [data-path="fresh"]');
  await wait(400);
  await vclick(page, '[data-recipe="sauerkraut"]');
  await wait(300);
  await vclick(page, '[data-act="startbatch"]');
  await wait(300);
  await sheetBtn(page, 'Start it');
  await wait(700);

  /* ---------- 1. the unbroken note ---------- */
  await vclick(page, '.chip[data-log="note"]');
  await wait(300);
  await setVal(page, '#lt', 'x'.repeat(600));
  await sheetBtn(page, 'Save');
  await wait(600);
  const over = await page.evaluate(() => {
    const out = [];
    const root = document.querySelector('#s-batch');
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > window.innerWidth + 1)
        out.push(el.tagName + '.' + (typeof el.className === 'string' ? el.className : '') +
                 ' w=' + Math.round(r.width));
    }
    return { over: out.slice(0, 6), body: document.body.scrollWidth, win: window.innerWidth };
  });
  check(log, 'an unbroken 600 character note does not widen anything',
        over.over.length === 0 && over.body <= over.win + 1, JSON.stringify(over));
  await shot('r07-note-overflow');

  /* the same string in a culture origin and a batch title */
  await page.evaluate(() => App.setView('cultures'));
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(300);
  await setVal(page, '#cn', 'y'.repeat(120));
  await setVal(page, '#co', 'z'.repeat(400));
  await sheetBtn(page, 'Add it');
  await wait(800);
  const over2 = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('#s-culture *')) {
      const r = el.getBoundingClientRect();
      if (r.width > window.innerWidth + 1)
        out.push(el.tagName + '.' + (typeof el.className === 'string' ? el.className : '') + ' w=' + Math.round(r.width));
    }
    return { over: out.slice(0, 6), body: document.body.scrollWidth, win: window.innerWidth };
  });
  check(log, 'an unbroken name and origin do not widen the culture page',
        over2.over.length === 0 && over2.body <= over2.win + 1, JSON.stringify(over2));
  await shot('r07-culture-overflow');

  /* ---------- 2. the shutter, twice in one frame ---------- */
  await page.evaluate(() => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[0].id }); });
  await wait(500);
  await vclick(page, '.chip[data-act="photo"]');
  await wait(1600);
  const race = await page.evaluate(async () => {
    const b = document.querySelector('#capShoot');
    b.click();
    b.click();                       // same task, before any promise has settled
    await new Promise(r => setTimeout(r, 2000));
    return { logs: Store.batches()[0].logs.filter(l => l.photoId).length,
             idb: (await Photos.keys()).length };
  });
  check(log, 'the shutter tapped twice in one frame saves one photograph',
        race.logs === 1 && race.idb === 1, JSON.stringify(race));
  await page.evaluate(() => { if (Capture.isOpen()) App.back(); });
  await wait(400);
  await shot('r07-after-race');

  check(log, 'the probe run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
