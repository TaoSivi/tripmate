// TripMate push relay — a Cloudflare Worker (free plan, no card).
//
// Why it exists: a web page can't wake a closed app. The sender's phone asks this Worker to push to the other
// members; the Worker looks up their push subscriptions in the Realtime Database *with the sender's own Firebase
// ID token*, so the database rules decide who may read them (trip members only) and the Worker holds no
// database secret. The only secret here is the VAPID private key.
//
// Request:  POST /push  {code, token, from, to?, title, body, tag?, urgent?}
// Response: {sent, failed, dead:[{uid, dev}]}   ("dead" = subscriptions the browser says no longer exist)
//
// Environment (Worker settings):
//   DB_URL            https://<project>-default-rtdb.<region>.firebasedatabase.app
//   VAPID_PUBLIC      base64url uncompressed P-256 public key (same value the app uses)
//   VAPID_D           base64url private scalar `d` of the same key (secret)
//   VAPID_SUBJECT     mailto:you@example.com
//   ALLOWED_ORIGINS   comma list, e.g. https://taosivi.github.io,http://localhost:8767

const enc = new TextEncoder();

export const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0)),
};
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** RFC 8291 (Web Push) payload encryption, aes128gcm content coding. sub = {endpoint, keys:{p256dh, auth}} */
export async function encryptPayload(sub, plaintext, { salt, ephemeral } = {}) {
  const uaPublic = b64u.dec(sub.keys.p256dh);
  const authSecret = b64u.dec(sub.keys.auth);
  const eph = ephemeral || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const s = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const padded = concat(plaintext, new Uint8Array([2]));              // 0x02 = last (and only) record
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, padded));
  const rs = new Uint8Array([0, 0, 0x10, 0]);                         // record size 4096
  return concat(s, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}

/** VAPID (RFC 8292) Authorization header value. */
export async function vapidAuth(endpoint, privateJwk, publicKeyB64u, subject, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const header = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u.enc(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u.enc(sig)}, k=${publicKeyB64u}`;
}

/** The signing key as a JWK, built from the public key (x, y) plus the one secret number d. */
export function vapidJwk(env) {
  const pub = b64u.dec(env.VAPID_PUBLIC);
  return { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), d: env.VAPID_D };
}

async function sendOne(sub, payload, env, urgent) {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(sub.endpoint, vapidJwk(env), env.VAPID_PUBLIC, env.VAPID_SUBJECT || 'mailto:admin@example.com'),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: urgent ? '3600' : '600',
      Urgency: urgent ? 'high' : 'normal',
    },
    body,
  });
  return res.status;
}

const clip = (s, n) => String(s ?? '').slice(0, n);
const json = (o, status, cors) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || ''),
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (url.pathname === '/' && req.method === 'GET') return json({ ok: true, service: 'tripmate-push' }, 200, cors);
    if (url.pathname !== '/push' || req.method !== 'POST') return json({ error: 'not found' }, 404, cors);
    if (allowed.length && !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403, cors);

    let b;
    try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
    if (!/^[A-Z2-9]{6}$/.test(b.code || '') || typeof b.token !== 'string' || b.token.length < 100 || b.token.length > 3000) return json({ error: 'bad request' }, 400, cors);

    // The database decides: only a trip member's token can read the trip's push subscriptions.
    const r = await fetch(`${env.DB_URL.replace(/\/$/, '')}/trips/${b.code}/push.json?auth=${encodeURIComponent(b.token)}`);
    if (!r.ok) return json({ error: 'not a member' }, 403, cors);
    const all = (await r.json()) || {};

    const payload = { title: clip(b.title, 80), body: clip(b.body, 180), tag: clip(b.tag || `trip-${b.code}`, 40), urgent: !!b.urgent, code: b.code };
    const jobs = [];
    for (const [uid, devs] of Object.entries(all)) {
      if (uid === b.from) continue;                              // never notify the sender's own devices
      if (b.to && uid !== b.to) continue;                        // direct message (e.g. "where are you?")
      for (const [dev, sub] of Object.entries(devs || {})) {
        if (sub && typeof sub.endpoint === 'string' && sub.keys && sub.keys.p256dh && sub.keys.auth) jobs.push({ uid, dev, sub });
      }
    }
    const targets = jobs.slice(0, 40);
    const results = await Promise.allSettled(targets.map((j) => sendOne(j.sub, payload, env, payload.urgent)));
    let sent = 0, failed = 0; const dead = [];
    results.forEach((x, i) => {
      const st = x.status === 'fulfilled' ? x.value : 0;
      if (st >= 200 && st < 300) sent++;
      else { failed++; if (st === 404 || st === 410) dead.push({ uid: targets[i].uid, dev: targets[i].dev }); }
    });
    return json({ sent, failed, dead }, 200, cors);
  },
};
