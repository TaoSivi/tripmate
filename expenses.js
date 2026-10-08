// Expenses tab: add (photo of bill + amount + what for), summary, who-pays-whom, per-item detail, export.
// Data: trips/{code}/exp/{id}  = {by, rec, amt, cur, note, cat, sp[], ts, bill, th?, nb?, nbn?, kind?}
//       trips/{code}/bills/{id} = data-URL of the bill photo (kept apart so the list stays light; `th` is a small thumbnail inside exp)
import * as M from './money.js';
import * as U from './lib.js';
import { ic, catIcon, nbIcon } from './icons.js';
import { paintScenes } from './paperart.js';

const BILL_LIMIT = 380000;   // chars of data-URL; database.rules.json caps at 400000

export function createExpenses(ctx) {
  const { S, $, esc, P, toast, confirmBox, modal, avatar, sendMsg, haptic, store, say, viewImage, nameOf, switchTab, FX } = ctx;
  let filterNoBill = false;
  const billCache = new Map();

  /* ---------- data helpers ---------- */
  const list = () => Object.entries(S.exp || {}).map(([id, e]) => ({ id, ...e })).filter((e) => e && e.amt > 0).sort((a, b) => b.ts - a.ts);
  const everyone = () => Object.keys(S.members);
  const splitText = (e) => M.splitLabel(e.sp, everyone());
  const canEdit = (e) => e.rec === S.uid || e.by === S.uid || S.info?.owner === S.uid;
  const nbLabel = (e) => {
    const r = M.NO_BILL.find((x) => x.k === e.nb);
    return e.nb === 'other' || !r ? (e.nbn || 'ບໍ່ລະບຸ') : r.n + (e.nbn ? ` · ${e.nbn}` : '');
  };
  const catOf = (e) => M.CATS.find((c) => c.k === e.cat);
  const dayLabel = (ts) => {
    const d = new Date(ts), now = new Date();
    const same = (a, b) => a.toDateString() === b.toDateString();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return same(d, now) ? 'ມື້ນີ້' : same(d, y) ? 'ມື້ວານ' : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  /* ---------- image helpers ---------- */
  function loadImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }
  async function makeBill(file) {
    const img = await loadImg(file);
    const cv = document.createElement('canvas');
    let max = 1600, q = 0.78, out = null;
    for (let i = 0; i < 7; i++) {
      const { w, h } = U.fitSize(img.naturalWidth, img.naturalHeight, max);
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      out = cv.toDataURL('image/jpeg', q);
      if (out.length < BILL_LIMIT) break;
      max = Math.round(max * 0.82); q = Math.max(0.55, q - 0.05);
    }
    if (out.length >= BILL_LIMIT) throw new Error('too big');
    const t = U.fitSize(img.naturalWidth, img.naturalHeight, 110);
    cv.width = t.w; cv.height = t.h;
    cv.getContext('2d').drawImage(img, 0, 0, t.w, t.h);
    return { data: out, th: cv.toDataURL('image/jpeg', 0.6) };
  }
  async function getBill(id) {
    if (billCache.has(id)) return billCache.get(id);
    let d = null;
    try { d = await S.be.get(P(`bills/${id}`)); } catch { d = null; }
    if (d) billCache.set(id, d);
    return d;
  }

  /* ---------- rendering ---------- */
  function render() {
    if (!S.code || !$('exp-sum')) return;
    const items = list();
    const T = M.totals(items), L = M.ledger(items);
    const memberCount = Object.keys(S.members).length || 1;
    const missing = items.filter((e) => !e.bill && e.kind !== 'pay');
    $('exp-sub').textContent = items.length ? `${items.filter((e) => e.kind !== 'pay').length} ລາຍການ · ${missing.length ? `ບໍ່ມີບິນ ${missing.length}` : 'ມີບິນຄົບ ✓'}` : 'ຍັງບໍ່ມີລາຍຈ່າຍ';

    let sum = '';
    if (!items.length) {
      sum = `<div class="x-empty"><div class="x-empty-pin">${FX.pin('happy', 'wave')}</div><b>ຍັງບໍ່ມີລາຍຈ່າຍ</b>
        <span>ຄົນໃດຈ່າຍກ່ອນ ກົດ "ເພີ່ມລາຍຈ່າຍ" ແລ້ວຖ່າຍບິນ ໃສ່ຈຳນວນ ແລະ ພິມວ່າຈ່າຍຫຍັງ. ແອັບຫານ ແລະ ບອກເອງວ່າໃຜຕ້ອງໂອນໃຫ້ໃຜ.</span></div>`;
    }
    for (const cur of Object.keys(T)) {
      const tr = M.settle(L[cur]);
      const people = Object.entries(L[cur] || {}).sort((a, b) => b[1].net - a[1].net);
      sum += `<div class="x-hero"><div class="scene-strip x-scene" data-seed="${17 + Object.keys(T).indexOf(cur) * 6}"></div><div class="x-hero-l">ລວມທັງໝົດ</div><div class="x-hero-v">${M.fmtMoney(T[cur], cur)}</div>
        <div class="x-hero-s">${items.filter((e) => e.cur === cur && e.kind !== 'pay').length} ລາຍການ · ສະເລ່ຍຄົນລະ ${M.fmtMoney(Math.round(T[cur] / memberCount), cur)}</div></div>
        <div class="x-card"><h3>ໃຜຕ້ອງໂອນໃຫ້ໃຜ</h3>${tr.length ? tr.map((t, i) => `
          <div class="x-tr ${t.from === S.uid ? 'me' : ''}">${avatar(S.members[t.from] || { name: nameOf(t.from) }, 'sm')}
            <div class="x-tr-t"><b>${esc(t.from === S.uid ? 'ເຈົ້າ' : nameOf(t.from))}</b> <span class="muted">ໂອນໃຫ້</span> <b>${esc(t.to === S.uid ? 'ເຈົ້າ' : nameOf(t.to))}</b>
              <div class="x-tr-v">${M.fmtMoney(t.amt, cur)}</div></div>
            ${t.from === S.uid || t.to === S.uid ? `<button class="btn sm" data-pay="${esc(cur)}|${esc(t.from)}|${esc(t.to)}|${t.amt}">${t.to === S.uid ? 'ໄດ້ຮັບແລ້ວ' : 'ໂອນແລ້ວ'}</button>` : ''}</div>`).join('') : `<div class="x-ok">${ic('check')} ບໍ່ມີໃຜຕິດໃຜ</div>`}
        </div>
        <div class="x-card"><h3>ຍອດແຕ່ລະຄົນ</h3>${people.map(([u, r]) => `
          <div class="x-per">${avatar(S.members[u] || { name: nameOf(u) }, 'sm')}<div class="x-per-t"><b>${esc(u === S.uid ? `${nameOf(u)} (ຂ້ອຍ)` : nameOf(u))}</b>
            <span>ຈ່າຍ ${M.fmtMoney(r.paid, cur)} · ສ່ວນຕົວ ${M.fmtMoney(r.owed, cur)}</span></div>
            <span class="x-net ${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : ''}">${r.net === 0 ? 'ພໍດີ' : M.fmtMoney(r.net, cur, { sign: true })}</span></div>`).join('')}
        </div>`;
    }
    if (missing.length) {
      sum += `<button class="x-warn ${filterNoBill ? 'on' : ''}" id="x-filter">${ic('warn')} ບໍ່ມີບິນ ${missing.length} ລາຍການ <span>${filterNoBill ? 'ສະແດງທັງໝົດ' : 'ກົດເພື່ອກັ່ນຕອງ'}</span></button>`;
    }
    $('exp-sum').innerHTML = sum;
    paintScenes($('exp-sum'));

    const shown = filterNoBill ? missing : items;
    let html = '', lastDay = '';
    for (const e of shown) {
      const day = dayLabel(e.ts);
      if (day !== lastDay) { html += `<div class="x-day">${day}</div>`; lastDay = day; }
      const c = catOf(e);
      const sp = e.sp || [];
      const sub = e.kind === 'pay' ? `${esc(nameOf(e.by))} → ${esc(nameOf(sp[0]))}` : `${esc(nameOf(e.by))} ຈ່າຍ · ${splitText(e)}`;
      html += `<button class="x-row" data-id="${esc(e.id)}">
        <span class="x-th ${e.th ? 'img' : ''}">${e.th ? `<img src="${e.th}" alt="">` : (e.kind === 'pay' ? ic('coin') : ic(c ? catIcon(c.k) : 'receipt'))}</span>
        <span class="x-mid"><b>${esc(e.note || (c && c.n) || 'ລາຍຈ່າຍ')}</b><span class="x-sub">${sub} · ${U.fmtTime(e.ts)}</span>
          ${e.kind === 'pay' ? '<span class="x-badge pay">ໂອນຄືນ</span>' : e.bill ? `<span class="x-badge ok">${ic('receipt')} ມີບິນ</span>` : `<span class="x-badge no">${ic('warn')} ບໍ່ມີບິນ · ${esc(nbLabel(e))}</span>`}</span>
        <span class="x-amt ${e.kind === 'pay' ? 'pay' : ''}">${M.fmtMoney(e.amt, e.cur)}</span></button>`;
    }
    $('exp-list').innerHTML = html;
  }

  /* ---------- add / edit sheet ---------- */
  // The card sent into the chat carries the sharing summary so nobody has to open the item to see it.
  function postToChat(id, e) {
    const kind = M.splitKind(e.sp, everyone());
    sendMsg({ type: 'exp', eid: id, amt: e.amt, cur: e.cur, text: e.note, by: e.by, sk: kind, n: (e.sp || []).length, bill: !!e.bill, ...(e.kind === 'pay' ? { kind: 'pay', to: (e.sp || [])[0] } : {}) });
  }

  function openForm(existing, opts = {}) {
    const lastCur = store.get('expCur', 'LAK');
    const f = existing ? {
      id: existing.id, cur: existing.cur, amtStr: fmtInput(existing.amt, existing.cur), note: existing.note || '', cat: existing.cat || '',
      by: existing.by, sp: new Set(existing.sp || []), mode: existing.bill ? 'photo' : 'none', nb: existing.nb || '', nbn: existing.nbn || '',
      bill: null, keep: !!existing.bill, th: existing.th || null,
    } : {
      cur: lastCur, amtStr: '', note: '', cat: '', by: S.uid, sp: new Set(Object.keys(S.members)),
      mode: null, nb: '', nbn: '', bill: null, keep: false, th: null,
    };
    const dp = () => M.CUR[f.cur].dp;
    const el = document.createElement('div');
    el.className = 'xs';
    el.innerHTML = `
      <header class="xs-h"><button class="icon-btn" id="xf-x" aria-label="ປິດ">${ic('close')}</button><h2>${existing ? 'ແກ້ໄຂລາຍຈ່າຍ' : 'ເພີ່ມລາຍຈ່າຍ'}</h2><span style="width:44px"></span></header>
      <div class="xs-b">
        <label class="xs-l" for="xf-amt">ຈຳນວນເງິນ</label>
        <div class="xs-amt"><input id="xf-amt" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(f.amtStr)}"><span id="xf-sym"></span></div>
        <div class="xs-payer" id="xf-payer"></div>
        <div class="seg xs-cur" id="xf-cur">${M.CUR_LIST.map((c) => `<button data-c="${c}" aria-checked="${c === f.cur}">${M.CUR[c].n} ${M.CUR[c].sym}</button>`).join('')}</div>

        <label class="xs-l" for="xf-note">ຈ່າຍຫຍັງ</label>
        <input id="xf-note" class="input" maxlength="100" placeholder="ເຊັ່ນ: ເຂົ້າປຽກ 4 ຖ້ວຍ" value="${esc(f.note)}">
        <div class="xs-chips" id="xf-cats">${M.CATS.map((c) => `<button data-k="${c.k}" aria-pressed="${c.k === f.cat}">${ic(catIcon(c.k))} ${c.n}</button>`).join('')}</div>

        <div class="xs-l">ຫານໃຫ້ໃຜແດ່ <span><button class="xs-link" id="xf-all">ທັງໝົດ</button> · <button class="xs-link" id="xf-none-sp">ບໍ່ຫານ</button></span></div>
        <div class="xs-ppl multi" id="xf-sp"></div>
        <div class="xs-each" id="xf-each"></div>

        <div class="xs-l">ບິນ</div>
        <div class="xs-bill">
          <button class="xs-bopt" id="xf-cam">${ic('camera')}<b>ຖ່າຍບິນ</b></button>
          <button class="xs-bopt" id="xf-gal">${ic('photo')}<b>ເລືອກຮູບ</b></button>
          <button class="xs-bopt" id="xf-none">${ic('no')}<b>ບໍ່ມີບິນ</b></button>
        </div>
        <input type="file" id="xf-file-cam" accept="image/*" capture="environment" hidden>
        <input type="file" id="xf-file-gal" accept="image/*" hidden>
        <div id="xf-billbox"></div>
      </div>
      <footer class="xs-f"><div class="xs-hint" id="xf-hint"></div><button class="btn primary block" id="xf-save">ບັນທຶກ ແລະ ສົ່ງ</button></footer>`;
    document.body.appendChild(el);
    const q = (s) => el.querySelector(s);
    const close = () => el.remove();
    q('#xf-x').onclick = async () => {
      if (f.amtStr || f.note || f.bill) { if (!(await confirmBox('ປິດໂດຍບໍ່ບັນທຶກ?', 'ຂໍ້ມູນທີ່ກຳລັງພິມຈະຫາຍ.', 'ປິດ', true))) return; }
      close();
    };

    const draw = () => {
      q('#xf-sym').textContent = M.CUR[f.cur].sym;
      q('#xf-payer').innerHTML = `${avatar(S.members[f.by] || { name: nameOf(f.by) }, 'sm')}<span>${f.by === S.uid ? 'ເຈົ້າເປັນຜູ້ຈ່າຍ' : `${esc(nameOf(f.by))} ເປັນຜູ້ຈ່າຍ`}</span>`;
      q('#xf-cur').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.c === f.cur)));
      q('#xf-cats').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === f.cat)));
      const ids = Object.keys(S.members);
      for (const u of [f.by, ...f.sp]) if (!ids.includes(u)) ids.push(u);   // keep people who left but are on this item
      q('#xf-sp').innerHTML = ids.map((u) => `<button data-u="${esc(u)}" aria-pressed="${f.sp.has(u)}">${avatar(S.members[u] || { name: nameOf(u) }, 'sm')}<span>${esc(u === S.uid ? 'ຂ້ອຍ' : nameOf(u))}</span><i>${f.sp.has(u) ? '✓' : ''}</i></button>`).join('');
      const minor = M.toMinor(f.amtStr, f.cur);
      const kind = M.splitKind([...f.sp], Object.keys(S.members));
      q('#xf-each').className = 'xs-each ' + kind;
      q('#xf-each').textContent = kind === 'none' ? `ບໍ່ຫານ — ເປັນລາຍຈ່າຍສ່ວນຕົວຂອງ ${nameOf(f.by)} ບໍ່ມີໃຜຕ້ອງໂອນ`
        : (kind === 'all' ? `ຫານທັງໝົດ ${f.sp.size} ຄົນ` : `ຫານ ${f.sp.size} ຄົນ`) + (minor > 0 ? ` · ຄົນລະປະມານ ${M.fmtMoney(Math.floor(minor / f.sp.size), f.cur)}` : '');
      q('#xf-cam').classList.toggle('on', f.mode === 'photo' && !!(f.bill || f.keep));
      q('#xf-none').classList.toggle('on', f.mode === 'none');
      let bb = '';
      if (f.mode === 'photo' && (f.bill || f.keep)) {
        bb = `<div class="xs-prev"><img src="${f.bill ? f.bill.th : f.th}" alt="ບິນ"><div><b>ມີບິນແລ້ວ</b><span>${f.bill ? 'ຮູບໃໝ່ພ້ອມສົ່ງ' : 'ໃຊ້ຮູບບິນເດີມ'}</span></div><button class="btn sm" id="xf-retake">ຖ່າຍໃໝ່</button></div>`;
      } else if (f.mode === 'none') {
        bb = `<div class="xs-nb"><div class="xs-nbh">ເປັນຫຍັງຈຶ່ງບໍ່ມີບິນ? <small>(ຈຳເປັນ — ເພື່ອໃຫ້ທຸກລາຍການມີເຫດຜົນ)</small></div>
          ${M.NO_BILL.map((r) => `<button class="xs-r" data-k="${r.k}" aria-pressed="${r.k === f.nb}">${ic(nbIcon(r.k))}${r.n}</button>`).join('')}
          <input id="xf-nbn" class="input" maxlength="80" placeholder="${f.nb === 'other' ? 'ພິມເຫດຜົນ (ຈຳເປັນ)' : 'ໝາຍເຫດເພີ່ມເຕີມ (ບໍ່ບັງຄັບ)'}" value="${esc(f.nbn)}"></div>`;
      } else if (!f.mode) {
        bb = '<div class="xs-need">ຖ່າຍບິນ ຫຼື ເລືອກ "ບໍ່ມີບິນ" ກ່ອນບັນທຶກ</div>';
      }
      q('#xf-billbox').innerHTML = bb;
      const nbn = q('#xf-nbn'); if (nbn) nbn.oninput = () => { f.nbn = nbn.value; hint(); };
      const rt = q('#xf-retake'); if (rt) rt.onclick = () => q('#xf-file-cam').click();
      hint();
    };
    function hint() {
      const minor = M.toMinor(f.amtStr, f.cur);
      let h = '';
      if (!(minor > 0)) h = 'ໃສ່ຈຳນວນເງິນ';
      else if (!f.note.trim() && !f.cat) h = 'ພິມວ່າຈ່າຍຫຍັງ ຫຼື ເລືອກໝວດ';
      else if (!f.mode || (f.mode === 'photo' && !f.bill && !f.keep)) h = 'ຖ່າຍບິນ ຫຼື ເລືອກ "ບໍ່ມີບິນ"';
      else if (f.mode === 'none' && !f.nb) h = 'ເລືອກເຫດຜົນທີ່ບໍ່ມີບິນ';
      else if (f.mode === 'none' && f.nb === 'other' && !f.nbn.trim()) h = 'ພິມເຫດຜົນທີ່ບໍ່ມີບິນ';
      q('#xf-hint').textContent = h;
      q('#xf-save').disabled = !!h;
      return !h;
    }

    // amount: thousands separators while typing
    const amt = q('#xf-amt');
    amt.addEventListener('input', () => {
      let v = amt.value.replace(/[^\d.]/g, '');
      const parts = v.split('.');
      let whole = parts[0].replace(/^0+(?=\d)/, '');
      v = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts.length > 1 && dp() ? '.' + parts[1].slice(0, dp()) : '');
      amt.value = v; f.amtStr = v; draw();
    });
    q('#xf-cur').onclick = (e) => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      f.cur = b.dataset.c; store.set('expCur', f.cur);
      const m = M.toMinor(f.amtStr, f.cur); f.amtStr = Number.isNaN(m) ? '' : fmtInput(m, f.cur);
      amt.value = f.amtStr; draw();
    };
    q('#xf-note').oninput = (e) => { f.note = e.target.value; hint(); };
    q('#xf-cats').onclick = (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const c = M.CATS.find((x) => x.k === b.dataset.k);
      f.cat = f.cat === c.k ? '' : c.k;
      if (f.cat && !f.note.trim()) { f.note = c.n; q('#xf-note').value = c.n; }
      draw();
    };
    q('#xf-sp').onclick = (e) => { const b = e.target.closest('[data-u]'); if (!b) return; const u = b.dataset.u; f.sp.has(u) ? f.sp.delete(u) : f.sp.add(u); draw(); };
    q('#xf-all').onclick = () => { f.sp = new Set(Object.keys(S.members)); draw(); };
    q('#xf-none-sp').onclick = () => { f.sp = new Set(); draw(); };

    const pick = async (file) => {
      if (!file) return;
      try { f.bill = await makeBill(file); f.mode = 'photo'; f.keep = false; haptic(); }
      catch { toast('ອ່ານຮູບບໍ່ໄດ້ ຫຼື ໃຫຍ່ເກີນໄປ — ລອງຖ່າຍໃໝ່'); }
      draw();
    };
    q('#xf-cam').onclick = () => q('#xf-file-cam').click();
    q('#xf-gal').onclick = () => q('#xf-file-gal').click();
    q('#xf-file-cam').onchange = (e) => { pick(e.target.files[0]); e.target.value = ''; };
    q('#xf-file-gal').onchange = (e) => { pick(e.target.files[0]); e.target.value = ''; };
    q('#xf-none').onclick = () => { f.mode = 'none'; f.bill = null; f.keep = false; draw(); };
    q('#xf-billbox').onclick = (e) => { const b = e.target.closest('.xs-r'); if (b) { f.nb = b.dataset.k; draw(); q('#xf-nbn')?.focus(); } };

    q('#xf-save').onclick = async () => {
      if (!hint()) return;
      const btn = q('#xf-save'); btn.disabled = true; btn.textContent = 'ກຳລັງບັນທຶກ…';
      const minor = M.toMinor(f.amtStr, f.cur);
      const c = M.CATS.find((x) => x.k === f.cat);
      const rec = {
        by: f.by, rec: existing ? existing.rec : S.uid, amt: minor, cur: f.cur, note: f.note.trim() || (c ? c.n : ''),
        ts: existing ? existing.ts : S.be.now(), bill: f.mode === 'photo',
      };
      if (f.sp.size) rec.sp = [...f.sp]; else rec.ns = true;
      if (f.cat) rec.cat = f.cat;
      if (rec.bill) rec.th = f.bill ? f.bill.th : f.th;
      else { rec.nb = f.nb; if (f.nbn.trim()) rec.nbn = f.nbn.trim(); }
      try {
        const id = existing ? existing.id : S.be.newKey(P('exp'));
        if (f.bill) { await S.be.set(P(`bills/${id}`), f.bill.data); billCache.set(id, f.bill.data); }
        else if (existing && existing.bill && !rec.bill) { await S.be.remove(P(`bills/${id}`)); billCache.delete(id); }
        await S.be.set(P(`exp/${id}`), rec);
        if (!existing) postToChat(id, rec);
        close(); haptic(30);
        if (!opts.stay) switchTab('exp');
        FX.burst('sparkles');
        toast(existing ? 'ບັນທຶກການແກ້ໄຂແລ້ວ ✓' : 'ບັນທຶກ ແລະ ສົ່ງໃຫ້ໝູ່ແລ້ວ ✓');
        setTimeout(() => { const row = document.querySelector(`.x-row[data-id="${id}"]`); if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1800); } }, 250);
      } catch (e) {
        btn.disabled = false; btn.textContent = 'ບັນທຶກ ແລະ ສົ່ງ';
        toast('ບັນທຶກບໍ່ສຳເລັດ — ກວດເນັດແລ້ວລອງໃໝ່');
      }
    };
    draw();
    if (!existing) setTimeout(() => amt.focus(), 120);
  }

  function fmtInput(minor, cur) {
    const dp = M.CUR[cur].dp;
    const whole = String(Math.floor(minor / 10 ** dp)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const frac = dp ? String(minor % 10 ** dp).padStart(dp, '0').replace(/0+$/, '') : '';
    return whole + (frac ? '.' + frac : '');
  }

  /* ---------- detail ---------- */
  async function openDetail(id) {
    const e0 = S.exp?.[id];
    if (!e0) return toast('ບໍ່ພົບລາຍການນີ້ (ອາດຖືກລຶບແລ້ວ)');
    const e = { id, ...e0 };
    const sh = M.shares(e.amt, e.sp || []);
    const sk = M.splitKind(e.sp, everyone());
    const c = catOf(e);
    const acts = [{ label: 'ປິດ' }, { label: 'ສົ່ງລົງແຊັດ', onClick: () => { postToChat(id, e); toast('ສົ່ງລາຍຈ່າຍລົງແຊັດແລ້ວ'); } }];
    if (canEdit(e)) {
      if (e.kind !== 'pay') acts.push({ label: 'ແກ້ໄຂ', onClick: () => setTimeout(() => openForm(e), 50) });
      acts.push({ label: 'ລຶບ', cls: 'danger', onClick: () => { setTimeout(() => remove(e), 50); } });
    }
    modal({
      title: `${e.note || (c && c.n) || 'ລາຍຈ່າຍ'}`,
      html: `<div class="xd-amt">${M.fmtMoney(e.amt, e.cur)}</div>
        <div class="xd-meta">${esc(nameOf(e.by))} ຈ່າຍ · ${dayLabel(e.ts)} ${U.fmtTime(e.ts)}${e.rec !== e.by ? ` · ບັນທຶກໂດຍ ${esc(nameOf(e.rec))}` : ''}</div>
        <div class="xd-split"><span class="tag ${sk}">${sk === 'none' ? 'ບໍ່ຫານ · ສ່ວນຕົວ' : sk === 'all' ? 'ຫານທັງໝົດ' : 'ຫານບາງຄົນ'}</span>${Object.entries(sh).map(([u, v]) => `<span class="tag">${esc(nameOf(u))} ${M.fmtMoney(v, e.cur)}</span>`).join('')}</div>
        <div id="xd-bill" class="xd-bill">${e.kind === 'pay' ? '' : e.bill ? '<div class="muted">ກຳລັງໂຫຼດບິນ…</div>' : `<div class="xd-nb">${ic('warn')} ບໍ່ມີບິນ<br><b>${esc(nbLabel(e))}</b></div>${canEdit(e) ? `<button class="btn sm primary" id="xd-add">${ic('camera')} ເພີ່ມບິນຕອນນີ້</button><input type="file" id="xd-file" accept="image/*" capture="environment" hidden>` : ''}`}</div>`,
      actions: acts,
    });
    const box = () => document.getElementById('xd-bill');
    if (e.bill) {
      const data = await getBill(id);
      if (box()) box().innerHTML = data ? `<img class="xd-img" src="${data}" alt="ບິນ"><a class="btn sm" download="bill_${esc(id)}.jpg" href="${data}">${ic('download')} ບັນທຶກຮູບບິນ</a>` : '<div class="muted">ໂຫຼດບິນບໍ່ໄດ້ (ເນັດ?)</div>';
      box()?.querySelector('.xd-img')?.addEventListener('click', () => viewImage(data));
    } else if (canEdit(e) && e.kind !== 'pay') {
      const add = document.getElementById('xd-add'), file = document.getElementById('xd-file');
      add.onclick = () => file.click();
      file.onchange = async () => {
        if (!file.files[0]) return;
        try {
          const b = await makeBill(file.files[0]);
          await S.be.set(P(`bills/${id}`), b.data);
          await S.be.update(P(`exp/${id}`), { bill: true, th: b.th, nb: null, nbn: null });
          billCache.set(id, b.data);
          document.querySelector('.modal-bg')?.remove();
          toast('ເພີ່ມບິນແລ້ວ ✓');
        } catch { toast('ເພີ່ມບິນບໍ່ສຳເລັດ'); }
      };
    }
  }

  async function remove(e) {
    if (!(await confirmBox('ລຶບລາຍຈ່າຍນີ້?', `${e.note || 'ລາຍການ'} · ${M.fmtMoney(e.amt, e.cur)} — ຍອດຈະຄິດໃໝ່ທັນທີ.`, 'ລຶບ', true))) return;
    try {
      if (e.bill) await S.be.remove(P(`bills/${e.id}`));
      await S.be.remove(P(`exp/${e.id}`));
      billCache.delete(e.id);
      sendMsg({ type: 'sys', text: `ລຶບລາຍຈ່າຍ "${e.note || ''}"` });
      toast('ລຶບແລ້ວ');
    } catch { toast('ລຶບບໍ່ສຳເລັດ'); }
  }

  /* ---------- repayment ---------- */
  async function markPaid(cur, from, to, amt) {
    const a = from === S.uid ? 'ເຈົ້າ' : nameOf(from), b = to === S.uid ? 'ເຈົ້າ' : nameOf(to);
    if (!(await confirmBox('ບັນທຶກວ່າໂອນແລ້ວ?', `${a} ໂອນ ${M.fmtMoney(amt, cur)} ໃຫ້ ${b} ແລ້ວ. ຍອດຈະຫັກອອກຈາກໜີ້.`, 'ໂອນແລ້ວ', false))) return;
    const rec = { by: from, rec: S.uid, amt: Number(amt), cur, note: 'ໂອນຄືນ', cat: 'misc', sp: [to], ts: S.be.now(), bill: false, kind: 'pay', nb: 'qr' };
    try {
      const id = S.be.newKey(P('exp'));
      await S.be.set(P(`exp/${id}`), rec);
      sendMsg({ type: 'exp', eid: id, amt: rec.amt, cur, text: 'ໂອນຄືນ', by: from, to, kind: 'pay' });
      FX.burst('confetti'); haptic(40);
      toast('ບັນທຶກການໂອນແລ້ວ ✓');
    } catch { toast('ບັນທຶກບໍ່ສຳເລັດ'); }
  }

  /* ---------- export ---------- */
  const uidsAll = () => {
    const s = new Set(Object.keys(S.members));
    for (const e of list()) { s.add(e.by); (e.sp || []).forEach((u) => s.add(u)); }
    return [...s];
  };
  async function exportCsv() {
    const items = list();
    if (!items.length) return toast('ຍັງບໍ່ມີລາຍຈ່າຍ');
    const csv = M.toCsv(items, uidsAll(), nameOf, nbLabel);
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    const name = `tripmate_${S.code}_expenses_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
    const file = new File([csv], name, { type: 'text/csv' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'ລາຍຈ່າຍ TripMate' }); return; }
    } catch (err) { if (err.name === 'AbortError') return; }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('ດາວໂຫຼດ CSV ແລ້ວ — ເປີດໃນ Excel / Google Sheets ໄດ້');
  }
  const summary = () => M.summaryText(S.info?.name || 'ທຣິບ', list(), nameOf);
  async function copySummary() {
    try { await navigator.clipboard.writeText(summary()); toast('ສຳເນົາສະຫຼຸບແລ້ວ — ເອົາໄປວາງໃນ Line / WhatsApp ໄດ້'); }
    catch { prompt('ສຳເນົາຂໍ້ຄວາມນີ້:', summary()); }
  }
  function openMenu() {
    const items = list();
    const bills = items.filter((e) => e.bill);
    const close = modal({
      title: 'ສົ່ງອອກ / ດຶງຂໍ້ມູນ',
      html: `<div class="x-menu">
        <button data-a="csv">${ic('file')}<div><b>ດາວໂຫຼດ CSV</b><small>ທຸກລາຍການ ເປີດໃນ Excel / Google Sheets · ມີຄໍລຳສ່ວນຂອງແຕ່ລະຄົນ</small></div></button>
        <button data-a="copy">${ic('copy')}<div><b>ສຳເນົາສະຫຼຸບເປັນຂໍ້ຄວາມ</b><small>ຍອດລວມ + ໃຜໂອນໃຫ້ໃຜ ເພື່ອວາງໃນແຊັດອື່ນ</small></div></button>
        <button data-a="chat">${ic('chat')}<div><b>ສົ່ງສະຫຼຸບເຂົ້າແຊັດທຣິບ</b><small>ໝູ່ທຸກຄົນເຫັນຍອດເທົ່າກັນ</small></div></button>
        <button data-a="bills" ${bills.length ? '' : 'disabled'}>${ic('receipt')}<div><b>ເບິ່ງບິນທັງໝົດ (${bills.length})</b><small>ກົດເບິ່ງ ແລະ ບັນທຶກຮູບເທື່ອລະໃບ</small></div></button>
        <button data-a="nobill" ${items.some((e) => !e.bill && e.kind !== 'pay') ? '' : 'disabled'}>${ic('warn')}<div><b>ສະເພາະລາຍການທີ່ບໍ່ມີບິນ</b><small>ກວດວ່າມີເຫດຜົນຄົບທຸກອັນ</small></div></button></div>`,
      actions: [{ label: 'ປິດ' }],
    });
    document.querySelector('.x-menu').onclick = (ev) => {
      const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
      close();
      ({
        csv: exportCsv, copy: copySummary,
        chat: () => { sendMsg({ type: 'text', text: summary() }); toast('ສົ່ງສະຫຼຸບເຂົ້າແຊັດແລ້ວ'); },
        bills: () => openGallery(bills),
        nobill: () => { filterNoBill = true; render(); document.getElementById('exp-list')?.scrollIntoView({ behavior: 'smooth' }); },
      })[b.dataset.a]();
    };
  }
  function openGallery(bills) {
    modal({
      title: `ບິນທັງໝົດ (${bills.length})`,
      html: `<div class="x-gal">${bills.map((e) => `<button data-id="${esc(e.id)}"><img src="${e.th}" alt=""><span>${esc(e.note || '')}</span><small>${M.fmtMoney(e.amt, e.cur)}</small></button>`).join('')}</div>`,
      actions: [{ label: 'ປິດ' }],
    });
    document.querySelector('.x-gal').onclick = (ev) => { const b = ev.target.closest('[data-id]'); if (b) { document.querySelector('.modal-bg')?.remove(); openDetail(b.dataset.id); } };
  }

  /* ---------- wiring ---------- */
  function wire() {
    $('exp-add').onclick = () => openForm(null);
    $('exp-menu').onclick = openMenu;
    $('exp-list').addEventListener('click', (e) => { const r = e.target.closest('.x-row'); if (r) openDetail(r.dataset.id); });
    $('exp-sum').addEventListener('click', (e) => {
      if (e.target.closest('#x-filter')) { filterNoBill = !filterNoBill; render(); return; }
      const p = e.target.closest('[data-pay]');
      if (p) { const [cur, from, to, amt] = p.dataset.pay.split('|'); markPaid(cur, from, to, amt); }
    });
  }
  return { render, wire, openDetail, openForm, summary, openFromChat: () => openForm(null, { stay: true }) };
}
