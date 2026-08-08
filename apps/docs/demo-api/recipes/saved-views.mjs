// saved-views — recipes/saved-views/contract.md
//
//   GET    /items?q=…&status=…
//     → 200 htmx: the result list fragment + an OOB outerHTML
//       re-render of the filter form with the controls filled (a view
//       is never opaque)
//     → 200 no-JS: a full page with the same filled form + list
//   POST   /views  (name + q/status via data-hx-include + the strip's
//                   hidden view= inputs)
//     → 200: the strip fragment, the new chip marked current
//     → 422: the strip + a field-errors alert (blank name → required,
//       existing name → duplicate); swaps via the standard allowance
//     → no-JS: the same outcomes as full pages
//   DELETE /views/<name>?view=…&view=…
//     → 200: the strip re-rendered from the threaded view= params,
//       minus <name>
//
// Stateless demo trick (the live-demos doctrine): a real app stores
// views per user; this demo has no storage, so the strip itself
// threads the state. Each chip's apply link carries the view's full
// querystring — the querystring IS the view — the strip region renders
// one hidden `view=` input per chip (the save form's data-hx-include
// picks them up on the next save), and each chip's delete URL repeats
// the OTHER chips as `view=` params. A view= value packs as
// `<name>|<querystring>` and splits on the first `|`.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/saved-views`;
const IDS = {
  filters: 'saved-views-demo-filters',
  q: 'saved-views-demo-q',
  status: 'saved-views-demo-status',
  views: 'saved-views-demo-views',
  results: 'saved-views-demo-results',
};

const STATUSES = [
  ['', 'All'],
  ['active', 'Active'],
  ['pending', 'Pending'],
  ['failed', 'Failed'],
];

const BADGES = {
  active: { variant: 'success', label: 'Active' },
  pending: { variant: 'warning', label: 'Pending' },
  failed: { variant: 'error', label: 'Failed' },
};

const ITEMS = [
  { name: 'Quarterly revenue', status: 'active' },
  { name: 'Churn cohorts', status: 'active' },
  { name: 'Signup funnel', status: 'pending' },
  { name: 'Legacy exports', status: 'failed' },
  { name: 'Beans forecast', status: 'active' },
];

/** One threaded view= value: `<name>|<querystring>`. */
function pack(view) {
  return `${view.name}|${new URLSearchParams({ q: view.q, status: view.status })}`;
}

/** Parse a threaded view= value (null when malformed). */
function unpack(value) {
  const split = value.indexOf('|');
  if (split < 1) return null;
  const pairs = new URLSearchParams(value.slice(split + 1));
  return {
    name: value.slice(0, split),
    q: pairs.get('q') ?? '',
    status: pairs.get('status') ?? '',
  };
}

function viewsFromParams(values) {
  return values.map(unpack).filter(Boolean);
}

function chipHtml(view, others, { current = false } = {}) {
  const applyQs = new URLSearchParams({ q: view.q, status: view.status });
  // escapeHtml doubles as attribute-encoding for the URLs (& → &amp;).
  const applyUrl = escapeHtml(`${API}/items?${applyQs}`);
  const remaining = new URLSearchParams();
  for (const other of others) remaining.append('view', pack(other));
  const deleteQs = remaining.toString();
  const deleteUrl = escapeHtml(
    `${API}/views/${encodeURIComponent(view.name)}${deleteQs ? `?${deleteQs}` : ''}`,
  );
  const currentAttr = current ? ' aria-current="true"' : '';
  return `<li class="hc-chip">
  <a href="${applyUrl}"${currentAttr} data-hx-get="${applyUrl}" data-hx-target="#${IDS.results}">${escapeHtml(view.name)}</a>
  <button class="hc-button" data-size="sm" type="button" aria-label="Delete view ${escapeHtml(view.name)}" data-hx-delete="${deleteUrl}" data-hx-target="#${IDS.views}">×</button>
</li>`;
}

/**
 * The strip region's contents: one hidden view= input per chip (the
 * threaded state) + the chips list, or the empty-state line.
 */
function stripFragment(views, { currentName = null, error = '' } = {}) {
  if (views.length === 0) {
    return `${error}<p class="hc-field__message">No saved views yet — filter, then save the result under a name.</p>`;
  }
  const hidden = views
    .map((view) => `<input type="hidden" name="view" value="${escapeHtml(pack(view))}">`)
    .join('\n');
  const chips = views
    .map((view) =>
      chipHtml(
        view,
        views.filter((other) => other !== view),
        { current: view.name === currentName },
      ),
    )
    .join('\n');
  return `${error}${hidden}
<ul class="hc-chips">
${chips}
</ul>`;
}

function errorAlert(code, detail) {
  return `<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
  <p class="hc-alert__title">The view was not saved.</p>
  <ul class="hc-alert__errors">
    <li class="hc-alert__error" data-field="name" data-code="${code}">name: ${escapeHtml(detail)}</li>
  </ul>
</div>
`;
}

/** The filter form — complete element (outerHTML is the OOB swap). */
function filterFormHtml(q, status, { oob = false } = {}) {
  const options = STATUSES.map(
    ([value, label]) =>
      `<option value="${value}"${value === status ? ' selected' : ''}>${label}</option>`,
  ).join('');
  const oobAttr = oob ? ' data-hx-swap-oob="outerHTML"' : '';
  return `<form id="${IDS.filters}" action="${API}/items" method="get" data-hx-get="${API}/items" data-hx-target="#${IDS.results}"${oobAttr}>
  <div class="hc-field">
    <label class="hc-field__label" for="${IDS.q}">Search</label>
    <input class="hc-input" id="${IDS.q}" name="q" type="search" value="${escapeHtml(q)}">
  </div>
  <div class="hc-field">
    <label class="hc-field__label" for="${IDS.status}">Status</label>
    <select class="hc-select" id="${IDS.status}" name="status">${options}</select>
  </div>
  <button class="hc-button" type="submit">Apply</button>
</form>`;
}

function itemsFragment(q, status) {
  const term = q.trim().toLowerCase();
  const hits = ITEMS.filter(
    (item) =>
      (status === '' || item.status === status) &&
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
  return `<ul class="hc-list">\n${lis}\n</ul>`;
}

export async function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const q = url.searchParams.get('q') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const fragment = itemsFragment(q, status);

    if (isHtmx(request)) {
      // The list for #results, plus the filter form re-rendered
      // out-of-band with the values filled — a view is never opaque.
      return html(`${fragment}
${filterFormHtml(q, status, { oob: true })}`);
    }

    // No-JS fallback: apply links are real hrefs and the filter form
    // is a real GET form — both navigate here.
    return page('Saved views demo', `${filterFormHtml(q, status)}\n${fragment}`);
  }

  if (method === 'POST' && path === '/views') {
    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const q = String(data.get('q') ?? '');
    const status = String(data.get('status') ?? '');
    const views = viewsFromParams(data.getAll('view').map(String));

    let error = null;
    if (!name) error = errorAlert('required', 'name the view first');
    else if (views.some((view) => view.name === name)) {
      error = errorAlert('duplicate', 'a view with this name already exists');
    }

    if (error) {
      const fragment = stripFragment(views, { error });
      if (isHtmx(request)) return html(fragment, { status: 422 });
      return page('View not saved', fragment, { status: 422 });
    }

    const saved = [...views, { name, q, status }];
    const fragment = stripFragment(saved, { currentName: name });
    if (isHtmx(request)) return html(fragment);
    // No-JS: a real app would 303 back to the list; the stateless demo
    // answers a readable page with the updated strip.
    return page('View saved', fragment);
  }

  const deleteMatch = method === 'DELETE' && path.match(/^\/views\/([^/]+)$/);
  if (deleteMatch) {
    const name = decodeURIComponent(deleteMatch[1]);
    const remaining = viewsFromParams(url.searchParams.getAll('view')).filter(
      (view) => view.name !== name,
    );
    return html(stripFragment(remaining));
  }

  return null;
}
