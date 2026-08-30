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

/** One threaded view= value: `<name>|<querystring>`.
 *
 * Scope and default ride in the packed querystring, not in the apply
 * link: they are facts ABOUT the view, not part of the question it
 * asks. A shared view and a personal one with the same conditions are
 * the same query and a different object. */
function pack(view) {
  const packed = new URLSearchParams({ q: view.q, status: view.status });
  if (view.scope === 'shared') packed.set('scope', 'shared');
  if (view.isDefault) packed.set('default', '1');
  return `${view.name}|${packed}`;
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
    scope: pairs.get('scope') === 'shared' ? 'shared' : 'personal',
    isDefault: pairs.get('default') === '1',
  };
}

function viewsFromParams(values) {
  return values.map(unpack).filter(Boolean);
}

/**
 * Normalized comparison key for a set of conditions. Two identical
 * questions must compare equal even when one was assembled by the form
 * and the other by an apply link, so the params are sorted.
 */
function conditionKey({ q, status }) {
  const params = new URLSearchParams({ q: q ?? '', status: status ?? '' });
  params.sort();
  return params.toString();
}

function chipHtml(view, others, { current = false, modified = false } = {}) {
  const applyQs = new URLSearchParams({
    q: view.q,
    status: view.status,
    // The apply link names the view it came from, which is what lets
    // the server tell "this IS the view" from "this started as it".
    'from-view': view.name,
  });
  // escapeHtml doubles as attribute-encoding for the URLs (& → &amp;).
  const applyUrl = escapeHtml(`${API}/items?${applyQs}`);
  const resetUrl = applyUrl;
  const remaining = new URLSearchParams();
  for (const other of others) remaining.append('view', pack(other));
  const deleteQs = remaining.toString();
  const deleteUrl = escapeHtml(
    `${API}/views/${encodeURIComponent(view.name)}${deleteQs ? `?${deleteQs}` : ''}`,
  );
  const currentAttr = current ? ' aria-current="true"' : '';
  const putUrl = escapeHtml(`${API}/views/${encodeURIComponent(view.name)}`);
  // Applied but no longer equal to what was stored: say so, and offer
  // all three ways out. Silence here is what makes a user either lose
  // the tweak or trust a view that is not what they are looking at.
  const modifiedControls = modified
    ? `
  <span class="hc-badge" data-variant="warning">Modified</span>
  <button class="hc-button" data-size="sm" type="button" data-hx-put="${putUrl}" data-hx-include="#${IDS.filters}, #${IDS.views}" data-hx-target="#${IDS.views}" aria-label="Update view ${escapeHtml(view.name)}">Update</button>
  <a class="hc-button" data-size="sm" href="${resetUrl}" data-hx-get="${resetUrl}" data-hx-target="#${IDS.results}" aria-label="Reset view ${escapeHtml(view.name)}">Reset</a>`
    : '';
  // A shared view is LABELLED, because editing somebody else's team
  // standard must be a visible act rather than something that happens
  // because a colleague pressed Update.
  const scopeLabel =
    view.scope === 'shared'
      ? ' <span class="hc-badge" data-variant="info">Shared</span>'
      : '';
  // The default redirects the bare list URL (303), so it is never a
  // hidden filter — the address bar shows the real conditions.
  const defaultLabel = view.isDefault
    ? ' <span class="hc-badge">Default</span>'
    : '';
  // A view IS a URL, so sharing one costs nothing and needs no shared
  // object at all. Reserve shared views for standards that outlive a
  // conversation.
  const copy = `<button class="hc-button" data-size="sm" type="button" data-hc-copy-text="${applyUrl}" aria-label="Copy link to ${escapeHtml(view.name)}">Copy link</button>`;
  return `<li class="hc-chip"${modified ? ' data-modified' : ''}${view.scope === 'shared' ? ' data-scope="shared"' : ''}${view.isDefault ? ' data-default' : ''}>
  <a href="${applyUrl}"${currentAttr} data-hx-get="${applyUrl}" data-hx-target="#${IDS.results}">${escapeHtml(view.name)}</a>${scopeLabel}${defaultLabel}${modifiedControls}
  ${copy}
  <button class="hc-button" data-size="sm" type="button" aria-label="Delete view ${escapeHtml(view.name)}" data-hx-delete="${deleteUrl}" data-hx-target="#${IDS.views}">×</button>
</li>`;
}

/**
 * The strip region's contents: one hidden view= input per chip (the
 * threaded state) + the chips list, or the empty-state line.
 */
function stripFragment(
  views,
  { currentName = null, error = '', modifiedName = null, oob = false } = {},
) {
  if (views.length === 0) {
    const empty = `${error}<p class="hc-field__message">No saved views yet — filter, then save the result under a name.</p>`;
    return oob
      ? `<div id="${IDS.views}" data-hx-swap-oob="innerHTML">${empty}</div>`
      : empty;
  }
  const hidden = views
    .map((view) => `<input type="hidden" name="view" value="${escapeHtml(pack(view))}">`)
    .join('\n');
  const chips = views
    .map((view) =>
      chipHtml(
        view,
        views.filter((other) => other !== view),
        {
          current: view.name === currentName,
          modified: view.name === modifiedName,
        },
      ),
    )
    .join('\n');
  const body = `${error}${hidden}
<ul class="hc-chips">
${chips}
</ul>`;
  // The strip re-renders out of band when an /items response carries it
  // (applying a view is the moment the modified state changes).
  return oob
    ? `<div id="${IDS.views}" data-hx-swap-oob="innerHTML">${body}</div>`
    : body;
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
  return `<ul>\n${lis}\n</ul>`;
}

export async function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items') {
    const q = url.searchParams.get('q') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const fromView = url.searchParams.get('from-view');
    const views = viewsFromParams(url.searchParams.getAll('view').map(String));
    const fragment = itemsFragment(q, status);

    // Applied but no longer equal to what was stored → modified. The
    // comparison is on NORMALIZED keys, so the same question compares
    // equal whether it arrived from the form or from an apply link.
    const applied = views.find((view) => view.name === fromView) ?? null;
    const modifiedName =
      applied && conditionKey(applied) !== conditionKey({ q, status })
        ? applied.name
        : null;

    if (isHtmx(request)) {
      // The list for #results, plus the filter form re-rendered
      // out-of-band with the values filled — a view is never opaque —
      // plus the strip when it has something to say about the view.
      const strip = views.length
        ? `\n${stripFragment(views, { currentName: fromView, modifiedName, oob: true })}`
        : '';
      return html(`${fragment}
${filterFormHtml(q, status, { oob: true })}${strip}`);
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
    const scope = String(data.get('scope') ?? 'personal') === 'shared' ? 'shared' : 'personal';
    const isDefault = data.get('default') != null;
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

    // One default at most: a screen that opens on two different
    // questions has no default at all.
    const existing = isDefault
      ? views.map((view) => ({ ...view, isDefault: false }))
      : views;
    const saved = [...existing, { name, q, status, scope, isDefault }];
    const fragment = stripFragment(saved, { currentName: name });
    if (isHtmx(request)) return html(fragment);
    // No-JS: a real app would 303 back to the list; the stateless demo
    // answers a readable page with the updated strip.
    return page('View saved', fragment);
  }

  // Update in place: the view is corrected, not deleted and recreated,
  // so its name (and any link anyone has shared) survives.
  const putMatch = method === 'PUT' && path.match(/^\/views\/([^/]+)$/);
  if (putMatch) {
    const name = decodeURIComponent(putMatch[1]);
    const data = await request.formData();
    const q = String(data.get('q') ?? '');
    const status = String(data.get('status') ?? '');
    const views = viewsFromParams(data.getAll('view').map(String));
    if (!views.some((view) => view.name === name)) {
      return html(errorAlert('unknown', 'that view no longer exists'), {
        status: 404,
      });
    }
    // Update in place corrects the CONDITIONS. Scope and default are
    // not conditions, so pressing Update never silently re-homes a view
    // or steals the default from another one.
    const updated = views.map((view) =>
      view.name === name ? { ...view, name, q, status } : view,
    );
    return html(stripFragment(updated, { currentName: name }));
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
