/* A restored backup is the one record this app does not write itself. Feed it the shapes a
   backup can really arrive in: a recipe this build does not carry, a stage number past the end
   of the plan, missing fields, and rubbish, and prove no screen throws and nothing is invented. */

const { check, report, NATIVE } = require('./review-lib');

module.exports = async ({ page, shot, wait, text, errors, log }) => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);

  const built = await page.evaluate(() => {
    const now = Date.now(), D = 86400000;
    const backup = {
      v: 1,
      batches: [
        // a recipe this build does not have
        { id: 'b-alien', recipeId: 'natto-from-the-future', title: 'Natto', family: 'veg',
          startedAt: now - 5 * D, stageIndex: 2, stageStartedAt: now - 2 * D,
          scale: { key: 'bean', amount: 500 }, state: 'active', logs: [
            { id: 'x1', at: now - 4 * D, kind: 'temp', value: 40, text: 'Warm box' },
            { id: 'x2', at: now - 3 * D, kind: 'note', value: null, text: 'Smells right' }] },
        // a stage number past the end of this build's plan
        { id: 'b-past', recipeId: 'sauerkraut', title: 'From a newer build', family: 'veg',
          startedAt: now - 30 * D, stageIndex: 9, stageStartedAt: now - 3 * D,
          scale: { key: 'veg', amount: 1000 }, state: 'active', logs: [] },
        // almost nothing at all
        { id: 'b-bare', recipeId: 'halfsour' },
        // nonsense in every numeric field
        { id: 'b-junk', recipeId: 'kombucha-f1', title: '', stageIndex: 'two',
          scale: { key: 'liquid', amount: 'lots' }, state: 'sideways', logs: 'no' }
      ],
      cultures: [
        { id: 'c-bare', name: 'Bare', kind: 'starter', bornAt: now - 729 * D,
          feed: { hours: 12, tempC: 21, ratio: '' } },
        { id: 'c-odd', name: 'Odd', kind: 'not-a-kind', bornAt: now - 3 * D,
          feed: { hours: 24, tempC: 21, ratio: '' }, logs: null, ancestors: null, gifted: null }
      ],
      settings: { kitchenTempC: 19 },
      createdAt: now - 100 * D
    };
    const ok = Store.importJSON(JSON.stringify(backup));
    return {
      ok: ok,
      batches: Store.batches().map(b => ({ id: b.id, stage: b.stageIndex, state: b.state,
        title: b.title, amount: b.scale.amount, logs: b.logs.length })),
      cultures: Store.cultures().map(c => ({ id: c.id, logs: c.logs.length,
        anc: c.ancestors.length, gift: c.gifted.length, age: Store.ageText(c.bornAt) })),
      kitchenTemp: Store.settings().kitchenTempC, notify: Store.settings().notify
    };
  });

  check(log, 'a foreign backup is accepted', built.ok);
  const past = built.batches.find(b => b.id === 'b-past');
  check(log, 'a stage number past the end of the plan is clamped to the plan',
        past && past.stage === 2, JSON.stringify(past));
  const junk = built.batches.find(b => b.id === 'b-junk');
  check(log, 'nonsense in stageIndex, scale and state is normalised',
        junk && junk.stage === 0 && junk.state === 'active' && junk.amount > 0 &&
        junk.title.length > 0 && junk.logs === 0, JSON.stringify(junk));
  const bare = built.batches.find(b => b.id === 'b-bare');
  check(log, 'a batch with almost no fields gets a title, a scale and a stage',
        bare && bare.title.length > 0 && bare.amount > 0 && bare.stage === 0, JSON.stringify(bare));
  check(log, 'a culture with null arrays is repaired',
        built.cultures.every(c => c.logs === 0 && c.anc === 0 && c.gift === 0), JSON.stringify(built.cultures));
  check(log, 'an age of 729 days does not read as "1 year and 12 months"',
        !/12 months/.test(built.cultures[0].age), built.cultures[0].age);
  check(log, 'a setting from the backup survives and the missing ones default',
        built.kitchenTemp === 19 && built.notify === true, JSON.stringify([built.kitchenTemp, built.notify]));

  /* every screen must render on top of that */
  await page.evaluate(() => App.setView('kitchen'));
  await wait(800);
  await shot('r09-kitchen');
  const k = await text('#kBody');
  check(log, 'the Kitchen renders the salvageable batches', /From a newer build/.test(k), k.slice(0, 60));

  await page.evaluate(() => App.push({ screen: 'batch', id: 'b-alien' }));
  await wait(600);
  await shot('r09-missing-recipe');
  const bt = await text('#batchBody');
  check(log, 'a batch on a missing recipe explains itself instead of throwing',
        /not in this app/i.test(bt), bt.slice(0, 90));
  check(log, 'its log is still readable', /Warm box/.test(bt) && /Smells right/.test(bt));
  check(log, 'and it can still be deleted',
        await page.evaluate(() => !!document.querySelector('#batchBody [data-act="deletebatch"]')));
  check(log, 'advancing a stage on a missing recipe is a no-op, not a throw',
        await page.evaluate(() => { Store.advanceStage('b-alien'); return Store.batch('b-alien').stageIndex === 2; }));

  for (const id of ['b-past', 'b-bare', 'b-junk']) {
    await page.evaluate(i => { App.setView('kitchen'); App.push({ screen: 'batch', id: i }); }, id);
    await wait(500);
    const t = await text('#batchBody');
    check(log, 'batch ' + id + ' renders', t.length > 40, t.slice(0, 50));
  }
  await shot('r09-clamped');

  for (const id of ['c-bare', 'c-odd']) {
    await page.evaluate(i => { App.setView('cultures'); App.push({ screen: 'culture', id: i }); }, id);
    await wait(500);
    const t = await text('#cultureBody');
    check(log, 'culture ' + id + ' renders without NaN', t.length > 40 && !/NaN|undefined/.test(t), t.slice(0, 60));
  }
  await shot('r09-culture');

  /* and rubbish that is not a backup at all is refused */
  const refused = await page.evaluate(() => ({
    notJson: Store.importJSON('this is not json'),
    wrongShape: Store.importJSON('{"hello":1}'),
    empty: Store.importJSON(''),
    stillThere: Store.batches().length
  }));
  check(log, 'a file that is not a backup is refused and changes nothing',
        !refused.notJson && !refused.wrongShape && !refused.empty && refused.stillThere === 4,
        JSON.stringify(refused));

  check(log, 'the restore run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
