/* Phase one of the upgrade proof. This runs against the SHIPPED 1.0.0 build (git archive of the
   first commit, served from a scratch directory), drives it through its own screens with real
   clicks, and dumps the localStorage record and the IndexedDB photographs to disk exactly as
   1.0.0 wrote them. review-02-upgrade.js then loads the 1.0.1 build on top of that dump.
   Nothing here touches the new code, so the fixture cannot be contaminated by it. */

const { check, report, sheetBtn, vclick, byText, setVal, dumpAll, save } = require('./review-lib');

module.exports = async ({ page, shot, wait, text, click, errors, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(300);

  /* ---------- onboarding: the fresh path ---------- */
  await vclick(page, '#welcomePaths [data-path="fresh"]');
  await wait(400);

  /* ---------- a batch, started from a recipe, with readings and a stage move ---------- */
  await vclick(page, '[data-recipe="sauerkraut"]');
  await wait(300);
  await vclick(page, '[data-act="startbatch"]');
  await wait(250);
  await setVal(page, '#bn', 'Winter kraut');
  await setVal(page, '#ba', '1400');
  await sheetBtn(page, 'Start it');
  await wait(450);

  await vclick(page, '.task[data-task="0"]');
  await wait(120);
  await vclick(page, '.task[data-task="1"]');
  await wait(150);

  await vclick(page, '.chip[data-log="temp"]');
  await wait(200); await setVal(page, '#lv', '20.5'); await setVal(page, '#lt', 'By the back door');
  await sheetBtn(page, 'Save'); await wait(300);

  await vclick(page, '.chip[data-log="salinity"]');
  await wait(200); await setVal(page, '#lv', '2.2');
  await sheetBtn(page, 'Save'); await wait(300);

  await vclick(page, '.chip[data-log="temp"]');
  await wait(200); await setVal(page, '#lv', '19');
  await sheetBtn(page, 'Save'); await wait(300);

  await byText(page, '.btn', 'Move on to');
  await wait(400);

  /* a journal photograph from the fake camera, so IndexedDB has a record too */
  await vclick(page, '.chip[data-act="photo"]');
  await wait(1400);
  await vclick(page, '#capShoot');
  await wait(1200);

  const photoLine = await text('#batchBody');
  check(log, '1.0.0 wrote a photo log', /Photo/.test(photoLine));

  /* ---------- a second batch that gets closed out ---------- */
  await page.evaluate(() => App.setView('recipes'));
  await wait(250);
  await vclick(page, '[data-recipe="baechu"]');
  await wait(300);
  await vclick(page, '[data-act="startbatch"]');
  await wait(250);
  await setVal(page, '#bn', 'Autumn baechu');
  await sheetBtn(page, 'Start it');
  await wait(400);
  for (let i = 0; i < 3; i++) { await byText(page, '.btn', 'Move on to'); await wait(350); }
  await byText(page, '.btn', 'Record how it turned out');
  await wait(250);
  await page.evaluate(() => document.querySelector('#rateRow button[data-rate="4"]').click());
  await setVal(page, '#on', 'Sour, crunchy, right.');
  await setVal(page, '#ox', 'Less gochugaru.');
  await sheetBtn(page, 'Close the batch');
  await wait(400);

  /* ---------- cultures: add, feed, log, split, gift, retire ---------- */
  await page.evaluate(() => App.setView('cultures'));
  await wait(250);
  await vclick(page, '[data-act="newculture"]');
  await wait(250);
  await setVal(page, '#cn', 'Brenda');
  await setVal(page, '#ck', 'starter');
  await setVal(page, '#cb', new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10));
  await setVal(page, '#co', 'A jar from my neighbour');
  await sheetBtn(page, 'Add it');
  await wait(500);

  await vclick(page, '[data-act="feed"]');
  await wait(300);
  await vclick(page, '.chip[data-log="temp"]');
  await wait(200); await setVal(page, '#lv', '22');
  await sheetBtn(page, 'Save'); await wait(300);

  await vclick(page, '[data-act="split"]');
  await wait(250);
  await setVal(page, '#sn', 'Little Brenda');
  await sheetBtn(page, 'Split it');
  await wait(500);
  // Back to the parent jar. 1.0.0 replaced the stack top here rather than pushing, so the
  // Back button lands somewhere different in the two builds: navigate by id instead.
  await page.evaluate(() => {
    const c = Store.cultures().find(x => x.name === 'Brenda');
    App.setView('cultures'); App.push({ screen: 'culture', id: c.id });
  });
  await wait(400);

  await vclick(page, '[data-act="gift"]');
  await wait(250);
  await setVal(page, '#gw', 'Maria');
  await sheetBtn(page, 'Make the card');
  await wait(300);
  const code = await page.evaluate(() => document.querySelector('#gout').value);
  check(log, '1.0.0 made a culture card', /^FRMT1\./.test(code), code.slice(0, 12));
  await sheetBtn(page, 'Done');
  await wait(300);

  /* claim the card back so an inherited-ancestry record exists in the fixture */
  await page.evaluate(() => App.setView('cultures'));
  await wait(200);
  await vclick(page, '[data-act="claim"]');
  await wait(250);
  await setVal(page, '#gc', code);
  await setVal(page, '#gn', "Maria's jar");
  await sheetBtn(page, 'Claim it');
  await wait(500);
  await vclick(page, '[data-act="retire"]');
  await wait(400);

  /* ---------- settings: a non-default preference, so it can be proved to survive ---------- */
  await page.evaluate(() => App.setView('kitchen'));
  await wait(200);
  await vclick(page, '#settingsBtn');
  await wait(300);
  await setVal(page, '#ktemp', '25');
  await page.evaluate(() => document.querySelector('[data-unit="F"]').click());
  await wait(300);
  await page.evaluate(() => { document.querySelector('#hapChk').checked = false;
    document.querySelector('#hapChk').dispatchEvent(new Event('change', { bubbles: true })); });
  await wait(300);
  await shot('r00-100-settings');

  const dump = await dumpAll(page);
  const parsed = JSON.parse(dump.raw);
  check(log, '1.0.0 record has both batches', parsed.batches.length === 2, String(parsed.batches.length));
  check(log, '1.0.0 record has three cultures', parsed.cultures.length === 3, String(parsed.cultures.length));
  check(log, '1.0.0 record kept the unit change', parsed.settings.unit === 'F', parsed.settings.unit);
  check(log, '1.0.0 record kept the kitchen temperature', parsed.settings.kitchenTempC === 25, String(parsed.settings.kitchenTempC));
  check(log, '1.0.0 stored a photograph in IndexedDB', Object.keys(dump.photos).length === 1,
        String(Object.keys(dump.photos).length));
  save('ferment-100-dump.json', dump);
  log('wrote the 1.0.0 fixture, ' + dump.raw.length + ' bytes of localStorage');

  check(log, 'the 1.0.0 run itself was clean', errors.length === 0, errors.join(' | '));
  report(log);
};
