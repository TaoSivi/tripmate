// Pure helpers — no DOM, no network. Tested with `node test-lib.mjs`.

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing a→b in degrees, 0 = north, clockwise. */
export function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function fmtDistance(m) {
  if (m == null || !isFinite(m)) return '';
  if (m < 1000) return `${Math.round(m)} ມ`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} ກມ`;
  return `${Math.round(m / 1000)} ກມ`;
}

/** "ຫາກໍ່ນີ້" / "5 ນາທີກ່ອນ" … */
export function fmtAgo(ts, now = Date.now()) {
  if (!ts) return 'ບໍ່ຮູ້';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 30) return 'ຫາກໍ່ນີ້';
  if (s < 60) return `${s} ວິນາທີກ່ອນ`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ນາທີກ່ອນ`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ຊົ່ວໂມງກ່ອນ`;
  return `${Math.floor(h / 24)} ມື້ກ່ອນ`;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const STALE_MS = 10 * 60 * 1000;
export const ARRIVED_M = 60;
// "Separated from the group": nobody else within AWAY_M; cleared again once back under BACK_M (hysteresis stops flapping).
export const AWAY_M = 1000;
export const BACK_M = 700;
export const LOW_BAT = 15;
export const BAT_RESET = 25;

/** For each point, the distance to its nearest other point. [{uid,lat,lng}] → {uid: metres} */
export function nearestOthers(points) {
  const out = {};
  for (const a of points) {
    let best = Infinity;
    for (const b of points) if (b !== a) best = Math.min(best, distanceM(a, b));
    out[a.uid] = best;
  }
  return out;
}

/** Location freshness: 'live' | 'stale' | 'off'. */
export function locState(loc, now = Date.now()) {
  if (!loc || loc.lat == null) return 'off';
  if (loc.sharing === false) return 'off';
  return now - (loc.ts || 0) > STALE_MS ? 'stale' : 'live';
}

// No 0/O/1/I/L — easy to read aloud and type.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function genCode(len = 6, rnd = Math.random) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)];
  return s;
}

/** Normalise user-typed code; returns '' if invalid. */
export function cleanCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) return '';
  for (const ch of c) if (!CODE_CHARS.includes(ch)) return '';
  return c;
}

/**
 * Decide whether a new GPS fix should be written to the backend.
 * Saves battery/data: only when moved enough, or as a heartbeat.
 */
export function shouldSend(prev, next, { minMoveM = 15, minGapMs = 5000, heartbeatMs = 60000, sos = false } = {}) {
  if (!prev) return true;
  const gap = next.ts - prev.ts;
  if (sos) return gap >= 5000;
  if (gap >= heartbeatMs) return true;
  if (gap < minGapMs) return false;
  return distanceM(prev, next) >= Math.max(minMoveM, Math.min(next.acc || 0, 100) / 2);
}

const LEAD_VOWELS = 'ເແໂໃໄ';
/** Short label for a map pin. Lao names starting with a leading vowel keep vowel+consonant. */
export function initials(name) {
  const n = String(name || '').trim();
  if (!n) return '?';
  const chars = Array.from(n);
  const isMark = (c) => /[ັິ-ຼ່-ໍ]/.test(c); // Lao combining marks
  let out = chars[0];
  let i = 1;
  if (LEAD_VOWELS.includes(chars[0]) && chars[1]) { out += chars[1]; i = 2; }
  while (i < chars.length && isMark(chars[i])) out += chars[i++];
  return /^[a-z]/.test(out) ? out.toUpperCase() : out;
}

/** Fit an image into maxSide keeping aspect ratio. */
export function fitSize(w, h, maxSide = 1024) {
  if (w <= maxSide && h <= maxSide) return { w, h };
  const k = maxSide / Math.max(w, h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** SMS composer link — iOS wants "&body", Android wants "?body". */
export function smsUrl(body, isIOS) {
  return `sms:${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

export const COLORS = ['#e8553d', '#f29e2e', '#2fa36b', '#1f8fc2', '#6b5bd6', '#d6458f', '#14a3a3', '#8a6d3b'];
