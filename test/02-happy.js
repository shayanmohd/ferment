/* The whole happy path: a culture, a batch, photographs, a rise series, a gift card,
   an outcome, and every reading kind, creating real data on every screen. */
const { withNative, check, report } = require('./lib');

module.exports = async ({ page, shot, wait, text, click, type, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await withNative(page);
  await page.evaluate(() => { if (window.Photos) Photos.clear(); });

  // position:fixed elements have no offsetParent, so ask the layout engine directly.
  const vis = s => page.evaluate(x => {
    const el = document.querySelector(x);
    return !!(el && !el.hidden && el.getClientRects().length > 0);
  }, s);
  const sheetBtn = async (label) => {
    const ok = await page.evaluate(l => {
      const b = Array.prototype.find.call(document.querySelectorAll('#sheetFoot .btn'), x => x.textContent.trim() === l);
      if (!b) return false; b.click(); return true;
    }, label);
    if (!ok) throw new Error('no sheet button "' + label + '"');
    await wait(260);
  };

  /* ---- 1. add a culture ---- */
  await click('#welcomePaths button:nth-child(1)');
  await wait(400);
  check(log, 'the "already alive" path opens the culture sheet', await vis('#sheet'));
  await type('#cn', 'Brenda');
  await page.select('#ck', 'starter');
  await page.evaluate(() => { document.querySelector('#cb').value = '2019-04-12'; });
  await type('#co', 'A jar from a bakery in Trieste.');
  await sheetBtn('Add it');
  check(log, 'culture page opens after adding', await vis('#s-culture'));
  const ct = await text('#cultureBody');
  check(log, 'culture shows its age in years', /years/.test(ct), ct.split('\n')[1]);
  await shot('10-culture-new');

  /* ---- 2. feed it, log a temperature ---- */
  await click('[data-act="feed"]');
  await wait(300);
  await click('[data-log="temp"]');
  await wait(300);
  await type('#lv', '24.5');
  await type('#lt', 'Warm week, back of the counter.');
  await sheetBtn('Save');
  const fed = await page.evaluate(() => {
    const c = Store.cultures()[0];
    return { feeds: Store.logsOfKind(c, 'feed').length, temps: Store.logsOfKind(c, 'temp').length, hours: Store.feedState(c).hours };
  });
  check(log, 'the feed is logged', fed.feeds === 1);
  check(log, 'the temperature is logged', fed.temps === 1);
  check(log, 'a warm kitchen shortens the interval', fed.hours < 12, fed.hours.toFixed(1) + 'h');

  /* ---- 3. camera: journal photo, then the rise lines, then a rise check ---- */
  await click('[data-act="photo"]');
  await wait(1600);
  check(log, 'the camera screen opens', await vis('#s-capture'));
  check(log, 'no camera fallback needed', !(await vis('#capFallback')));
  await shot('11-capture');
  await click('#capShoot');
  await wait(900);
  const shots1 = await page.evaluate(() => Store.photoLogs(Store.cultures()[0]).length);
  check(log, 'the journal photo is stored', shots1 === 1, String(shots1));

  await click('[data-act="risecheck"]');
  await wait(1500);
  check(log, 'the rise check starts in "set the lines"', await page.evaluate(() => !!document.querySelector('#capModes [data-mode="mark"].is-on')));
  await shot('12-capture-marks');
  await click('#capShoot');
  await wait(900);
  check(log, 'the reference lines are stored', await page.evaluate(() => !!Store.cultures()[0].riseRef));

  // Drag the "now" line up and take a rise reading.
  await click('[data-act="risecheck"]');
  await wait(1500);
  const dragged = await page.evaluate(() => {
    const frame = document.querySelector('#camFrame');
    const r = frame.getBoundingClientRect();
    const h = document.querySelector('.mk-live[data-h="now"]');
    if (!h) return null;
    const opts = { bubbles: true, cancelable: true, pointerId: 1 };
    h.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ clientY: r.top + r.height * 0.5 }, opts)));
    window.dispatchEvent(new PointerEvent('pointermove', Object.assign({ clientY: r.top + r.height * 0.30 }, opts)));
    window.dispatchEvent(new PointerEvent('pointerup', opts));
    return document.querySelector('#capRead b').textContent;
  });
  check(log, 'dragging the line reads out a multiple', /x$/.test(dragged || ''), String(dragged));
  await shot('13-capture-rise');
  await click('#capShoot');
  await wait(900);
  const rise = await page.evaluate(() => Store.riseSeries(Store.cultures()[0]).map(p => p.ratio));
  check(log, 'the rise series has both marks', rise.length === 2, JSON.stringify(rise));
  check(log, 'the second mark is above one', rise[1] > 1, String(rise[1]));
  await wait(400);
  await shot('14-culture-rise');

  /* ---- 4. split a jar, gift a card, claim it back ---- */
  await click('[data-act="split"]');
  await wait(300);
  await type('#sn', 'Rye Brenda');
  await sheetBtn('Split it');
  check(log, 'the split jar becomes the open page', /Rye Brenda/.test(await text('#cultureTop')));
  await page.evaluate(() => { App.back(); });
  await wait(400);
  check(log, 'back from a split jar returns to its parent', /Brenda/.test(await text('#cultureTop')) && !/Rye/.test(await text('#cultureTop')), await text('#cultureTop'));
  await click('[data-act="gift"]');
  await wait(300);
  await type('#gw', 'Maria');
  await sheetBtn('Make the card');
  const code = await page.evaluate(() => document.querySelector('#gout').value);
  check(log, 'the culture card is a FRMT1 code', /^FRMT1\./.test(code), code.slice(0, 24));
  await sheetBtn('Done');
  await page.evaluate(() => App.setView('cultures'));
  await wait(400);
  await page.evaluate(() => document.querySelector('#cBody [data-act="claim"]').click());
  await wait(400);
  check(log, 'the claim sheet opens', await vis('#sheet'));
  await page.evaluate(c => { const t = document.querySelector('#gc'); t.value = c; t.dispatchEvent(new Event('input', { bubbles: true })); }, code);
  await wait(200);
  await sheetBtn('Claim it');
  const claimed = await page.evaluate(() => {
    const cs = Store.cultures();
    const kid = cs[cs.length - 1];
    return { n: cs.length, name: kid.name, anc: Store.ancestryOf(kid).length };
  });
  check(log, 'claiming a card creates a jar with ancestry', claimed.n === 3 && claimed.anc >= 1, JSON.stringify(claimed));

  /* ---- 5. a batch from a recipe ---- */
  await page.evaluate(() => App.setView('recipes'));
  await wait(300);
  await click('[data-recipe="sourdough-loaf"]');
  await wait(400);
  await shot('15-recipe');
  await page.evaluate(() => { const i = document.querySelector('#calcIn'); i.value = '900'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(200);
  const readTable = () => page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#recipeBody table.lab tbody tr'),
    r => [r.querySelector('td.pct').textContent, r.querySelector('td.n').textContent]));
  const at900 = await readTable();
  await page.evaluate(() => { const i = document.querySelector('#calcIn'); i.value = '1800'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(200);
  const at1800 = await readTable();
  const linear = at900.every((r, i) => Number(r[1]) * 2 === Number(at1800[i][1]));
  const pctRight = at900.every(r => !Number(r[0]) || Math.abs(Number(r[1]) - 9 * Number(r[0])) < 0.6);
  await page.evaluate(() => { const i = document.querySelector('#calcIn'); i.value = '900'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(150);
  check(log, 'the percentage table scales with the flour weight', linear && pctRight, JSON.stringify(at900));
  await click('[data-act="startbatch"]');
  await wait(300);
  await page.evaluate(() => { document.querySelector('#bn').value = 'Saturday loaf'; });
  await page.select('#bc', await page.evaluate(() => document.querySelector('#bc option:nth-child(2)').value));
  await sheetBtn('Start it');
  check(log, 'the batch page opens', await vis('#s-batch'));
  await shot('16-batch');

  /* ---- 6. tasks, readings, stage moves ---- */
  await click('#batchBody .task');
  await wait(200);
  check(log, 'a task ticks', await page.evaluate(() => document.querySelector('#batchBody .task').classList.contains('is-done')));
  for (const [kind, v] of [['temp', '25'], ['temp', '23.5']]) {
    await click('[data-log="' + kind + '"]');
    await wait(250);
    await type('#lv', v);
    await sheetBtn('Save');
  }
  await click('[data-act="advance"]');
  await wait(400);
  const st = await page.evaluate(() => { const b = Store.batches()[0]; return { i: b.stageIndex, logs: b.logs.length }; });
  check(log, 'the stage moves on and is logged', st.i === 1, JSON.stringify(st));
  await click('[data-act="backstage"]');
  await wait(300);
  check(log, 'the stage steps back', await page.evaluate(() => Store.batches()[0].stageIndex === 0));
  await page.evaluate(() => { for (let i = 0; i < 6; i++) App.refresh && Store.advanceStage(Store.batches()[0].id); App.refresh(); });
  await wait(400);
  const last = await page.evaluate(() => {
    const b = Store.batches()[0], r = Content.recipe(b.recipeId);
    return b.stageIndex === r.stages.length - 1;
  });
  check(log, 'the last stage clamps rather than overflowing', last);
  await wait(200);
  check(log, 'the last stage offers the outcome', await page.evaluate(() => !!document.querySelector('[data-act="outcome"]')));
  await shot('17-batch-charts');

  await click('[data-act="outcome"]');
  await wait(300);
  await page.evaluate(() => document.querySelector('#rateRow [data-rate="4"]').click());
  await type('#on', 'Open crumb, blistered crust.');
  await type('#ox', 'Twenty minutes less bulk.');
  await sheetBtn('Close the batch');
  const done = await page.evaluate(() => { const b = Store.batches()[0]; return { s: b.state, r: b.outcome && b.outcome.rating }; });
  check(log, 'the batch closes out with a rating', done.s === 'done' && done.r === 4, JSON.stringify(done));

  /* ---- 7. the kitchen with real data ---- */
  await page.evaluate(() => { App.back(); });
  await wait(400);
  await page.evaluate(() => App.setView('kitchen'));
  await wait(400);
  await shot('18-kitchen-full');
  const rows = await page.$$eval('#kBody .ag-row', b => b.length);
  check(log, 'the agenda lists what is next', rows > 0, String(rows));

  /* ---- 8. the guide ---- */
  await page.evaluate(() => App.setView('guide'));
  await wait(300);
  await shot('19-guide');
  await click('[data-triage="t-kahm"]');
  await wait(350);
  await shot('20-triage');
  check(log, 'a triage plate opens with its verdict', /carry on/i.test(await text('#topicBody')));
  await page.evaluate(() => App.back());
  await wait(250);
  await click('[data-topic="salt"]');
  await wait(300);
  check(log, 'a guide topic opens', /Salt/.test(await text('#topicTop')));
  await page.evaluate(() => App.back());
  await wait(250);

  /* ---- 9. settings and export ---- */
  await page.evaluate(() => App.setView('kitchen'));
  await wait(250);
  await click('#settingsBtn');
  await wait(500);
  await shot('21-settings');
  await click('[data-act="exporttext"]');
  await wait(400);
  await click('[data-act="exportjson"]');
  await wait(400);
  const saved = await page.evaluate(() => window.__native.saved.map(s => s.name));
  check(log, 'both exports go through Native.saveFile', saved.length === 2 && saved[0] === 'ferment-notebook.txt', JSON.stringify(saved));
  const plan = await page.evaluate(() => window.__native.scheduled);
  check(log, 'reminders are scheduled', plan.length > 0, plan.length + ' entries');
  check(log, 'no reminder is in the past', plan.every(p => p.at > Date.now()));
  check(log, 'the schedule stays under 64', plan.length <= 64, String(plan.length));

  report(log);
};
