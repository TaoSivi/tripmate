// Web push (client side): subscribe this device, store the subscription in the trip, and ask the relay Worker
// to push to the other members when something happens. See push-worker/worker.js for why it works this way.

import { PUSH_CONFIG } from './config.js';

const b64uToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const bytesToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function createPush({ S, P, store, isIOS, standalone }) {
  const cfg = PUSH_CONFIG || {};
  const configured = () => !!(cfg.url && cfg.vapid) && S.be?.mode === 'firebase';
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  /** 'off' | 'on' | 'denied' | 'ios-install' | 'unsupported' | 'unconfigured' */
  function state() {
    if (!configured()) return 'unconfigured';
    if (!supported()) return isIOS && !standalone ? 'ios-install' : 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return store.get('push') && Notification.permission === 'granted' ? 'on' : 'off';
  }

  async function registration() {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg;
    return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('no service worker')), 4000))]);
  }

  async function devKey(endpoint) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
    return bytesToB64u(h).slice(0, 16);
  }

  async function subscription(create) {
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(cfg.vapid) });
    return sub;
  }

  /** Write this device's subscription into the current trip so the relay can find it. */
  async function register() {
    if (!S.code || state() !== 'on') return;
    try {
      const sub = await subscription(true);
      if (!sub) return;
      const j = sub.toJSON();
      await S.be.set(P(`push/${S.uid}/${await devKey(sub.endpoint)}`), { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth }, ts: S.be.now() });
    } catch { /* offline or blocked: next trip entry retries */ }
  }

  /** Turn on: ask permission, subscribe, register. Returns the new state. */
  async function enable() {
    if (!supported() || !configured()) return state();
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return state();
    store.set('push', true);
    await register();
    return state();
  }

  async function disable() {
    store.set('push', false);
    try {
      const sub = await subscription(false);
      if (sub) {
        if (S.code) await S.be.remove(P(`push/${S.uid}/${await devKey(sub.endpoint)}`)).catch(() => {});
        await sub.unsubscribe();
      }
    } catch { /* nothing to undo */ }
    return state();
  }

  /** Called when entering a trip: keep this device's subscription fresh. */
  const ensure = () => register();

  /** Leaving/deleting a trip: stop being pushed for it. */
  async function forget(code, uid) {
    try { await S.be.remove(`trips/${code}/push/${uid}`); } catch { /* may already be gone */ }
  }

  /** Ask the relay to push to the other members. ev: {title, body, to?, urgent?, tag?} */
  async function notify(ev) {
    if (!configured() || !S.code || !S.be.idToken) return;
    try {
      const token = await S.be.idToken();
      const res = await fetch(cfg.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ code: S.code, token, from: S.uid, ...ev }),
      });
      if (!res.ok) return;
      const out = await res.json();
      for (const d of out.dead || []) S.be.remove(P(`push/${d.uid}/${d.dev}`)).catch(() => {});   // expired subscriptions
    } catch { /* push is best-effort; the message itself is already saved */ }
  }

  return { state, enable, disable, ensure, forget, notify, configured };
}
