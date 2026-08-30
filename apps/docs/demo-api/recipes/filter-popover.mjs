// filter-popover — recipes/filter-popover/contract.md
//
//   GET /items?status=<all|active|pending|failed>&q=<term>
//     → htmx: 200, HTML for the results region (a list or empty state)
//     → no-JS: 200, a full page with the same list (the popover form
//       degrades to a normal GET navigation)
//
// Any 2xx makes `installClosePopover` dismiss the popover on the
// client — the server just answers the filter query. Stateless.

import { escapeHtml, html, isHtmx, page } from '../html.mjs';

const BADGES = {
  active: { variant: 'success', label: 'Active' },
  pending: { variant: 'warning', label: 'Pending' },
  failed: { variant: 'error', label: 'Failed' },
};

const ITEMS = [
  { name: 'Ingest pipeline', status: 'active' },
  { name: 'Nightly backup', status: 'active' },
  { name: 'Search indexer', status: 'active' },
  { name: 'Billing export', status: 'pending' },
  { name: 'Webhook redelivery', status: 'pending' },
  { name: 'Image resizer', status: 'active' },
  { name: 'Legacy sync', status: 'failed' },
  { name: 'Report mailer', status: 'failed' },
];

function itemsFragment(status, q) {
  const term = q.trim().toLowerCase();
  const hits = ITEMS.filter(
    (item) =>
      (status === 'all' || item.status === status) &&
      item.name.toLowerCase().includes(term),
  );
  if (hits.length === 0) {
    return '<p class="hc-field__message">No items match the current filters.</p>';
  }
  const lis = hits
    .map(({ name, status: s }) => {
      const badge = BADGES[s];
      return `  <li>${escapeHtml(name)} <span class="hc-badge" data-variant="${badge.variant}">${badge.label}</span></li>`;
    })
    .join('\n');
  return `<ul>\n${lis}\n</ul>`;
}

export function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const status = url.searchParams.get('status') || 'all';
    const q = url.searchParams.get('q') ?? '';
    const fragment = itemsFragment(status, q);
    if (isHtmx(request)) return html(fragment);

    // No-JS fallback: the popover form is a real GET form — a plain
    // submit navigates here, so answer with a usable page.
    return page(
      'Filter popover demo',
      `<form action="" method="get">
  <label>Status
    <select name="status">
      <option value="all"${status === 'all' ? ' selected' : ''}>All</option>
      <option value="active"${status === 'active' ? ' selected' : ''}>Active</option>
      <option value="pending"${status === 'pending' ? ' selected' : ''}>Pending</option>
      <option value="failed"${status === 'failed' ? ' selected' : ''}>Failed</option>
    </select>
  </label>
  <label>Name <input type="text" name="q" value="${escapeHtml(q)}"></label>
  <button type="submit">Apply</button>
</form>
${fragment}`,
    );
  }
  return null;
}
