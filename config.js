// Firebase web config for the "tripmate-2001c" project.
// These values are public by design (every Firebase web app ships them to the browser).
// What protects the data is database.rules.json: only trip members can read/write a trip.
// To go back to local demo mode, set FIREBASE_CONFIG = null.

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAqXQt8AP3FdJlyfy2y8C7FCUnAm-dxDJM",
  authDomain: "tripmate-2001c.firebaseapp.com",
  databaseURL: "https://tripmate-2001c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tripmate-2001c",
  storageBucket: "tripmate-2001c.firebasestorage.app",
  messagingSenderId: "25125371778",
  appId: "1:25125371778:web:d155192ce05e3807af599b",
};

// Push relay (Cloudflare Worker, see push-worker/). url stays null until the Worker is deployed; the public VAPID key is not secret.
export const PUSH_CONFIG = {
  url: "https://tripmate-push.tao123456789034.workers.dev/push",
  vapid: "BHs_II_B0aN-e1koCV6p9rT1oUe2rRWTqCb0bwYci0L3r6ptNltg8OlsZ-1yLS2mrbsi7GS-vuaN_beLM_FgmiA",
};
