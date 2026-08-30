// inline-edit — recipes/inline-edit/contract.md
//
//   GET /items/42/name?v=…       → display fragment
//   GET /items/42/name/edit?v=…  → edit-form fragment
//   PUT /items/42/name           → 200 + display fragment (new value),
//                                  or 422 + edit fragment with the
//                                  error state (blank name)
//
// Stateless: the current value threads through `?v=` on every URL the
// fragments carry (default: "Acme widgets"), plus a hidden `v` input
// in the edit form so a 422 re-render keeps Cancel pointing at the
// ORIGINAL value. Fragment URLs are absolute and carry DOCS_BASE —
// they swap into the docs page, where htmx would otherwise resolve
// them against the bare origin and miss the Worker's base prefix.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const PREFIX = `${DOCS_BASE}/api/recipes/inline-edit`;
const ID = 'inline-edit-demo-name';
const DEFAULT_VALUE = 'Acme widgets';

/** Display state — the value plus a real Edit button. */
function displayFragment(v) {
  const q = `v=${encodeURIComponent(v)}`;
  return `<span id="${ID}">
  ${escapeHtml(v)}
  <button class="hc-button" data-size="sm" type="button"
    data-hx-get="${PREFIX}/items/42/name/edit?${q}"
    data-hx-target="closest span"
    data-hx-swap="outerHTML">
    Edit
  </button>
</span>`;
}

/**
 * Edit state. `v` is the original (pre-edit) value — Cancel and the
 * hidden input carry it; `value` is what the input shows (defaults to
 * `v`; on a 422 re-render it is the rejected submission).
 */
function editFragment(v, { value = v, invalid = false } = {}) {
  const q = `v=${encodeURIComponent(v)}`;
  const control = invalid
    ? `<div class="hc-field" data-invalid="true">
    <input
      class="hc-input"
      data-size="sm"
      name="name"
      value="${escapeHtml(value)}"
      aria-label="Item name"
      aria-invalid="true"
      aria-describedby="${ID}-error"
      autofocus>
    <p id="${ID}-error" class="hc-field__message">Name is required.</p>
  </div>`
    : `<input
    name="name"
    class="hc-input"
    data-size="sm"
    value="${escapeHtml(value)}"
    aria-label="Item name"
    autofocus>`;
  return `<form
  id="${ID}"
  data-hx-put="${PREFIX}/items/42/name"
  data-hx-target="this"
  data-hx-swap="outerHTML"
  style="display: inline-flex; gap: .25rem;">
  <input type="hidden" name="v" value="${escapeHtml(v)}">
  ${control}
  <button class="hc-button" data-size="sm" data-variant="primary" type="submit">
    Save
  </button>
  <button class="hc-button" data-size="sm" type="button"
    data-hx-get="${PREFIX}/items/42/name?${q}"
    data-hx-target="closest form"
    data-hx-swap="outerHTML">
    Cancel
  </button>
</form>`;
}

export async function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/items/42/name') {
    return html(displayFragment(url.searchParams.get('v') ?? DEFAULT_VALUE));
  }

  if (method === 'GET' && path === '/items/42/name/edit') {
    return html(editFragment(url.searchParams.get('v') ?? DEFAULT_VALUE));
  }

  if (method === 'PUT' && path === '/items/42/name') {
    const data = await request.formData();
    const name = String(data.get('name') ?? '');
    const v = String(data.get('v') ?? DEFAULT_VALUE);
    if (name.trim() === '') {
      return html(editFragment(v, { value: name, invalid: true }), { status: 422 });
    }
    return html(displayFragment(name.trim()));
  }

  return null;
}
