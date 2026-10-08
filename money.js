// Expense maths — pure functions, tested by `node test-money.mjs`.
// Money is stored in MINOR units: LAK ×1, THB/USD ×100 (so there is never a float in the database).

export const CUR = { LAK: { sym: '₭', dp: 0, n: 'ກີບ' }, THB: { sym: '฿', dp: 2, n: 'ບາດ' }, USD: { sym: '$', dp: 2, n: 'ໂດລາ' } };
export const CUR_LIST = Object.keys(CUR);

/** Why there is no bill. Every bill-less expense must carry one of these, so nothing is "just missing". */
export const NO_BILL = [
  { k: 'market', em: '🛖', n: 'ຕະຫຼາດ / ຮ້ານນ້ອຍ ບໍ່ອອກບິນ' },
  { k: 'cash', em: '💵', n: 'ຈ່າຍເງິນສົດ ບໍ່ມີໃບຮັບ' },
  { k: 'qr', em: '📲', n: 'ໂອນ / QR (ແນບສະລິບພາຍຫຼັງ)' },
  { k: 'tip', em: '🙏', n: 'ທິບ / ຄ່ານ້ຳໃຈ' },
  { k: 'lost', em: '🫥', n: 'ບິນຫາຍ / ລືມຖ່າຍ' },
  { k: 'other', em: '✍️', n: 'ອື່ນໆ (ພິມເຫດຜົນ)' },
];
export const CATS = [
  { k: 'food', em: '🍜', n: 'ອາຫານ' }, { k: 'drink', em: '☕', n: 'ເຄື່ອງດື່ມ' }, { k: 'ride', em: '🚗', n: 'ເດີນທາງ' },
  { k: 'stay', em: '🏨', n: 'ທີ່ພັກ' }, { k: 'ticket', em: '🎟️', n: 'ປີ້ / ເຂົ້າຊົມ' }, { k: 'shop', em: '🛒', n: 'ຂອງໃຊ້' }, { k: 'misc', em: '💡', n: 'ອື່ນໆ' },
];

/** "12,500.5" → minor units; NaN if unparsable or not positive-looking. */
export function toMinor(input, cur) {
  const dp = (CUR[cur] || CUR.LAK).dp;
  const t = String(input ?? '').replace(/[,\s]/g, '');
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return NaN;
  return Math.round(parseFloat(t) * 10 ** dp);
}

export function fmtMoney(minor, cur, { sign = false } = {}) {
  const { sym, dp } = CUR[cur] || CUR.LAK;
  const neg = minor < 0, v = Math.abs(minor);
  const whole = Math.floor(v / 10 ** dp), frac = v % 10 ** dp;
  let s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (dp && frac) s += '.' + String(frac).padStart(dp, '0').replace(/0+$/, '');
  return `${neg ? '−' : sign && v ? '+' : ''}${s} ${sym}`;
}

/** Equal split; leftover units go to the first uids in sorted order, so every device computes the same numbers. */
export function shares(minor, uids) {
  const ids = [...new Set(uids)].sort();
  if (!ids.length) return {};
  const base = Math.floor(minor / ids.length);
  let rem = minor - base * ids.length;
  const out = {};
  for (const u of ids) { out[u] = base + (rem > 0 ? 1 : 0); if (rem > 0) rem--; }
  return out;
}

/** exps: [{by, amt, cur, sp:[uid]}] → {cur: {uid: {paid, owed, net}}}. A repayment is a normal row with sp=[creditor]. */
export function ledger(exps) {
  const out = {};
  for (const e of exps) {
    if (!e || !(e.amt > 0) || !e.by) continue;
    const L = (out[e.cur] ||= {});
    const row = (u) => (L[u] ||= { paid: 0, owed: 0, net: 0 });
    row(e.by).paid += e.amt;
    const sp = Array.isArray(e.sp) ? e.sp : [];
    if (!sp.length) { row(e.by).owed += e.amt; continue; }   // not split: personal spending of the payer
    for (const [u, v] of Object.entries(shares(e.amt, sp))) row(u).owed += v;
  }
  for (const L of Object.values(out)) for (const r of Object.values(L)) r.net = r.paid - r.owed;
  return out;
}

/** How an expense is shared: 'none' (not split), 'all' (everyone in `everyone`), or 'some'. */
export function splitKind(sp, everyone) {
  const s = new Set(Array.isArray(sp) ? sp : []);
  if (!s.size) return 'none';
  return everyone.length && everyone.every((u) => s.has(u)) ? 'all' : 'some';
}
/** Short Lao label: "ຫານທັງໝົດ 5 ຄົນ" · "ຫານ 2 ຄົນ" · "ບໍ່ຫານ". */
export function splitLabel(sp, everyone) {
  const k = splitKind(sp, everyone), n = new Set(Array.isArray(sp) ? sp : []).size;
  return k === 'none' ? 'ບໍ່ຫານ' : k === 'all' ? `ຫານທັງໝົດ ${n} ຄົນ` : `ຫານ ${n} ຄົນ`;
}

/** Greedy settlement for one currency: at most (people − 1) transfers. → [{from, to, amt}] */
export function settle(L) {
  const cred = [], debt = [];
  for (const [u, r] of Object.entries(L || {})) { if (r.net > 0) cred.push({ u, v: r.net }); else if (r.net < 0) debt.push({ u, v: -r.net }); }
  const by = (a, b) => b.v - a.v || (a.u < b.u ? -1 : 1);
  cred.sort(by); debt.sort(by);
  const out = [];
  let i = 0, j = 0;
  while (i < cred.length && j < debt.length) {
    const t = Math.min(cred[i].v, debt[j].v);
    if (t > 0) out.push({ from: debt[j].u, to: cred[i].u, amt: t });
    cred[i].v -= t; debt[j].v -= t;
    if (cred[i].v === 0) i++;
    if (debt[j].v === 0) j++;
  }
  return out;
}

/** Total spent per currency (repayments are not spending). */
export function totals(exps) {
  const out = {};
  for (const e of exps) if (e && e.amt > 0 && e.kind !== 'pay') out[e.cur] = (out[e.cur] || 0) + e.amt;
  return out;
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** CSV with a UTF-8 BOM so Excel shows Lao. One column per person with that person's share. */
export function toCsv(exps, uids, nameOf, noBillLabel) {
  const head = ['ວັນທີ', 'ເວລາ', 'ລາຍການ', 'ໝວດ', 'ຈຳນວນ', 'ສະກຸນ', 'ຜູ້ຈ່າຍ', 'ຫານໃຫ້', 'ບິນ', 'ເຫດຜົນບໍ່ມີບິນ', ...uids.map((u) => `ສ່ວນຂອງ ${nameOf(u)}`)];
  const rows = [head];
  const pad = (n) => String(n).padStart(2, '0');
  for (const e of [...exps].sort((a, b) => a.ts - b.ts)) {
    const d = new Date(e.ts);
    const dp = (CUR[e.cur] || CUR.LAK).dp;
    const num = (m) => (m / 10 ** dp).toFixed(dp);
    const sh = shares(e.amt, e.sp || []);
    rows.push([
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      (e.kind === 'pay' ? '[ໂອນຄືນ] ' : '') + (e.note || ''), (CATS.find((c) => c.k === e.cat) || {}).n || '',
      num(e.amt), e.cur, nameOf(e.by), (e.sp || []).length ? (e.sp.length >= uids.length && uids.every((u) => e.sp.includes(u)) ? 'ທັງໝົດ' : e.sp.map(nameOf).join(' + ')) : 'ບໍ່ຫານ',
      e.bill ? 'ມີ' : 'ບໍ່ມີ', e.bill ? '' : noBillLabel(e), ...uids.map((u) => (sh[u] != null ? num(sh[u]) : '')),
    ]);
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Plain text for pasting into a chat. */
export function summaryText(title, exps, nameOf) {
  const L = ledger(exps), T = totals(exps);
  const lines = [`💰 ສະຫຼຸບລາຍຈ່າຍ · ${title}`];
  for (const cur of Object.keys(T)) {
    lines.push('', `ລວມ ${fmtMoney(T[cur], cur)} (${exps.filter((e) => e.cur === cur && e.kind !== 'pay').length} ລາຍການ)`);
    for (const [u, r] of Object.entries(L[cur] || {})) {
      lines.push(`• ${nameOf(u)}: ຈ່າຍ ${fmtMoney(r.paid, cur)} · ສ່ວນຕົວ ${fmtMoney(r.owed, cur)} · ${r.net >= 0 ? 'ຮັບຄືນ' : 'ຕ້ອງໂອນ'} ${fmtMoney(Math.abs(r.net), cur)}`);
    }
    const tr = settle(L[cur]);
    if (tr.length) { lines.push('ໂອນດັ່ງນີ້:'); for (const t of tr) lines.push(`  ${nameOf(t.from)} → ${nameOf(t.to)}  ${fmtMoney(t.amt, cur)}`); }
    else lines.push('✅ ບໍ່ມີໃຜຕິດໃຜ');
  }
  return lines.join('\n');
}
