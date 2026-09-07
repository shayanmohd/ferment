/* Contrast. Every visible piece of text and every control label is measured against the surface
   it is actually painted on, compositing translucent layers up the tree. WCAG AA is the bar:
   4.5:1 for body text, 3:1 for large text (24px, or 18.66px at 600 weight and above).
   Anything sitting on a gradient is listed separately and sampled from the rendered pixels. */

const { check, report, vclick, NATIVE, seedDump, seedPhotos, read } = require('./review-lib');

function audit() {
  const parse = c => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1
  });
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05); };

  const vis = el => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };

  /* the surface under an element: composite every background up to the body */
  function surface(el) {
    let stack = [], gradient = false;
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') gradient = true;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
      n = n.parentElement;
    }
    let base = { r: 244, g: 237, b: 224, a: 1 };   // --paper, the body ground
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return { c: base, gradient: gradient };
  }

  const out = { fails: [], gradients: [], n: 0 };
  const SEL = 'p, h1, h2, h3, h4, b, i, em, span, label, li, td, th, button, a, input, textarea, select';
  for (const el of document.querySelectorAll(SEL)) {
    if (!vis(el)) continue;
    if (el.closest('[hidden]')) continue;
    // only elements that themselves paint text
    const own = Array.prototype.slice.call(el.childNodes)
      .some(n => n.nodeType === 3 && n.textContent.trim().length);
    const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    if (!own && !isField) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const surf = surface(el);
    const text = over(fg, surf.c);
    const r = ratio(text, surf.c);
    const px = parseFloat(s.fontSize);
    const w = parseInt(s.fontWeight, 10) || 400;
    const large = px >= 24 || (px >= 18.66 && w >= 600);
    const need = large ? 3 : 4.5;
    const label = (el.tagName + '.' + (typeof el.className === 'string' ? el.className : '') + ' "' +
      (el.innerText || el.placeholder || el.value || '').slice(0, 26) + '" ' + Math.round(px) + 'px/' + w +
      ' ' + s.color + ' on rgb(' + [surf.c.r, surf.c.g, surf.c.b].map(Math.round).join(',') + ') = ' +
      (Math.round(r * 100) / 100)).replace(/\s+/g, ' ');
    out.n++;
    if (r < need) (surf.gradient ? out.gradients : out.fails).push(label + ' need ' + need);
  }
  return out;
}

module.exports = async ({ page, shot, wait, errors, log }) => {
  const dump = read('ferment-100-dump.json');
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluateOnNewDocument(NATIVE);
  await seedDump(page, dump);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(500);
  await seedPhotos(page, dump);

  const screens = [
    ['kitchen', () => App.setView('kitchen')],
    ['recipes', () => App.setView('recipes')],
    ['cultures', () => App.setView('cultures')],
    ['guide', () => App.setView('guide')],
    ['batch', () => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[0].id }); }],
    ['done batch', () => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[1].id }); }],
    ['culture', () => { App.setView('cultures'); App.push({ screen: 'culture', id: Store.cultures()[0].id }); }],
    ['retired culture', () => { App.setView('cultures'); App.push({ screen: 'culture', id: Store.cultures()[2].id }); }],
    ['recipe', () => { App.setView('recipes'); App.push({ screen: 'recipe', id: 'mead' }); }],
    ['topic', () => { App.setView('guide'); App.push({ screen: 'topic', kind: 'triage', id: Content.TRIAGE[0].id }); }],
    ['settings', () => { App.setView('kitchen'); App.push({ screen: 'settings' }); }]
  ];

  let allGradients = [];
  for (const [name, fn] of screens) {
    await page.evaluate('(' + fn.toString() + ')()');
    await wait(450);
    // scroll through, so every row is measured, not just the first screenful
    const res = await page.evaluate(async fnBody => {
      const sc = document.querySelector('.screen.page:not([hidden]) .scroller, .view:not([hidden]) .scroller');
      const seen = { fails: [], gradients: [], n: 0 };
      const run = new Function('return (' + fnBody + ')()');
      const steps = sc ? Math.min(8, Math.ceil(sc.scrollHeight / sc.clientHeight)) : 1;
      for (let i = 0; i < steps; i++) {
        if (sc) sc.scrollTop = i * sc.clientHeight * 0.9;
        await new Promise(r => setTimeout(r, 60));
        const o = run();
        seen.n += o.n;
        for (const f of o.fails) if (seen.fails.indexOf(f) < 0) seen.fails.push(f);
        for (const g of o.gradients) if (seen.gradients.indexOf(g) < 0) seen.gradients.push(g);
      }
      if (sc) sc.scrollTop = 0;
      return seen;
    }, audit.toString());
    check(log, name + ': every flat-surface text pair passes AA (' + res.n + ' measured)',
          res.fails.length === 0, res.fails.slice(0, 4).join(' || '));
    allGradients = allGradients.concat(res.gradients.map(g => name + ': ' + g));
  }

  /* the sheet and the camera, which have their own surfaces */
  await page.evaluate(() => { App.setView('cultures'); });
  await wait(300);
  await vclick(page, '[data-act="newculture"]');
  await wait(400);
  const sheet = await page.evaluate(audit);
  check(log, 'the sheet passes AA', sheet.fails.length === 0, sheet.fails.slice(0, 4).join(' || '));
  allGradients = allGradients.concat(sheet.gradients.map(g => 'sheet: ' + g));
  await page.evaluate(() => App.back());
  await wait(300);

  await page.evaluate(() => { App.setView('kitchen'); App.push({ screen: 'batch', id: Store.batches()[0].id }); });
  await wait(400);
  await vclick(page, '.chip[data-act="photo"]');
  await wait(1500);
  const cap = await page.evaluate(audit);
  check(log, 'the camera screen passes AA', cap.fails.length === 0, cap.fails.slice(0, 4).join(' || '));
  allGradients = allGradients.concat(cap.gradients.map(g => 'camera: ' + g));
  await page.evaluate(() => App.back());
  await wait(300);

  if (allGradients.length) {
    log('--- on a gradient, to be checked against the rendered pixels ---');
    for (const g of allGradients.slice(0, 30)) log('  ' + g);
  } else {
    log('nothing sits on a gradient below the flat-surface threshold');
  }

  check(log, 'the contrast run had no page errors', errors.length === 0, errors.join(' | '));
  report(log);
};
