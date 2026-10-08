// Layered paper-cut landscapes: sun, karst mountains, a river, a small city skyline and forest. Colours come from CSS variables
// (--pa-*) so light/dark skins recolour them. Each layer casts a soft shadow on the one behind it via the shared #pa-sh filter.

const rng = (seed) => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const f1 = (n) => +n.toFixed(1);

/** Rounded karst-like ridge across the width. */
function ridge(w, base, amp, n, seed, bottom) {
  const r = rng(seed);
  const xs = Array.from({ length: n + 1 }, (_, i) => (i * w) / n);
  const ys = xs.map(() => base - amp * (0.15 + 0.5 * r()));
  let d = `M0 ${bottom}L0 ${f1(ys[0])}`;
  for (let i = 0; i < n; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = Math.min(ys[i], ys[i + 1]) - amp * (0.35 + 0.65 * r());
    d += `Q${f1(cx)} ${f1(cy)} ${f1(xs[i + 1])} ${f1(ys[i + 1])}`;
  }
  return `${d}L${w} ${bottom}Z`;
}

function pine(x, y, s, cls = 'pa-tree') {
  const w = 14 * s, h = 12 * s;
  let t = '';
  for (let i = 0; i < 3; i++) {
    const yy = y - i * h * 0.55, ww = w * (1 - i * 0.22);
    t += `<path d="M${f1(x - ww / 2)} ${f1(yy)}L${f1(x)} ${f1(yy - h)}L${f1(x + ww / 2)} ${f1(yy)}Z"/>`;
  }
  return `<g class="${cls}">${t}<rect x="${f1(x - s)}" y="${f1(y)}" width="${f1(2 * s)}" height="${f1(4 * s)}"/></g>`;
}

function palm(x, y, s) {
  const lean = 6 * s;
  const tx = x + lean * 0.4, ty = y - 34 * s;
  let g = `<path class="pa-trunk" d="M${f1(x)} ${f1(y)}q${f1(lean)} ${f1(-18 * s)} ${f1(lean * 0.4)} ${f1(-34 * s)}"/>`;
  for (const a of [-165, -125, -90, -55, -15]) {
    const r = (a * Math.PI) / 180, cx = tx + 11 * s * Math.cos(r), cy = ty + 8 * s * Math.sin(r) + 3 * s;
    g += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(12 * s)}" ry="${f1(3.2 * s)}" transform="rotate(${a} ${f1(cx)} ${f1(cy)})"/>`;
  }
  return `<g class="pa-palm">${g}</g>`;
}

function city(w, base, seed) {
  const r = rng(seed);
  let b = '', win = '';
  const x0 = w * 0.1, x1 = w * 0.9;
  let x = x0;
  while (x < x1) {
    const bw = 10 + r() * 14, bh = 14 + r() * 34;
    const roof = r() > 0.7;
    b += `<path d="M${f1(x)} ${base}V${f1(base - bh)}${roof ? `L${f1(x + bw / 2)} ${f1(base - bh - 7)}L${f1(x + bw)} ${f1(base - bh)}` : `H${f1(x + bw)}`}V${base}Z"/>`;
    for (let yy = base - bh + 5; yy < base - 5; yy += 7) for (let xx = x + 3; xx < x + bw - 3; xx += 5) if (r() > 0.35) win += `<rect x="${f1(xx)}" y="${f1(yy)}" width="2.2" height="3.2"/>`;
    x += bw + 1.5 + r() * 3;
  }
  // That Luang-style stupa, the one landmark
  const sx = w * 0.62, sh = 58;
  const stupa = `<path class="pa-gold" d="M${f1(sx - 12)} ${base}V${f1(base - 12)}H${f1(sx + 12)}V${base}Z M${f1(sx - 9)} ${f1(base - 12)}L${f1(sx - 6)} ${f1(base - 30)}H${f1(sx + 6)}L${f1(sx + 9)} ${f1(base - 12)}Z M${f1(sx - 5)} ${f1(base - 30)}L${f1(sx - 2.4)} ${f1(base - sh + 6)}H${f1(sx + 2.4)}L${f1(sx + 5)} ${f1(base - 30)}Z M${f1(sx - 1)} ${f1(base - sh + 6)}L${f1(sx)} ${f1(base - sh - 6)}L${f1(sx + 1)} ${f1(base - sh + 6)}Z"/>`;
  return `<g class="pa-city">${b}</g><g class="pa-win">${win}</g>${stupa}`;
}

function clouds(w, seed) {
  const r = rng(seed);
  let c = '';
  for (let i = 0; i < 3; i++) {
    const x = w * (0.12 + 0.32 * i + r() * 0.08), y = 28 + r() * 26, s = 0.8 + r() * 0.5;
    c += `<path d="M${f1(x)} ${f1(y)}h${f1(46 * s)}a${f1(8 * s)} ${f1(8 * s)} 0 0 0 -${f1(4 * s)} -${f1(14 * s)}a${f1(11 * s)} ${f1(11 * s)} 0 0 0 -${f1(20 * s)} -${f1(5 * s)}a${f1(10 * s)} ${f1(10 * s)} 0 0 0 -${f1(22 * s)} ${f1(19 * s)}z"/>`;
  }
  return `<g class="pa-cloud">${c}</g>`;
}

/** Full landscape. kind: 'wide' (banner) | 'tall' unused for now. */
export function scene({ w = 400, h = 200, seed = 3, withCity = true } = {}) {
  const r = rng(seed + 11);
  let trees = '';
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * (w / 8.6) + (r() - 0.5) * 18;
    trees += r() > 0.28 ? pine(x, h - 30 - r() * 6, 0.9 + r() * 0.7) : palm(x, h - 26, 1 + r() * 0.5);
  }
  const wave = `M0 ${h - 74}Q${w * 0.12} ${h - 82} ${w * 0.25} ${h - 74}T${w * 0.5} ${h - 74}T${w * 0.75} ${h - 74}T${w} ${h - 74}V${h - 40}H0Z`;
  const wcuts = [0.1, 0.4, 0.7].map((p, i) => `<path d="M${f1(w * p)} ${h - 60 + i * 6}q8 -4 16 0t16 0" />`).join('');
  return `<svg class="pa-scene" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <g class="pa-sun"><circle cx="${w * 0.78}" cy="62" r="30"/><circle class="pa-sun2" cx="${w * 0.78}" cy="62" r="20"/></g>
    ${clouds(w, seed)}
    <g filter="url(#pa-sh)"><path class="pa-m1" d="${ridge(w, h - 84, 70, 6, seed, h)}"/></g>
    <g filter="url(#pa-sh)"><path class="pa-m2" d="${ridge(w, h - 62, 48, 7, seed + 5, h)}"/></g>
    ${withCity ? `<g filter="url(#pa-sh)">${city(w, h - 70, seed + 2)}</g>` : ''}
    <g filter="url(#pa-sh)"><path class="pa-river" d="${wave}"/><g class="pa-wave" fill="none">${wcuts}</g></g>
    <g filter="url(#pa-sh)"><path class="pa-hill" d="${ridge(w, h - 36, 24, 8, seed + 9, h)}"/></g>
    <g filter="url(#pa-sh)">${trees}</g>
    <g filter="url(#pa-sh)"><path class="pa-fg" d="${ridge(w, h - 12, 12, 10, seed + 21, h)}"/></g>
  </svg>`;
}

/** One-time shared defs (shadow filter for the paper layers). */
export function installDefs() {
  if (document.getElementById('pa-defs')) return;
  const d = document.createElement('div');
  d.id = 'pa-defs';
  d.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="pa-sh" x="-5%" y="-25%" width="110%" height="150%"><feDropShadow dx="0" dy="-2" stdDeviation="1.6" flood-color="#2a1d05" flood-opacity=".28"/></filter>
  </defs></svg>`;
  document.body.appendChild(d);
}

/** Fill every <div class="scene-strip"> that is still empty. */
const sceneCache = new Map();
export function paintScenes(root = document) {
  installDefs();
  root.querySelectorAll('.scene-strip:not([data-done])').forEach((el, i) => {
    el.dataset.done = '1';
    const seed = +el.dataset.seed || 3 + i * 7;
    const ck = `${seed}|${el.dataset.city}`;
    if (!sceneCache.has(ck)) sceneCache.set(ck, scene({ seed, withCity: el.dataset.city !== '0' }));
    el.innerHTML = sceneCache.get(ck);
  });
}
