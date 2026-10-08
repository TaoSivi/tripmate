// Notification gimmicks: mascot "ນ້ອງປິນ", banner alerts, big alerts, particles, synthesised sounds, vibration patterns.
// No dependency on app state — app.js decides WHEN, this file decides HOW it looks, sounds and feels.

const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const opts = { motion: true, sound: true };
export const setFx = (o) => Object.assign(opts, o);
const animOK = () => opts.motion && !reduceMq.matches;

/* ---------- mascot ---------- */
const star = (cx, cy, r) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return `<path class="p-star" d="${d}Z"/>`;
};
const EYES = {
  normal: '<ellipse class="p-ink" cx="44" cy="60" rx="7" ry="9.5"/><ellipse class="p-ink" cx="76" cy="60" rx="7" ry="9.5"/><circle class="p-hi" cx="46.5" cy="56" r="3"/><circle class="p-hi" cx="78.5" cy="56" r="3"/>',
  happy: '<path class="p-line" d="M36 62 q8 -11 16 0 M68 62 q8 -11 16 0"/>',
  wide: '<circle class="p-ink" cx="44" cy="59" r="10"/><circle class="p-ink" cx="76" cy="59" r="10"/><circle class="p-hi" cx="47" cy="55" r="4"/><circle class="p-hi" cx="79" cy="55" r="4"/>',
  cry: '<path class="p-line" d="M37 54 l12 6 l-12 6 M83 54 l-12 6 l12 6"/><path class="p-tear" d="M40 70 q-4 14 0 22 q6 -4 4 -22z"/><path class="p-tear" d="M80 70 q4 14 0 22 q-6 -4 -4 -22z"/>',
  sleepy: '<path class="p-line" d="M37 62 q7 4 14 0 M69 62 q7 4 14 0"/>',
  star: star(44, 59, 11) + star(76, 59, 11),
  dizzy: '<circle class="p-line thin" cx="44" cy="60" r="8"/><circle class="p-line thin" cx="44" cy="60" r="3.5"/><circle class="p-line thin" cx="76" cy="60" r="8"/><circle class="p-line thin" cx="76" cy="60" r="3.5"/>',
  look: '<ellipse class="p-eye" cx="44" cy="60" rx="8" ry="10"/><ellipse class="p-eye" cx="76" cy="60" rx="8" ry="10"/><circle class="p-ink" cx="48" cy="61" r="4.5"/><circle class="p-ink" cx="80" cy="61" r="4.5"/>',
  wink: '<path class="p-line" d="M36 62 q8 -10 16 0"/><ellipse class="p-ink" cx="76" cy="60" rx="7" ry="9.5"/><circle class="p-hi" cx="78.5" cy="56" r="3"/>',
};
const MOUTH = {
  smile: '<path class="p-line" d="M53 79 q7 7 14 0"/>',
  open: '<path class="p-mouth" d="M51 77 q9 15 18 0z"/>',
  o: '<ellipse class="p-mouth" cx="60" cy="82" rx="5" ry="6"/>',
  wavy: '<path class="p-line thin" d="M50 83 q5 -5 10 0 q5 5 10 0"/>',
  tiny: '<path class="p-line thin" d="M56 81 h8"/>',
  cat: '<path class="p-line thin" d="M52 78 q4 5 8 0 q4 5 8 0"/>',
};
const ARMS = {
  down: ['M22 84 q-10 6 -9 18', 'M98 84 q10 6 9 18'],
  wave: ['M22 84 q-10 6 -9 18', 'M98 80 q14 -6 16 -24'],
  up: ['M22 80 q-14 -6 -16 -24', 'M98 80 q14 -6 16 -24'],
  point: ['M22 84 q-10 6 -9 18', 'M98 82 q16 2 24 -6'],
  hold: ['M24 86 q4 12 18 12', 'M96 86 q-4 12 -18 12'],
};
export const FACES = {
  normal: ['normal', 'smile'], happy: ['happy', 'open'], surprised: ['wide', 'o'], star: ['star', 'open'],
  sleepy: ['sleepy', 'tiny'], dizzy: ['dizzy', 'wavy'], look: ['look', 'cat'], cry: ['cry', 'wavy'], wink: ['wink', 'open'],
};
export const FACE_NAMES = { normal: 'ປົກກະຕິ', happy: 'ດີໃຈ', surprised: 'ຕົກໃຈ', star: 'ຕື່ນເຕັ້ນ', wink: 'ຂີ້ຫຼິ້ນ', sleepy: 'ງ່ວງ', look: 'ຊອກຫາ', dizzy: 'ມຶນ', cry: 'ຮ້ອງໄຫ້' };

export function pin(face = 'normal', arms = 'down') {
  const [e, m] = FACES[face] || FACES.normal;
  const [a1, a2] = ARMS[arms] || ARMS.down;
  const arm = (d) => `<path class="p-arm-o" d="${d}"/><path class="p-arm" d="${d}"/>`;
  const sweat = face === 'look' ? '<path class="p-sweat" d="M100 34 q-7 10 0 14 q7 -4 0 -14z"/>' : '';
  return `<svg class="pin-svg" viewBox="-14 -14 148 160" aria-hidden="true">${arm(a1)}${arm(a2)}
    <path class="p-line" d="M60 14 q-4 -14 10 -18" style="stroke-width:5"/>
    <path class="p-body" d="M60 136 C44 114, 14 94, 14 60 A46 46 0 1 1 106 60 C106 94, 76 114, 60 136 Z"/>
    <ellipse class="p-shine" cx="38" cy="30" rx="12" ry="7" transform="rotate(-30 38 30)"/>
    <ellipse class="p-cheek" cx="32" cy="74" rx="8" ry="4.5"/><ellipse class="p-cheek" cx="88" cy="74" rx="8" ry="4.5"/>
    ${EYES[e]}${MOUTH[m]}${sweat}</svg>`;
}

export function speedLines(n = 54) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.03, r1 = 70 + (i % 4) * 18;
    s += `<line x1="${(200 + r1 * Math.cos(a)).toFixed(1)}" y1="${(200 + r1 * Math.sin(a)).toFixed(1)}" x2="${(200 + 320 * Math.cos(a)).toFixed(1)}" y2="${(200 + 320 * Math.sin(a)).toFixed(1)}" stroke-width="${2 + (i % 3) * 2}"/>`;
  }
  return `<svg class="fx-speed" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
}

const SPARK = '<svg viewBox="-12 -12 24 24"><path d="M0 -11 C2 -3 3 -2 11 0 C3 2 2 3 0 11 C-2 3 -3 2 -11 0 C-3 -2 -2 -3 0 -11Z"/></svg>';

/* ---------- sound ---------- */
let actx = null;
export function unlock() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { actx = null; }
}
function tone(f1, f2, at, dur, vol = 0.16, type = 'sine') {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(at, dur, vol = 0.25) {
  if (!actx || actx.state !== 'running') return;
  const b = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const s = actx.createBufferSource(), g = actx.createGain();
  s.buffer = b; g.gain.value = vol; s.connect(g).connect(actx.destination); s.start(actx.currentTime + at);
}
const SFX = {
  money: () => { tone(1250, 1250, 0, 0.09, 0.12, 'square'); tone(1670, 1670, 0.09, 0.32, 0.12, 'square'); tone(2500, 2500, 0.09, 0.3, 0.04); },
  msg: () => { tone(620, 1240, 0, 0.14); tone(990, 1480, 0.13, 0.16, 0.12); },
  ping: () => { for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) tone(1320, 1320, r * 0.5 + i * 0.11, 0.07, 0.09, 'square'); },
  meet: () => { tone(320, 110, 0, 0.18, 0.25); [1047, 1319, 1568].forEach((f, i) => tone(f, f, 0.25 + i * 0.12, 0.35, 0.1, 'triangle')); },
  arrive: () => { [523, 659, 784].forEach((f, i) => tone(f, f, i * 0.12, 0.14, 0.14, 'triangle')); tone(1047, 1047, 0.38, 0.5, 0.16, 'triangle'); tone(1319, 1319, 0.38, 0.5, 0.08); },
  join: () => [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, f, i * 0.07, 0.22, 0.07)),
  photo: () => { noise(0, 0.06, 0.3); noise(0.07, 0.05, 0.2); tone(2400, 1800, 0, 0.04, 0.05, 'square'); },
  bat: () => tone(700, 260, 0, 0.7, 0.14),
  away: () => { tone(880, 860, 0, 0.7, 0.12); tone(880, 860, 0.8, 0.7, 0.07); },
  off: () => { tone(260, 110, 0, 0.25, 0.2); tone(150, 210, 0.22, 0.3, 0.14); },
  back: () => { tone(660, 990, 0, 0.12, 0.12); tone(990, 1320, 0.12, 0.16, 0.1); },
  sos: () => { for (let i = 0; i < 2; i++) { tone(960, 960, i * 0.5, 0.24, 0.14, 'square'); tone(760, 760, i * 0.5 + 0.25, 0.24, 0.14, 'square'); } },
};
export const BUZZ = { money: [40, 60, 40], msg: [40], ping: [60, 60, 60, 60, 60], meet: [50, 80, 50], arrive: [60, 60, 60, 60, 200], join: [40], photo: [30], bat: [400], away: [120, 200, 120], off: [], back: [30], sos: [500, 200, 500, 200, 500] };
export const sfx = (k) => { if (opts.sound && SFX[k]) SFX[k](); };
export function buzz(k) {
  try { if (opts.sound && navigator.vibrate && navigator.userActivation?.hasBeenActive && BUZZ[k]?.length) navigator.vibrate(BUZZ[k]); } catch { /* unsupported */ }
}

/* ---------- particles ---------- */
const COLORS = ['#ff79b0', '#ffcf5c', '#4fd1a8', '#62c3ff', '#a58bff'];
function layer() {
  let l = document.getElementById('fx-layer');
  if (!l) { l = document.createElement('div'); l.id = 'fx-layer'; document.body.appendChild(l); }
  return l;
}
function piece(cls, html, css, kf, dur, delay = 0) {
  const p = document.createElement('span');
  p.className = 'fx-p ' + cls; p.innerHTML = html || ''; Object.assign(p.style, css);
  layer().appendChild(p);
  p.animate(kf, { duration: dur, delay, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'both' }).onfinish = () => p.remove();
}
export function burst(kind) {
  if (!animOK()) return;
  const W = innerWidth, H = innerHeight;
  if (kind === 'hearts') for (let i = 0; i < 7; i++) {
    const x = 30 + Math.random() * 90;
    piece('heart', '♥', { left: x + 'px', top: '92px', fontSize: (16 + Math.random() * 14) + 'px' },
      [{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${(Math.random() - 0.5) * 50}px,-${60 + Math.random() * 40}px) scale(1.1)`, opacity: 0 }], 1300, 200 + i * 80);
  }
  if (kind === 'confetti') for (let i = 0; i < 48; i++) {
    const a = Math.random() * Math.PI - Math.PI, v = 120 + Math.random() * 180;
    piece('conf', '', { left: W / 2 + 'px', top: '90px', background: COLORS[i % COLORS.length] },
      [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v * 0.5}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${Math.cos(a) * v * 1.2}px,${H * 0.6 + Math.random() * 200}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }], 1900, 150 + Math.random() * 100);
  }
  if (kind === 'sparkles') for (let i = 0; i < 10; i++) {
    piece('spark', SPARK, { left: (20 + i * (W - 40) / 10) + 'px', top: (70 + Math.sin(i) * 22) + 'px', width: '18px', height: '18px', color: COLORS[i % COLORS.length] },
      [{ transform: 'scale(0) rotate(0)', opacity: 0 }, { transform: 'scale(1.2) rotate(40deg)', opacity: 1, offset: 0.4 }, { transform: 'scale(0) rotate(90deg)', opacity: 0 }], 900, 80 + i * 55);
  }
  if (kind === 'zzz') ['z', 'Z', 'z'].forEach((c, i) => piece('zz', c, { left: (74 + i * 14) + 'px', top: '70px', fontSize: (16 + i * 4) + 'px' },
    [{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translate(16px,-36px) scale(1.2)', opacity: 0 }], 1600, i * 450));
  if (kind === 'rings') for (let i = 0; i < 3; i++) piece('ring', '', { left: '52px', top: '86px' },
    [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0 }], 1500, i * 380);
  if (kind === 'flash') piece('flash', '', {}, [{ opacity: 0.95 }, { opacity: 0 }], 450);
}

/* ---------- banner alerts ---------- */
const KINDS = {
  msg: { face: 'happy', arms: 'hold', fx: 'hearts', anim: 'bob' },
  money: { face: 'wink', arms: 'hold', fx: 'sparkles', anim: 'jump' },
  meet: { face: 'happy', arms: 'point', fx: 'sparkles', anim: 'bob' },
  arrive: { face: 'star', arms: 'up', fx: 'confetti', anim: 'jump' },
  join: { face: 'happy', arms: 'wave', fx: 'sparkles', anim: 'wave' },
  photo: { face: 'wink', arms: 'hold', fx: 'flash', anim: 'bob' },
  bat: { face: 'sleepy', arms: 'down', fx: 'zzz', anim: 'sway' },
  away: { face: 'look', arms: 'hold', fx: 'rings', anim: 'sway' },
  off: { face: 'dizzy', arms: 'down', fx: null, anim: 'sway' },
  back: { face: 'happy', arms: 'up', fx: 'sparkles', anim: 'jump' },
};
const SHOW_MS = 4600;
let queue = [], showing = null, hideTimer = null;

export function alertBanner(a) {
  // a: {kind, title, sub, time, onTap}
  if (!KINDS[a.kind]) return;
  queue = queue.filter((q) => !(q.kind === a.kind && q.title === a.title));
  if (queue.length >= 3) queue.shift();
  queue.push(a);
  if (showing && !(showing.el && showing.el.isConnected)) { clearTimeout(hideTimer); showing = null; } // banner removed from outside
  if (!showing) next();
}

function next() {
  const a = queue.shift();
  if (!a) { showing = null; return; }
  showing = a;
  const K = KINDS[a.kind];
  const el = document.createElement('div');
  el.className = `fx-banner k-${K.anim} ${animOK() ? 'anim' : ''}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="fx-mascot">${pin(K.face, K.arms)}</span>
    <span class="fx-txt"><b></b><span></span></span><small></small>`;
  el.querySelector('b').textContent = a.title;
  el.querySelector('.fx-txt span').textContent = a.sub || '';
  el.querySelector('small').textContent = a.time || '';
  a.el = el;
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; clearTimeout(hideTimer);
    el.classList.add('out');
    setTimeout(() => { el.remove(); showing = null; next(); }, animOK() ? 260 : 0);
  };
  el.addEventListener('click', () => { try { a.onTap && a.onTap(); } finally { close(); } });
  document.body.appendChild(el);
  sfx(a.kind); buzz(a.kind);
  if (K.fx) burst(K.fx);
  hideTimer = setTimeout(close, SHOW_MS);
}

/* ---------- big alerts (ping, SOS) ---------- */
// cfg: {cls, face, arms, mark, title, sub, actions:[{label, cls, onClick(closeFn)}], sound, persistent}
export function bigAlert(cfg) {
  const el = document.createElement('div');
  el.className = `fx-big ${cfg.cls || ''} ${animOK() ? 'anim' : ''}`;
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `${speedLines(cfg.cls === 'sos' ? 64 : 48)}
    <div class="fx-big-in"><div class="fx-big-pin"><span class="waves"><i></i><i></i><i></i></span>${pin(cfg.face, cfg.arms)}<span class="mark">${cfg.mark || ''}</span></div>
    <h2></h2><p class="sub"></p><div class="acts"></div></div>`;
  const q = (s) => el.querySelector(s);
  q('h2').textContent = cfg.title; q('.sub').textContent = cfg.sub || '';
  const api = {
    el, closed: false,
    setTitle: (t) => { q('h2').textContent = t; },
    setSub: (t) => { q('.sub').textContent = t; },
    close() { if (api.closed) return; api.closed = true; clearTimeout(api._t); el.remove(); },
  };
  for (const act of cfg.actions || []) {
    const b = document.createElement(act.href ? 'a' : 'button');
    b.className = 'fx-btn ' + (act.cls || ''); b.textContent = act.label; b.id = act.id || '';
    if (act.href) { b.target = '_blank'; b.rel = 'noopener'; }
    b.addEventListener('click', () => act.onClick && act.onClick(api));
    q('.acts').appendChild(b);
    if (act.id) api[act.id] = b;
  }
  document.body.appendChild(el);
  if (cfg.sound) { sfx(cfg.sound); buzz(cfg.sound); }
  if (cfg.autoClose) api._t = setTimeout(() => api.close(), cfg.autoClose);
  return api;
}
