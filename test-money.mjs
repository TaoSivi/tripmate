// Run: node test-money.mjs
import assert from 'node:assert/strict';
import * as M from './money.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('toMinor / fmtMoney', () => {
  assert.equal(M.toMinor('12,500', 'LAK'), 12500);
  assert.equal(M.toMinor('12.505', 'THB'), 1251);
  assert.equal(M.toMinor('0.1', 'USD'), 10);
  for (const bad of ['', '.', '1e3', '-5', 'abc', '1.2.3']) assert.ok(Number.isNaN(M.toMinor(bad, 'LAK')), bad);
  assert.equal(M.fmtMoney(1250000, 'LAK'), '1,250,000 ₭');
  assert.equal(M.fmtMoney(125050, 'THB'), '1,250.5 ฿');
  assert.equal(M.fmtMoney(125000, 'THB'), '1,250 ฿');
  assert.equal(M.fmtMoney(-500, 'LAK'), '−500 ₭');
  assert.equal(M.fmtMoney(500, 'LAK', { sign: true }), '+500 ₭');
});

t('shares: sums exactly and fairly, deterministic', () => {
  for (const [amt, k] of [[100, 3], [1, 4], [999999, 7], [0, 3], [10, 1]]) {
    const sh = M.shares(amt, Array.from({ length: k }, (_, i) => 'u' + i));
    assert.equal(Object.values(sh).reduce((a, b) => a + b, 0), amt);
    assert.ok(Math.max(...Object.values(sh)) - Math.min(...Object.values(sh)) <= 1);
  }
  assert.deepEqual(M.shares(100, ['b', 'a', 'c']), { a: 34, b: 33, c: 33 });
  assert.deepEqual(M.shares(100, []), {});
  assert.deepEqual(M.shares(90, ['a', 'a', 'b']), { a: 45, b: 45 });      // duplicates ignored
});

t('ledger + settle: A pays 300 for A,B,C; B pays 60 for B,C', () => {
  const ex = [{ by: 'A', amt: 300, cur: 'LAK', sp: ['A', 'B', 'C'] }, { by: 'B', amt: 60, cur: 'LAK', sp: ['B', 'C'] }];
  const led = M.ledger(ex).LAK;
  // A: paid 300, owes 100 → +200.  B: paid 60, owes 100+30 → −70.  C: owes 100+30 → −130.
  assert.deepEqual([led.A.net, led.B.net, led.C.net], [200, -70, -130]);
  assert.deepEqual(M.settle(led), [{ from: 'C', to: 'A', amt: 130 }, { from: 'B', to: 'A', amt: 70 }]);
});

t('settle: random trips always balance to zero with at most n-1 transfers', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 400; k++) {
    const people = ['a', 'b', 'c', 'd', 'e'].slice(0, 2 + Math.floor(rnd() * 4));
    const ex = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => ({
      by: people[Math.floor(rnd() * people.length)], amt: 1 + Math.floor(rnd() * 500000), cur: 'LAK',
      sp: people.filter(() => rnd() > 0.35).concat(people[0]),
    }));
    const led = M.ledger(ex).LAK;
    assert.equal(Object.values(led).reduce((a, r) => a + r.net, 0), 0);
    const bal = Object.fromEntries(Object.entries(led).map(([u, r]) => [u, r.net]));
    const tr = M.settle(led);
    assert.ok(tr.length <= people.length - 1);
    for (const x of tr) { assert.ok(x.amt > 0); bal[x.from] += x.amt; bal[x.to] -= x.amt; }
    assert.ok(Object.values(bal).every((v) => v === 0), JSON.stringify(bal));
  }
});

t('repayment clears the debt; currencies stay separate; repayments are not spending', () => {
  const ex = [{ by: 'A', amt: 200, cur: 'LAK', sp: ['A', 'B'] }, { by: 'A', amt: 1000, cur: 'THB', sp: ['A', 'B'] }];
  assert.deepEqual(M.settle(M.ledger(ex).LAK), [{ from: 'B', to: 'A', amt: 100 }]);
  assert.deepEqual(M.settle(M.ledger(ex).THB), [{ from: 'B', to: 'A', amt: 500 }]);
  const paid = [...ex, { by: 'B', amt: 100, cur: 'LAK', sp: ['A'], kind: 'pay' }];
  assert.deepEqual(M.settle(M.ledger(paid).LAK), []);
  assert.deepEqual(M.totals(paid), { LAK: 200, THB: 1000 });
});

t('ledger ignores malformed rows instead of crashing', () => {
  assert.deepEqual(M.ledger([null, {}, { by: 'A', amt: 0, cur: 'LAK', sp: ['A'] }, { amt: 50, cur: 'LAK', sp: ['A'] }]), {});
});

t('not split = personal: counted as spending, never creates a debt', () => {
  const ex = [{ by: 'A', amt: 100, cur: 'LAK' }, { by: 'B', amt: 70, cur: 'LAK', sp: [] }, { by: 'A', amt: 300, cur: 'LAK', sp: ['A', 'B', 'C'] }];
  const led = M.ledger(ex).LAK;
  assert.deepEqual(led.A, { paid: 400, owed: 200, net: 200 });
  assert.deepEqual(led.B, { paid: 70, owed: 170, net: -100 });   // 70 own + 100 share
  assert.equal(led.C.net, -100);
  assert.deepEqual(M.settle(led), [{ from: 'B', to: 'A', amt: 100 }, { from: 'C', to: 'A', amt: 100 }]);
  assert.deepEqual(M.totals(ex), { LAK: 470 });
});

t('splitKind / splitLabel: none, all, some', () => {
  const all = ['a', 'b', 'c'];
  assert.equal(M.splitKind([], all), 'none');
  assert.equal(M.splitKind(undefined, all), 'none');
  assert.equal(M.splitKind(['c', 'a', 'b'], all), 'all');
  assert.equal(M.splitKind(['a', 'b'], all), 'some');
  assert.equal(M.splitKind(['a', 'b', 'c', 'x'], all), 'all');     // a former member on the item doesn't hide "all"
  assert.equal(M.splitLabel([], all), 'ບໍ່ຫານ');
  assert.equal(M.splitLabel(all, all), 'ຫານທັງໝົດ 3 ຄົນ');
  assert.equal(M.splitLabel(['a', 'b'], all), 'ຫານ 2 ຄົນ');
});

t('toCsv: BOM, quoting, per-person columns, no-bill reason', () => {
  const ex = [
    { by: 'A', amt: 5000000, cur: 'LAK', sp: ['A', 'B'], note: 'ເຂົ້າປຽກ, "ແຊບ"', cat: 'food', ts: Date.UTC(2026, 9, 8, 3, 5), bill: true },
    { by: 'B', amt: 12000, cur: 'LAK', sp: ['A', 'B'], note: 'ນ້ຳ', ts: Date.UTC(2026, 9, 8, 4, 0), bill: false, nb: 'market' },
  ];
  const csv = M.toCsv(ex, ['A', 'B'], (u) => ({ A: 'ແສງ', B: 'ນ້ອຍ' }[u]), (e) => e.nb);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes('"ເຂົ້າປຽກ, ""ແຊບ"""'));
  assert.ok(lines[1].endsWith(',2500000,2500000'));
  assert.ok(lines[2].includes(',ບໍ່ມີ,market,'));
});

t('summaryText lists totals and transfers', () => {
  const txt = M.summaryText('ວັງວຽງ', [{ by: 'A', amt: 300, cur: 'LAK', sp: ['A', 'B', 'C'], ts: 1 }], (u) => u);
  assert.ok(txt.includes('B → A  100 ₭') && txt.includes('C → A  100 ₭') && txt.includes('ລວມ 300 ₭'));
  assert.ok(M.summaryText('x', [], (u) => u).startsWith('💰'));
});

console.log(`\n${n} groups passed`);
