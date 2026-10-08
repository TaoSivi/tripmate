// Paper-cut icon set. Every icon is solid shapes on a 24-grid: a shadow copy offset down-right (the "paper thickness"),
// the main sheet, optional gold accent, and cut-outs painted in the surface colour.
// Usage: ic('map') → SVG string · hydrate(root) swaps <i data-ic="map"></i> placeholders.

const D = {
  // navigation
  map: { f: '<path d="M3 6.2 9 4l6 2.2 6-2.2v13.8L15 20l-6-2.2L3 20z"/>', c: '<path class="st" d="M9 4.5v13M15 6.5v13"/>' },
  chat: { f: '<path d="M4 6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v8a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5v-3.5h-.5A2.5 2.5 0 0 1 4 14z"/>', c: '<circle cx="8.8" cy="10" r="1.2"/><circle cx="12" cy="10" r="1.2"/><circle cx="15.2" cy="10" r="1.2"/>' },
  wallet: { f: '<path d="M3 8a3 3 0 0 1 3-3h11v3h2a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/>', c: '<path class="st" d="M3.6 9.2h15"/>', a: '<circle cx="16.6" cy="14.2" r="1.9"/>' },
  people: { f: '<circle cx="9" cy="8" r="3.3"/><path d="M2.8 20c0-3.6 2.8-6 6.2-6s6.2 2.4 6.2 6z"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.3c3 .1 5.2 1.8 5.2 4.9h-4.3c0-1.9-.4-3.4-.9-4.9z"/>' },
  // actions
  send: { f: '<path d="M3 11.2 21 3.5l-4.6 17-4.3-6.2z"/>', c: '<path class="st" d="M12.2 14.4 21 3.6"/>' },
  camera: { f: '<path d="M4 7.5h3l1.4-2.3h7.2L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5z"/>', c: '<circle cx="12" cy="13.3" r="4"/>', a: '<circle cx="12" cy="13.3" r="2"/>' },
  photo: { f: '<path d="M3.5 5h17A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-11A1.5 1.5 0 0 1 3.5 5z"/>', c: '<path d="M4 17.4l5-6 3.5 4 2.5-3 4.8 5z"/>', a: '<circle cx="16.6" cy="9.4" r="1.8"/>' },
  pin: { f: '<path d="M12 22.2s-7.2-6.6-7.2-12.2a7.2 7.2 0 0 1 14.4 0c0 5.6-7.2 12.2-7.2 12.2z"/>', c: '<circle cx="12" cy="10" r="2.8"/>' },
  flag: { f: '<path d="M5 3h2v18H5z"/><path d="M7 4.5h12.5l-2.6 4 2.6 4H7z"/>', a: '<circle cx="11" cy="8.5" r="1.5"/>' },
  layers: { f: '<path d="M12 3.5 22 9l-10 5.5L2 9z"/><path d="M2 12.2l10 5.5 10-5.5v2.4l-10 5.5-10-5.5z"/>' },
  locate: { f: '<path d="M21 3 3 10.6l7.4 2.4 2.4 7.4z"/>', c: '<path class="st" d="M10.6 13 20 4"/>' },
  fit: { f: '<path d="M3 3h6v2.2H5.2V9H3zM15 3h6v6h-2.2V5.2H15zM21 15v6h-6v-2.2h3.8V15zM9 21H3v-6h2.2v3.8H9z"/>', a: '<circle cx="12" cy="12" r="2.6"/>' },
  sos: { f: '<circle cx="12" cy="12" r="9.5"/>', c: '<path d="M10.9 6.4h2.2v7.2h-2.2z"/><circle cx="12" cy="16.7" r="1.3"/>' },
  mega: { f: '<path d="M3 10h4l8-5v14l-8-5H3z"/><path d="M6 15h3l1 5H7z"/>', c: '<path class="st" d="M7.2 10.5v4"/>', a: '<path d="M17.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2z"/>' },
  battery: { f: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h11A2.5 2.5 0 0 1 19 8.5V9h1.2a.8.8 0 0 1 .8.8v4.4a.8.8 0 0 1-.8.8H19v.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 3 15.5z"/>', c: '<rect x="5" y="9" width="3" height="6" rx=".8"/><rect x="9.4" y="9" width="3" height="6" rx=".8"/>' },
  more: { f: '<circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/>' },
  close: { f: '<path d="M5.2 3.8 12 10.6l6.8-6.8 1.4 1.4-6.8 6.8 6.8 6.8-1.4 1.4-6.8-6.8-6.8 6.8-1.4-1.4 6.8-6.8-6.8-6.8z"/>' },
  plus: { f: '<path d="M10.8 4h2.4v6.8H20v2.4h-6.8V20h-2.4v-6.8H4v-2.4h6.8z"/>' },
  check: { f: '<path d="M4.5 12.6 9.6 17.6 19.8 6.6l-1.6-1.5L9.6 14.4 6 11z"/>' },
  warn: { f: '<path d="M12 3 22 20.5H2z"/>', c: '<path d="M11 9.5h2v6h-2z"/><circle cx="12" cy="17.9" r="1.15"/>' },
  share: { f: '<circle cx="18" cy="5.5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="18.5" r="3"/><path class="sf" d="M8.4 10.7l7.2-4M8.4 13.3l7.2 4"/>' },
  copy: { f: '<path d="M4.5 7.5H6v11h9V20H6a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8.5 3.5h9A1.5 1.5 0 0 1 19 5v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 15V5a1.5 1.5 0 0 1 1.5-1.5z"/>' },
  download: { f: '<path d="M10.8 3h2.4v8h3.3L12 16 7.5 11h3.3z"/><path d="M4 18.5h16V21H4z"/>' },
  file: { f: '<path d="M6 2.8h8l5 5V21a.7.7 0 0 1-.7.7H6A.7.7 0 0 1 5.3 21V3.5A.7.7 0 0 1 6 2.8z"/>', c: '<path class="st" d="M8.5 12h7M8.5 15.5h7M8.5 19h4"/>', a: '<path d="M14 2.8v5h5z"/>' },
  receipt: { f: '<path d="M5 2.8h14v18.4l-2.3-1.6-2.4 1.6-2.3-1.6-2.4 1.6-2.3-1.6L5 21.2z"/>', c: '<path class="st" d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>' },
  trash: { f: '<path d="M5 7h14l-1 13a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 20zM9 3.5h6L16 5.5H8z"/>', c: '<path class="st" d="M10 10.5v7M14 10.5v7"/>' },
  pencil: { f: '<path d="M4 20v-4l11-11 4 4L8 20z"/><path d="M16.5 3.5l4 4 1.3-1.3a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0z"/>' },
  sticker: { f: '<circle cx="12" cy="12" r="9.5"/>', c: '<circle cx="9" cy="10.4" r="1.3"/><circle cx="15" cy="10.4" r="1.3"/><path class="st" d="M8.3 14.3q3.7 3.6 7.4 0"/>' },
  bulb: { f: '<path d="M12 2.8a6.2 6.2 0 0 0-3.6 11.2v2.2h7.2V14A6.2 6.2 0 0 0 12 2.8z"/><path d="M9 17.6h6v1.6a1.8 1.8 0 0 1-1.8 1.8h-2.4A1.8 1.8 0 0 1 9 19.2z"/>', c: '<path class="st" d="M10.4 14 12 10.8l1.6 3.2"/>' },
  pause: { f: '<path d="M6 4h4.2v16H6zM13.8 4H18v16h-4.2z"/>' },
  sound: { f: '<path d="M3 9.5h3.6L12 5v14l-5.4-4.5H3z"/><path class="sf" d="M15.2 9.2a4 4 0 0 1 0 5.6M18 6.6a8 8 0 0 1 0 10.8"/>' },
  bell: { f: '<path d="M12 3a6 6 0 0 0-6 6v4l-2 3.5h16L18 13V9a6 6 0 0 0-6-6z"/><path d="M9.8 18.5h4.4a2.2 2.2 0 0 1-4.4 0z"/>' },
  moon: { f: '<path d="M20 14.6A8.5 8.5 0 0 1 9.4 4 8.5 8.5 0 1 0 20 14.6z"/>', a: '<path d="M17 4l.7 1.8 1.8.7-1.8.7L17 9l-.7-1.8-1.8-.7 1.8-.7z"/>' },
  sparkle: { f: '<path d="M12 2.5 14 9.5l7 2.5-7 2.5-2 7-2-7-7-2.5 7-2.5z"/>' },
  star: { f: '<path d="M12 2.8l2.8 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.5l-5.7 3 1.1-6.4L2.8 9.6l6.4-.9z"/>' },
  wifi: { f: '<path d="M2 9.2a14.5 14.5 0 0 1 20 0l-1.8 1.9a11.8 11.8 0 0 0-16.4 0z"/><path d="M5.8 13a9 9 0 0 1 12.4 0l-1.8 1.9a6.3 6.3 0 0 0-8.8 0z"/><circle cx="12" cy="18.2" r="2"/>' },
  user: { f: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.4-7 8-7s8 2.6 8 7z"/>' },
  coin: { f: '<circle cx="12" cy="12" r="9.5"/>', c: '<path class="st" d="M9.2 9.4c.6-1 1.6-1.4 2.8-1.4 1.7 0 2.8.8 2.8 2 0 2.8-5.6 1.4-5.6 4.2 0 1.2 1.2 2 2.8 2 1.2 0 2.2-.4 2.8-1.4M12 6.2v1.8M12 16v1.8"/>', a: '<circle cx="12" cy="12" r="9.5"/>' },
  // expense categories
  food: { f: '<path d="M2.5 11.5h19A9.5 9.5 0 0 1 12 21a9.5 9.5 0 0 1-9.5-9.5z"/><path d="M15.2 2.4l1.1.5-4.2 8.4-1.1-.5zM18.2 3.6l1.1.4-3.4 7.3-1.1-.4z"/>', a: '<path d="M7 5.5q-1.4 1.4 0 2.8M10.5 4.2q-1.4 1.4 0 2.8" class="sf"/>' },
  drink: { f: '<path d="M4.5 6h12v8a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M16.5 8h1.8a2.8 2.8 0 0 1 0 5.6h-1.8v-1.7h1.8a1.1 1.1 0 0 0 0-2.2h-1.8z"/>', a: '<path d="M8 1.8q1.2 1.5 0 3M12 1.8q1.2 1.5 0 3" class="sf"/>' },
  car: { f: '<path d="M2.5 15.5l1.7-5.2A2.5 2.5 0 0 1 6.6 8.5h10.8a2.5 2.5 0 0 1 2.4 1.8l1.7 5.2v3.2h-2.4v-1.6H4.9v1.6H2.5z"/>', c: '<path d="M6.2 10.3h11.6l1.2 3.7H5z"/>', a: '<circle cx="7.4" cy="17.4" r="1.7"/><circle cx="16.6" cy="17.4" r="1.7"/>' },
  stay: { f: '<path d="M2.5 11.2 12 3l9.5 8.2V21h-19z"/>', c: '<path d="M10 14h4v7h-4z"/>', a: '<circle cx="12" cy="9.6" r="1.5"/>' },
  ticket: { f: '<path d="M2.5 6.5h19v4a1.8 1.8 0 0 0 0 3.6v4h-19v-4a1.8 1.8 0 0 0 0-3.6z"/>', c: '<path class="st" d="M14.5 7.8v1.6M14.5 11.2v1.6M14.5 14.6v1.6"/>' },
  bag: { f: '<path d="M4.5 8h15l1 13h-17z"/><path class="sf" d="M8.6 8V6.6a3.4 3.4 0 0 1 6.8 0V8"/>', a: '<circle cx="12" cy="13.4" r="1.6"/>' },
  lotus: { f: '<path d="M12 20.5c-2-1-6-3-6.5-8 3 0 5.5 1.2 6.5 3.5 1-2.3 3.5-3.5 6.5-3.5-.5 5-4.5 7-6.5 8z"/>', a: '<path d="M12 3.5c2 2.6 3 5.6 0 11.6-3-6-2-9 0-11.6z"/>' },
  no: { f: '<circle cx="12" cy="12" r="9.5"/>', c: '<path class="st" d="M6.2 6.2l11.6 11.6"/>' },
  qr: { f: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM18 14h3v2h-3z"/>', c: '<rect x="5" y="5" width="3" height="3"/><rect x="16" y="5" width="3" height="3"/><rect x="5" y="16" width="3" height="3"/>' },
  hand: { f: '<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10h.5V4a1.5 1.5 0 0 1 3 0v6h.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7S5 18 5 14.5l-1.3-3a1.4 1.4 0 0 1 2.4-1.2z"/>' },
  question: { f: '<circle cx="12" cy="12" r="9.5"/>', c: '<path class="st" d="M9.2 9.5a2.8 2.8 0 1 1 4.2 2.4c-.9.5-1.4 1-1.4 2"/><circle cx="12" cy="16.9" r="1.1"/>' },
};
export const NAMES = Object.keys(D);
const CAT_ICON = { food: 'food', drink: 'drink', ride: 'car', stay: 'stay', ticket: 'ticket', shop: 'bag', misc: 'lotus' };
export const catIcon = (k) => CAT_ICON[k] || 'lotus';
const NB_ICON = { market: 'bag', cash: 'coin', qr: 'qr', tip: 'hand', lost: 'question', other: 'pencil' };
export const nbIcon = (k) => NB_ICON[k] || 'question';

export function ic(name, cls = '') {
  const d = D[name];
  if (!d) return '';
  return `<svg class="pi ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g class="pi-s" transform="translate(.7 .9)">${d.f}</g><g class="pi-f">${d.f}</g>${d.a ? `<g class="pi-a">${d.a}</g>` : ''}${d.c ? `<g class="pi-c">${d.c}</g>` : ''}</svg>`;
}

/** Swap <i data-ic="name"></i> placeholders inside root for SVG icons. */
export function hydrate(root = document) {
  root.querySelectorAll('i[data-ic]').forEach((el) => {
    const s = ic(el.dataset.ic, el.dataset.cls || '');
    if (s) el.outerHTML = s;
  });
}
