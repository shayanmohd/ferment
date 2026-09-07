/* Edges: empty and very long strings, zero and negative numbers, out-of-range readings,
   duplicate names, future and ancient dates, rapid double taps, fast view switching,
   the back gesture on every nested screen, and onPause / onResume. */
const { withNative, check, report } = require('./lib');

module.exports = async ({ page, shot, wait, text, click, type, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await withNative(page);
  await page.evaluate(() => { Store.setSetting('onboarded', true); App.setView('kitchen'); });
  await wait(300);

  const sheetBtn = async (label) => {
    await page.evaluate(l => {
      const b = Array.prototype.find.call(document.querySelectorAll('#sheetFoot .btn'), x => x.textContent.trim() === l);
      if (b) b.click();
    }, label);
    await wait(220);
  };
  const toastText = () => page.evaluate(() => { const t = document.querySelector('#toast'); return t.hidden ? '' : t.textContent; });
  const sheetOpen = () => page.evaluate(() => !document.querySelector('#sheet').hidden);

  /* ---------- empty and very long names ---------- */
  await page.evaluate(() => document.querySelector('[data-act="newculture"]').click());
  await wait(300);
  await sheetBtn('Add it');
  check(log, 'an empty culture name is refused', await sheetOpen() && /needs a name/i.test(await toastText()), await toastText());
  const LONG = 'Brenda '.repeat(40).trim();
  await page.evaluate(n => { document.querySelector('#cn').value = n; }, LONG);
  await sheetBtn('Add it');
  const long = await page.evaluate(() => Store.cultures()[0].name.length);
  check(log, 'a very long name is stored whole', long === 279, String(long));
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('#cultureTop');
    return el.scrollWidth > 0 && el.getBoundingClientRect().width <= window.innerWidth;
  });
  check(log, 'a very long name does not push the top bar off screen', overflow);
  await shot('40-long-name');

  /* ---------- a duplicate name, and dates at both extremes ---------- */
  await page.evaluate(() => { App.back(); App.setView('cultures'); });
  await wait(300);
  for (const [name, date] of [['Gary', '2019-04-12'], ['Gary', '2099-12-31'], ['Gary', '1901-01-01']]) {
    await page.evaluate(() => document.querySelector('[data-act="newculture"]').click());
    await wait(250);
    await page.evaluate((n, d) => {
      document.querySelector('#cn').value = n;
      document.querySelector('#cb').value = d;
    }, name, date);
    await sheetBtn('Add it');
    await page.evaluate(() => { App.back(); App.setView('cultures'); });
    await wait(250);
  }
  const dupes = await page.evaluate(() => Store.cultures().filter(c => c.name === 'Gary').map(c => Store.ageText(c.bornAt)));
  check(log, 'duplicate names are allowed and distinct', dupes.length === 3, JSON.stringify(dupes));
  check(log, 'a birthday in the future does not print a negative age', !dupes.some(d => /-/.test(d)), JSON.stringify(dupes));
  await shot('41-dates');

  /* ---------- readings out of range ---------- */
  await page.evaluate(() => { App.push({ screen: 'culture', id: Store.cultures()[0].id }); });
  await wait(400);
  for (const [v, want] of [['', 'needs a number'], ['abc', 'needs a number'], ['-40', 'outside'], ['900', 'outside']]) {
    await page.evaluate(() => document.querySelector('[data-log="temp"]').click());
    await wait(220);
    await page.evaluate(x => { document.querySelector('#lv').value = x; }, v);
    await sheetBtn('Save');
    const t = await toastText();
    check(log, 'temperature "' + v + '" is refused', await sheetOpen() && new RegExp(want, 'i').test(t), t);
    await page.evaluate(() => document.querySelector('#sheetX').click());
    await wait(180);
  }
  const zero = await page.evaluate(() => {
    document.querySelector('[data-log="temp"]').click();
    return true;
  });
  await wait(220);
  await page.evaluate(() => { document.querySelector('#lv').value = '0'; });
  await sheetBtn('Save');
  check(log, 'zero is a legal temperature', !(await sheetOpen()) && zero);
  const logged = await page.evaluate(() => Store.logsOfKind(Store.cultures()[0], 'temp').length);
  check(log, 'exactly one temperature was written', logged === 1, String(logged));

  /* ---------- rapid double taps ----------
     Re-queried between taps, because the page re-renders after the first one and a stale
     node would swallow the rest without ever reaching the delegated handler. */
  await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    for (let i = 0; i < 3; i++) { document.querySelector('[data-act="feed"]').click(); await w(70); }
  });
  await wait(400);
  const feeds = await page.evaluate(() => Store.logsOfKind(Store.cultures()[0], 'feed').length);
  check(log, 'three fast taps on "fed it" do not write three feeds', feeds === 1, feeds + ' feeds');

  await page.evaluate(() => { App.back(); App.setView('recipes'); });
  await wait(300);
  await page.evaluate(() => document.querySelector('[data-recipe="sauerkraut"]').click());
  await wait(350);
  await page.evaluate(() => { const b = document.querySelector('[data-act="startbatch"]'); b.click(); b.click(); });
  await wait(300);
  await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    const b = Array.prototype.find.call(document.querySelectorAll('#sheetFoot .btn'), x => x.textContent.trim() === 'Start it');
    b.click(); await w(60); b.click();
  });
  await wait(500);
  const nb = await page.evaluate(() => Store.batches().length);
  check(log, 'a double tap on "start it" makes one batch', nb === 1, nb + ' batches');

  /* ---------- zero and negative amounts ---------- */
  await page.evaluate(() => { App.back(); App.setView('recipes'); });
  await wait(300);
  await page.evaluate(() => document.querySelector('[data-recipe="sauerkraut"]').click());
  await wait(350);
  for (const v of ['0', '-500', '']) {
    await page.evaluate(() => document.querySelector('[data-act="startbatch"]').click());
    await wait(250);
    await page.evaluate(x => { document.querySelector('#ba').value = x; }, v);
    await sheetBtn('Start it');
    check(log, 'an amount of "' + v + '" is refused', await sheetOpen() && /amount/i.test(await toastText()), await toastText());
    await page.evaluate(() => document.querySelector('#sheetX').click());
    await wait(180);
  }
  const stepDown = await page.evaluate(() => {
    App.back();
    return true;
  });
  await wait(250);
  await page.evaluate(() => document.querySelector('[data-recipe="sauerkraut"]').click());
  await wait(350);
  await page.evaluate(() => { for (let i = 0; i < 30; i++) document.querySelector('[data-calc="-"]').click(); });
  await wait(250);
  const calc = await page.evaluate(() => Number(document.querySelector('#calcIn').value));
  check(log, 'the calculator never goes to zero or below', calc > 0 && stepDown, String(calc));
  const negTable = await page.evaluate(() => Array.prototype.some.call(
    document.querySelectorAll('#recipeBody table.lab td.n'), c => /-/.test(c.textContent)));
  check(log, 'the table never shows a negative weight', !negTable);

  /* ---------- back on every nested screen ---------- */
  await page.evaluate(() => { App.back(); App.setView('kitchen'); });
  await wait(300);
  const backs = await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    const out = {};
    const b = Store.batches()[0], c = Store.cultures()[0];
    App.push({ screen: 'batch', id: b.id }); await w(120); out.batch = App.back();
    App.push({ screen: 'culture', id: c.id }); await w(120); out.culture = App.back();
    App.push({ screen: 'recipe', id: 'sauerkraut' }); await w(120); out.recipe = App.back();
    App.push({ screen: 'topic', kind: 'guide', id: 'salt' }); await w(120); out.topic = App.back();
    App.push({ screen: 'topic', kind: 'triage', id: 't-mold' }); await w(120); out.triage = App.back();
    App.push({ screen: 'settings' }); await w(120); out.settings = App.back();
    App.push({ screen: 'culture', id: c.id }); await w(120);
    document.querySelector('[data-act="schedule"]').click(); await w(150);
    out.sheet = App.back();
    out.sheetClosed = document.querySelector('#sheet').hidden;
    out.stillOnCulture = App.back();
    App.setView('guide'); await w(120); out.tab = App.back();
    out.root = App.back();
    return out;
  });
  check(log, 'back leaves a batch', backs.batch === true);
  check(log, 'back leaves a culture', backs.culture === true);
  check(log, 'back leaves a recipe', backs.recipe === true);
  check(log, 'back leaves a guide topic', backs.topic === true);
  check(log, 'back leaves a triage page', backs.triage === true);
  check(log, 'back leaves settings', backs.settings === true);
  check(log, 'back closes an open sheet first', backs.sheet === true && backs.sheetClosed === true);
  check(log, 'back then leaves the page under it', backs.stillOnCulture === true);
  check(log, 'back returns to the kitchen from another tab', backs.tab === true);
  check(log, 'back at the root hands the gesture to Android', backs.root === false);

  const capBack = await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    App.setView('cultures');
    App.push({ screen: 'culture', id: Store.cultures()[0].id }); await w(200);
    document.querySelector('[data-act="photo"]').click(); await w(1400);
    const opened = Capture.isOpen();
    const consumed = App.back();
    await w(200);
    return { opened, consumed, closed: !Capture.isOpen() };
  });
  check(log, 'back closes the camera', capBack.opened && capBack.consumed === true && capBack.closed, JSON.stringify(capBack));

  /* ---------- pause and resume ---------- */
  const pause = await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    document.querySelector('[data-act="photo"]').click(); await w(1400);
    const live = !!(document.querySelector('#camVideo').srcObject);
    App.onPause();
    await w(120);
    const stopped = !document.querySelector('#camVideo').srcObject;
    App.onResume();
    App.onPause(); App.onResume(); App.onResume();
    App.back();
    return { live, stopped, scheduled: window.__native.scheduled.length };
  });
  check(log, 'the camera is live before pause', pause.live);
  check(log, 'onPause stops the camera', pause.stopped);
  check(log, 'onPause and onResume reschedule reminders', pause.scheduled > 0, String(pause.scheduled));

  /* ---------- a restored backup that carries an unknown recipe ---------- */
  const foreign = await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    const db = JSON.parse(localStorage.getItem('ferment.v1'));
    db.batches.push({ id: 'b-foreign', recipeId: 'miso-from-a-later-version', title: 'Barley miso',
      family: 'veg', startedAt: Date.now() - 86400000, logs: [
        { id: 'lf', at: Date.now() - 3600000, kind: 'note', value: null, text: 'Pressed under a weight.', photoId: null, meta: null }] });
    localStorage.setItem('ferment.v1', JSON.stringify(db));
    return true;
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  const foreignOut = await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    const b = Store.batch('b-foreign');
    App.setView('kitchen'); App.push({ screen: 'batch', id: 'b-foreign' }); await w(300);
    return { scale: b.scale, stage: b.stageIndex, state: b.state,
             body: document.querySelector('#batchBody').innerText.slice(0, 60),
             logs: document.querySelectorAll('#batchBody .logrow').length };
  });
  check(log, 'a batch from an unknown recipe is filled in rather than left half made',
    foreignOut.scale && foreignOut.scale.amount > 0 && foreignOut.stage === 0 && foreignOut.state === 'active' && foreign,
    JSON.stringify(foreignOut));
  check(log, 'it explains itself instead of rendering nothing', /not in this app/.test(foreignOut.body), foreignOut.body);
  check(log, 'its log is still readable', foreignOut.logs === 1, String(foreignOut.logs));
  await shot('43-unknown-recipe');
  await page.evaluate(() => { App.back(); });
  await wait(250);

  /* ---------- the camera comes back after a pause ---------- */
  const cam = await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    App.setView('cultures');
    App.push({ screen: 'culture', id: Store.cultures()[0].id }); await w(250);
    document.querySelector('[data-act="photo"]').click(); await w(1400);
    App.onPause(); await w(150);
    const dead = !document.querySelector('#camVideo').srcObject;
    App.onResume(); await w(1400);
    const back = !!document.querySelector('#camVideo').srcObject;
    const shutter = document.querySelector('#capShoot span').textContent;
    const fallback = !document.querySelector('#capFallback').hidden;
    App.back();
    return { dead, back, shutter, fallback };
  });
  check(log, 'the camera really does stop on pause', cam.dead);
  check(log, 'the camera restarts on resume', cam.back, JSON.stringify(cam));
  check(log, 'no file fallback is offered after resuming', !cam.fallback, JSON.stringify(cam));

  /* ---------- fast view switching ---------- */
  const spin = await page.evaluate(async () => {
    const w = m => new Promise(r => setTimeout(r, m));
    const views = ['kitchen', 'recipes', 'cultures', 'guide'];
    for (let i = 0; i < 24; i++) { App.setView(views[i % 4]); await w(12); }
    await w(200);
    const shown = ['kitchen', 'recipes', 'cultures', 'guide'].filter(v => !document.querySelector('#v-' + v).hidden);
    return shown;
  });
  check(log, 'fast tab switching leaves exactly one view up', spin.length === 1, JSON.stringify(spin));
  await wait(300);
  await shot('42-after-spin');

  report(log);
};
