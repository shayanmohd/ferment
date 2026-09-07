/* Phase two of the upgrade proof. The localStorage record and the IndexedDB photographs that the
   SHIPPED 1.0.0 build wrote (review-00-make100.js) are put back exactly as they were, then the
   1.0.1 build loads on top of them. Nothing may be lost, renamed or misread, and the screens must
   render the old records without a single page error. */

const { check, report, vclick, seedDump, seedPhotos, NATIVE, read } = require('./review-lib');

module.exports = async ({ page, shot, wait, text, errors, log }) => {
  const dump = read('ferment-100-dump.json');
  const old = JSON.parse(dump.raw);

  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await seedDump(page, dump);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(400);
  await seedPhotos(page, dump);

  /* ---------- nothing lost ---------- */
  const got = await page.evaluate(() => ({
    raw: localStorage.getItem('ferment.v1'),
    batches: Store.batches().map(b => ({ id: b.id, title: b.title, state: b.state, stage: b.stageIndex,
      logs: b.logs.length, amount: b.scale.amount, done: Object.keys(b.doneTasks).length,
      outcome: b.outcome, started: b.startedAt })),
    cultures: Store.cultures().map(c => ({ id: c.id, name: c.name, state: c.state, logs: c.logs.length,
      parent: c.parentId, anc: Store.ancestryOf(c).length, gifted: c.gifted.length, born: c.bornAt,
      feed: c.feed })),
    settings: Store.settings(),
    createdAt: Store.all().createdAt,
    plan: Store.reminderPlan().length,
    scheduled: window.__native.scheduled.length
  }));

  check(log, 'the localStorage key is still ferment.v1',
        !!got.raw && got.raw.length > 100);
  check(log, 'both 1.0.0 batches are present', got.batches.length === old.batches.length, String(got.batches.length));
  check(log, 'all three 1.0.0 cultures are present', got.cultures.length === old.cultures.length, String(got.cultures.length));
  for (const ob of old.batches) {
    const nb = got.batches.find(x => x.id === ob.id);
    check(log, 'batch ' + ob.title + ' survives whole',
      !!nb && nb.title === ob.title && nb.state === ob.state && nb.stage === ob.stageIndex &&
      nb.logs === ob.logs.length && nb.amount === ob.scale.amount && nb.started === ob.startedAt,
      JSON.stringify(nb));
    check(log, 'batch ' + ob.title + ' keeps its ticked tasks',
      nb.done === Object.keys(ob.doneTasks).length, nb.done + ' vs ' + Object.keys(ob.doneTasks).length);
    if (ob.outcome) check(log, 'batch ' + ob.title + ' keeps its outcome',
      nb.outcome && nb.outcome.rating === ob.outcome.rating && nb.outcome.notes === ob.outcome.notes,
      JSON.stringify(nb.outcome));
  }
  for (const oc of old.cultures) {
    const nc = got.cultures.find(x => x.id === oc.id);
    check(log, 'culture ' + oc.name + ' survives whole',
      !!nc && nc.name === oc.name && nc.state === oc.state && nc.logs === oc.logs.length &&
      nc.parent === oc.parentId && nc.born === oc.bornAt && nc.gifted === oc.gifted.length &&
      nc.feed.hours === oc.feed.hours && nc.feed.ratio === oc.feed.ratio,
      JSON.stringify(nc));
  }
  check(log, 'inherited ancestry survives',
        got.cultures.find(c => c.name === "Maria's jar").anc === 1);
  check(log, 'settings survive byte for byte',
        JSON.stringify(got.settings) === JSON.stringify(old.settings),
        JSON.stringify(got.settings) + ' vs ' + JSON.stringify(old.settings));
  check(log, 'createdAt survives', got.createdAt === old.createdAt);
  check(log, 'reminders are recomputed on open and stay under 64',
        got.plan > 0 && got.plan <= 64 && got.scheduled === got.plan, String(got.plan));
  check(log, 'no reminder is scheduled in the past',
        await page.evaluate(() => window.__native.scheduled.every(r => r.at > Date.now())));

  /* ---------- and rendered ---------- */
  await page.evaluate(() => App.setView('kitchen'));
  await wait(700);
  await shot('r02-kitchen');
  const k = await text('#v-kitchen');
  check(log, 'the Kitchen names the upgraded batch', /Winter kraut/.test(k), k.split('\n')[0]);

  const ids = await page.evaluate(() => ({
    kraut: Store.batches().find(b => b.title === 'Winter kraut').id,
    baechu: Store.batches().find(b => b.title === 'Autumn baechu').id,
    brenda: Store.cultures().find(c => c.name === 'Brenda').id,
    maria: Store.cultures().find(c => c.name === "Maria's jar").id
  }));

  await page.evaluate(id => App.push({ screen: 'batch', id: id }), ids.kraut);
  await wait(700);
  await shot('r02-batch');
  const bt = await text('#batchBody');
  check(log, 'the upgraded batch keeps its readings', /Brine/.test(bt) && /Temperature/.test(bt), '');
  check(log, 'the upgraded batch keeps its photograph', /photo journal/i.test(bt));
  const photoOk = await page.evaluate(() => {
    const im = document.querySelector('#batchBody .strip img');
    return !!im && im.src.indexOf('data:image/jpeg') === 0;
  });
  check(log, 'the 1.0.0 photograph still draws from IndexedDB', photoOk);

  await page.evaluate(id => { App.setView('cultures'); App.push({ screen: 'culture', id: id }); }, ids.brenda);
  await wait(700);
  await shot('r02-culture');
  const ct = await text('#cultureBody');
  check(log, 'the upgraded culture keeps its family tree', /Little Brenda/.test(ct));
  check(log, 'the upgraded culture keeps its gift record', /Maria/.test(ct));

  await page.evaluate(id => App.push({ screen: 'culture', id: id }), ids.maria);
  await wait(600);
  await shot('r02-retired');
  const rt = await text('#cultureBody');
  check(log, 'a retired jar is not called hungry', !/Hungry|overdue/i.test(rt), rt.split('\n').slice(0, 4).join(' / '));
  check(log, 'a retired jar says it is retired', /Retired/i.test(rt));

  /* ---------- a write from the new build survives a reload ---------- */
  await page.evaluate(id => Store.addBatchLog(id, { kind: 'note', text: 'Written by 1.0.1.' }), ids.kraut);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  const after = await page.evaluate(id => ({
    logs: Store.batch(id).logs.length, cultures: Store.cultures().length,
    unit: Store.settings().unit
  }), ids.kraut);
  const oldKraut = old.batches.find(b => b.title === 'Winter kraut');
  check(log, 'the new write survives a reload',
        after.logs === oldKraut.logs.length + 1 && after.cultures === 3 && after.unit === 'F',
        JSON.stringify(after));

  /* ---------- and the 1.0.0 export still reads back ---------- */
  const round = await page.evaluate(() => {
    const json = Store.exportJSON();
    const before = Store.batches().length + ':' + Store.cultures().length;
    const ok = Store.importJSON(json);
    return { ok: ok, before: before, after: Store.batches().length + ':' + Store.cultures().length,
             text: Store.exportText().length };
  });
  check(log, 'a backup round-trips through the new build',
        round.ok && round.before === round.after, JSON.stringify(round));
  check(log, 'the text export still writes', round.text > 500, String(round.text));

  check(log, 'the upgrade run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
