// cascading-select — recipes/cascading-select/contract.md
//
//   GET /areas/cities?prefecture=<id> → 200, the city <select> re-rendered
//                                       (+ OOB reset of the ward level)
//   GET /areas/wards?city=<id>        → 200, the ward <select> re-rendered
//                                       (deepest level — no OOB)
//
// Always 200: an empty or unknown parent value is not an error — the
// response is the disabled placeholder child (plus OOB resets), which
// unwinds the chain.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/cascading-select`;
const CITY_ID = 'cascading-select-demo-city';
const WARD_ID = 'cascading-select-demo-ward';

// Canned data: prefecture id → cities, city id → wards (districts).
const CITIES = new Map([
  ['13', [['13101', 'Chiyoda'], ['13102', 'Chuo'], ['13103', 'Minato']]],
  ['27', [['27102', 'Kita'], ['27103', 'Fukushima'], ['27104', 'Konohana']]],
]);
const WARD_NAMES = ['North', 'Central', 'South'];
const CITY_IDS = new Set([...CITIES.values()].flat().map(([id]) => id));

function options(entries) {
  return ['  <option value="">Select…</option>']
    .concat(entries.map(([id, name]) => `  <option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`))
    .join('\n');
}

/** The ward level's disabled placeholder, optionally as an OOB swap. */
function wardReset({ oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="true"' : '';
  return `<select class="hc-select" id="${WARD_ID}" name="ward" disabled${oobAttr}>
  <option value="">Select a city first</option>
</select>`;
}

export function handle({ url, method, path }) {
  if (method !== 'GET') return null;

  if (path === '/areas/cities') {
    const prefecture = url.searchParams.get('prefecture') ?? '';
    let city;
    if (CITIES.has(prefecture)) {
      // Enabled + populated, wired to load ITS child (the ward level).
      city = `<select class="hc-select" id="${CITY_ID}" name="city"
        data-hx-get="${API}/areas/wards" data-hx-include="this"
        data-hx-target="#${WARD_ID}" data-hx-swap="outerHTML">
${options(CITIES.get(prefecture))}
</select>`;
    } else {
      // Empty / unknown parent: unwind to the disabled placeholder.
      city = `<select class="hc-select" id="${CITY_ID}" name="city" disabled>
  <option value="">Select a prefecture first</option>
</select>`;
    }
    // One response keeps the whole chain coherent: reset every deeper
    // level out of band.
    return html(`${city}\n${wardReset({ oob: true })}`);
  }

  if (path === '/areas/wards') {
    const city = url.searchParams.get('city') ?? '';
    if (!CITY_IDS.has(city)) return html(wardReset());
    const wards = WARD_NAMES.map((name, i) => [`${city}-${i + 1}`, name]);
    return html(`<select class="hc-select" id="${WARD_ID}" name="ward">
${options(wards)}
</select>`);
  }

  return null;
}
