/* Small SVG instruments drawn on grid paper: the log charts, the feeding ring,
   and the triage reference plates. Everything here is drawn from code. */

const Charts = (() => {

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n2 = v => Math.round(v * 100) / 100;

  /* deterministic noise, so a redraw is never a different picture */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  const W = 320, H = 132, PL = 34, PR = 10, PT = 12, PB = 20;

  /* Pattern ids have to be unique across the document: url(#id) resolves to the first match in the
     page, and a chart still sitting inside a display:none screen would otherwise win and paint nothing. */
  let gridN = 0;
  function gridDefs(id) {
    return '<defs><pattern id="' + id + '" width="16" height="16" patternUnits="userSpaceOnUse">' +
      '<path d="M16 0H0V16" class="c-grid" fill="none" stroke-width="1"/></pattern></defs>';
  }

  /**
   * A time series on grid paper. points: [{at, value}]. band: [lo, hi] target window.
   * Returns a complete <svg>, sized by CSS.
   */
  function series(points, opts) {
    const o = opts || {};
    if (!points || points.length === 0) return empty(o.emptyText || 'Nothing logged yet.');
    const xs = points.map(p => p.at), ys = points.map(p => p.value);
    let lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    if (o.zeroLine !== undefined) { lo = Math.min(lo, o.zeroLine); hi = Math.max(hi, o.zeroLine); }
    let padv = (hi - lo) * 0.18;
    if (padv < (o.minPad || 0.2)) padv = (o.minPad || 0.2);
    lo -= padv; hi += padv;
    const t0 = Math.min.apply(null, xs), t1 = Math.max.apply(null, xs);
    const span = Math.max(1, t1 - t0);
    const X = t => PL + (W - PL - PR) * (t - t0) / span;
    const Y = v => PT + (H - PT - PB) * (1 - (v - lo) / Math.max(0.0001, hi - lo));

    const gid = 'fg' + (++gridN);
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' +
            esc(o.label || 'chart') + '">' + gridDefs(gid);
    s += '<rect x="' + PL + '" y="' + PT + '" width="' + (W - PL - PR) + '" height="' + (H - PT - PB) + '" fill="url(#' + gid + ')"/>';
    if (o.band) {
      // The band is clipped into the plot, never allowed to flatten the readings it sits behind.
      const top = PT, bot = H - PB;
      const y1 = Math.max(top, Math.min(bot, Y(o.band[1])));
      const y2 = Math.max(top, Math.min(bot, Y(o.band[0])));
      if (y2 - y1 > 1 && (y2 - y1) < (bot - top) * 0.86)
        s += '<rect x="' + PL + '" y="' + n2(y1) + '" width="' + (W - PL - PR) + '" height="' + n2(y2 - y1) +
             '" class="c-band"/>';
    }
    if (o.zeroLine !== undefined) {
      s += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + n2(Y(o.zeroLine)) + '" y2="' + n2(Y(o.zeroLine)) + '" class="c-zero"/>';
    }
    s += '<line x1="' + PL + '" x2="' + PL + '" y1="' + PT + '" y2="' + (H - PB) + '" class="c-axis"/>';
    s += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + (H - PB) + '" y2="' + (H - PB) + '" class="c-axis"/>';

    const d = points.map((p, i) => (i ? 'L' : 'M') + n2(X(p.at)) + ' ' + n2(Y(p.value))).join(' ');
    if (points.length > 1) s += '<path d="' + d + '" class="c-line"/>';
    for (const p of points) {
      s += '<circle cx="' + n2(X(p.at)) + '" cy="' + n2(Y(p.value)) + '" r="3" class="c-dot"/>';
    }
    // Label the readings themselves, at their own height, rather than the padded axis ends.
    const fmt = o.fmt || (v => String(Math.round(v * 10) / 10));
    const vmin = Math.min.apply(null, ys), vmax = Math.max.apply(null, ys);
    const ymin = Y(vmin), ymax = Y(vmax);
    s += '<text x="' + (PL - 6) + '" y="' + n2(ymax + 3.5) + '" class="c-num" text-anchor="end">' + esc(fmt(vmax)) + '</text>';
    if (ymin - ymax > 13)
      s += '<text x="' + (PL - 6) + '" y="' + n2(ymin + 3.5) + '" class="c-num" text-anchor="end">' + esc(fmt(vmin)) + '</text>';
    if (o.xLabels !== false) {
      s += '<text x="' + PL + '" y="' + (H - 6) + '" class="c-num">' + esc(o.x0 || Store.dayLabel(t0)) + '</text>';
      if (o.x1 || t1 - t0 > 60000)
        s += '<text x="' + (W - PR) + '" y="' + (H - 6) + '" class="c-num" text-anchor="end">' + esc(o.x1 || Store.dayLabel(t1)) + '</text>';
    }
    s += '</svg>';
    return s;
  }

  function empty(text) {
    const gid = 'fg' + (++gridN);
    return '<svg class="chart chart-empty" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' +
      esc(text) + '">' + gridDefs(gid) +
      '<rect x="' + PL + '" y="' + PT + '" width="' + (W - PL - PR) + '" height="' + (H - PT - PB) + '" fill="url(#' + gid + ')"/>' +
      '<text x="' + (W / 2) + '" y="' + (H / 2 + 4) + '" class="c-empty" text-anchor="middle">' + esc(text) + '</text></svg>';
  }

  /** The rise chart: hours since the feed on x, multiples of the starting height on y. */
  function rise(points, opts) {
    const o = opts || {};
    if (!points.length) return empty(o.emptyText || 'No rise marks against the current line.');
    const pts = points.map(p => ({ at: p.hours, value: p.ratio }));
    const s = series(pts, {
      band: null, zeroLine: 1, minPad: 0.25, label: 'Rise over time',
      fmt: v => (Math.round(v * 10) / 10) + 'x',
      x0: 'Feed', x1: Store.spanText(pts[pts.length - 1].at) + ' later'
    });
    return s;
  }

  /** Feeding status ring: a stroked circle that fills as the interval runs out. */
  function ring(frac, overdue) {
    const r = 13, c = 2 * Math.PI * r;
    const f = Math.max(0, Math.min(1, frac));
    return '<svg class="ring' + (overdue ? ' is-over' : '') + '" viewBox="0 0 32 32" aria-hidden="true">' +
      '<circle cx="16" cy="16" r="' + r + '" class="ring-track"/>' +
      '<circle cx="16" cy="16" r="' + r + '" class="ring-fill" stroke-dasharray="' + n2(c * f) + ' ' + n2(c) +
      '" transform="rotate(-90 16 16)"/>' +
      (overdue ? '<circle cx="16" cy="16" r="3" class="ring-dot"/>' : '') +
      '</svg>';
  }

  /* ---------- triage plates ---------- */
  const AW = 168, AH = 126;

  function plateOpen(label) {
    return '<svg class="plate" viewBox="0 0 ' + AW + ' ' + AH + '" role="img" aria-label="' + esc(label) + '">';
  }
  /** Top view: the mouth of a jar, seen from above. */
  function jarMouth() {
    return '<ellipse cx="84" cy="63" rx="60" ry="50" class="a-glass"/>' +
           '<ellipse cx="84" cy="63" rx="52" ry="42" class="a-brine"/>';
  }
  /** Side view: a straight sided jar with a shoulder. */
  function jarSide() {
    return '<path d="M50 14h68v6h-5v88a10 10 0 0 1-10 10H65a10 10 0 0 1-10-10V20h-5z" class="a-glass"/>';
  }

  function fuzz(cx, cy, r, seed) {
    const rand = rng(seed);
    let s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" class="a-mold"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + n2(r * 0.55) + '" class="a-mold-core"/>';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
      const r0 = r * (0.82 + rand() * 0.15), r1 = r * (1.12 + rand() * 0.3);
      s += '<line x1="' + n2(cx + Math.cos(a) * r0) + '" y1="' + n2(cy + Math.sin(a) * r0) +
           '" x2="' + n2(cx + Math.cos(a) * r1) + '" y2="' + n2(cy + Math.sin(a) * r1) + '" class="a-hair"/>';
    }
    return s;
  }

  const PLATES = {
    mold() {
      let s = plateOpen('Three fuzzy circular mold colonies on the surface of a brine, seen from above') + jarMouth();
      s += fuzz(64, 50, 15, 7) + fuzz(101, 72, 11, 19) + fuzz(72, 84, 8, 33);
      return s + '</svg>';
    },
    kahm() {
      let s = plateOpen('A flat wrinkled white film covering the surface of a brine, seen from above') + jarMouth();
      s += '<ellipse cx="84" cy="63" rx="48" ry="38" class="a-film"/>';
      const rand = rng(5);
      for (let i = 0; i < 7; i++) {
        const y = 34 + i * 9 + rand() * 2;
        const w = 44 * Math.sqrt(Math.max(0.05, 1 - Math.pow((y - 63) / 40, 2)));
        s += '<path d="M' + n2(84 - w) + ' ' + n2(y) + ' q ' + n2(w * 0.5) + ' ' + n2(-3 - rand() * 3) + ' ' +
             n2(w) + ' 0 q ' + n2(w * 0.5) + ' ' + n2(3 + rand() * 3) + ' ' + n2(w) + ' 0" class="a-wrinkle"/>';
      }
      return s + '</svg>';
    },
    pellicle() {
      let s = plateOpen('A smooth new layer forming across the top of a kombucha jar, seen from the side') + jarSide();
      s += '<rect x="57" y="46" width="54" height="60" class="a-tea"/>';
      s += '<rect x="57" y="38" width="54" height="9" rx="3" class="a-pellicle"/>';
      s += '<rect x="57" y="31" width="54" height="6" rx="3" class="a-pellicle-new"/>';
      s += '<line x1="57" y1="30" x2="111" y2="30" class="a-edge"/>';
      return s + '</svg>';
    },
    strands() {
      let s = plateOpen('Brown yeast strands hanging below a kombucha pellicle, with sediment beneath') + jarSide();
      s += '<rect x="57" y="42" width="54" height="64" class="a-tea"/>';
      s += '<rect x="57" y="34" width="54" height="9" rx="3" class="a-pellicle"/>';
      const rand = rng(11);
      for (let i = 0; i < 6; i++) {
        const x = 63 + i * 9 + rand() * 3;
        const len = 20 + rand() * 26;
        s += '<path d="M' + n2(x) + ' 43 q ' + n2(4 - rand() * 8) + ' ' + n2(len * 0.5) + ' ' +
             n2(2 - rand() * 5) + ' ' + n2(len) + '" class="a-strand"/>';
      }
      s += '<path d="M57 98h54v8H57z" class="a-sediment"/>';
      return s + '</svg>';
    },
    pink() {
      let s = plateOpen('Irregular pink and orange patches spreading across a vegetable ferment, seen from above') + jarMouth();
      const rand = rng(23);
      for (let i = 0; i < 5; i++) {
        const a = rand() * Math.PI * 2, d = rand() * 30;
        const cx = 84 + Math.cos(a) * d, cy = 63 + Math.sin(a) * d * 0.8;
        const r = 7 + rand() * 9;
        let p = '';
        for (let k = 0; k <= 10; k++) {
          const t = (k / 10) * Math.PI * 2, rr = r * (0.7 + rand() * 0.55);
          p += (k ? 'L' : 'M') + n2(cx + Math.cos(t) * rr) + ' ' + n2(cy + Math.sin(t) * rr * 0.85);
        }
        s += '<path d="' + p + 'Z" class="a-pink"/>';
      }
      return s + '</svg>';
    },
    cloudy() {
      let s = plateOpen('A cloudy brine with rising bubbles and a layer of sediment, seen from the side') + jarSide();
      s += '<rect x="57" y="34" width="54" height="72" class="a-cloud"/>';
      const rand = rng(41);
      for (let i = 0; i < 16; i++) {
        const x = 60 + rand() * 48, y = 40 + rand() * 58, r = 1 + rand() * 2.6;
        s += '<circle cx="' + n2(x) + '" cy="' + n2(y) + '" r="' + n2(r) + '" class="a-bubble"/>';
      }
      s += '<path d="M57 96h54v10H57z" class="a-sediment"/>';
      s += '<line x1="57" y1="34" x2="111" y2="34" class="a-edge"/>';
      return s + '</svg>';
    }
  };
  function plate(kind) { return (PLATES[kind] || PLATES.cloudy)(); }

  /** The lineage tree, laid out by depth with elbow connectors. */
  function tree(node, focusId, inherited) {
    const rows = [];
    (function walk(n, depth) {
      rows.push({ n, depth });
      (n.children || []).forEach(k => walk(k, depth + 1));
    })(node, 0);
    const above = (inherited || []).length;
    let s = '';
    (inherited || []).forEach((a, i) => {
      s += '<li class="tw-row tw-ghost' + (i === 0 ? ' tw-top' : '') + '" style="--d:' + i + '">' +
           '<span class="tw-node"><b>' + esc(a.n) + '</b><i>' +
           (a.b ? esc(Store.ageText(a.b)) : 'in earlier hands') + '</i></span></li>';
    });
    for (const r of rows) {
      const d = r.depth + above;
      s += '<li class="tw-row' + (d === 0 ? ' tw-top' : '') + (r.n.id === focusId ? ' is-focus' : '') +
           (r.n.state === 'retired' ? ' is-retired' : '') + '" style="--d:' + d + '">' +
           '<button class="tw-node" data-culture="' + esc(r.n.id) + '"><b>' + esc(r.n.name) + '</b><i>' +
           esc(Store.ageText(r.n.bornAt)) + (r.n.state === 'retired' ? ', retired' : '') + '</i></button></li>';
    }
    return '<ul class="tw">' + s + '</ul>';
  }

  return { series, rise, ring, empty, plate, tree, esc };
})();

window.Charts = Charts;
