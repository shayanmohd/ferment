(() => {
  const K = 'ferment.v1';
  if (localStorage.getItem(K)) return;
  const H = 3600000, D = 86400000, now = Date.now();
  let n = 0;
  const lid = () => 'sl' + (n++);
  const L = (kind, hoursAgo, value, text) => ({
    id: lid(), at: now - hoursAgo * H, kind: kind,
    value: (value === undefined ? null : value), text: text || '', photoId: null, meta: null
  });

  const cultures = [
    { id: 'c-brenda', name: 'Brenda', kind: 'starter',
      bornAt: Date.UTC(2019, 3, 12, 9), createdAt: now - 400 * D, parentId: null,
      origin: 'A jar from a bakery in Trieste, carried home wrapped in a tea towel.',
      feed: { hours: 12, tempC: 21, ratio: '1:5:5 by weight, starter to flour to water' },
      ancestors: [{ n: 'The Trieste bakery jar', k: 'starter', b: Date.UTC(1998, 4, 1, 9) }],
      gifted: [{ name: 'Maria', at: now - 90 * D }, { name: 'Tom', at: now - 21 * D }],
      riseRef: { bottomY: 0.84, baseY: 0.62, at: now - 7 * H },
      photoId: null, state: 'active',
      logs: [
        L('feed', 105), L('feed', 93), L('feed', 81), L('feed', 69), L('temp', 66, 23.5),
        L('feed', 57), L('feed', 45), L('temp', 40, 25),
        L('feed', 33), L('feed', 21), L('temp', 14, 24),
        L('feed', 9, undefined, 'Fed and marked the level'),
        L('rise', 7, 1, 'Level marked at the feed'),
        L('rise', 5.5, 1.31, '1.5h after the feed'),
        L('rise', 4, 1.78, '3h after the feed'),
        L('rise', 2.5, 2.24, '4.5h after the feed'),
        L('rise', 1.2, 2.46, '5.8h after the feed'),
        L('rise', 0.4, 2.38, '6.6h after the feed'),
        L('note', 0.3, undefined, 'Peaked around six hours, domed and smelling of apples. Ready for a Saturday bake.')
      ] },
    { id: 'c-rye', name: 'Rye Brenda', kind: 'starter',
      bornAt: now - 62 * D, createdAt: now - 62 * D, parentId: 'c-brenda',
      origin: 'Split from Brenda',
      feed: { hours: 24, tempC: 21, ratio: '1:4:4, all wholemeal rye' },
      ancestors: [], gifted: [], riseRef: null, photoId: null, state: 'active',
      logs: [L('feed', 40), L('feed', 16), L('temp', 15, 22.5), L('note', 14, undefined, 'Slower than Brenda but far sourer. Keep it on rye.')] },
    { id: 'c-nell', name: 'Nell', kind: 'starter',
      bornAt: now - 30 * D, createdAt: now - 30 * D, parentId: 'c-rye',
      origin: 'Split from Rye Brenda, for the flat downstairs',
      feed: { hours: 24, tempC: 21, ratio: '1:4:4, all wholemeal rye' },
      ancestors: [], gifted: [], riseRef: null, photoId: null, state: 'retired',
      logs: [L('feed', 200), L('note', 190, undefined, 'Handed over in a jam jar with a card.')] },
    { id: 'c-window', name: 'Kitchen window jar', kind: 'starter',
      bornAt: now - 140 * D, createdAt: now - 140 * D, parentId: 'c-brenda',
      origin: 'Split from Brenda',
      feed: { hours: 12, tempC: 21, ratio: '1:5:5' },
      ancestors: [], gifted: [], riseRef: null, photoId: null, state: 'retired',
      logs: [L('note', 700, undefined, 'Too hot on that windowsill in July. Merged back into Brenda.')] },
    { id: 'c-ferdinand', name: 'Ferdinand', kind: 'scoby',
      bornAt: now - 760 * D, createdAt: now - 300 * D, parentId: null,
      origin: 'Grew himself out of a bottle of shop kombucha in 2024.',
      feed: { hours: 240, tempC: 24, ratio: 'A fresh sweet tea brew, or top up the hotel jar' },
      ancestors: [], gifted: [{ name: 'the office', at: now - 60 * D }],
      riseRef: null, photoId: null, state: 'active',
      logs: [L('feed', 150), L('temp', 100, 25.5), L('note', 96, undefined, 'Third pellicle stacked up. Peeled the bottom two off.')] }
  ];

  const B = (o) => Object.assign({
    cultureId: null, state: 'active', finishedAt: null, outcome: null,
    doneTasks: {}, acks: {}, riseRef: null
  }, o);

  const batches = [
    B({ id: 'b-kimchi', recipeId: 'baechu', title: 'Baechu kimchi, batch 4', family: 'veg',
        startedAt: now - 3 * D, stageIndex: 2, stageStartedAt: now - 47 * H,
        scale: { key: 'veg', amount: 2400 },
        doneTasks: { '2:0': now - 40 * H },
        logs: [
          L('stage', 71, undefined, 'Finished Brine the cabbage, started Paste and pack'),
          L('stage', 47, undefined, 'Finished Paste and pack, started Room temperature wake up'),
          L('temp', 46, 20.5), L('burp', 40, undefined, 'Climbing already, plate underneath earned its keep'),
          L('ph', 39, 5.6), L('temp', 24, 21), L('burp', 22),
          L('ph', 21, 4.9, 'Sour on the tongue now'),
          L('taste', 20, undefined, 'Fizzing on the tongue, still sweet at the stem'),
          L('temp', 6, 20), L('ph', 5, 4.5), L('burp', 4)
        ] }),
    B({ id: 'b-kombucha', recipeId: 'kombucha-f1', title: 'Autumn kombucha', family: 'kombucha',
        startedAt: now - 9.2 * D, stageIndex: 1, stageStartedAt: now - 9 * D,
        scale: { key: 'liquid', amount: 3000 }, cultureId: 'c-ferdinand',
        logs: [
          L('stage', 220, undefined, 'Finished Brew and cool, started Primary ferment'),
          L('ph', 214, 4.5), L('temp', 213, 24.5),
          L('ph', 144, 3.6), L('temp', 140, 25.5),
          L('note', 138, undefined, 'New pellicle right across the top. Cross checked against the guide, it is a pellicle.'),
          L('ph', 72, 3.1), L('temp', 70, 26),
          L('taste', 30, undefined, 'Sharp but still sweet underneath. Two more days.'),
          L('ph', 6, 2.9), L('temp', 5, 25)
        ] }),
    B({ id: 'b-sauce', recipeId: 'hotsauce', title: 'Red jalapeno sauce', family: 'sauce',
        startedAt: now - 16 * D, stageIndex: 1, stageStartedAt: now - 15.8 * D,
        scale: { key: 'water', amount: 700 },
        logs: [
          L('salinity', 378, 3), L('temp', 370, 21.5),
          L('burp', 360, undefined, 'Bubbling hard'), L('burp', 336),
          L('ph', 300, 4.2), L('temp', 200, 22), L('ph', 168, 3.7),
          L('note', 100, undefined, 'Quiet now. Brine is cloudy and the chillies have gone dull.'),
          L('ph', 20, 3.4), L('temp', 18, 21.5)
        ] }),
    B({ id: 'b-loaf', recipeId: 'sourdough-loaf', title: 'Saturday loaf', family: 'bread',
        startedAt: now - 2 * H, stageIndex: 1, stageStartedAt: now - 1.5 * H,
        scale: { key: 'flour', amount: 800 }, cultureId: 'c-brenda',
        doneTasks: { '1:0': now - 80 * 60000, '1:1': now - 40 * 60000 },
        logs: [L('stage', 1.5, undefined, 'Finished Autolyse, started Mix and bulk ferment'), L('temp', 1, 24.5)] }),
    B({ id: 'b-kraut', recipeId: 'sauerkraut', title: 'Sauerkraut, jar 7', family: 'veg',
        startedAt: now - 46 * D, stageIndex: 2, stageStartedAt: now - 28 * D,
        scale: { key: 'veg', amount: 1400 }, state: 'done', finishedAt: now - 20 * D,
        outcome: { rating: 4, notes: 'Crunchier than jar 6 and properly sour by day 16.',
                   next: 'Two and a quarter percent salt, and keep it off the top of the fridge.' },
        logs: [L('salinity', 1104, 2.2), L('ph', 900, 4.4), L('ph', 700, 3.6),
               L('taste', 500, undefined, 'Sour, still crunchy'), L('stage', 672, undefined, 'Finished Primary ferment, started Cold store')] })
  ];

  localStorage.setItem(K, JSON.stringify({
    v: 1, batches: batches, cultures: cultures,
    settings: { kitchenTempC: 24, unit: 'C', notify: true, haptics: true, onboarded: true },
    createdAt: now - 400 * D
  }));
})()
