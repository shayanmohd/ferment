/* window.App.back() on every nested screen, plus the shell's other two hooks.
   back() must return true whenever the app consumed the gesture and false only at the root,
   and onPause/onResume must not throw and must do the right thing with the camera. */

const { check, report, sheetBtn, vclick, setVal, NATIVE, seedDump, seedPhotos, read } = require('./review-lib');

module.exports = async ({ page, shot, wait, text, errors, log }) => {
  const dump = read('ferment-100-dump.json');
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await seedDump(page, dump);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  await seedPhotos(page, dump);

  check(log, 'window.App exists with all three hooks', await page.evaluate(
    () => !!(window.App && typeof App.back === 'function' && typeof App.onPause === 'function' &&
             typeof App.onResume === 'function')));

  const ids = await page.evaluate(() => ({
    b: Store.batches()[0].id, c: Store.cultures()[0].id
  }));

  /* ---------- the root ---------- */
  await page.evaluate(() => App.setView('kitchen'));
  await wait(400);
  check(log, 'back() is false at the root', await page.evaluate(() => App.back()) === false);

  /* ---------- a non-default tab returns to the Kitchen first ---------- */
  for (const v of ['recipes', 'cultures', 'guide']) {
    const r = await page.evaluate(view => {
      App.setView(view);
      const took = App.back();
      return { took: took, kitchen: !document.querySelector('#v-kitchen').hidden };
    }, v);
    check(log, 'back() from the ' + v + ' tab returns to the Kitchen', r.took && r.kitchen, JSON.stringify(r));
  }

  /* ---------- every pushed page ---------- */
  const pages = [
    ['batch', () => ({ screen: 'batch', id: null })],
    ['culture', null], ['recipe', null], ['topic guide', null], ['topic triage', null], ['settings', null]
  ];
  const nested = await page.evaluate(ids => {
    const out = [];
    const trial = (name, p) => {
      App.setView('kitchen');
      App.push(p);
      const visible = document.querySelector('#s-' + (p.screen)).hidden === false;
      const took = App.back();
      const gone = document.querySelector('#s-' + (p.screen)).hidden === true;
      out.push({ name: name, visible: visible, took: took, gone: gone });
    };
    trial('batch', { screen: 'batch', id: ids.b });
    trial('culture', { screen: 'culture', id: ids.c });
    trial('recipe', { screen: 'recipe', id: 'sauerkraut' });
    trial('guide topic', { screen: 'topic', kind: 'guide', id: Content.GUIDE[0].id });
    trial('triage topic', { screen: 'topic', kind: 'triage', id: Content.TRIAGE[0].id });
    trial('settings', { screen: 'settings' });
    return out;
  }, ids);
  for (const n of nested)
    check(log, 'back() closes the ' + n.name + ' screen and returns true',
          n.visible && n.took === true && n.gone, JSON.stringify(n));

  /* ---------- two deep ---------- */
  const deep = await page.evaluate(ids => {
    App.setView('cultures');
    App.push({ screen: 'culture', id: ids.c });
    App.push({ screen: 'settings' });
    const a = App.back();
    const onCulture = !document.querySelector('#s-culture').hidden;
    const b = App.back();
    const onList = !document.querySelector('#v-cultures').hidden && document.querySelector('#s-culture').hidden;
    const c = App.back();
    return { a, onCulture, b, onList, c };
  }, ids);
  check(log, 'back() unwinds a two deep stack one screen at a time',
        deep.a && deep.onCulture && deep.b && deep.onList && deep.c === true, JSON.stringify(deep));

  /* ---------- an open sheet ---------- */
  await page.evaluate(() => App.setView('cultures'));
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(300);
  const sheet = await page.evaluate(() => {
    const took = App.back();
    return { took: took, hidden: document.querySelector('#sheet').hidden };
  });
  check(log, 'back() closes an open sheet and returns true', sheet.took && sheet.hidden, JSON.stringify(sheet));

  /* ---------- the camera ---------- */
  await page.evaluate(id => { App.setView('cultures'); App.push({ screen: 'culture', id: id }); }, ids.c);
  await wait(400);
  await vclick(page, '.chip[data-act="photo"]');
  await wait(1400);
  const camOpen = await page.evaluate(() => ({
    open: Capture.isOpen(),
    live: !!(document.querySelector('#camVideo').srcObject)
  }));
  check(log, 'the camera opens with a live stream', camOpen.open && camOpen.live, JSON.stringify(camOpen));

  /* onPause must stop the stream, onResume must bring it back */
  await page.evaluate(() => App.onPause());
  await wait(300);
  const paused = await page.evaluate(() => ({
    stream: !!document.querySelector('#camVideo').srcObject, open: Capture.isOpen()
  }));
  check(log, 'onPause stops the camera without closing the screen', !paused.stream && paused.open, JSON.stringify(paused));
  await page.evaluate(() => App.onResume());
  await wait(1400);
  const resumed = await page.evaluate(() => {
    const v = document.querySelector('#camVideo');
    return { stream: !!v.srcObject, playing: v.videoWidth > 0 && !v.paused };
  });
  check(log, 'onResume restarts the camera', resumed.stream && resumed.playing, JSON.stringify(resumed));
  await shot('r03-camera-resumed');

  const camBack = await page.evaluate(() => {
    const took = App.back();
    return { took: took, open: Capture.isOpen(), stream: !!document.querySelector('#camVideo').srcObject };
  });
  check(log, 'back() closes the camera, returns true and releases the stream',
        camBack.took && !camBack.open && !camBack.stream, JSON.stringify(camBack));

  /* ---------- onPause and onResume from every screen ---------- */
  const cycled = await page.evaluate(ids => {
    const screens = [
      () => App.setView('kitchen'), () => App.setView('recipes'), () => App.setView('cultures'),
      () => App.setView('guide'),
      () => App.push({ screen: 'batch', id: ids.b }), () => App.push({ screen: 'culture', id: ids.c }),
      () => App.push({ screen: 'recipe', id: 'mead' }), () => App.push({ screen: 'settings' })
    ];
    for (const s of screens) { s(); App.onPause(); App.onResume(); }
    return true;
  }, ids);
  check(log, 'onPause and onResume are safe on every screen', cycled);
  check(log, 'the reminder plan is re-sent on every resume',
        await page.evaluate(() => window.__native.scheduled.length > 0));

  check(log, 'the back and lifecycle run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
