/* Edges. Rapid double taps on every primary button, empty and absurd input, duplicate names,
   dates in the past and the future, deletion while a screen is open, and the reminder plan under
   a load that would blow past 64 alarms. */

const { check, report, sheetBtn, vclick, byText, setVal, NATIVE } = require('./review-lib');

/* Two clicks 40ms apart: what a real double tap delivers. */
async function doubleTap(page, sel) {
  await page.evaluate(async s => {
    const el = Array.prototype.slice.call(document.querySelectorAll(s)).find(x => x.getClientRects().length);
    if (!el) throw new Error('no visible ' + s);
    el.click();
    await new Promise(r => setTimeout(r, 40));
    const again = Array.prototype.slice.call(document.querySelectorAll(s)).find(x => x.getClientRects().length);
    if (again) again.click();
  }, sel);
}
async function doubleTapText(page, sel, label) {
  await page.evaluate(async (s, l) => {
    const find = () => Array.prototype.slice.call(document.querySelectorAll(s))
      .find(x => x.textContent.trim().indexOf(l) === 0 && x.getClientRects().length);
    const a = find();
    if (!a) throw new Error('no ' + s + ' "' + l + '"');
    a.click();
    await new Promise(r => setTimeout(r, 40));
    const b = find();
    if (b) b.click();
  }, sel, label);
}

module.exports = async ({ page, shot, wait, text, errors, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await page.evaluate(() => indexedDB.deleteDatabase('ferment-photos'));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  await vclick(page, '#welcomePaths [data-path="fresh"]');
  await wait(400);

  /* ---------- double tap: start a batch ---------- */
  await vclick(page, '[data-recipe="sauerkraut"]');
  await wait(300);
  await vclick(page, '[data-act="startbatch"]');
  await wait(300);
  await page.evaluate(async () => {
    const b = Array.prototype.slice.call(document.querySelectorAll('#sheetFoot button'))
      .find(x => x.textContent.trim() === 'Start it');
    b.click();
    await new Promise(r => setTimeout(r, 40));
    b.click();
  });
  await wait(700);
  check(log, 'a double tap on "Start it" makes one batch',
        await page.evaluate(() => Store.batches().length) === 1,
        String(await page.evaluate(() => Store.batches().length)));

  /* ---------- double tap: advance a stage ---------- */
  const stageBefore = await page.evaluate(() => Store.batches()[0].stageIndex);
  await doubleTapText(page, '.btn', 'Move on to');
  await wait(700);
  const stageAfter = await page.evaluate(() => Store.batches()[0].stageIndex);
  check(log, 'a double tap on "Move on to" advances exactly one stage',
        stageAfter === stageBefore + 1, stageBefore + ' -> ' + stageAfter);

  /* ---------- double tap: step back ---------- */
  await doubleTapText(page, '.btn', 'Step back');
  await wait(700);
  check(log, 'a double tap on "Step back" steps back exactly one stage',
        await page.evaluate(() => Store.batches()[0].stageIndex) === stageBefore,
        String(await page.evaluate(() => Store.batches()[0].stageIndex)));

  /* ---------- double tap: the camera shutter ---------- */
  await vclick(page, '.chip[data-act="photo"]');
  await wait(1600);
  await doubleTap(page, '#capShoot');
  await wait(1800);
  const photos = await page.evaluate(async () => ({
    logs: Store.batches()[0].logs.filter(l => l.photoId).length,
    idb: (await Photos.keys()).length
  }));
  check(log, 'a double tap on the shutter saves exactly one photograph',
        photos.logs === 1 && photos.idb === 1, JSON.stringify(photos));
  await page.evaluate(() => { if (Capture.isOpen()) App.back(); });
  await wait(400);

  /* ---------- double tap: log something ---------- */
  await vclick(page, '.chip[data-log="temp"]');
  await wait(300);
  await setVal(page, '#lv', '21');
  await page.evaluate(async () => {
    const b = Array.prototype.slice.call(document.querySelectorAll('#sheetFoot button'))
      .find(x => x.textContent.trim() === 'Save');
    b.click();
    await new Promise(r => setTimeout(r, 40));
    b.click();
  });
  await wait(600);
  check(log, 'a double tap on "Save" writes one reading',
        await page.evaluate(() => Store.batches()[0].logs.filter(l => l.kind === 'temp').length) === 1,
        String(await page.evaluate(() => Store.batches()[0].logs.filter(l => l.kind === 'temp').length)));

  /* ---------- rubbish input ---------- */
  await vclick(page, '.chip[data-log="ph"]');
  await wait(300);
  await sheetBtn(page, 'Save');
  await wait(300);
  check(log, 'an empty number is refused, and the sheet stays open',
        await page.evaluate(() => !document.querySelector('#sheet').hidden));
  await setVal(page, '#lv', '99999');
  await sheetBtn(page, 'Save');
  await wait(300);
  check(log, 'an out of range number is refused',
        await page.evaluate(() => !document.querySelector('#sheet').hidden &&
              Store.batches()[0].logs.filter(l => l.kind === 'ph').length === 0));
  await setVal(page, '#lv', '-4');
  await sheetBtn(page, 'Save');
  await wait(300);
  check(log, 'a negative pH is refused',
        await page.evaluate(() => Store.batches()[0].logs.filter(l => l.kind === 'ph').length) === 0);
  await setVal(page, '#lv', '3.6');
  await setVal(page, '#lt', 'x'.repeat(600));
  await sheetBtn(page, 'Save');
  await wait(500);
  check(log, 'a 600 character note is accepted and stored whole',
        await page.evaluate(() => {
          const l = Store.batches()[0].logs.find(x => x.kind === 'ph');
          return !!l && l.text.length === 600;
        }));
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('#batchBody');
    return el.scrollWidth <= el.clientWidth + 1;
  });
  check(log, 'a very long note does not push the page sideways', overflow);
  await shot('r06-longnote');

  /* ---------- the recipe calculator ---------- */
  await page.evaluate(() => { App.setView('recipes'); App.push({ screen: 'recipe', id: 'sauerkraut' }); });
  await wait(500);
  await setVal(page, '#calcIn', '0');
  await wait(200);
  await setVal(page, '#calcIn', '-50');
  await wait(200);
  await setVal(page, '#calcIn', '');
  await wait(200);
  const calcOk = await page.evaluate(() => {
    const cells = Array.prototype.slice.call(document.querySelectorAll('#recipeBody td.n'));
    return cells.every(c => c.textContent === 'one' || /^[0-9.]+$/.test(c.textContent));
  });
  check(log, 'zero, negative and empty amounts never put NaN in the table', calcOk);
  await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) document.querySelector('[data-calc="-"]').click();
  });
  await wait(300);
  const floor = await page.evaluate(() => parseFloat(document.querySelector('#calcIn').value));
  check(log, 'the stepper cannot go below one step', floor > 0, String(floor));
  await shot('r06-calc');

  /* ---------- cultures: empty name, duplicate name, a birthday in the future ---------- */
  await page.evaluate(() => App.setView('cultures'));
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(300);
  await sheetBtn(page, 'Add it');
  await wait(300);
  check(log, 'a culture with no name is refused',
        await page.evaluate(() => Store.cultures().length) === 0);
  await setVal(page, '#cn', '   ');
  await sheetBtn(page, 'Add it');
  await wait(300);
  check(log, 'a culture named only with spaces is refused',
        await page.evaluate(() => Store.cultures().length) === 0);
  await setVal(page, '#cn', 'Gary');
  await setVal(page, '#cb', new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10));
  await sheetBtn(page, 'Add it');
  await wait(600);
  const future = await page.evaluate(() => ({
    age: Store.ageText(Store.cultures()[0].bornAt),
    line: document.querySelector('#cultureBody .rhero .sub').innerText
  }));
  check(log, 'a birthday in the future does not print a negative age',
        !/-/.test(future.age) && !/NaN/.test(future.age), JSON.stringify(future));
  await shot('r06-future-birthday');

  await page.evaluate(() => App.setView('cultures'));
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(300);
  await setVal(page, '#cn', 'Gary');
  await sheetBtn(page, 'Add it');
  await wait(600);
  check(log, 'a duplicate culture name is allowed and makes a second jar',
        await page.evaluate(() => Store.cultures().length) === 2);

  /* a very long name must not break the header or the tree */
  await page.evaluate(() => App.setView('cultures'));
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(300);
  await setVal(page, '#cn', 'Bartholomew '.repeat(12).trim());
  await sheetBtn(page, 'Add it');
  await wait(700);
  const wide = await page.evaluate(() => {
    const b = document.body;
    return { doc: b.scrollWidth <= window.innerWidth + 1,
             top: document.querySelector('#cultureTop').getBoundingClientRect().right <= window.innerWidth + 1 };
  });
  check(log, 'a 143 character name does not push any screen sideways', wide.doc && wide.top, JSON.stringify(wide));
  await shot('r06-longname');

  /* ---------- double tap: split, feed, retire, gift ---------- */
  await doubleTapText(page, '.btn.ghost', 'Split off a jar');
  await wait(400);
  await setVal(page, '#sn', 'Offshoot');
  await page.evaluate(async () => {
    const b = Array.prototype.slice.call(document.querySelectorAll('#sheetFoot button'))
      .find(x => x.textContent.trim() === 'Split it');
    b.click();
    await new Promise(r => setTimeout(r, 40));
    b.click();
  });
  await wait(800);
  check(log, 'a double tap on "Split it" makes one offshoot',
        await page.evaluate(() => Store.cultures().filter(c => c.name === 'Offshoot').length) === 1,
        String(await page.evaluate(() => Store.cultures().length)));

  await doubleTapText(page, '.btn', 'Fed it just now');
  await wait(700);
  check(log, 'a double tap on "Fed it just now" writes one feed',
        await page.evaluate(() => {
          const c = Store.cultures().find(x => x.name === 'Offshoot');
          return c.logs.filter(l => l.kind === 'feed').length;
        }) === 1);

  /* the agenda's own Fed it button */
  await page.evaluate(() => App.setView('kitchen'));
  await wait(600);
  const agFeeds = await page.evaluate(async () => {
    const row = document.querySelector('.ag-row[data-ag-kind="feed"] .ag-do');
    if (!row) return { skip: true };
    const id = row.closest('[data-ag-owner]').dataset.agOwner;
    const before = Store.culture(id).logs.filter(l => l.kind === 'feed').length;
    row.click();
    await new Promise(r => setTimeout(r, 40));
    const again = document.querySelector('.ag-row[data-ag-kind="feed"] .ag-do');
    if (again) again.click();
    await new Promise(r => setTimeout(r, 400));
    return { skip: false, before: before, after: Store.culture(id).logs.filter(l => l.kind === 'feed').length };
  });
  check(log, 'a double tap on the agenda "Fed it" writes one feed',
        agFeeds.skip || agFeeds.after === agFeeds.before + 1, JSON.stringify(agFeeds));

  /* ---------- delete the thing whose page is open ---------- */
  await page.evaluate(() => {
    const c = Store.cultures().find(x => x.name === 'Offshoot');
    App.setView('cultures'); App.push({ screen: 'culture', id: c.id });
  });
  await wait(500);
  await byText(page, '.btn.ghost.danger', 'Delete');
  await wait(300);
  await sheetBtn(page, 'Delete');
  await wait(700);
  const gone = await page.evaluate(() => ({
    n: Store.cultures().filter(c => c.name === 'Offshoot').length,
    page: document.querySelector('#s-culture').hidden
  }));
  check(log, 'deleting the open culture removes it and leaves the page',
        gone.n === 0 && gone.page, JSON.stringify(gone));

  /* ---------- rotate through screens as fast as the app will go ---------- */
  await page.evaluate(() => {
    for (let i = 0; i < 30; i++) {
      App.setView(['kitchen', 'recipes', 'cultures', 'guide'][i % 4]);
      if (i % 3 === 0) App.push({ screen: 'settings' });
      if (i % 5 === 0) App.back();
    }
    App.setView('kitchen');
  });
  await wait(600);
  check(log, 'thirty fast screen changes leave the Kitchen standing',
        await page.evaluate(() => !document.querySelector('#v-kitchen').hidden &&
          document.querySelector('#kBody').innerText.length > 20));

  /* ---------- the alarm plan under load ---------- */
  const plan = await page.evaluate(() => {
    for (let i = 0; i < 30; i++) Store.addCulture({ name: 'Jar ' + i, kind: 'starter' });
    for (let i = 0; i < 12; i++) Store.startBatch(Content.RECIPES[i % 12].id, { title: 'Batch ' + i });
    const p = Store.reminderPlan();
    return { n: p.length, past: p.filter(x => x.at <= Date.now()).length,
             ids: new Set(p.map(x => x.id)).size, sorted: p.every((x, i) => i === 0 || x.at >= p[i - 1].at) };
  });
  check(log, 'the alarm plan never exceeds 64 entries', plan.n <= 64, String(plan.n));
  check(log, 'no alarm is scheduled in the past', plan.past === 0, String(plan.past));
  check(log, 'every alarm has its own id', plan.ids === plan.n, plan.ids + '/' + plan.n);
  check(log, 'the alarm plan is in time order', plan.sorted);
  await page.evaluate(() => App.setView('kitchen'));
  await wait(900);
  await shot('r06-loaded-kitchen');
  check(log, 'the Kitchen still renders with 44 live things',
        await page.evaluate(() => document.querySelectorAll('#kBody .thing').length) > 20);

  check(log, 'the edge run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
