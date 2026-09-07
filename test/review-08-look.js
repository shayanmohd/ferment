/* A screenshot of every screen with real data, for looking at. Run three times:
   plain, --reduced-motion, and --dark. Under reduced motion every shape must still be there
   (Sway shipped a build whose signature wave went flat), and in dark mode the app must render
   as the daylight object it declares itself to be rather than half inverted. */

const { check, report, vclick, NATIVE, seedDump, seedPhotos, read } = require('./review-lib');

module.exports = async ({ page, shot, wait, errors, log }) => {
  const dump = read('ferment-100-dump.json');
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await seedDump(page, dump);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  await seedPhotos(page, dump);

  const tag = (process.env.LOOK_TAG || 'plain') + '-';

  const screens = [
    ['kitchen', () => App.setView('kitchen')],
    ['recipes', () => App.setView('recipes')],
    ['cultures', () => App.setView('cultures')],
    ['guide', () => App.setView('guide')],
    ['batch', () => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[0].id }); }],
    ['closed', () => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[1].id }); }],
    ['culture', () => { App.setView('cultures'); App.push({ screen: 'culture', id: Store.cultures()[0].id }); }],
    ['retired', () => { App.setView('cultures'); App.push({ screen: 'culture', id: Store.cultures()[2].id }); }],
    ['recipe', () => { App.setView('recipes'); App.push({ screen: 'recipe', id: 'mead' }); }],
    ['triage', () => { App.setView('guide'); App.push({ screen: 'topic', kind: 'triage', id: Content.TRIAGE[0].id }); }],
    ['settings', () => { App.setView('kitchen'); App.push({ screen: 'settings' }); }]
  ];
  for (const [name, fn] of screens) {
    await page.evaluate('(' + fn.toString() + ')()');
    await wait(600);
    await shot(tag + name);
  }

  /* the jar must keep every part of itself whatever the motion setting */
  const jar = await page.evaluate(() => {
    App.setView('kitchen');
    const svg = document.querySelector('#kJar svg.jar');
    const bubs = svg.querySelectorAll('.j-bub');
    const box = svg.getBoundingClientRect();
    const opacities = Array.prototype.slice.call(bubs).map(b => +getComputedStyle(b).opacity);
    return {
      bubbles: bubs.length,
      visible: opacities.filter(o => o > 0.05).length,
      line: !!svg.querySelector('.j-line'),
      glow: !!svg.querySelector('.j-glow'),
      edge: !!svg.querySelector('.j-edge'),
      w: Math.round(box.width), h: Math.round(box.height)
    };
  });
  check(log, 'the jar keeps its bubbles, surface line, glow and edge',
        jar.bubbles === 7 && jar.visible === 7 && jar.line && jar.glow && jar.edge, JSON.stringify(jar));
  check(log, 'the jar is drawn at a real size', jar.w > 60 && jar.h > 90, JSON.stringify(jar));

  /* the illustrations must still be drawn */
  await page.evaluate(() => { localStorage.removeItem('ferment.v1'); });
  const p2 = await page.browser().newPage();
  await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p2.on('pageerror', e => errors.push('empty tab: ' + e.message));
  await p2.goto(page.url(), { waitUntil: 'networkidle0' });
  await p2.evaluate(() => { localStorage.clear(); });
  await p2.reload({ waitUntil: 'networkidle0' });
  await wait(700);
  await p2.evaluate(() => {
    document.querySelector('#welcomePaths [data-path="fresh"]').click();
  });
  await wait(500);
  await p2.evaluate(() => App.setView('kitchen'));
  await wait(600);
  await p2.screenshot({ path: require('path').join(__dirname, 'shots-review', tag + 'empty-kitchen.png') });
  await p2.evaluate(() => App.setView('cultures'));
  await wait(500);
  await p2.screenshot({ path: require('path').join(__dirname, 'shots-review', tag + 'empty-cultures.png') });
  const ill = await p2.evaluate(() => {
    const s = document.querySelector('#cBody svg.illus');
    return { there: !!s, paths: s ? s.querySelectorAll('path, ellipse, line, rect').length : 0 };
  });
  check(log, 'the empty state illustration is fully drawn', ill.there && ill.paths >= 8, JSON.stringify(ill));
  await p2.close();

  check(log, 'the look run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
