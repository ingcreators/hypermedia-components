// live-search — recipes/live-search/contract.md
//
//   GET /items?q=<term>  → 200, HTML for #results (list or empty state)
//
// The response is the inner HTML of the results region. The same URL
// answers plain form GETs (no-JS fallback) with a full page.

import { escapeHtml, html, isHtmx, page } from '../html.mjs';

const ITEMS = [
  'Accordion', 'Avatar', 'Badge', 'Breadcrumb', 'Button', 'Calendar',
  'Card', 'Carousel', 'Checkbox', 'Combobox', 'Command', 'Datagrid',
  'Dialog', 'Drawer', 'Input', 'Menu', 'Pagination', 'Popover',
  'Progress', 'Radio', 'Select', 'Slider', 'Switch', 'Table', 'Tabs',
  'Toast', 'Toolbar', 'Tooltip',
];

function resultsFragment(q) {
  const term = q.trim().toLowerCase();
  const hits = ITEMS.filter((name) => name.toLowerCase().includes(term));
  if (hits.length === 0) {
    return `<p class="hc-field__message">No items match “${escapeHtml(q)}”.</p>`;
  }
  const lis = hits.map((name) => `  <li>${escapeHtml(name)}</li>`).join('\n');
  return `<ul>\n${lis}\n</ul>`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const q = url.searchParams.get('q') ?? '';
    const fragment = resultsFragment(q);
    if (isHtmx(request)) return html(fragment);

    // No-JS fallback: the recipe's <form action method="get"> lands
    // here as a normal navigation — answer with a usable page.
    return page(
      'Live search demo',
      `<form action="" method="get" role="search">
  <input type="search" name="q" value="${escapeHtml(q)}" aria-label="Search items">
  <button type="submit">Search</button>
</form>
${fragment}`,
    );
  }
  return null;
}
