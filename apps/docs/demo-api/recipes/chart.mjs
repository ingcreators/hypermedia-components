// chart — recipes/chart/contract.md
//
//   GET /reports/sales?region=emea|apac  (default emea)
//     → 200, a `<figure class="hc-chart" data-hc-chart="bar">` wrapping
//       the semantic data table (6 months of canned numbers per
//       region). The table IS the chart's data source — installChart()
//       redraws it on htmx:load — and also the no-JS fallback: a plain
//       navigation gets the same figure inside a full page, where it
//       renders as a readable table.
//
// Stateless and read-only; the demo's region buttons just refetch with
// a different query string.

import { html, isHtmx, page } from '../html.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const REGIONS = {
  emea: { label: 'EMEA', values: [120, 200, 150, 175, 230, 210] },
  apac: { label: 'APAC', values: [90, 110, 160, 205, 240, 305] },
};

/** The chart figure for one region — the table is the wire format. */
function figureHtml(regionKey) {
  const region = REGIONS[regionKey];
  const title = `Monthly sales — ${region.label}`;
  const rows = MONTHS.map(
    (month, i) => `      <tr><td>${month}</td><td>${region.values[i]}</td></tr>`,
  ).join('\n');
  return `<figure class="hc-chart" data-hc-chart="bar" data-y-label="Sales ($k)" data-title="${title}">
  <table class="hc-table">
    <caption>${title}</caption>
    <thead><tr><th>Month</th><th>Sales</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</figure>`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/reports/sales') {
    const requested = url.searchParams.get('region');
    const regionKey = Object.hasOwn(REGIONS, requested) ? requested : 'emea';
    const figure = figureHtml(regionKey);
    if (isHtmx(request)) return html(figure);

    // No-JS fallback: the same figure inside a full page. Without
    // JavaScript (or without Plot) the table simply renders as a
    // normal, readable data table — that is the whole recipe.
    return page('Sales report demo', figure);
  }
  return null;
}
