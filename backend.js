// Tiny path-based data layer with two implementations:
//  - firebase: Firebase Realtime Database + anonymous auth (real multi-device use)
//  - demo:     localStorage + BroadcastChannel (works across tabs of one browser; for trying the app without setup)
// Both expose the same API so app.js never cares which one is active.

const FB = 'https://www.gstatic.com/firebasejs/13.0.0';

export async function createBackend(config, { slot = '' } = {}) {
  return config && config.apiKey && config.databaseURL ? firebaseBackend(config, slot) : demoBackend(slot);
}

/* ---------------- Firebase ---------------- */
async function firebaseBackend(cfg, slot) {
  const [{ initializeApp }, A, D] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-database.js`),
  ]);
  const app = initializeApp(cfg);
  // Test identities (?as=b) must be separate Firebase users, so keep their login in memory only.
  const auth = slot ? A.initializeAuth(app, { persistence: A.inMemoryPersistence }) : A.getAuth(app);
  const user = await new Promise((resolve, reject) => {
    const off = A.onAuthStateChanged(auth, (u) => {
      if (u) { off(); resolve(u); }
      else A.signInAnonymously(auth).catch((e) => { off(); reject(e); });
    }, reject);
  });
  const db = D.getDatabase(app);
  const r = (p) => D.ref(db, p);
  let offset = 0;
  D.onValue(r('.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });

  return {
    mode: 'firebase',
    uid: user.uid,
    idToken: () => user.getIdToken(),
    now: () => Date.now() + offset,
    newKey: (p) => D.push(r(p)).key,
    set: (p, v) => D.set(r(p), v),
    update: (p, v) => D.update(r(p), v),
    remove: (p) => D.remove(r(p)),
    get: async (p) => (await D.get(r(p))).val(),
    onValue(p, cb, onErr) {
      return D.onValue(r(p), (s) => cb(s.val()), (e) => onErr && onErr(e));
    },
    onChildAdded(p, limit, cb, onErr) {
      return D.onChildAdded(D.query(r(p), D.limitToLast(limit)), (s) => cb(s.key, s.val()), (e) => onErr && onErr(e));
    },
    onConnected(cb) {
      return D.onValue(r('.info/connected'), (s) => cb(!!s.val()));
    },
    // Writes `on` now and `off` automatically when the connection drops.
    presence(p, on, off) {
      const od = D.onDisconnect(r(p));
      od.set({ ...off, ts: D.serverTimestamp() });
      return D.set(r(p), on).then(() => () => od.cancel());
    },
  };
}

/* ---------------- Demo (local) ---------------- */
function demoBackend(slot) {
  const KEY = 'tm_demo_db';
  const bc = 'BroadcastChannel' in self ? new BroadcastChannel('tm_demo') : null;
  const uidKey = `tm${slot}_demo_uid`;
  let uid = localStorage.getItem(uidKey);
  if (!uid) { uid = 'demo-' + Math.random().toString(36).slice(2, 10); localStorage.setItem(uidKey, uid); }

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const parts = (p) => p.split('/').filter(Boolean);
  const at = (tree, p) => parts(p).reduce((n, k) => (n == null ? null : n[k] ?? null), tree);
  const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  const related = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');

  function write(p, v) {
    const tree = load();
    const ks = parts(p);
    let n = tree;
    for (let i = 0; i < ks.length - 1; i++) n = n[ks[i]] = n[ks[i]] && typeof n[ks[i]] === 'object' ? n[ks[i]] : {};
    if (v == null) delete n[ks[ks.length - 1]];
    else n[ks[ks.length - 1]] = clone(v);
    try { localStorage.setItem(KEY, JSON.stringify(tree)); }
    catch (e) { return Promise.reject(new Error('ພື້ນທີ່ເກັບຂໍ້ມູນໃນເຄື່ອງເຕັມ (ໂໝດທົດລອງ)')); }
    changed(p);
    bc && bc.postMessage(p);
    return Promise.resolve();
  }

  const subs = new Set();
  function changed(p) {
    const tree = load();
    for (const s of subs) if (related(s.path, p)) s.fire(tree);
  }
  bc && (bc.onmessage = (e) => changed(e.data));

  let seq = 0;
  const newKey = () => Date.now().toString(36).padStart(9, '0') + (seq++ % 1296).toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);

  function sub(s) { subs.add(s); s.fire(load()); return () => subs.delete(s); }

  return {
    mode: 'demo',
    uid,
    now: () => Date.now(),
    newKey: () => newKey(),
    set: (p, v) => write(p, v),
    update: (p, obj) => Promise.all(Object.entries(obj).map(([k, v]) => write(`${p}/${k}`, v))).then(() => {}),
    remove: (p) => write(p, null),
    get: async (p) => clone(at(load(), p)),
    onValue(p, cb) {
      return sub({ path: p, fire: (t) => cb(clone(at(t, p))) });
    },
    onChildAdded(p, limit, cb) {
      const known = new Set();
      return sub({
        path: p,
        fire(t) {
          const node = at(t, p) || {};
          for (const k of Object.keys(node).sort().slice(-limit)) {
            if (!known.has(k)) { known.add(k); cb(k, clone(node[k])); }
          }
        },
      });
    },
    onConnected(cb) {
      const f = () => cb(navigator.onLine !== false);
      f(); addEventListener('online', f); addEventListener('offline', f);
      return () => { removeEventListener('online', f); removeEventListener('offline', f); };
    },
    presence(p, on, off) {
      const bye = () => write(p, { ...off, ts: Date.now() });
      addEventListener('pagehide', bye);
      return write(p, on).then(() => () => removeEventListener('pagehide', bye));
    },
  };
}
