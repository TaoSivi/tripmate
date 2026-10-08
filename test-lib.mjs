// Run: node test-lib.mjs
import assert from 'node:assert/strict';
import * as L from './lib.js';

const vte = { lat: 17.9757, lng: 102.6331 };   // Vientiane
const lpq = { lat: 19.8856, lng: 102.1347 };   // Luang Prabang

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('distance VTE→LPQ ≈ 218 km', () => {
  const d = L.distanceM(vte, lpq);
  assert.ok(d > 210000 && d < 225000, d);
});
t('distance zero', () => assert.equal(L.distanceM(vte, vte), 0));
t('bearing north / east', () => {
  assert.ok(Math.abs(L.bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })) < 0.01);
  assert.ok(Math.abs(L.bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 90) < 0.01);
});
t('fmtDistance', () => {
  assert.equal(L.fmtDistance(0), '0 ມ');
  assert.equal(L.fmtDistance(999.4), '999 ມ');
  assert.equal(L.fmtDistance(1000), '1.0 ກມ');
  assert.equal(L.fmtDistance(12345), '12 ກມ');
  assert.equal(L.fmtDistance(NaN), '');
});
t('fmtAgo', () => {
  const now = 1_000_000_000;
  assert.equal(L.fmtAgo(now - 5000, now), 'ຫາກໍ່ນີ້');
  assert.equal(L.fmtAgo(now - 45000, now), '45 ວິນາທີກ່ອນ');
  assert.equal(L.fmtAgo(now - 5 * 60000, now), '5 ນາທີກ່ອນ');
  assert.equal(L.fmtAgo(now - 3 * 3600000, now), '3 ຊົ່ວໂມງກ່ອນ');
  assert.equal(L.fmtAgo(now - 50 * 3600000, now), '2 ມື້ກ່ອນ');
  assert.equal(L.fmtAgo(now + 9000, now), 'ຫາກໍ່ນີ້'); // clock skew → never negative
  assert.equal(L.fmtAgo(0, now), 'ບໍ່ຮູ້');
});
t('locState', () => {
  const now = Date.now();
  assert.equal(L.locState(null, now), 'off');
  assert.equal(L.locState({ lat: 1, lng: 1, ts: now, sharing: false }, now), 'off');
  assert.equal(L.locState({ lat: 1, lng: 1, ts: now - 60000 }, now), 'live');
  assert.equal(L.locState({ lat: 1, lng: 1, ts: now - L.STALE_MS - 1 }, now), 'stale');
});
t('genCode / cleanCode', () => {
  for (let i = 0; i < 500; i++) {
    const c = L.genCode();
    assert.equal(c.length, 6);
    assert.equal(L.cleanCode(c.toLowerCase()), c);
  }
  assert.equal(L.cleanCode(' ab-c 234 '), 'ABC234');
  assert.equal(L.cleanCode('ABC10O'), '');   // ambiguous chars rejected
  assert.equal(L.cleanCode('ABC23'), '');
  assert.equal(L.cleanCode(''), '');
});
t('shouldSend', () => {
  const p = { ...vte, ts: 0, acc: 10 };
  assert.equal(L.shouldSend(null, p), true);
  assert.equal(L.shouldSend(p, { ...vte, ts: 3000, acc: 10 }), false);                      // too soon
  assert.equal(L.shouldSend(p, { lat: vte.lat + 0.001, lng: vte.lng, ts: 6000, acc: 10 }), true); // moved ~111 m
  assert.equal(L.shouldSend(p, { ...vte, ts: 30000, acc: 10 }), false);                     // still, no heartbeat yet
  assert.equal(L.shouldSend(p, { ...vte, ts: 60000, acc: 10 }), true);                      // heartbeat
  assert.equal(L.shouldSend(p, { lat: vte.lat + 0.0003, lng: vte.lng, ts: 6000, acc: 100 }), false); // 33 m jitter at 100 m accuracy
  assert.equal(L.shouldSend(p, { ...vte, ts: 5000, acc: 10 }, { sos: true }), true);
});
t('initials (Lao + Latin)', () => {
  assert.equal(L.initials('ແສງ'), 'ແສ');
  assert.equal(L.initials('ສົມພອນ'), 'ສົ');
  assert.equal(L.initials('ນ້ອຍ'), 'ນ້');
  assert.equal(L.initials('ໄຊ'), 'ໄຊ');
  assert.equal(L.initials('tao'), 'T');
  assert.equal(L.initials('  '), '?');
});
t('fitSize', () => {
  assert.deepEqual(L.fitSize(800, 600), { w: 800, h: 600 });
  assert.deepEqual(L.fitSize(4032, 3024), { w: 1024, h: 768 });
  assert.deepEqual(L.fitSize(3024, 4032), { w: 768, h: 1024 });
});
t('sms / maps urls', () => {
  assert.equal(L.smsUrl('a b', true), 'sms:&body=a%20b');
  assert.equal(L.smsUrl('a b', false), 'sms:?body=a%20b');
  assert.equal(L.mapsUrl(1.5, 2.5), 'https://www.google.com/maps/dir/?api=1&destination=1.5,2.5');
});
t('nearestOthers', () => {
  const pts = [
    { uid: 'a', lat: 18.9236, lng: 102.4477 },
    { uid: 'b', lat: 18.9240, lng: 102.4477 },   // ~44 m from a
    { uid: 'c', lat: 18.9400, lng: 102.4477 },   // ~1.8 km north
  ];
  const n = L.nearestOthers(pts);
  assert.ok(n.a > 40 && n.a < 50, n.a);
  assert.ok(n.b > 40 && n.b < 50, n.b);
  assert.ok(n.c > L.AWAY_M, n.c);
  assert.equal(L.nearestOthers([{ uid: 'x', lat: 1, lng: 1 }]).x, Infinity);
  assert.ok(L.BACK_M < L.AWAY_M && L.LOW_BAT < L.BAT_RESET);
});
console.log(`\n${n} groups passed`);
