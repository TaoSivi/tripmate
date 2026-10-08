// Run: node push-worker/test-worker.mjs   (no network: fetch is mocked)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import W, { b64u } from './worker.js';

const ua = () => { const k = crypto.createECDH('prime256v1'); k.generateKeys(); return { endpoint: 'https://push.example/' + crypto.randomBytes(4).toString('hex'), keys: { p256dh: b64u.enc(k.getPublicKey()), auth: b64u.enc(crypto.randomBytes(16)) } }; };
const vk = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = vk.privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
const env = { DB_URL: 'https://db.example', VAPID_PUBLIC: b64u.enc(pub), VAPID_PRIVATE_JWK: JSON.stringify(jwk), VAPID_SUBJECT: 'mailto:t@example.com', ALLOWED_ORIGINS: 'https://ok.example' };

const subs = { A: { d1: ua() }, B: { d1: ua(), d2: ua() }, C: { d1: ua() } };
const pushed = [];
let dbStatus = 200, deadEndpoint = null;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://db.example/')) return new Response(dbStatus === 200 ? JSON.stringify(subs) : '{"error":"Permission denied"}', { status: dbStatus });
  pushed.push({ url: String(url), headers: init.headers, len: init.body.length });
  return new Response(null, { status: String(url) === deadEndpoint ? 410 : 201 });
};

const call = (body, origin = 'https://ok.example') => W.fetch(new Request('https://w.example/push', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
const base = { code: 'ABC234', token: 'x'.repeat(200), from: 'A', title: 't', body: 'b' };
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

await t('pushes to every device of everyone except the sender', async () => {
  pushed.length = 0;
  const r = await (await call(base)).json();
  assert.deepEqual([r.sent, r.failed, r.dead.length], [3, 0, 0]);            // B has 2 devices, C 1; A skipped
  assert.ok(pushed.every((p) => /^vapid t=.+, k=.+$/.test(p.headers.Authorization) && p.headers['Content-Encoding'] === 'aes128gcm'));
  assert.ok(!pushed.some((p) => p.url === subs.A.d1.endpoint));
});
await t('direct message goes only to the addressed person', async () => {
  pushed.length = 0;
  const r = await (await call({ ...base, to: 'C' })).json();
  assert.equal(r.sent, 1); assert.equal(pushed[0].url, subs.C.d1.endpoint);
});
await t('urgent (SOS) uses high urgency and long TTL', async () => {
  pushed.length = 0; await call({ ...base, urgent: true });
  assert.ok(pushed.every((p) => p.headers.Urgency === 'high' && p.headers.TTL === '3600'));
});
await t('expired subscriptions are reported back so the app can remove them', async () => {
  deadEndpoint = subs.B.d2.endpoint;
  const r = await (await call(base)).json();
  assert.deepEqual(r.dead, [{ uid: 'B', dev: 'd2' }]); assert.equal(r.sent, 2); deadEndpoint = null;
});
await t('a non-member (database says permission denied) gets 403 and nothing is pushed', async () => {
  dbStatus = 401; pushed.length = 0;
  const res = await call(base); assert.equal(res.status, 403); assert.equal(pushed.length, 0); dbStatus = 200;
});
await t('rejects bad code, short token, other origins, wrong path', async () => {
  assert.equal((await call({ ...base, code: 'abc' })).status, 400);
  assert.equal((await call({ ...base, token: 'short' })).status, 400);
  assert.equal((await call(base, 'https://evil.example')).status, 403);
  assert.equal((await W.fetch(new Request('https://w.example/other', { method: 'POST', headers: { Origin: 'https://ok.example' } }), env)).status, 404);
});
await t('CORS preflight allows only the app origin', async () => {
  const r = await W.fetch(new Request('https://w.example/push', { method: 'OPTIONS', headers: { Origin: 'https://ok.example' } }), env);
  assert.equal(r.status, 204); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://ok.example');
});
console.log(`\n${n} groups passed`);
