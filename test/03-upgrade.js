/* Upgrade from 1.0.0. Two fixtures are written into localStorage exactly as the shipped
   1.0.0 store module wrote them, then the new build loads on top of them.
   Fixture A is the full seed (every record shape the app produces).
   Fixture B is a sparse record from an early 1.0.0 install: no acks, no riseRef, no gifted,
   no createdAt, and a settings object missing the keys added since. */
const fs = require('fs');
const path = require('path');
const { withNative, check, report } = require('./lib');

const SEED = fs.readFileSync(path.join(__dirname, '..', 'store', 'seed.js'), 'utf8');

const SPARSE = `(() => {
  const now = Date.now(), D = 86400000, H = 3600000;
  localStorage.setItem('ferment.v1', JSON.stringify({
    v: 1,
    cultures: [{
      id: 'c-old', name: 'Gary', kind: 'starter', bornAt: now - 500 * D, createdAt: now - 500 * D,
      parentId: null, origin: '', feed: { hours: 12, tempC: 21, ratio: '1:5:5' },
      logs: [{ id: 'l1', at: now - 30 * H, kind: 'feed', value: null, text: '', photoId: null, meta: null }],
      photoId: null, state: 'active'
    }],
    batches: [{
      id: 'b-old', recipeId: 'sauerkraut', title: 'Kraut jar 1', family: 'veg',
      cultureId: null, startedAt: now - 12 * D, stageIndex: 1, stageStartedAt: now - 11 * D,
      scale: { key: 'veg', amount: 1200 }, state: 'active', finishedAt: null, outcome: null,
      logs: [{ id: 'l2', at: now - 10 * D, kind: 'salinity', value: 2.2, text: '', photoId: null, meta: null },
             { id: 'l3', at: now - 2 * D, kind: 'ph', value: 3.6, text: 'Sharp', photoId: null, meta: null }]
    }],
    settings: { kitchenTempC: 19, unit: 'F' },
    createdAt: null
  }));
})()`;

module.exports = async ({ page, shot, wait, text, log }) => {
  /* ---------- fixture A: a full 1.0.0 notebook ---------- */
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(SEED);
  await withNative(page);
  await wait(500);

  const a = await page.evaluate(() => {
    const brenda = Store.cultures().find(c => c.id === 'c-brenda');
    const kimchi = Store.batch('b-kimchi');
    return {
      cultures: Store.cultures().length,
      batches: Store.batches().length,
      brendaLogs: brenda.logs.length,
      brendaAge: Store.ageText(brenda.bornAt),
      brendaRise: Store.riseSeries(brenda).length,
      peak: Store.risePeak(brenda).ratio,
      ancestors: Store.ancestryOf(brenda).length,
      descendants: Store.descendantCount('c-brenda'),
      kimchiLogs: kimchi.logs.length,
      kimchiStage: kimchi.stageIndex,
      kimchiTask: Store.taskDone(kimchi, 2, 0),
      retired: Store.cultures().filter(c => c.state === 'retired').length,
      doneBatch: Store.batch('b-kraut').outcome.rating,
      unit: Store.settings().unit,
      temp: Store.settings().kitchenTempC,
      plan: Store.reminderPlan().length
    };
  });
  check(log, 'every 1.0.0 culture loads', a.cultures === 5, JSON.stringify(a.cultures));
  check(log, 'every 1.0.0 batch loads', a.batches === 5, String(a.batches));
  check(log, 'a culture keeps its whole log', a.brendaLogs === 19, String(a.brendaLogs));
  check(log, 'a culture keeps its birthday', /years/.test(a.brendaAge), a.brendaAge);
  check(log, 'the rise reference and its series survive', a.brendaRise === 6 && a.peak === 2.46, JSON.stringify([a.brendaRise, a.peak]));
  check(log, 'inherited ancestry survives', a.ancestors === 1, String(a.ancestors));
  check(log, 'the family tree still counts descendants', a.descendants === 3, String(a.descendants));
  check(log, 'a batch keeps its logs and stage', a.kimchiLogs === 12 && a.kimchiStage === 2, JSON.stringify(a));
  check(log, 'ticked tasks survive', a.kimchiTask === true);
  check(log, 'retired cultures stay retired', a.retired === 2, String(a.retired));
  check(log, 'a closed batch keeps its outcome', a.doneBatch === 4, String(a.doneBatch));
  check(log, 'settings survive', a.unit === 'C' && a.temp === 24, JSON.stringify([a.unit, a.temp]));
  check(log, 'reminders are recomputed on open', a.plan > 0 && a.plan <= 64, String(a.plan));

  await page.evaluate(() => App.setView('kitchen'));
  await wait(600);
  await shot('30-upgrade-kitchen');
  await page.evaluate(() => { App.setView('cultures'); App.push({ screen: 'culture', id: 'c-brenda' }); });
  await wait(600);
  await shot('31-upgrade-culture');
  await page.evaluate(() => { App.setView('kitchen'); App.push({ screen: 'batch', id: 'b-kimchi' }); });
  await wait(600);
  await shot('32-upgrade-batch');
  const bt = await text('#batchBody');
  check(log, 'the upgraded batch renders its readings', /pH/.test(bt) && /Everything logged/i.test(bt));

  // The record must round-trip: what the new build writes back is still readable.
  const rewritten = await page.evaluate(() => {
    Store.addBatchLog('b-kimchi', { kind: 'note', text: 'Written by the new build.' });
    return JSON.parse(localStorage.getItem('ferment.v1'));
  });
  check(log, 'the key is unchanged', rewritten.v === 1 && Array.isArray(rewritten.batches));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  const after = await page.evaluate(() => ({ n: Store.batch('b-kimchi').logs.length, c: Store.cultures().length }));
  check(log, 'the new write survives a reload', after.n === 13 && after.c === 5, JSON.stringify(after));

  /* ---------- fixture B: a sparse early 1.0.0 record ---------- */
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(SPARSE);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  const b = await page.evaluate(() => {
    const c = Store.culture('c-old'), bt = Store.batch('b-old');
    return {
      acks: JSON.stringify(bt.acks), done: JSON.stringify(bt.doneTasks),
      riseRef: bt.riseRef, gifted: Array.isArray(c.gifted), ancestors: Array.isArray(c.ancestors),
      notify: Store.settings().notify, haptics: Store.settings().haptics,
      onboarded: Store.settings().onboarded, unit: Store.settings().unit,
      overdue: Store.feedState(c).overdue, plan: Store.reminderPlan().length
    };
  });
  check(log, 'missing acks and doneTasks are filled in', b.acks === '{}' && b.done === '{}', JSON.stringify(b));
  check(log, 'a missing riseRef becomes null, not undefined', b.riseRef === null);
  check(log, 'missing arrays are filled in', b.gifted && b.ancestors);
  check(log, 'settings added since 1.0.0 take their defaults', b.notify === true && b.haptics === true);
  check(log, 'a user preference from 1.0.0 is kept', b.unit === 'F');
  check(log, 'an old install without onboarded still skips the welcome', b.onboarded === false);
  check(log, 'the overdue feed is still overdue', b.overdue === true);
  check(log, 'a sparse record still schedules reminders', b.plan > 0, String(b.plan));

  const welcome = await page.evaluate(() => {
    const el = document.querySelector('#s-welcome');
    return !!(el && !el.hidden && el.getClientRects().length > 0);
  });
  check(log, 'an upgrading user is not sent back to onboarding', !welcome);
  await page.evaluate(() => App.setView('kitchen'));
  await wait(500);
  await shot('33-upgrade-sparse');

  report(log);
};
