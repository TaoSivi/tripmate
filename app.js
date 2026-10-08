import * as U from './lib.js';
import * as FX from './fx.js';
import * as M from './money.js';
import { ic, hydrate } from './icons.js';
import { paintScenes } from './paperart.js';
import { createPush } from './push.js';
import { createExpenses } from './expenses.js';
import { createBackend } from './backend.js';
import { FIREBASE_CONFIG } from './config.js';

const VERSION = '1.1.0';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// ?as=b gives a second identity in the same browser — lets two tabs act as two friends in demo mode.
const SLOT = (params.get('as') || '').replace(/[^a-z0-9]/gi, '').slice(0, 8);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const coarse = matchMedia('(pointer: coarse)').matches;
const darkMq = matchMedia('(prefers-color-scheme: dark)');

const EMOJIS = ['', '😎', '🐼', '🦊', '🐯', '🐸', '🦄', '🐙', '🌸', '⚡', '🏕️', '🛵'];
const QUICK = ['📍 ຢູ່ໃສແລ້ວ?', '🚶 ກຳລັງໄປ', '⏳ ລໍຖ້າແດ່', '✅ ຮອດແລ້ວ', '🍜 ຫິວເຂົ້າແລ້ວ', '👍 ໂອເຄ'];
const TRIP_GRADS = [
  'linear-gradient(135deg,#0d9488,#22d3ee)', 'linear-gradient(135deg,#6366f1,#a855f7)', 'linear-gradient(135deg,#f97316,#facc15)',
  'linear-gradient(135deg,#ec4899,#f43f5e)', 'linear-gradient(135deg,#0ea5e9,#6366f1)', 'linear-gradient(135deg,#16a34a,#84cc16)',
];
const TRIP_ICON = ['map', 'flag', 'lotus', 'pin', 'stay', 'car'];

const store = {
  k: (k) => `tm${SLOT}_${k}`,
  get(k, d = null) { try { const v = localStorage.getItem(this.k(k)); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(this.k(k), JSON.stringify(v)); } catch { /* storage full/blocked */ } },
  del(k) { try { localStorage.removeItem(this.k(k)); } catch { /* ignore */ } },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = (s) => Array.from(String(s)).reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);
const FX_FACES = ['happy', 'surprised', 'star', 'wink', 'sleepy', 'look', 'dizzy', 'cry', 'normal'];
const haptic = (ms = 12) => { try { if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(ms); } catch { /* ignore */ } };

const S = {
  be: null, uid: null,
  profile: store.get('profile'),
  code: null, info: null,
  members: {}, loc: {}, presence: {}, meet: null, sos: {}, exp: {},
  me: null, lastSent: null,
  geo: 'idle', watchId: null,
  sharing: store.get('sharing', true),
  pauseUntil: store.get('pauseUntil', 0),
  wake: false, wakeLock: null,
  sound: store.get('sound', true),
  fx: store.get('fx', true),
  locInit: false, ready: {}, lowBat: {}, away: {}, arrived: {}, meetTs: 0, awayAt: 0,
  theme: store.get('theme', 'auto'),
  skin: store.get('skin', 'paper'),
  layer: store.get('layer', 'std'),
  tab: 'map', unread: 0, lastRead: 0,
  online: true, unsubs: [], presenceOff: null,
  msgIds: new Set(), pending: new Set(), imgCache: new Map(),
  sessionStart: Date.now(),
  mySos: false, dismissedSos: store.get('dismissedSos', {}),
  leaving: false, joinedOnce: false, picking: false, centered: false,
  editingFromApp: false, installPrompt: null, lastPing: {},
};
const P = (sub = '') => `trips/${S.code}${sub ? '/' + sub : ''}`;
const sharingActive = () => S.sharing && Date.now() > S.pauseUntil;
const memberName = (uid, fallback) => S.members[uid]?.name || fallback || 'ໝູ່';
const isDark = () => S.theme === 'dark' || (S.theme === 'auto' && darkMq.matches);

/* =================== avatars =================== */
function avatarInner(m) {
  return m?.emoji ? `<span class="emo">${esc(m.emoji)}</span>` : esc(U.initials(m?.name));
}
function avatar(m, cls = '', dot = null) {
  return `<span class="av ${cls}" style="--c:${esc(m?.color || '#94a3b8')}">${avatarInner(m)}${dot == null ? '' : `<span class="dot ${dot ? 'on' : ''}"></span>`}</span>`;
}
function avatarStack(list, max = 4) {
  const shown = list.slice(0, max).map((m) => avatar(m, 'sm')).join('');
  return shown + (list.length > max ? `<span class="more">+${list.length - max}</span>` : '');
}

/* =================== boot =================== */

async function boot() {
  registerSW();
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installPrompt = e; renderInstall(); });
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  darkMq.addEventListener?.('change', applyTheme);
  try {
    S.be = await withTimeout(createBackend(FIREBASE_CONFIG, { slot: SLOT }), 20000);
  } catch (e) {
    return fatal(explainError(e));
  }
  S.uid = S.be.uid;
  // Firebase reports "disconnected" for a moment at start-up and on brief drops — only show it if it lasts.
  let offTimer = null;
  S.be.onConnected((on) => {
    clearTimeout(offTimer);
    if (!on) { offTimer = setTimeout(() => { S.online = false; renderStatus(); if (S.code) say('off', 'ເນັດຫຼຸດ~', 'ຂໍ້ຄວາມຈະສົ່ງເອງເມື່ອມີເນັດ'); }, 3000); return; }
    const was = S.online;
    S.online = true;
    if (!was && S.code) { startPresence(); say('back', 'ເນັດກັບມາແລ້ວ!', 'ກຳລັງສົ່ງຂໍ້ຄວາມທີ່ຄ້າງ'); }
    renderStatus();
  });
  if (S.be.mode === 'demo' || params.has('debug')) {
    window.TM = { S, fakeFix: (lat, lng, acc = 10) => onFix({ coords: { latitude: lat, longitude: lng, accuracy: acc } }), get map() { return map; } };
  }
  setInterval(tick, 15000);
  setInterval(heartbeat, 30000);
  document.addEventListener('visibilitychange', onVisibility);
  wireUi();
  route();
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

function explainError(e) {
  const c = (e && (e.code || e.message)) || '';
  if (/operation-not-allowed|admin-restricted|configuration-not-found/.test(c)) return 'ຍັງບໍ່ໄດ້ເປີດ Anonymous sign-in ໃນ Firebase (Authentication → Sign-in method)';
  if (/api-key-not-valid|invalid-api-key/.test(c)) return 'apiKey ໃນ config.js ບໍ່ຖືກຕ້ອງ — ສຳເນົາ firebaseConfig ຈາກ Firebase Console ໃໝ່';
  if (/permission[_-]denied/i.test(c)) return 'Firebase ປະຕິເສດ — ກວດວ່າວາງ database.rules.json ແລ້ວ';
  if (/network|timeout|Failed to fetch|import/i.test(c)) return 'ເຊື່ອມຕໍ່ບໍ່ໄດ້ — ກວດອິນເຕີເນັດແລ້ວລອງໃໝ່';
  return 'ເກີດຂໍ້ຜິດພາດ: ' + c;
}

function fatal(msg) {
  showScreen('splash');
  $('splash').innerHTML = `<div><div style="font-size:44px">⚠️</div><p style="max-width:300px">${esc(msg)}</p><button class="btn white" onclick="location.reload()">ລອງໃໝ່</button></div>`;
}

function route() {
  if (!S.profile) return showProfile();
  const invite = U.cleanCode(params.get('t'));
  if (invite) {
    params.delete('t');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
    if (invite !== store.get('trip')) return joinTrip(invite);
  }
  const cur = store.get('trip');
  if (cur) return enterTrip(cur);
  showHome();
}

function showScreen(id) {
  for (const s of ['splash', 's-profile', 's-home', 'app']) $(s).hidden = s !== id;
}

/* =================== gimmicks =================== */
function applyFx() { FX.setFx({ motion: S.fx, sound: S.sound }); }
function say(kind, title, sub, onTap) {
  FX.alertBanner({ kind, title, sub, time: U.fmtTime(S.be ? S.be.now() : Date.now()), onTap });
}

/* =================== theme =================== */
function applySkin() {
  document.documentElement.dataset.skin = S.skin;
  document.querySelectorAll('#skin-seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === S.skin)));
  paintScenes();
}

function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = S.theme;
  document.querySelector('meta[name="theme-color"]').content = isDark() ? '#0a0f1c' : '#0d9488';
  document.querySelectorAll('#theme-seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === S.theme)));
  setLayer(S.layer);
}

/* =================== profile & home =================== */
let draft = null;
function showProfile(fromApp = false) {
  S.editingFromApp = fromApp;
  showScreen('s-profile');
  draft = { ...(S.profile || { name: '', color: U.COLORS[Math.floor(Math.random() * U.COLORS.length)], emoji: '' }) };
  $('p-name').value = draft.name;
  $('profile-title').textContent = S.profile ? 'ແກ້ໄຂໂປຣໄຟລ໌' : 'ໂປຣໄຟລ໌ຂອງເຈົ້າ';
  $('p-save').textContent = fromApp ? 'ບັນທຶກ' : 'ຕໍ່ໄປ';
  const invite = U.cleanCode(params.get('t'));
  $('invite-note').hidden = !invite;
  if (invite) $('invite-note').textContent = `🎉 ເຈົ້າຖືກເຊີນເຂົ້າທຣິບ ${invite} — ຕັ້ງຊື່ກ່ອນເພື່ອເຂົ້າຮ່ວມ`;
  renderProfileForm();
}

function renderProfileForm() {
  $('p-preview').innerHTML = avatar({ ...draft, name: draft.name || '?' }, 'lg');
  $('p-emojis').innerHTML = EMOJIS.map((e) =>
    `<button role="radio" aria-checked="${e === (draft.emoji || '')}" data-e="${esc(e)}" aria-label="${e || 'ຕົວອັກສອນ'}">${e || esc(U.initials(draft.name || 'ກ'))}</button>`).join('');
  $('p-colors').innerHTML = U.COLORS.map((c) =>
    `<button class="swatch" role="radio" aria-checked="${c === draft.color}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
}

async function saveProfile() {
  const name = $('p-name').value.trim().replace(/\s+/g, ' ');
  if (!name) { toast('ກະລຸນາໃສ່ຊື່'); $('p-name').focus(); return; }
  S.profile = { name, color: draft.color || U.COLORS[0], emoji: draft.emoji || '' };
  store.set('profile', S.profile);
  if (S.editingFromApp && S.code) {
    S.be.update(P(`members/${S.uid}`), { name, color: S.profile.color, emoji: S.profile.emoji }).catch(() => {});
    showScreen('app');
    switchTab('trip');
    renderAll();
    return;
  }
  route();
}

function showHome() {
  showScreen('s-home');
  $('hello').textContent = S.profile.name;
  $('edit-profile').innerHTML = avatar(S.profile, 'ring');
  $('demo-note').hidden = S.be.mode !== 'demo';
  $('otp').innerHTML = Array.from({ length: 6 }, (_, i) =>
    `<input inputmode="text" maxlength="1" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="ຕົວທີ ${i + 1}">`).join('');
  const recent = store.get('recent', []);
  $('recent-card').hidden = !recent.length;
  $('recent').innerHTML = recent.map((r) => {
    const h = hash(r.code);
    return `<button class="trip-tile" data-rejoin="${esc(r.code)}"><div class="tt-img" style="--g:${TRIP_GRADS[h % TRIP_GRADS.length]}"><span>${ic(TRIP_ICON[h % TRIP_ICON.length])}</span></div>
      <div class="tt-b"><b>${esc(r.name)}</b><small>${esc(r.code)}</small></div></button>`;
  }).join('');
}

function otpValue() {
  return [...$('otp').querySelectorAll('input')].map((i) => i.value).join('');
}

function addRecent(code, name) {
  const list = store.get('recent', []).filter((r) => r.code !== code);
  list.unshift({ code, name });
  store.set('recent', list.slice(0, 6));
}

async function createTrip(btn) {
  const name = $('c-name').value.trim() || `ທຣິບຂອງ ${S.profile.name}`;
  await busy(btn, async () => {
    let code;
    for (let i = 0; i < 6; i++) {
      code = U.genCode();
      if (!(await S.be.get(`trips/${code}/info`))) break;
    }
    await S.be.set(`trips/${code}/info`, { name, owner: S.uid, created: S.be.now() });
    await joinTrip(code);
  });
}

async function joinTrip(code) {
  let info;
  try { info = await S.be.get(`trips/${code}/info`); }
  catch (e) { toast(explainError(e)); return showHome(); }
  if (!info) { toast(`ບໍ່ພົບທຣິບລະຫັດ ${code}`); return showHome(); }
  const wasMember = await isMember(code);
  await S.be.update(`trips/${code}/members/${S.uid}`, {
    name: S.profile.name, color: S.profile.color, emoji: S.profile.emoji || '', ...(wasMember ? {} : { joined: S.be.now() }),
  });
  S.code = code;
  if (!wasMember) sendMsg({ type: 'sys', text: 'ເຂົ້າຮ່ວມທຣິບ 👋', ev: 'join' });
  return enterTrip(code, info);
}

// Non-members get "permission denied" from Firebase — that also means "no".
async function isMember(code) {
  try { return !!(await S.be.get(`trips/${code}/members/${S.uid}`)); } catch { return false; }
}

async function enterTrip(code, info) {
  if (!info) {
    try {
      info = await S.be.get(`trips/${code}/info`);
      if (!info) { store.del('trip'); toast('ທຣິບນີ້ຖືກລຶບແລ້ວ'); return showHome(); }
      if (!(await isMember(code))) {
        await S.be.update(`trips/${code}/members/${S.uid}`, { name: S.profile.name, color: S.profile.color, emoji: S.profile.emoji || '', joined: S.be.now() });
      }
    } catch {
      // Offline at start-up: carry on with what we remember, listeners catch up when online.
      info = { name: store.get('recent', []).find((r) => r.code === code)?.name || code };
    }
  }
  S.code = code; S.info = info; S.leaving = false; S.joinedOnce = false;
  store.set('trip', code);
  addRecent(code, info.name);
  S.lastRead = store.get('lastRead_' + code, 0);
  S.locInit = false; S.ready = {}; S.lowBat = {}; S.away = {}; S.arrived = {};
  resetMsgs();
  showScreen('app');
  initMap();
  attachListeners();
  startPresence();
  switchTab('map');
  renderAll();
  maybeStartGeo();
  PUSH.ensure();
}

function attachListeners() {
  const be = S.be;
  const err = (e) => onListenError(e);
  S.unsubs.push(
    be.onValue(P('info'), (v) => {
      if (!v) return exitTrip(S.leaving ? null : 'ທຣິບນີ້ຖືກລຶບແລ້ວ');
      S.info = v; addRecent(S.code, v.name); renderHeads(); renderTrip();
    }, err),
    be.onValue(P('members'), (v) => {
      S.members = v || {};
      if (!S.members[S.uid]) {
        if (S.joinedOnce && !S.leaving) return exitTrip('ເຈົ້າຖືກເອົາອອກຈາກທຣິບ');
        return;
      }
      S.joinedOnce = true;
      S.ready.members = true;
      renderAll();
      watchGroup();
    }, err),
    be.onValue(P('loc'), (v) => { S.loc = v || {}; S.ready.loc = true; renderMap(); renderCards(); renderTrip(); renderMeet(); watchGroup(); }, err),
    be.onValue(P('presence'), (v) => { S.presence = v || {}; renderTrip(); renderHeads(); }, err),
    be.onValue(P('meet'), (v) => { S.meet = v; S.ready.meet = true; if (!v) S.arrived = {}; renderMeet(); renderMap(); renderCards(); watchGroup(); }, err),
    be.onValue(P('sos'), (v) => { S.sos = v || {}; handleSos(); }, err),
    be.onValue(P('exp'), (v) => { S.exp = v || {}; EXP.render(); }, err),
    be.onChildAdded(P('msgs'), 150, (k, m) => addMsg(k, m), err),
  );
}

function onListenError() {
  if (S.leaving || !S.code) return;
  exitTrip('ເຂົ້າເຖິງທຣິບນີ້ບໍ່ໄດ້ອີກແລ້ວ');
}

function exitTrip(message) {
  if (!S.code) return;
  for (const f of S.unsubs) try { f && f(); } catch { /* already gone */ }
  S.unsubs = [];
  try { S.presenceOff && S.presenceOff(); } catch { /* ignore */ }
  S.presenceOff = null;
  stopGeo(); setWake(false); stopSiren(); closeSosAlert();
  S.code = null; S.info = null; S.members = {}; S.loc = {}; S.presence = {}; S.meet = null; S.sos = {}; S.exp = {};
  S.mySos = false; S.lastSent = null; S.unread = 0; S.centered = false;
  store.del('trip');
  clearMap();
  resetMsgs();
  showHome();
  if (message) toast(message);
}

async function leaveTrip() {
  if (!(await confirmBox('ອອກຈາກທຣິບ?', 'ໝູ່ຈະບໍ່ເຫັນຕຳແໜ່ງຂອງເຈົ້າອີກ. ເຂົ້າຄືນໄດ້ດ້ວຍລະຫັດທຣິບ.', 'ອອກ', true))) return;
  S.leaving = true;
  const uid = S.uid;
  try {
    await sendMsg({ type: 'sys', text: 'ອອກຈາກທຣິບ' });
    await Promise.all([S.be.remove(P(`loc/${uid}`)), S.be.remove(P(`presence/${uid}`)), S.be.remove(P(`sos/${uid}`))]);
    await S.be.remove(P(`members/${uid}`));
  } catch { /* offline — Firebase queues the writes */ }
  PUSH.forget(S.code, uid);
  store.set('recent', store.get('recent', []).filter((r) => r.code !== S.code));
  exitTrip('ອອກຈາກທຣິບແລ້ວ');
}

// Plain-text copy of the chat (text only; photos stay in the app) so it can be kept before the trip is deleted.
function exportChat() {
  const lines = [`TripMate · ${S.info?.name || ''} · ${S.code}`, ''];
  for (const el of $('msgs').children) {
    const m = el._m;
    if (!m) continue;
    const d = new Date(m.ts), pad = (n) => String(n).padStart(2, '0');
    const t = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const body = m.type === 'text' ? m.text : m.type === 'sys' ? m.text : m.type === 'img' ? '[ຮູບ]' : m.type === 'stk' ? '[ສະຕິກເກີ]' : m.type === 'loc' ? `[ຕຳແໜ່ງ ${m.lat},${m.lng}]`
      : m.type === 'meet' ? `[ນັດພົບ ${m.time || ''} ${m.text || ''}]` : m.type === 'sos' ? '[SOS]' : m.type === 'exp' ? `[ລາຍຈ່າຍ ${M.fmtMoney(m.amt, m.cur)} ${m.text || ''}]` : m.type === 'ping' ? '[ຖາມຢູ່ໃສ]' : '';
    lines.push(`${t}  ${memberName(m.uid, m.name)}: ${body}`);
  }
  const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `tripmate_${S.code}_chat.txt`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('ດາວໂຫຼດແຊັດແລ້ວ (.txt)');
}

// Delete confirmation that first offers to save what will disappear.
function confirmDelete() {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    modal({
      title: 'ລຶບທຣິບນີ້?',
      html: `<p class="muted">ຂໍ້ຄວາມ, ຮູບ, ຕຳແໜ່ງ, ລາຍຈ່າຍ ແລະ ບິນ ຈະຖືກລຶບຖາວອນ ສຳລັບທຸກຄົນ ແລະ ກູ້ຄືນບໍ່ໄດ້.</p>
        <div class="del-exp"><b>ເກັບໄວ້ກ່ອນລຶບ:</b>
          ${EXP.hasItems() ? `<button class="btn sm" id="dx-csv">${ic('download')} CSV ລາຍຈ່າຍ</button><button class="btn sm" id="dx-sum">${ic('copy')} ສຳເນົາສະຫຼຸບ</button>` : ''}
          <button class="btn sm" id="dx-chat">${ic('file')} ແຊັດ (.txt)</button></div>`,
      actions: [{ label: 'ຍົກເລີກ', onClick: () => fin(false) }, { label: 'ລຶບຖາວອນ', cls: 'danger', onClick: () => fin(true) }],
    });
    const bg = $('modal-root').lastElementChild;
    bg.querySelector('#dx-csv')?.addEventListener('click', () => EXP.exportCsv());
    bg.querySelector('#dx-sum')?.addEventListener('click', () => EXP.copySummary());
    bg.querySelector('#dx-chat')?.addEventListener('click', exportChat);
    new MutationObserver((_, obs) => { if (!bg.isConnected) { obs.disconnect(); fin(false); } }).observe($('modal-root'), { childList: true });
  });
}

async function deleteTrip() {
  if (!(await confirmDelete())) return;
  S.leaving = true;
  const code = S.code;
  try { await S.be.remove(`trips/${code}`); }
  catch { S.leaving = false; return toast('ລຶບບໍ່ສຳເລັດ — ລອງໃໝ່'); }
  store.set('recent', store.get('recent', []).filter((r) => r.code !== code));
  exitTrip();
  showHome();
  toast('ລຶບທຣິບແລ້ວ');
}

async function removeMember(uid) {
  if (!(await confirmBox(`ເອົາ ${memberName(uid)} ອອກ?`, 'ຄົນນີ້ຈະເຂົ້າຄືນໄດ້ ຖ້າຍັງມີລະຫັດທຣິບ.', 'ເອົາອອກ', true))) return;
  S.be.remove(P(`members/${uid}`)).catch(() => toast('ບໍ່ສຳເລັດ'));
}

/* =================== try-out (trip tab) =================== */
const TRY = [
  { k: 'msg', ic: 'chat', n: 'ຂໍ້ຄວາມໃໝ່' }, { k: 'ping', ic: 'mega', n: 'ຖາມຢູ່ໃສ' }, { k: 'meet', ic: 'flag', n: 'ນັດພົບ' },
  { k: 'arrive', ic: 'star', n: 'ຮອດຈຸດນັດ', isNew: true }, { k: 'join', ic: 'people', n: 'ໝູ່ເຂົ້າທຣິບ' }, { k: 'photo', ic: 'camera', n: 'ຮູບໃໝ່' },
  { k: 'bat', ic: 'battery', n: 'ແບັດໃກ້ໝົດ', isNew: true }, { k: 'away', ic: 'locate', n: 'ໝູ່ຫ່າງກຸ່ມ', isNew: true }, { k: 'off', ic: 'wifi', n: 'ເນັດຫຼຸດ' },
  { k: 'money', ic: 'wallet', n: 'ໝູ່ຈ່າຍເງິນ', isNew: true }, { k: 'sos', ic: 'sos', n: 'SOS (ທົດລອງ)' },
];
function tryAlert(k) {
  const who = S.profile?.name || 'ໝູ່';
  const T = {
    msg: () => say('msg', 'ນ້ອຍ', 'ໄປລ່ອງເຮືອຢາງກ່ອນເດີ້ 🛶'),
    money: () => say('money', 'ຕຸ້ຍ ຈ່າຍ 120,000 ₭', 'ເຂົ້າປຽກ 4 ຖ້ວຍ · ແຕະເພື່ອເບິ່ງ'),
    meet: () => say('meet', 'ນ້ອຍ ຕັ້ງຈຸດນັດພົບ 18:30', 'ຮ້ານເຂົ້າປຽກແຄມນ້ຳ'),
    arrive: () => say('arrive', 'ນ້ອຍ ຮອດຈຸດນັດແລ້ວ~!', 'ຮອດແລ້ວ 3/4 ຄົນ'),
    join: () => say('join', 'ຍິນດີຕ້ອນຮັບ ນ້ອຍ ✦', 'ເຂົ້າທຣິບແລ້ວ'),
    photo: () => say('photo', 'ນ້ອຍ ສົ່ງຮູບມາ 📷', 'ແຕະເພື່ອເບິ່ງ'),
    bat: () => say('bat', 'ຕຸ້ຍ ແບັດເຫຼືອ 15%', 'ໃກ້ໝົດແລ້ວ~ ຢູ່ໃກ້ໆກັນໄວ້ເດີ'),
    away: () => say('away', 'ມິດ ຫ່າງກຸ່ມ 1.2 ກມ', 'ແຕະເພື່ອເບິ່ງໃນແຜນທີ່'),
    off: () => say('off', 'ເນັດຫຼຸດ~', 'ຂໍ້ຄວາມຈະສົ່ງເອງເມື່ອມີເນັດ'),
    ping: () => showPing({ uid: S.uid, name: who }),
    sos: () => {
      const api = FX.bigAlert({
        cls: 'sos', face: 'cry', arms: 'up', mark: '!!', sound: 'sos', title: 'ນ້ອຍ ຕ້ອງການຄວາມຊ່ວຍເຫຼືອ!', sub: 'ນີ້ແມ່ນການທົດລອງ — ບໍ່ໄດ້ສົ່ງຫາໝູ່',
        actions: [{ label: 'ຮັບຊາບ (ປິດການທົດລອງ)', cls: 'yellow', onClick: (a) => a.close() }],
      });
      setTimeout(() => api.close(), 6000);
    },
  };
  T[k] && T[k]();
}

/* =================== group watcher: low battery, separated, arrived =================== */
// Runs on every location/meet update. The first snapshot after joining only records the starting
// state, so opening the app never fires a pile of old alerts.
function watchGroup() {
  // wait until members, locations and the meeting point have all arrived once, so the first pass is a silent baseline
  if (!S.code || !S.ready.members || !S.ready.loc || !S.ready.meet) return;
  const now = S.be.now();
  const live = [];
  for (const uid of Object.keys(S.members)) {
    const p = posOf(uid);
    if (p && p.lat != null && stateOf(uid, p, now) === 'live') live.push({ uid, lat: p.lat, lng: p.lng, bat: p.bat });
  }
  const quiet = !S.locInit;
  const goto = (uid) => () => { switchTab('map'); focusMember(uid); };

  for (const m of live) {
    // low battery; resets once above BAT_RESET so it cannot repeat while charging at 16-24%
    if (m.bat != null) {
      if (m.bat <= U.LOW_BAT && !S.lowBat[m.uid]) {
        S.lowBat[m.uid] = true;
        if (!quiet && m.uid !== S.uid) say('bat', `${memberName(m.uid)} ແບັດເຫຼືອ ${m.bat}%`, 'ໃກ້ໝົດແລ້ວ~ ຢູ່ໃກ້ໆກັນໄວ້ເດີ', goto(m.uid));
      } else if (m.bat >= U.BAT_RESET) S.lowBat[m.uid] = false;
    }
  }

  // separated from the group: needs 2+ live people; hysteresis between AWAY_M and BACK_M
  if (live.length >= 2) {
    const near = U.nearestOthers(live);
    for (const m of live) {
      const d = near[m.uid];
      if (d > U.AWAY_M && !S.away[m.uid]) {
        S.away[m.uid] = true;
        if (!quiet && now - S.awayAt > 60000) {
          S.awayAt = now;
          if (m.uid === S.uid) say('away', 'ເຈົ້າຫ່າງຈາກໝູ່ແລ້ວ', `ໄກຈາກຄົນໃກ້ສຸດ ${U.fmtDistance(d)}`, () => { switchTab('map'); fitAll(); });
          else say('away', `${memberName(m.uid)} ຫ່າງກຸ່ມ ${U.fmtDistance(d)}`, 'ແຕະເພື່ອເບິ່ງໃນແຜນທີ່', goto(m.uid));
        }
      } else if (d < U.BACK_M) S.away[m.uid] = false;
    }
  }

  // arrived at the meeting point: once per person per meeting
  if (S.meet) {
    if (S.meetTs !== S.meet.ts) { S.meetTs = S.meet.ts; S.arrived = {}; }
    const total = Object.keys(S.members).length;
    for (const uid of Object.keys(S.members)) {
      const p = posOf(uid);
      const here = p && p.lat != null && U.distanceM(p, S.meet) <= U.ARRIVED_M;
      if (here && !S.arrived[uid]) {
        S.arrived[uid] = true;
        if (!quiet) {
          const n = Object.keys(S.arrived).length;
          say('arrive', uid === S.uid ? 'ເຈົ້າຮອດຈຸດນັດແລ້ວ~!' : `${memberName(uid)} ຮອດຈຸດນັດແລ້ວ~!`, `ຮອດແລ້ວ ${n}/${total} ຄົນ`, () => switchTab('map'));
        }
      }
    }
  }
  S.locInit = true;
}

/* =================== push to the others when the app is closed =================== */
function pushFor(m) {
  if (!PUSH.configured()) return;
  const who = S.profile?.name || 'ໝູ່', title = S.info?.name || 'TripMate';
  const preview = { text: m.text, img: '📷 ສົ່ງຮູບມາ', stk: 'ສົ່ງສະຕິກເກີ', loc: '📍 ແຊຣ໌ຕຳແໜ່ງ', meet: `🚩 ຕັ້ງຈຸດນັດພົບ ${m.time || ''}`, exp: m.kind === 'pay' ? '💸 ບັນທຶກການໂອນເງິນ' : `💰 ຈ່າຍ ${M.fmtMoney(m.amt || 0, m.cur || 'LAK')} ${m.text || ''}` }[m.type];
  if (m.type === 'sos') return PUSH.notify({ title: `🆘 SOS ຈາກ ${who}`, body: 'ຕ້ອງການຄວາມຊ່ວຍເຫຼືອ! ເປີດແອັບເບິ່ງຕຳແໜ່ງ', urgent: true, tag: 'tm-sos' });
  if (m.type === 'ping') return PUSH.notify({ title, body: `📣 ${who} ຖາມວ່າເຈົ້າຢູ່ໃສ?`, to: m.to, tag: 'tm-ping' });
  if (m.type === 'sys') return m.ev === 'join' ? PUSH.notify({ title, body: `👋 ${who} ເຂົ້າທຣິບແລ້ວ` }) : undefined;
  if (preview) PUSH.notify({ title, body: `${who}: ${preview}` });
}

/* =================== presence & visibility =================== */
function startPresence() {
  if (!S.code || S.leaving) return;
  try { S.presenceOff && S.presenceOff(); } catch { /* ignore */ }
  S.be.presence(P(`presence/${S.uid}`), { on: !document.hidden, ts: S.be.now() }, { on: false })
    .then((off) => { S.presenceOff = off; }).catch(() => {});
}

function onVisibility() {
  if (!S.code) return;
  if (document.hidden) {
    S.be.set(P(`presence/${S.uid}`), { on: false, ts: S.be.now() }).catch(() => {});
  } else {
    startPresence();
    heartbeat(true);
    if (S.wake && !S.wakeLock) setWake(true);
    tick();
  }
}

function tick() {
  if (!S.code) return;
  if (S.pauseUntil && Date.now() > S.pauseUntil) {
    S.pauseUntil = 0; store.set('pauseUntil', 0);
    toast('ເປີດແຊຣ໌ຕຳແໜ່ງຄືນແລ້ວ');
    maybeStartGeo();
  }
  renderCards(); renderMeet(); renderTrip(); renderStatus(); renderMap();
}

// GPS may go quiet while standing still — re-send the last fix so friends see "ຫາກໍ່ນີ້".
function heartbeat(force) {
  if (!S.code || !S.me || !sharingActive() || document.hidden || S.geo !== 'ok') return;
  const fix = { ...S.me, ts: S.be.now() };
  if (force === true || U.shouldSend(S.lastSent, fix, { sos: S.mySos })) sendLoc(fix);
}

/* =================== geolocation =================== */
function maybeStartGeo() {
  if (!S.code) return;
  if (!sharingActive()) { stopGeo(); pushSharingOff(); renderStatus(); return; }
  if (!('geolocation' in navigator)) { S.geo = 'unavailable'; renderStatus(); return; }
  if (!store.get('geoAsked')) { askGeo(); return; }
  startGeo();
}

function askGeo() {
  S.geo = 'idle'; renderStatus();
  modal({
    title: '📍 ອະນຸຍາດໃຫ້ໃຊ້ຕຳແໜ່ງ',
    html: '<p>ເພື່ອໃຫ້ໝູ່ໃນທຣິບເຫັນວ່າເຈົ້າຢູ່ໃສ ເວລາແຍກກັນ.</p><p class="muted" style="font-size:14px">ປິດ ຫຼື ຢຸດແຊຣ໌ໄດ້ທຸກເວລາໃນແຖບ "ທຣິບ". ເຫັນໄດ້ສະເພາະຄົນໃນທຣິບນີ້ເທົ່ານັ້ນ.</p>',
    actions: [
      { label: 'ຍັງກ່ອນ' },
      { label: 'ອະນຸຍາດ', cls: 'primary', onClick: () => { store.set('geoAsked', true); startGeo(); } },
    ],
  });
}

function startGeo() {
  if (S.watchId != null || !('geolocation' in navigator)) return;
  S.geo = 'waiting'; renderStatus();
  S.watchId = navigator.geolocation.watchPosition(onFix, onGeoError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}

function stopGeo() {
  if (S.watchId != null) navigator.geolocation.clearWatch(S.watchId);
  S.watchId = null;
  if (S.geo !== 'denied') S.geo = 'idle';
}

function onGeoError(e) {
  if (e.code === 1) { stopGeo(); S.geo = 'denied'; }
  else if (S.geo !== 'ok') S.geo = 'waiting';
  renderStatus();
}

function onFix(pos) {
  const c = pos.coords;
  const fix = { lat: +c.latitude.toFixed(6), lng: +c.longitude.toFixed(6), acc: Math.round(c.accuracy || 0), ts: S.be.now() };
  S.me = fix; S.geo = 'ok';
  if (map && !S.centered) { map.setView([fix.lat, fix.lng], 16); S.centered = true; }
  if (sharingActive() && S.code && U.shouldSend(S.lastSent, fix, { sos: S.mySos })) sendLoc(fix);
  renderMap(); renderCards(); renderStatus(); renderMeet(); updateSmsLink(); watchGroup();
}

let batteryMgr = null;
async function batteryLevel() {
  try {
    if (!batteryMgr && navigator.getBattery) batteryMgr = await navigator.getBattery();
    return batteryMgr ? Math.round(batteryMgr.level * 100) : null;
  } catch { return null; }
}

async function sendLoc(fix) {
  if (!S.code) return;
  S.lastSent = fix;
  const bat = await batteryLevel();
  const data = { lat: fix.lat, lng: fix.lng, acc: fix.acc, ts: fix.ts, sharing: true };
  if (bat != null) data.bat = bat;
  S.be.set(P(`loc/${S.uid}`), data).catch(() => {});
  if (S.mySos) S.be.update(P(`sos/${S.uid}`), { lat: fix.lat, lng: fix.lng, ts: fix.ts }).catch(() => {});
}

function pushSharingOff() {
  if (S.code && S.loc[S.uid]) S.be.update(P(`loc/${S.uid}`), { sharing: false, ts: S.be.now() }).catch(() => {});
  S.lastSent = null;
}

function setSharing(on) {
  S.sharing = on; store.set('sharing', on);
  if (on) { S.pauseUntil = 0; store.set('pauseUntil', 0); maybeStartGeo(); }
  else { stopGeo(); pushSharingOff(); }
  renderAll();
}

function pauseSharing() {
  if (S.pauseUntil > Date.now()) { S.pauseUntil = 0; store.set('pauseUntil', 0); maybeStartGeo(); renderAll(); return; }
  S.pauseUntil = Date.now() + 3600e3; store.set('pauseUntil', S.pauseUntil);
  stopGeo(); pushSharingOff();
  toast(`ຢຸດແຊຣ໌ຮອດ ${U.fmtTime(S.pauseUntil)}`);
  renderAll();
}

async function setWake(on) {
  S.wake = on;
  if (on && 'wakeLock' in navigator) {
    try {
      S.wakeLock = await navigator.wakeLock.request('screen');
      S.wakeLock.addEventListener('release', () => { S.wakeLock = null; renderWake(); });
      toast('💡 ເປີດຈໍຄ້າງແລ້ວ — ໝູ່ຈະເຫັນເຈົ້າຕະຫຼອດ');
    } catch { S.wake = false; toast('ເປີດຈໍຄ້າງບໍ່ໄດ້ໃນເຄື່ອງນີ້'); }
  } else if (on) { S.wake = false; toast('ເຄື່ອງນີ້ບໍ່ຮອງຮັບການເປີດຈໍຄ້າງ'); }
  else if (S.wakeLock) { S.wakeLock.release().catch(() => {}); S.wakeLock = null; }
  renderWake();
}

function renderWake() {
  $('sw-wake').checked = S.wake;
  renderCards(); renderStatus();
}

/* =================== map =================== */
let map = null, baseLayer = null, labelLayer = null;
const pins = new Map();
let accCircle = null, meetPin = null, flashPin = null;
// Keep popups clear of the top bars and the cards at the bottom.
const POPUP = { closeButton: false, autoPanPaddingTopLeft: [10, 170], autoPanPaddingBottomRight: [70, 260] };

// CARTO now needs an API key, so the clean look comes from OSM tiles + a CSS filter (keeps Lao labels, inverts for dark mode).
const LAYERS = {
  std: { name: 'ມາດຕະຖານ', sub: 'ສະອາດ ອ່ານງ່າຍ', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', soft: true, sw: 'linear-gradient(135deg,#e8eef0,#cfe3df)' },
  osm: { name: 'ລາຍລະອຽດ', sub: 'ສີເຕັມ OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', soft: false, sw: 'linear-gradient(135deg,#f2efe9,#aad3df 60%,#cdebb0)' },
  sat: {
    name: 'ດາວທຽມ', sub: 'ພາບຖ່າຍຈາກອາວະກາດ', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', sw: 'linear-gradient(135deg,#2f4f2f,#6b8e23 50%,#3e5f8a)',
  },
};
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function initMap() {
  if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
  map = L.map('map', { zoomControl: false, attributionControl: false }).setView([17.9667, 102.6], 13); // Vientiane until GPS arrives
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
  setLayer(S.layer);
  map.on('click', (e) => {
    $('layer-menu').hidden = true;
    if (S.picking) { setPicking(false); openMeetForm(e.latlng); }
  });
}

function setLayer(key) {
  if (!LAYERS[key]) key = 'std';
  S.layer = key; store.set('layer', key);
  if (!map) return;
  const L0 = LAYERS[key];
  baseLayer && baseLayer.remove(); labelLayer && labelLayer.remove(); labelLayer = null;
  const soft = L0.soft || (key === 'osm' && isDark());
  baseLayer = L.tileLayer(L0.url, {
    maxZoom: 20, maxNativeZoom: key === 'sat' ? 18 : 19, className: soft ? 'tiles-soft' : '',
    attribution: key === 'sat' ? 'Tiles © Esri' : OSM_ATTR,
  }).addTo(map);
  // Place names only when zoomed out — up close Esri's POI labels clutter the photo.
  if (L0.labels) labelLayer = L.tileLayer(L0.labels, { maxZoom: 15, pane: 'overlayPane' }).addTo(map);
  renderLayerMenu();
}

function renderLayerMenu() {
  $('layer-menu').innerHTML = Object.entries(LAYERS).map(([k, l]) =>
    `<button data-layer="${k}" aria-checked="${k === S.layer}"><span class="sw" style="background:${l.sw}"></span><span><div>${l.name}</div><div class="muted" style="font-size:12px;font-weight:500">${l.sub}</div></span></button>`).join('');
}

function clearMap() {
  for (const m of pins.values()) m.remove();
  pins.clear();
  accCircle && accCircle.remove(); accCircle = null;
  meetPin && meetPin.remove(); meetPin = null;
  flashPin && flashPin.remove(); flashPin = null;
}

function posOf(uid) {
  if (uid === S.uid && S.me && sharingActive()) return { ...S.me, sharing: true, bat: S.loc[uid]?.bat };
  return S.loc[uid];
}

function stateOf(uid, p, now) {
  return uid === S.uid && sharingActive() && S.me ? 'live' : U.locState(p, now);
}

let mapDirty = false;
function renderMap() {
  if (!map || !S.code) return;
  if (S.tab !== 'map') { mapDirty = true; return; }
  mapDirty = false;
  const now = S.be.now();
  const seen = new Set();
  for (const [uid, m] of Object.entries(S.members)) {
    const p = posOf(uid);
    if (!p || p.lat == null) continue;
    seen.add(uid);
    const st = stateOf(uid, p, now);
    const cls = ['mk-wrap', uid === S.uid ? 'me' : '', st !== 'live' ? st : '', S.sos[uid] ? 'sos' : ''].join(' ').trim();
    const key = `${cls}|${m.name}|${m.color}|${m.emoji || ''}`;
    let mk = pins.get(uid);
    if (!mk) {
      mk = L.marker([p.lat, p.lng], { zIndexOffset: uid === S.uid ? 1000 : 0 }).addTo(map);
      mk.bindPopup(() => popupHtml(uid), POPUP);
      pins.set(uid, mk);
    } else mk.setLatLng([p.lat, p.lng]);
    if (mk._key !== key) {
      mk._key = key;
      mk.setIcon(L.divIcon({
        className: cls, iconSize: [48, 58], iconAnchor: [24, 57], popupAnchor: [0, -58],
        html: `<div class="mk" style="--c:${esc(m.color)}"><div class="mk-tail"></div><div class="mk-av">${avatarInner(m)}</div><div class="mk-name">${esc(uid === S.uid ? 'ຂ້ອຍ' : m.name)}</div></div>`,
      }));
    }
    if (mk.isPopupOpen()) mk.getPopup().update();
  }
  for (const [uid, mk] of pins) if (!seen.has(uid)) { mk.remove(); pins.delete(uid); }

  if (S.me && sharingActive() && S.me.acc < 1000) {
    if (!accCircle) accCircle = L.circle([S.me.lat, S.me.lng], { radius: S.me.acc, color: '#06b6d4', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
    else { accCircle.setLatLng([S.me.lat, S.me.lng]); accCircle.setRadius(S.me.acc); }
  } else if (accCircle) { accCircle.remove(); accCircle = null; }

  if (S.meet) {
    const ll = [S.meet.lat, S.meet.lng];
    if (!meetPin) {
      meetPin = L.marker(ll, { icon: L.divIcon({ className: 'mk-wrap', html: `<div class="flag">${ic('flag')}</div>`, iconSize: [44, 44], iconAnchor: [4, 44] }), zIndexOffset: 500 }).addTo(map);
      meetPin.bindPopup(() => `<div class="pop-t">🚩 ນັດພົບ ${esc(S.meet?.time || '')}</div><div>${esc(S.meet?.note || '')}</div>`, POPUP);
    } else meetPin.setLatLng(ll);
  } else if (meetPin) { meetPin.remove(); meetPin = null; }
}

function popupHtml(uid) {
  const m = S.members[uid] || {};
  const p = posOf(uid);
  if (!p) return esc(m.name);
  if (uid === S.uid) return `<div class="pop-t">${esc(m.name)} (ຂ້ອຍ)</div><div class="muted">ຄວາມແມ່ນຍຳ ±${p.acc ?? '?'} ມ</div>`;
  const d = S.me ? U.distanceM(S.me, p) : null;
  const st = U.locState(p, S.be.now());
  return `<div class="pop-t">${esc(m.name)}</div>
    <div class="muted">${st === 'off' ? 'ປິດການແຊຣ໌ · ' : ''}ອັບເດດ ${esc(U.fmtAgo(p.ts, S.be.now()))}${d != null ? ` · ຫ່າງ ${U.fmtDistance(d)}` : ''}</div>
    <div class="pop-a"><a class="btn sm primary" href="${U.mapsUrl(p.lat, p.lng)}" target="_blank" rel="noopener">ນຳທາງ</a></div>`;
}

// moveend can be skipped when the browser throttles animation frames — the timer is a fallback.
function afterFly(fn) {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  map.once('moveend', run);
  setTimeout(run, 1200);
}

function focusMember(uid) {
  const p = posOf(uid);
  if (!p || !map) return toast(`${memberName(uid)} ຍັງບໍ່ໄດ້ແຊຣ໌ຕຳແໜ່ງ`);
  const mk = pins.get(uid);
  mk && afterFly(() => mk.openPopup());
  map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
}

function focusPoint(lat, lng, label) {
  switchTab('map');
  if (!map) return;
  flashPin && flashPin.remove();
  flashPin = L.circleMarker([lat, lng], { radius: 11, color: '#fff', weight: 3, fillColor: '#06b6d4', fillOpacity: 0.9 }).addTo(map);
  if (label) {
    flashPin.bindPopup(esc(label), POPUP);
    afterFly(() => flashPin && flashPin.openPopup());
  }
  map.flyTo([lat, lng], 17, { duration: 0.6 });
}

function fitAll() {
  const pts = Object.keys(S.members).map(posOf).filter((p) => p && p.lat != null).map((p) => [p.lat, p.lng]);
  if (S.meet) pts.push([S.meet.lat, S.meet.lng]);
  if (!pts.length) return toast('ຍັງບໍ່ມີໃຜແຊຣ໌ຕຳແໜ່ງ');
  if (pts.length === 1) return map.flyTo(pts[0], 16, { duration: 0.6 });
  map.flyToBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 170], paddingBottomRight: [70, 250], maxZoom: 17, duration: 0.6 });
}

const ARROW = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 19 20l-7-4-7 4z"/></svg>';
const NAV_IC = ic('locate');

// The card strip is a swipeable scroller: rewriting it mid-swipe made it stick. Hold updates while a finger is on it,
// skip them while another tab is open, and patch only the cards whose content changed.
let cardsBusy = false, cardsDirty = false, cardsTimer = 0;
function cardsHold() { cardsBusy = true; clearTimeout(cardsTimer); }
function cardsRelease() {
  clearTimeout(cardsTimer);
  cardsTimer = setTimeout(() => { cardsBusy = false; if (cardsDirty) renderCards(); }, 450);
}

function renderCards() {
  if (!S.code) return;
  if (S.tab !== 'map' || cardsBusy) { cardsDirty = true; return; }
  cardsDirty = false;
  const now = S.be.now();
  const rows = Object.entries(S.members).map(([uid, m]) => {
    const p = posOf(uid);
    const d = uid !== S.uid && S.me && p && p.lat != null ? U.distanceM(S.me, p) : null;
    return { uid, m, p, d };
  }).sort((a, b) => (a.uid === S.uid ? -1 : b.uid === S.uid ? 1 : (a.d ?? 1e12) - (b.d ?? 1e12)));

  const items = rows.map(({ uid, m, p, d }) => {
    const mine = uid === S.uid;
    const st = mine ? (sharingActive() && S.me ? 'live' : 'off') : U.locState(p, now);
    const paused = S.pauseUntil > Date.now();
    const tags = [];
    let sub;
    if (mine) sub = !S.sharing ? 'ປິດການແຊຣ໌' : paused ? `ຢຸດຮອດ ${U.fmtTime(S.pauseUntil)}` : S.me ? `ກຳລັງແຊຣ໌ · ±${S.me.acc} ມ` : 'ລໍຖ້າ GPS…';
    else if (!p || p.lat == null) sub = 'ຍັງບໍ່ມີຕຳແໜ່ງ';
    else sub = st === 'off' ? `ປິດແຊຣ໌ · ${U.fmtAgo(p.ts, now)}` : `${S.presence[uid]?.on ? '🟢 ' : ''}${U.fmtAgo(p.ts, now)}`;

    if (S.sos[uid]) tags.push(`<span class="tag bad">${ic('sos')} SOS</span>`);
    if (d != null) tags.push(`<span class="tag dist"><span style="display:inline-flex;transform:rotate(${Math.round(U.bearingDeg(S.me, p))}deg)">${ARROW}</span>${U.fmtDistance(d)}</span>`);
    if (S.meet && p && p.lat != null && U.distanceM(p, S.meet) <= U.ARRIVED_M) tags.push('<span class="tag ok">✓ ຮອດຈຸດນັດ</span>');
    if (p && p.bat != null) tags.push(`<span class="tag ${p.bat <= 20 ? 'bad' : ''}">${ic('battery')} ${p.bat}%</span>`);
    if (!tags.length && mine) tags.push(`<span class="tag">${S.mySos ? `${ic('sos')} SOS ເປີດຢູ່` : 'ນີ້ແມ່ນເຈົ້າ'}</span>`);

    const acts = mine
      ? `<button class="mini ${S.wake ? 'on' : ''}" data-act="wake">${ic('bulb')} ຈໍຄ້າງ</button><button class="mini ${paused ? 'on' : ''}" data-act="pause">${ic('pause')} ${paused ? 'ເປີດຄືນ' : 'ຢຸດ 1 ຊມ'}</button>`
      : `${p && p.lat != null ? `<a class="mini" data-act="nav" href="${U.mapsUrl(p.lat, p.lng)}" target="_blank" rel="noopener">${NAV_IC}ນຳທາງ</a>` : ''}<button class="mini" data-act="ping">${ic('mega')} ຖາມຢູ່ໃສ</button>`;

    const html = `<div class="mcard glass ${st} ${S.sos[uid] ? 'sos' : ''}" data-uid="${esc(uid)}" role="button" tabindex="0">
      <div class="mc-top">${avatar(m, st === 'live' ? 'ring' : '')}<div class="grow"><div class="mc-name">${esc(m.name)}${mine ? ' (ຂ້ອຍ)' : ''}</div><div class="mc-sub">${esc(sub)}</div></div></div>
      <div class="mc-mid">${tags.join('')}</div>
      <div class="mc-act">${acts}</div></div>`;
    return { uid, html };
  });
  const box = $('cards'), cur = box.children;
  const same = cur.length === items.length && items.every((it, i) => cur[i].dataset.uid === it.uid);
  const make = (html) => { const t = document.createElement('template'); t.innerHTML = html; const el = t.content.firstElementChild; el._h = html; return el; };
  if (same) {
    items.forEach((it, i) => { if (cur[i]._h !== it.html) cur[i].replaceWith(make(it.html)); });
  } else {
    const x = box.scrollLeft;
    box.replaceChildren(...items.map((it) => make(it.html)));
    box.scrollLeft = x;
  }
}

function setPicking(on) {
  S.picking = on;
  $('pick-hint').hidden = !on;
  $('c-meet').classList.toggle('on', on);
  if (map) map.getContainer().style.cursor = on ? 'crosshair' : '';
}

function openMeetForm(latlng) {
  const t = new Date(Date.now() + 30 * 60000);
  t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5);
  const def = U.fmtTime(t.getTime());
  modal({
    title: '🚩 ຕັ້ງຈຸດນັດພົບ',
    html: `<div class="label">ເວລາ</div><input id="mt-time" type="time" class="input" value="${def}">
      <div class="label">ລາຍລະອຽດ (ບໍ່ບັງຄັບ)</div><input id="mt-note" class="input" maxlength="80" placeholder="ເຊັ່ນ: ໜ້າຮ້ານກາເຟ">`,
    actions: [
      { label: 'ຍົກເລີກ' },
      {
        label: 'ຕັ້ງນັດພົບ', cls: 'primary', onClick: () => {
          const time = $('mt-time').value || def;
          const note = $('mt-note').value.trim();
          const lat = +latlng.lat.toFixed(6), lng = +latlng.lng.toFixed(6);
          S.be.set(P('meet'), { lat, lng, time, note, by: S.uid, ts: S.be.now() }).catch(() => toast('ບໍ່ສຳເລັດ'));
          sendMsg({ type: 'meet', lat, lng, time, text: note });
          haptic();
        },
      },
    ],
  });
}

function renderMeet() {
  const m = S.meet;
  $('meet-bar').hidden = !m;
  if (!m) return;
  const d = S.me ? U.distanceM(S.me, m) : null;
  const total = Object.keys(S.members).length;
  const arrived = Object.keys(S.members).filter((uid) => { const p = posOf(uid); return p && p.lat != null && U.distanceM(p, m) <= U.ARRIVED_M; }).length;
  $('meet-t1').textContent = `ນັດພົບ ${m.time}${m.note ? ' · ' + m.note : ''}`;
  $('meet-t2').textContent = [d != null ? `ຫ່າງ ${U.fmtDistance(d)}` : '', `ຮອດແລ້ວ ${arrived}/${total} ຄົນ`].filter(Boolean).join(' · ');
  $('meet-nav').href = U.mapsUrl(m.lat, m.lng);
}

async function clearMeet() {
  if (!(await confirmBox('ຍົກເລີກຈຸດນັດພົບ?', 'ທຸກຄົນຈະບໍ່ເຫັນຈຸດນັດພົບນີ້ອີກ.', 'ຍົກເລີກນັດ', true))) return;
  await S.be.remove(P('meet')).catch(() => {});
  sendMsg({ type: 'sys', text: 'ຍົກເລີກຈຸດນັດພົບ' });
}

/* =================== heads & status =================== */
function renderHeads() {
  if (!S.code) return;
  const list = Object.entries(S.members).sort(([a], [b]) => (a === S.uid ? -1 : b === S.uid ? 1 : 0)).map(([, m]) => m);
  const n = list.length;
  const on = Object.keys(S.members).filter((u) => S.presence[u]?.on).length;
  const name = S.info?.name || 'ທຣິບ';
  const sub = `${n} ຄົນ · ອອນລາຍ ${on}`, st1 = avatarStack(list), st2 = avatarStack(list, 3);
  const key = `${name}|${sub}|${st1}`;
  if (renderHeads.k === key) return;
  renderHeads.k = key;
  $('map-title').textContent = name;
  $('map-sub').textContent = sub;
  $('map-stack').innerHTML = st1;
  $('chat-title').textContent = name;
  $('chat-sub').textContent = sub;
  $('chat-stack').innerHTML = st2;
}

function renderStatus() {
  if (!S.code) return;
  const el = $('status');
  let cls = 'off', txt, act = null;
  if (!S.online) { cls = 'warn'; txt = 'ບໍ່ມີອິນເຕີເນັດ — ຈະສົ່ງເມື່ອມີເນັດ'; }
  else if (!S.sharing) { txt = 'ປິດການແຊຣ໌ · ແຕະເພື່ອເປີດ'; act = () => setSharing(true); }
  else if (S.pauseUntil > Date.now()) { txt = `ຢຸດແຊຣ໌ຮອດ ${U.fmtTime(S.pauseUntil)}`; act = pauseSharing; }
  else if (S.geo === 'denied') { cls = 'warn'; txt = 'ບໍ່ໄດ້ອະນຸຍາດ GPS · ແຕະເບິ່ງວິທີແກ້'; act = geoHelp; }
  else if (S.geo === 'unavailable') { cls = 'warn'; txt = 'ເຄື່ອງນີ້ບໍ່ຮອງຮັບ GPS'; }
  else if (S.geo === 'waiting') { cls = 'warn'; txt = 'ກຳລັງຫາສັນຍານ GPS…'; }
  else if (S.geo === 'ok') { cls = 'live'; txt = S.wake ? 'ກຳລັງແຊຣ໌ຕຳແໜ່ງ · ຈໍຄ້າງ' : 'ກຳລັງແຊຣ໌ຕຳແໜ່ງ'; }
  else { txt = 'ແຕະເພື່ອເປີດແຊຣ໌ຕຳແໜ່ງ'; act = askGeo; }
  el.className = 'pill glass ' + cls;
  $('status-txt').textContent = txt;
  el.onclick = () => act && act();
}

function geoHelp() {
  modal({
    title: 'ເປີດການອະນຸຍາດ GPS',
    html: isIOS
      ? '<ol class="steps"><li>ເປີດ <b>ການຕັ້ງຄ່າ (Settings)</b> → <b>ຄວາມເປັນສ່ວນຕົວ ແລະ ຄວາມປອດໄພ</b> → <b>ບໍລິການຕຳແໜ່ງ</b> → ເປີດ</li><li>ລົງໄປຫາ <b>Safari Websites</b> → ເລືອກ <b>ໃນຂະນະໃຊ້ແອັບ</b></li><li>ກັບມາແອັບນີ້ ແລ້ວກົດ "ລອງໃໝ່"</li></ol>'
      : '<ol class="steps"><li>ເປີດ GPS / ຕຳແໜ່ງ ຂອງເຄື່ອງ (ດຶງແຖບດ້ານເທິງລົງ)</li><li>ໃນ Chrome ແຕະໄອຄອນ 🔒 ຂ້າງທີ່ຢູ່ເວັບ → <b>ການອະນຸຍາດ</b> → <b>ຕຳແໜ່ງ</b> → ອະນຸຍາດ</li><li>ກັບມາແອັບນີ້ ແລ້ວກົດ "ລອງໃໝ່"</li></ol>',
    actions: [{ label: 'ປິດ' }, { label: 'ລອງໃໝ່', cls: 'primary', onClick: () => { S.geo = 'idle'; stopGeo(); startGeo(); } }],
  });
}

/* =================== ping ("where are you?") =================== */
function ping(uid) {
  if (Date.now() - (S.lastPing[uid] || 0) < 30000) return toast('ຫາກໍ່ຖາມໄປ — ລໍຖ້າບຶດໜຶ່ງ');
  S.lastPing[uid] = Date.now();
  sendMsg({ type: 'ping', to: uid });
  haptic(20);
  toast(`📣 ຖາມ ${memberName(uid)} ວ່າຢູ່ໃສແລ້ວ`);
}

function showPing(m) {
  const from = memberName(m.uid, m.name);
  if (document.hidden) notify(`📣 ${from}`, 'ຖາມວ່າເຈົ້າຢູ່ໃສແລ້ວ?');
  FX.bigAlert({
    cls: 'ping', face: 'surprised', arms: 'up', mark: '!?', sound: 'ping',
    title: `${from} ຖາມວ່າ ເຈົ້າຢູ່ໃສແລ້ວ?!`, sub: 'ໝູ່ຢາກເຫັນເຈົ້າເທິງແຜນທີ່',
    actions: [
      { label: 'ແຊຣ໌ຕຳແໜ່ງ ✦', cls: 'main', onClick: (a) => {
        a.close();
        if (!sharingActive()) setSharing(true);
        if (S.me) { sendMyLocation(); heartbeat(true); } else { maybeStartGeo(); toast('ກຳລັງຫາ GPS…'); }
      } },
      { label: 'ປິດ', onClick: (a) => a.close() },
    ],
  });
}

/* =================== chat =================== */
function resetMsgs() {
  S.msgIds.clear(); S.pending.clear();
  imgObs && imgObs.disconnect();
  msgNear = true;
  $('msgs').innerHTML = '<div class="empty" id="msgs-empty"><div class="big">💬</div>ຍັງບໍ່ມີຂໍ້ຄວາມ<br>ທັກທາຍໝູ່ເລີຍ!</div>';
}

async function sendMsg(obj) {
  if (!S.code) return;
  const key = S.be.newKey(P('msgs'));
  const msg = { uid: S.uid, name: S.profile.name, ts: S.be.now(), ...obj };
  for (const k of Object.keys(msg)) if (msg[k] === undefined || msg[k] === '') delete msg[k];
  S.pending.add(key);
  try {
    await S.be.set(P(`msgs/${key}`), msg);
    pushFor(msg);
  } catch {
    toast('ສົ່ງຂໍ້ຄວາມບໍ່ສຳເລັດ');
    document.querySelector(`[data-k="${key}"]`)?.remove();
  } finally {
    S.pending.delete(key);
    document.querySelector(`[data-k="${key}"]`)?.classList.remove('pending');
  }
  return key;
}

function sendText(textArg) {
  const ta = $('m-text');
  const quick = typeof textArg === 'string';
  const text = (quick ? textArg : ta.value).trim();
  if (!text) return;
  if (!quick) { ta.value = ''; autosize(); }
  sendMsg({ type: 'text', text });
  haptic();
  if (!coarse && !quick) ta.focus();
}

function openStickers() {
  const arms = { happy: 'wave', surprised: 'up', star: 'up', wink: 'hold', sleepy: 'down', look: 'hold', dizzy: 'down', cry: 'up', normal: 'down' };
  const close = modal({
    title: 'ສະຕິກເກີນ້ອງປິນ',
    html: `<div class="stk-grid">${FX_FACES.map((f) => `<button data-f="${f}">${FX.pin(f, arms[f])}${FX.FACE_NAMES[f]}</button>`).join('')}</div>`,
    actions: [{ label: 'ປິດ' }],
  });
  $('modal-root').lastElementChild.querySelector('.stk-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    sendMsg({ type: 'stk', face: b.dataset.f, arms: arms[b.dataset.f] });
    haptic();
    close();
  });
}

function sendMyLocation() {
  if (!S.me) {
    toast('ຍັງບໍ່ມີສັນຍານ GPS');
    if (sharingActive()) maybeStartGeo();
    return;
  }
  sendMsg({ type: 'loc', lat: S.me.lat, lng: S.me.lng, acc: S.me.acc });
  haptic();
}

async function sendPhoto(file) {
  if (!file) return;
  toast('ກຳລັງສົ່ງຮູບ…');
  try {
    const { data, w, h } = await compressImage(file);
    const key = S.be.newKey(P('msgs'));
    S.imgCache.set(key, data);
    await S.be.set(P(`imgs/${key}`), data);
    S.pending.add(key);
    await S.be.set(P(`msgs/${key}`), { uid: S.uid, name: S.profile.name, ts: S.be.now(), type: 'img', w, h });
    S.pending.delete(key);
    document.querySelector(`[data-k="${key}"]`)?.classList.remove('pending');
    pushFor({ type: 'img' });
  } catch (e) {
    toast(e.message && /ພື້ນທີ່/.test(e.message) ? e.message : 'ສົ່ງຮູບບໍ່ສຳເລັດ');
  }
}

function loadImageEl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

async function compressImage(file) {
  const img = await loadImageEl(file);
  let max = 1280, q = 0.72, out;
  const cv = document.createElement('canvas');
  for (let i = 0; i < 6; i++) {
    const { w, h } = U.fitSize(img.naturalWidth, img.naturalHeight, max);
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    out = { data: cv.toDataURL('image/jpeg', q), w, h };
    if (out.data.length < 330000) return out;
    max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.06);
  }
  if (out.data.length < 400000) return out;
  throw new Error('image too large');
}

function dayLabel(ts) {
  const d = new Date(ts), now = new Date();
  const key = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (key(d) === key(now)) return 'ມື້ນີ້';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (key(d) === key(y)) return 'ມື້ວານ';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function msgHtml(k, m) {
  const name = memberName(m.uid, m.name);
  const attrs = `data-k="${esc(k)}" data-uid="${esc(m.uid)}" data-ts="${Number(m.ts) || 0}"`;
  if (m.type === 'sys') return `<div class="sys" ${attrs}><span>${esc(name)} ${esc(m.text)} · ${U.fmtTime(m.ts)}</span></div>`;
  if (m.type === 'ping') {
    const to = m.to === S.uid ? 'ເຈົ້າ' : memberName(m.to);
    return `<div class="sys ping" ${attrs}><span>📣 ${esc(name)} ຖາມ ${esc(to)} ວ່າຢູ່ໃສ · ${U.fmtTime(m.ts)}</span></div>`;
  }
  const mine = m.uid === S.uid;
  const dist = m.lat != null && S.me && !mine ? `ຫ່າງ ${U.fmtDistance(U.distanceM(S.me, { lat: m.lat, lng: m.lng }))} · ` : '';
  let body;
  switch (m.type) {
    case 'loc':
      body = `<div class="bubble cm loc" data-act="loc"><div class="cm-ic">${ic('pin')}</div><div><div class="ct">ຕຳແໜ່ງຂອງ ${esc(name)}</div><div class="cs">${dist}ແຕະເບິ່ງແຜນທີ່</div></div></div>`; break;
    case 'meet':
      body = `<div class="bubble cm meet" data-act="loc"><div class="cm-ic">${ic('flag')}</div><div><div class="ct">ນັດພົບ ${esc(m.time || '')}</div><div class="cs">${m.text ? esc(m.text) + ' · ' : ''}${dist}ແຕະເບິ່ງຈຸດນັດ</div></div></div>`; break;
    case 'sos':
      body = `<div class="bubble cm sos" data-act="loc"><div class="cm-ic">${ic('sos')}</div><div><div class="ct">${esc(name)} ຂໍຄວາມຊ່ວຍເຫຼືອ!</div><div class="cs">${m.lat != null ? dist + 'ແຕະເບິ່ງຕຳແໜ່ງ' : 'ບໍ່ມີຕຳແໜ່ງ GPS'}</div></div></div>`; break;
    case 'exp': {
      const pay = m.kind === 'pay';
      body = `<div class="bubble cm exp" data-act="exp"><div class="cm-ic">${ic(pay ? 'coin' : 'wallet')}</div><div><div class="ct">${esc(memberName(m.by || m.uid, m.name))} ${pay ? `ໂອນ ${M.fmtMoney(m.amt, m.cur)} ໃຫ້ ${esc(memberName(m.to))}` : `ຈ່າຍ ${M.fmtMoney(m.amt, m.cur)}`}</div><div class="cs">${esc(m.text || '')}${m.kind === 'pay' ? '' : ` · <b class="sp-${m.sk || 'all'}">${m.sk === 'none' ? 'ບໍ່ຫານ' : m.sk === 'some' ? `ຫານ ${m.n || ''} ຄົນ` : 'ຫານທັງໝົດ'}</b>${m.bill ? ' · ມີບິນ' : ' · ບໍ່ມີບິນ'}`} · ແຕະເບິ່ງ</div></div></div>`;
      break;
    }
    case 'stk':
      body = `<div class="sticker-msg">${FX.pin(FX_FACES.includes(m.face) ? m.face : 'happy', m.arms || 'wave')}</div>`; break;
    case 'img':
      body = `<div class="bubble img" data-act="img"><img alt="ຮູບຈາກ ${esc(name)}" width="${Math.min(230, m.w || 230)}" style="aspect-ratio:${m.w || 4}/${m.h || 3}"></div>`; break;
    default:
      body = `<div class="bubble">${esc(m.text)}</div>`;
  }
  const member = S.members[m.uid] || { name, color: '#94a3b8' };
  return `<div class="msg ${mine ? 'mine' : ''} ${S.pending.has(k) ? 'pending' : ''}" ${attrs}>
    ${mine ? '' : `<div class="msg-av">${avatar(member, 'sm')}</div>`}
    <div class="msg-col">${mine ? '' : `<div class="who" style="color:${esc(member.color)}">${esc(name)}</div>`}${body}<div class="time">${U.fmtTime(m.ts)}</div></div></div>`;
}

function prevMsgEl(el) {
  let p = el.previousElementSibling;
  while (p && !p.dataset.k) p = p.previousElementSibling;
  return p;
}

function addMsg(k, m) {
  if (!m || S.msgIds.has(k)) return;
  S.msgIds.add(k);
  const box = $('msgs');
  $('msgs-empty')?.remove();
  const nearBottom = msgNear;
  const wrap = document.createElement('div');
  wrap.innerHTML = msgHtml(k, m);
  const el = wrap.firstElementChild;
  el._m = m;
  // Keys sort by time; insert in order in case an older message arrives late.
  // Almost always the newest message: look from the end instead of scanning the whole list.
  let after = null;
  for (let c = box.lastElementChild; c; c = c.previousElementSibling) {
    if (!c.dataset.k) continue;
    if (c.dataset.k > k) after = c; else break;
  }
  box.insertBefore(el, after);

  const prev = prevMsgEl(el);
  if (!prev || dayLabel(+prev.dataset.ts) !== dayLabel(m.ts)) {
    const day = document.createElement('div');
    day.className = 'day';
    day.innerHTML = `<span>${dayLabel(m.ts)}</span>`;
    box.insertBefore(day, el);
  } else if (el.classList.contains('msg') && prev.classList.contains('msg') && prev.dataset.uid === m.uid && m.ts - +prev.dataset.ts < 5 * 60000) {
    el.classList.add('cont');
  }
  if (m.type === 'img') lazyImg(k, el.querySelector('img'));

  const mine = m.uid === S.uid;
  if (mine || nearBottom) stickBottom();
  if (!mine && m.ts > S.lastRead && m.type !== 'ping') {
    if (S.tab === 'chat' && !document.hidden) markRead(m.ts);
    else { S.unread++; renderUnread(); }
  }
  const fresh = !mine && m.ts > S.sessionStart - 2000;
  if (fresh && m.type === 'ping' && m.to === S.uid) showPing(m);
  else if (fresh && m.type !== 'sos' && m.type !== 'ping') {
    const who = memberName(m.uid, m.name);
    const inChat = S.tab === 'chat' && !document.hidden;
    const toChat = () => switchTab('chat');
    const toPoint = () => { if (m.lat != null) focusPoint(m.lat, m.lng, m.type === 'meet' ? `🚩 ນັດພົບ ${m.time || ''}` : `📍 ${who}`); };
    const preview = m.type === 'exp' ? `💰 ${memberName(m.by || m.uid, m.name)} ຈ່າຍ ${M.fmtMoney(m.amt, m.cur)}` : m.type === 'text' ? m.text : m.type === 'img' ? '📷 ຮູບ' : m.type === 'stk' ? 'ສະຕິກເກີ' : m.type === 'loc' ? '📍 ແຊຣ໌ຕຳແໜ່ງ' : m.type === 'meet' ? `🚩 ນັດພົບ ${m.time || ''}` : m.text;
    const money = m.type === 'exp' ? M.fmtMoney(m.amt, m.cur) : '';
    if (m.type === 'exp') say('money', m.kind === 'pay' ? `${memberName(m.by)} ໂອນ ${money} ໃຫ້ ${memberName(m.to)}` : `${memberName(m.by || m.uid, m.name)} ຈ່າຍ ${money}`, m.text || 'ແຕະເພື່ອເບິ່ງ', () => { switchTab('exp'); EXP.openDetail(m.eid); });
    else if (m.type === 'meet') say('meet', `${who} ຕັ້ງຈຸດນັດພົບ ${m.time || ''}`, m.text || 'ແຕະເພື່ອເບິ່ງໃນແຜນທີ່', toPoint);
    else if (m.type === 'sys' && m.ev === 'join') say('join', `ຍິນດີຕ້ອນຮັບ ${who} ✦`, 'ເຂົ້າທຣິບແລ້ວ', () => switchTab('trip'));
    else if (m.type === 'sys') { /* leave / cancel notices stay quiet */ }
    else if (inChat) { if (S.sound) FX.sfx('msg'); }
    else if (m.type === 'img') say('photo', `${who} ສົ່ງຮູບມາ 📷`, 'ແຕະເພື່ອເບິ່ງ', toChat);
    else say('msg', who, preview, m.type === 'loc' ? toPoint : toChat);
    if (document.hidden && !(m.type === 'sys')) notify(who, preview);
  }
}

// Chat keeps a cheap "am I near the bottom" flag (no layout reads per message) and scrolls once per frame.
let msgNear = true, stickQueued = false;
function stickBottom() {
  if (stickQueued) return;
  stickQueued = true;
  requestAnimationFrame(() => { stickQueued = false; const b = $('msgs'); b.scrollTop = b.scrollHeight; msgNear = true; });
}

// Photos are fetched only when they scroll near the screen (opening a chat with many photos no longer downloads them all).
let imgObs = null;
function lazyImg(k, imgEl) {
  if (S.imgCache.has(k) || !('IntersectionObserver' in window)) return loadImg(k, imgEl);
  imgObs = imgObs || new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      imgObs.unobserve(e.target);
      loadImg(e.target.dataset.lk, e.target);
    }
  }, { root: $('msgs'), rootMargin: '400px 0px' });
  imgEl.dataset.lk = k;
  imgObs.observe(imgEl);
}

async function loadImg(k, imgEl) {
  let data = S.imgCache.get(k);
  if (!data) {
    try { data = await S.be.get(P(`imgs/${k}`)); } catch { data = null; }
    if (data) S.imgCache.set(k, data);
  }
  imgEl.decoding = 'async';
  if (data) imgEl.src = data; else imgEl.alt = 'ໂຫຼດຮູບບໍ່ໄດ້';
}

function markRead(ts) {
  S.lastRead = Math.max(S.lastRead, ts || S.be.now());
  store.set('lastRead_' + S.code, S.lastRead);
  S.unread = 0; renderUnread();
}

function renderUnread() {
  const u = $('unread');
  u.hidden = !S.unread;
  u.textContent = S.unread > 99 ? '99+' : S.unread;
}

function autosize() {
  const ta = $('m-text');
  ta.style.height = 'auto';
  ta.style.height = Math.min(120, ta.scrollHeight + 2) + 'px';
}

/* =================== SOS =================== */
let holdTimer = null;

function sosDown(e) {
  e.preventDefault();
  unlockAudio();
  if (S.mySos) return toast('SOS ກຳລັງເປີດຢູ່');
  $('sos-fab').classList.add('holding');
  haptic(15);
  holdTimer = setTimeout(() => { holdTimer = null; $('sos-fab').classList.remove('holding'); triggerSos(); }, 1500);
}

function sosUp() {
  if (!holdTimer) return;
  clearTimeout(holdTimer); holdTimer = null;
  $('sos-fab').classList.remove('holding');
  toast('ກົດຄ້າງໄວ້ 2 ວິນາທີ ເພື່ອສົ່ງ SOS');
}

async function triggerSos() {
  haptic(300);
  S.mySos = true;
  const p = S.me || S.loc[S.uid] || {};
  const now = S.be.now();
  const data = { name: S.profile.name, start: now, ts: now };
  if (p.lat != null) { data.lat = p.lat; data.lng = p.lng; }
  renderSosMine();
  S.be.set(P(`sos/${S.uid}`), data).catch(() => toast('ສົ່ງ SOS ບໍ່ສຳເລັດ — ລອງ SMS'));
  sendMsg({ type: 'sos', lat: data.lat, lng: data.lng });
  if (!sharingActive()) setSharing(true); else maybeStartGeo();
  if (S.me) sendLoc({ ...S.me, ts: now });
}

async function cancelSos() {
  S.mySos = false;
  renderSosMine();
  await S.be.remove(P(`sos/${S.uid}`)).catch(() => {});
  sendMsg({ type: 'sys', text: '✅ ປອດໄພແລ້ວ (ຍົກເລີກ SOS)' });
}

function updateSmsLink() {
  const p = S.me || S.loc[S.uid];
  const where = p && p.lat != null ? ` ຕຳແໜ່ງ: https://maps.google.com/?q=${p.lat},${p.lng}` : '';
  $('sos-sms').href = U.smsUrl(`🆘 SOS ຈາກ ${S.profile?.name || ''}: ຂ້ອຍຕ້ອງການຄວາມຊ່ວຍເຫຼືອ!${where}`, isIOS);
}

function renderSosMine() {
  $('sos-mine').hidden = !S.mySos;
  $('sos-fab').hidden = S.mySos;
  updateSmsLink();
}

let alertUid = null;
function handleSos() {
  const now = S.be.now();
  S.mySos = !!S.sos[S.uid];
  renderSosMine();
  if (alertUid && !S.sos[alertUid]) closeSosAlert();
  for (const [uid, s] of Object.entries(S.sos)) {
    if (uid === S.uid || !s || now - (s.start || 0) > 2 * 3600e3) continue;
    if (S.dismissedSos[uid] === s.start) continue;
    if (alertUid === uid) { updateSosAlert(); continue; }
    if (!alertUid) showSosAlert(uid);
  }
  renderMap(); renderCards();
}

let sosApi = null;
function showSosAlert(uid) {
  alertUid = uid;
  const dismiss = () => {
    const so = S.sos[uid];
    if (so) { S.dismissedSos[uid] = so.start; store.set('dismissedSos', S.dismissedSos); }
    closeSosAlert();
    handleSos();
  };
  sosApi = FX.bigAlert({
    cls: 'sos', face: 'cry', arms: 'up', mark: '!!', title: '', sub: '',
    actions: [
      { id: 'sa-map', label: 'ເບິ່ງໃນແຜນທີ່', onClick: () => { dismiss(); switchTab('map'); focusMember(uid); } },
      { id: 'sa-nav', label: 'ນຳທາງໄປຫາ', href: '#', onClick: () => dismiss() },
      { id: 'sa-ok', label: 'ຮັບຊາບ', cls: 'yellow', onClick: () => dismiss() },
    ],
  });
  sosApi.el.id = 'sos-alert';
  updateSosAlert();
  startSiren();
  if (document.hidden) notify('🆘 SOS', `${memberName(uid, S.sos[uid]?.name)} ຕ້ອງການຄວາມຊ່ວຍເຫຼືອ!`, true);
}

function updateSosAlert() {
  const so = S.sos[alertUid];
  if (!so || !sosApi) return;
  sosApi.setTitle(`${memberName(alertUid, so.name)} ຕ້ອງການຄວາມຊ່ວຍເຫຼືອ!`);
  const d = S.me && so.lat != null ? U.distanceM(S.me, so) : null;
  sosApi.setSub(so.lat == null ? 'ຍັງບໍ່ມີຕຳແໜ່ງ GPS — ລອງໂທຫາ' : [d != null ? `ຫ່າງຈາກເຈົ້າ ${U.fmtDistance(d)}` : '', `ອັບເດດ ${U.fmtAgo(so.ts, S.be.now())}`].filter(Boolean).join(' · '));
  sosApi['sa-nav'].hidden = so.lat == null;
  if (so.lat != null) sosApi['sa-nav'].href = U.mapsUrl(so.lat, so.lng);
}

function closeSosAlert() {
  sosApi?.close(); sosApi = null;
  alertUid = null;
  stopSiren();
}

/* =================== sound & notifications =================== */
let actx = null;
function unlockAudio() {
  FX.unlock();
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* no audio */ }
}

function tone(f1, f2, start, dur, vol = 0.18, type = 'sine') {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime + start;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.linearRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}


let sirenTimer = null;
function startSiren() {
  stopSiren();
  const cycle = () => {
    tone(650, 1300, 0, 0.5, 0.3, 'sawtooth'); tone(1300, 650, 0.5, 0.5, 0.3, 'sawtooth');
    haptic(400);
  };
  cycle();
  sirenTimer = setInterval(cycle, 1100);
}
function stopSiren() {
  if (!sirenTimer) return;
  clearInterval(sirenTimer);
  sirenTimer = null;
  haptic(0);
}

async function notify(title, body, urgent = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: urgent ? 'tm-sos' : 'tm-msg', renotify: true, requireInteraction: urgent };
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) reg.showNotification(title, opts); else new Notification(title, opts);
  } catch { /* ignore */ }
}

async function askNotify() {
  if (!('Notification' in window)) return;
  try { await Notification.requestPermission(); } catch { /* ignore */ }
  renderTrip();
}

/* =================== trip tab =================== */
function inviteUrl() {
  return `${location.origin}${location.pathname}?t=${S.code}`;
}

let qrFor = null;
let tripDirty = false;
function renderTrip() {
  if (!S.code) return;
  if (S.tab !== 'trip') { tripDirty = true; return; }
  tripDirty = false;
  const isOwner = S.info?.owner === S.uid;
  const n = Object.keys(S.members).length;
  $('trip-title').textContent = S.info?.name || 'ທຣິບ';
  $('trip-sub').textContent = `${n} ຄົນໃນທຣິບ${isOwner ? ' · ເຈົ້າເປັນເຈົ້າຂອງທຣິບ' : ''}`;
  $('codebox').innerHTML = Array.from(S.code).map((c) => `<span>${c}</span>`).join('');
  if (qrFor !== S.code && window.qrcode) {
    const qr = window.qrcode(0, 'M');
    qr.addData(inviteUrl()); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    qrFor = S.code;
  }
  const now = S.be.now();
  const ownerId = S.info?.owner;
  $('members').innerHTML = Object.entries(S.members)
    .sort(([a], [b]) => (a === S.uid ? -1 : b === S.uid ? 1 : 0))
    .map(([uid, m]) => {
      const on = !!S.presence[uid]?.on;
      const seen = Math.max(S.presence[uid]?.ts || 0, S.loc[uid]?.ts || 0);
      const sub = uid === S.uid ? 'ຂ້ອຍ' : on ? 'ກຳລັງເປີດແອັບ' : seen ? `ເຫັນລ່າສຸດ ${U.fmtAgo(seen, now)}` : 'ຍັງບໍ່ເຄີຍອອນລາຍ';
      return `<div class="li">${avatar(m, '', uid === S.uid ? true : on)}
        <div class="grow"><div class="t">${esc(m.name)} ${uid === ownerId ? '<span class="badge">ເຈົ້າຂອງທຣິບ</span>' : ''}</div><div class="s">${sub}</div></div>
        ${isOwner && uid !== S.uid ? `<button class="btn sm" data-kick="${esc(uid)}">ເອົາອອກ</button>` : ''}</div>`;
    }).join('');

  $('sw-share').checked = S.sharing;
  const paused = S.pauseUntil > Date.now();
  $('pause-btn').textContent = paused ? 'ເປີດຄືນ' : 'ຢຸດ';
  $('pause-btn').disabled = !S.sharing;
  $('pause-sub').textContent = paused ? `ຢຸດຢູ່ — ຈະເປີດຄືນເອງ ${U.fmtTime(S.pauseUntil)}` : 'ຈະເປີດແຊຣ໌ຄືນເອງ';
  $('share-sub').textContent = S.sharing ? 'ໝູ່ເຫັນເຈົ້າເທິງແຜນທີ່' : 'ປິດຢູ່ — ໝູ່ຈະບໍ່ເຫັນເຈົ້າ';
  $('sw-sound').checked = S.sound;
  $('sw-fx').checked = S.fx;
  $('me-av').innerHTML = avatar(S.profile);
  $('me-name').textContent = S.profile?.name || '';
  document.querySelectorAll('#theme-seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === S.theme)));

  const nb = $('notif-btn'), ns = $('notif-sub');
  if (!('Notification' in window)) { nb.hidden = true; ns.textContent = isIOS && !standalone ? 'iPhone: ຕ້ອງຕິດຕັ້ງແອັບລົງໜ້າຈໍກ່ອນ' : 'ເຄື່ອງນີ້ບໍ່ຮອງຮັບ'; }
  else if (Notification.permission === 'granted') { nb.hidden = true; ns.textContent = 'ເປີດແລ້ວ'; }
  else if (Notification.permission === 'denied') { nb.hidden = true; ns.textContent = 'ຖືກປິດໃນການຕັ້ງຄ່າ browser'; }
  else { nb.hidden = false; ns.textContent = 'ເຕືອນເມື່ອມີຂໍ້ຄວາມ ຫຼື SOS'; }

  const ps = PUSH.state();
  $('push-row').hidden = ps === 'unconfigured';
  $('sw-push').checked = ps === 'on';
  $('sw-push').disabled = ps === 'denied' || ps === 'unsupported' || ps === 'ios-install';
  $('push-sub').textContent = { on: 'ເປີດແລ້ວ — ໄດ້ຮັບຂໍ້ຄວາມ, SOS, ຖາມຢູ່ໃສ ເຖິງວ່າປິດແອັບ', off: 'ປິດຢູ່ — ເປີດເພື່ອຮັບແຈ້ງເຕືອນຕອນປິດແອັບ', denied: 'ຖືກບລັອກໃນການຕັ້ງຄ່າ browser', 'ios-install': 'iPhone: ຕ້ອງ Add to Home Screen ກ່ອນ', unsupported: 'ເຄື່ອງນີ້ບໍ່ຮອງຮັບ', unconfigured: '' }[ps];
  $('delete-trip').hidden = !isOwner;
  $('about').textContent = `TripMate v${VERSION} · ${S.be.mode === 'demo' ? 'ໂໝດທົດລອງ (ໃນເຄື່ອງ)' : 'ເຊື່ອມ Firebase'}`;
  renderInstall();
}

function renderInstall() {
  const card = $('install-card');
  if (!card || standalone) { card && (card.hidden = true); return; }
  card.hidden = false;
  if (isIOS) {
    $('install-body').innerHTML = `<ol class="steps"><li>ເປີດໜ້ານີ້ໃນ <b>Safari</b></li><li>ແຕະປຸ່ມ <b>ແຊຣ໌</b> (ສີ່ຫຼ່ຽມມີລູກສອນຂຶ້ນ)</li><li>ເລືອກ <b>ເພີ່ມໃສ່ໜ້າຈໍໂຮມ (Add to Home Screen)</b></li><li>ເປີດແອັບຈາກໄອຄອນ ແລ້ວພິມລະຫັດ <b>${esc(S.code || '')}</b> ເຂົ້າທຣິບອີກຄັ້ງ</li></ol>`;
  } else if (S.installPrompt) {
    $('install-body').innerHTML = '<p class="muted" style="margin-top:0">ເປີດໄດ້ໄວຄືແອັບທົ່ວໄປ ແລະ ຮັບແຈ້ງເຕືອນໄດ້</p><button class="btn primary block" id="install-btn">ຕິດຕັ້ງແອັບ</button>';
    $('install-btn').onclick = async () => { S.installPrompt.prompt(); await S.installPrompt.userChoice.catch(() => {}); S.installPrompt = null; renderInstall(); };
  } else {
    $('install-body').innerHTML = '<ol class="steps"><li>ໃນ Chrome ແຕະເມນູ <b>⋮</b></li><li>ເລືອກ <b>ຕິດຕັ້ງແອັບ</b> ຫຼື <b>ເພີ່ມໃສ່ໜ້າຈໍຫຼັກ</b></li></ol>';
  }
}

async function shareInvite() {
  const url = inviteUrl();
  const text = `ມາເຂົ້າທຣິບ "${S.info?.name || ''}" ນຳກັນໃນ TripMate — ລະຫັດ ${S.code}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'TripMate', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  copy(`${text}\n${url}`, 'ສຳເນົາລິ້ງເຊີນແລ້ວ');
}

async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { prompt('ສຳເນົາຂໍ້ຄວາມນີ້:', text); }
}

/* =================== tabs & render =================== */
function switchTab(t) {
  S.tab = t;
  for (const id of ['map', 'chat', 'exp', 'trip']) $('t-' + id).hidden = id !== t;
  document.querySelectorAll('nav.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  if (t === 'map') { renderCards(); renderMap(); if (map) setTimeout(() => map.invalidateSize(), 30); }
  if (t === 'trip') renderTrip();
  if (t === 'exp') EXP.render();
  if (t === 'chat') {
    const box = $('msgs');
    box.scrollTop = box.scrollHeight;
    markRead();
  }
  if (t !== 'map') { setPicking(false); $('layer-menu').hidden = true; }
}

function renderAll() {
  renderHeads(); renderMap(); renderCards(); renderMeet(); renderStatus(); renderTrip(); renderSosMine(); renderUnread(); EXP.render();
}

/* =================== UI helpers =================== */
function viewImage(src) {
  if (!src) return;
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<img src="${src}" alt="">`;
  v.onclick = () => v.remove();
  document.body.appendChild(v);
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.hidden = true; void t.offsetWidth; // restart the drop-in animation
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

function modal({ title, html, actions = [{ label: 'ປິດ' }] }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><div>${html}</div><div class="actions"></div></div>`;
  const close = () => bg.remove();
  const bar = bg.querySelector('.actions');
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.onclick = () => { if (a.onClick && a.onClick() === false) return; close(); };
    bar.appendChild(b);
  }
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  $('modal-root').appendChild(bg);
  const first = bg.querySelector('input');
  first && !coarse && first.focus();
  return close;
}

function confirmBox(title, text, okLabel, danger) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    modal({
      title, html: `<p class="muted">${esc(text)}</p>`,
      actions: [{ label: 'ຍົກເລີກ', onClick: () => fin(false) }, { label: okLabel, cls: danger ? 'danger' : 'primary', onClick: () => fin(true) }],
    });
    // Tapping the backdrop closes without a choice → treat as cancel.
    const bg = $('modal-root').lastElementChild;
    new MutationObserver((_, obs) => { if (!bg.isConnected) { obs.disconnect(); fin(false); } }).observe($('modal-root'), { childList: true });
  });
}

async function busy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'ລໍຖ້າ…';
  try { await fn(); }
  catch (e) { toast(explainError(e)); }
  finally { btn.disabled = false; btn.textContent = label; }
}

function registerSW() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* =================== wiring =================== */
function wireUi() {
  $('p-emojis').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    draft.emoji = b.dataset.e; renderProfileForm();
  });
  $('p-colors').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    draft.color = b.dataset.c; renderProfileForm();
  });
  $('p-name').addEventListener('input', () => {
    draft.name = $('p-name').value;
    $('p-preview').innerHTML = avatar({ ...draft, name: draft.name || '?' }, 'lg');
    const first = $('p-emojis').querySelector('[data-e=""]');
    if (first) first.textContent = U.initials(draft.name || 'ກ');
  });
  $('p-save').onclick = saveProfile;
  $('p-name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) saveProfile(); });

  // 6-box trip code: auto-advance, backspace goes back, paste fills all, auto-join when complete.
  const join = () => {
    const code = U.cleanCode(otpValue());
    if (!code) return toast('ລະຫັດບໍ່ຖືກຕ້ອງ — ຕ້ອງມີ 6 ຕົວ');
    busy($('j-go'), () => joinTrip(code));
  };
  $('otp').addEventListener('input', (e) => {
    const boxes = [...$('otp').querySelectorAll('input')];
    const i = boxes.indexOf(e.target);
    const chars = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (chars.length > 1) { // paste or autofill
      chars.slice(0, 6 - i).split('').forEach((c, j) => { boxes[i + j].value = c; });
      boxes[Math.min(5, i + chars.length - 1)].focus();
    } else {
      e.target.value = chars;
      if (chars && i < 5) boxes[i + 1].focus();
    }
    if (U.cleanCode(otpValue())) join();
  });
  $('otp').addEventListener('keydown', (e) => {
    const boxes = [...$('otp').querySelectorAll('input')];
    const i = boxes.indexOf(e.target);
    if (e.key === 'Backspace' && !e.target.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ''; }
    if (e.key === 'Enter') join();
  });
  $('otp').addEventListener('focusin', (e) => e.target.select && e.target.select());
  $('j-go').onclick = join;
  $('c-go').onclick = (e) => createTrip(e.currentTarget);
  $('c-name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) createTrip($('c-go')); });
  $('recent').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rejoin]');
    if (b) busy(b, () => joinTrip(b.dataset.rejoin));
  });
  $('edit-profile').onclick = () => showProfile(false);

  document.querySelectorAll('nav.tabs button').forEach((b) => { b.onclick = () => { haptic(8); switchTab(b.dataset.tab); }; });

  $('c-layers').onclick = () => { $('layer-menu').hidden = !$('layer-menu').hidden; };
  $('layer-menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layer]');
    if (!b) return;
    setLayer(b.dataset.layer);
    $('layer-menu').hidden = true;
  });
  $('c-me').onclick = () => {
    if (S.me) map.flyTo([S.me.lat, S.me.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    else if (!sharingActive()) toast('ເປີດແຊຣ໌ຕຳແໜ່ງກ່ອນ');
    else { toast('ກຳລັງຫາ GPS…'); maybeStartGeo(); }
  };
  $('c-all').onclick = fitAll;
  $('c-meet').onclick = () => setPicking(!S.picking);
  $('pick-cancel').onclick = () => setPicking(false);
  const strip = $('cards');
  for (const ev of ['touchstart', 'pointerdown']) strip.addEventListener(ev, cardsHold, { passive: true });
  for (const ev of ['touchend', 'touchcancel', 'pointerup', 'pointercancel']) strip.addEventListener(ev, cardsRelease, { passive: true });
  strip.addEventListener('scroll', () => { cardsHold(); cardsRelease(); }, { passive: true });
  $('cards').addEventListener('click', (e) => {
    const card = e.target.closest('.mcard');
    if (!card) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    const uid = card.dataset.uid;
    if (act === 'nav') return;
    if (act === 'ping') return ping(uid);
    if (act === 'wake') return setWake(!S.wake);
    if (act === 'pause') return pauseSharing();
    focusMember(uid);
  });
  $('meet-clear').onclick = clearMeet;

  const fab = $('sos-fab');
  fab.addEventListener('pointerdown', sosDown);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => fab.addEventListener(ev, sosUp));
  fab.addEventListener('contextmenu', (e) => e.preventDefault());
  $('sos-cancel').onclick = cancelSos;

  $('quick').innerHTML = QUICK.map((q) => `<button>${esc(q)}</button>`).join('');
  $('quick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) sendText(b.textContent); });
  $('m-send').onclick = () => sendText();
  $('m-text').addEventListener('input', autosize);
  $('m-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !coarse) { e.preventDefault(); sendText(); }
  });
  EXP.wire();
  $('m-exp').onclick = () => EXP.openFromChat();
  $('m-loc').onclick = sendMyLocation;
  $('m-stk').onclick = openStickers;
  $('m-photo').onclick = () => $('m-file').click();
  $('m-file').onchange = (e) => { sendPhoto(e.target.files[0]); e.target.value = ''; };
  $('msgs').addEventListener('scroll', () => { const b = $('msgs'); msgNear = b.scrollHeight - b.scrollTop - b.clientHeight < 140; }, { passive: true });
  $('msgs').addEventListener('click', (e) => {
    const card = e.target.closest('[data-act]');
    if (!card) return;
    const m = card.closest('.msg')?._m;
    if (!m) return;
    if (card.dataset.act === 'loc' && m.lat != null) {
      const label = m.type === 'meet' ? `🚩 ນັດພົບ ${m.time || ''}` : m.type === 'sos' ? `🆘 ${memberName(m.uid, m.name)}` : `📍 ${memberName(m.uid, m.name)} · ${U.fmtTime(m.ts)}`;
      focusPoint(m.lat, m.lng, label);
    }
    if (card.dataset.act === 'exp') { switchTab('exp'); EXP.openDetail(m.eid); }
    if (card.dataset.act === 'img') {
      const src = card.querySelector('img')?.src;
      if (src) viewImage(src);
    }
  });

  $('share-link').onclick = shareInvite;
  $('copy-code').onclick = () => copy(S.code, `ສຳເນົາລະຫັດ ${S.code} ແລ້ວ`);
  $('sw-share').onchange = (e) => setSharing(e.target.checked);
  $('pause-btn').onclick = pauseSharing;
  $('sw-wake').onchange = (e) => setWake(e.target.checked);
  $('sw-sound').onchange = (e) => { S.sound = e.target.checked; store.set('sound', S.sound); applyFx(); if (S.sound) { unlockAudio(); FX.sfx('msg'); } };
  $('sw-fx').onchange = (e) => { S.fx = e.target.checked; store.set('fx', S.fx); applyFx(); if (S.fx) FX.burst('sparkles'); };
  $('try-grid').innerHTML = TRY.map((t) => `<button data-t="${t.k}"><span class="em">${ic(t.ic)}</span><span>${t.n}</span>${t.isNew ? '<span class="new">ໃໝ່</span>' : ''}</button>`).join('');
  $('try-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { unlockAudio(); tryAlert(b.dataset.t); } });
  $('notif-btn').onclick = askNotify;
  $('sw-push').onchange = async (e) => {
    const was = PUSH.state();
    const st = e.target.checked ? await PUSH.enable() : await PUSH.disable();
    renderTrip();
    if (e.target.checked && st === 'on') toast('ເປີດ Push ແລ້ວ ✓');
    else if (e.target.checked) toast(st === 'denied' ? 'ຖືກບລັອກ — ເປີດໃນການຕັ້ງຄ່າ browser' : 'ເປີດ Push ບໍ່ສຳເລັດ');
    void was;
  };
  $('skin-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    S.skin = b.dataset.v; store.set('skin', S.skin); applySkin(); applyTheme();
  });
  $('theme-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    S.theme = b.dataset.v; store.set('theme', S.theme); applyTheme();
  });
  $('edit-me').onclick = () => showProfile(true);
  $('members').addEventListener('click', (e) => { const b = e.target.closest('[data-kick]'); if (b) removeMember(b.dataset.kick); });
  $('leave').onclick = leaveTrip;
  $('delete-trip').onclick = deleteTrip;
}

// Started last so every module-level const/let above is initialised before first use.
const EXP = createExpenses({
  S, $, esc, P, toast, confirmBox, modal, avatar, sendMsg, haptic, store, FX, viewImage, switchTab,
  say: (...a) => say(...a),
  nameOf: (u) => S.members[u]?.name || 'ໝູ່ (ອອກແລ້ວ)',
});

const PUSH = createPush({ S, P, store, isIOS, standalone });

applySkin();
applyFx();
applyTheme();
hydrate();
boot();
