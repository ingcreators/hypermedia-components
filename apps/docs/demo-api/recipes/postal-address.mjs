// postal-address — recipes/postal-address/contract.md
//
//   GET /address-by-postal?postal=123-4567[&choice=<n>]
//     → 200 single hit: hint status line + OOB outerHTML re-renders of
//       the address inputs (stable demo ids)
//     → 200 multiple hits: candidate buttons re-calling with &choice
//     → 200 not found: hint line, no OOB
//     → 422 malformed postal: hint line (422 allowance swaps it)
//
// Stateless: the postal value (and choice) fully determine the answer;
// the canned table below is the whole "database".

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/postal-address`;
const IDS = {
  pref: 'postal-address-demo-pref',
  city: 'postal-address-demo-city',
  addr1: 'postal-address-demo-addr1',
  result: 'postal-address-demo-result',
};

const BOOK = new Map([
  ['123-4567', [{ pref: 'Tokyo', city: 'Chiyoda-ku', addr1: 'Chiyoda 1-1' }]],
  ['064-0941', [{ pref: 'Hokkaido', city: 'Sapporo, Chuo-ku', addr1: 'Asahigaoka' }]],
  [
    '600-8216',
    [
      { pref: 'Kyoto', city: 'Shimogyo-ku', addr1: 'Higashishiokoji-cho' },
      { pref: 'Kyoto', city: 'Shimogyo-ku', addr1: 'Nishishiokoji-cho' },
    ],
  ],
]);

const AUTOCOMPLETE = {
  pref: 'address-level1',
  city: 'address-level2',
  addr1: 'address-line1',
};

function oobInput(field, value) {
  return `<input class="hc-input" id="${IDS[field]}" name="${field}" value="${escapeHtml(value)}" autocomplete="${AUTOCOMPLETE[field]}" data-hx-swap-oob="outerHTML">`;
}

function filled(postal, hit) {
  return html(
    [
      `<span>Address filled from ${escapeHtml(postal)}.</span>`,
      oobInput('pref', hit.pref),
      oobInput('city', hit.city),
      oobInput('addr1', hit.addr1),
    ].join('\n'),
  );
}

function candidates(postal, hits) {
  const buttons = hits
    .map(
      (hit, i) =>
        `<button type="button" class="hc-button" data-size="sm" data-hx-get="${API}/address-by-postal?postal=${encodeURIComponent(postal)}&amp;choice=${i}" data-hx-target="#${IDS.result}">${escapeHtml(`${hit.pref}, ${hit.city}, ${hit.addr1}`)}</button>`,
    )
    .join('\n');
  return html(
    `<span>${hits.length} addresses share ${escapeHtml(postal)} — pick one:</span>\n${buttons}`,
  );
}

export function handle({ url, method, path }) {
  if (method !== 'GET' || path !== '/address-by-postal') return null;

  const postal = url.searchParams.get('postal') ?? '';
  if (!/^\d{3}-\d{4}$/.test(postal)) {
    return html(`<span>Enter a postal code as 123-4567.</span>`, { status: 422 });
  }

  const hits = BOOK.get(postal);
  if (!hits) {
    return html(
      `<span>No address for ${escapeHtml(postal)} — enter it manually.</span>`,
    );
  }

  const choice = Number.parseInt(url.searchParams.get('choice') ?? '', 10);
  if (hits.length === 1) return filled(postal, hits[0]);
  if (Number.isInteger(choice) && choice >= 0 && choice < hits.length) {
    return filled(postal, hits[choice]);
  }
  return candidates(postal, hits);
}
