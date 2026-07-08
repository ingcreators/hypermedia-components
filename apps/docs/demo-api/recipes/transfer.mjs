// transfer — recipes/transfer/contract.md
//
//   GET  /roles/42/members?assigned=2,4 → 200, the form fragment (htmx)
//                                         or a full page (no HX-Request)
//   POST /roles/42/members?assigned=2,4 → action=add|remove moves the
//                                         checked ids; 200 + the whole
//                                         re-rendered form (htmx), 303 +
//                                         Location PRG (no JS), 422 +
//                                         inline alert when nothing
//                                         relevant is checked
//
// Stateless: the current membership rides on the form's own URLs as
// `?assigned=<comma-separated ids>` — every re-rendered form carries
// the UPDATED value in both `action` and `data-hx-post`. `action=add`
// reads only the checked `available` ids, `remove` only the checked
// `assigned` ids (a user can check both sides); unknown and duplicate
// ids are ignored — moves are idempotent per id.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/transfer`;
const FORM_ID = 'transfer-demo-members';
const INITIAL_ASSIGNED = ['2'];

const PEOPLE = new Map([
  ['1', 'Ada Lovelace'],
  ['2', 'Alan Turing'],
  ['3', 'Grace Hopper'],
  ['4', 'Margaret Hamilton'],
  ['5', 'Katherine Johnson'],
]);

/** Parse `?assigned=` into a sorted, deduped list of known ids. */
function parseAssigned(url) {
  const raw = url.searchParams.get('assigned');
  if (raw === null) return [...INITIAL_ASSIGNED];
  return normalize(raw.split(','));
}

function normalize(ids) {
  return [...new Set(ids.map((id) => String(id).trim()).filter((id) => PEOPLE.has(id)))].sort(
    (a, b) => Number(a) - Number(b),
  );
}

function membersUrl(assigned) {
  return `${API}/roles/42/members?assigned=${assigned.join(',')}`;
}

function paneHtml(title, name, ids) {
  const items = ids
    .map(
      (id) => `      <label class="hc-item">
        <input class="hc-checkbox" type="checkbox" name="${name}" value="${id}">
        <span class="hc-item__title">${escapeHtml(PEOPLE.get(id))}</span>
      </label>`,
    )
    .join('\n');
  return `  <fieldset class="hc-transfer__pane">
    <legend class="hc-transfer__title">${title}
      <span class="hc-transfer__count">(${ids.length})</span></legend>
    <div class="hc-transfer__list">
${items}
    </div>
  </fieldset>`;
}

/** The whole re-rendered form — the swap unit for every response. */
function formHtml(assigned, { alert = false } = {}) {
  const available = [...PEOPLE.keys()].filter((id) => !assigned.includes(id));
  const action = membersUrl(assigned);
  const alertHtml = alert
    ? `  <div class="hc-alert" data-variant="error" role="alert" style="flex-basis:100%;">
    <p class="hc-alert__title">Select at least one member to move.</p>
  </div>\n`
    : '';
  return `<form class="hc-transfer" id="${FORM_ID}" method="post" action="${action}"
      data-hx-post="${action}"
      data-hx-target="this" data-hx-swap="outerHTML"
      aria-label="Role members">
${alertHtml}${paneHtml('Available', 'available', available)}

  <div class="hc-transfer__controls">
    <button class="hc-button" type="submit" name="action" value="add"
            data-hx-disabled-elt="this" aria-label="Add selected">
      <span class="hc-transfer__arrow" aria-hidden="true">→</span>
    </button>
    <button class="hc-button" type="submit" name="action" value="remove"
            data-hx-disabled-elt="this" aria-label="Remove selected">
      <span class="hc-transfer__arrow" aria-hidden="true">←</span>
    </button>
  </div>

${paneHtml('Assigned', 'assigned', assigned)}
</form>`;
}

export async function handle({ request, url, method, path }) {
  if (path !== '/roles/42/members') return null;

  if (method === 'GET') {
    const assigned = parseAssigned(url);
    if (isHtmx(request)) return html(formHtml(assigned));
    // No-JS / PRG landing: the same form as a full page.
    return page('Role members — transfer demo', formHtml(assigned));
  }

  if (method === 'POST') {
    const assigned = parseAssigned(url);
    const form = await request.formData();
    const action = form.get('action');

    // Only the pane matching the verb counts; the other side (and any
    // unknown ids) are ignored.
    const checked =
      action === 'add' || action === 'remove'
        ? normalize(form.getAll(action === 'add' ? 'available' : 'assigned'))
        : [];

    if (checked.length === 0) {
      const body = formHtml(assigned, { alert: true });
      if (isHtmx(request)) return html(body, { status: 422 });
      return page('Role members — transfer demo', body, { status: 422 });
    }

    const next =
      action === 'add'
        ? normalize([...assigned, ...checked])
        : assigned.filter((id) => !checked.includes(id));

    if (isHtmx(request)) return html(formHtml(next));
    // No-JS: POST-redirect-GET onto the updated membership.
    return new Response(null, { status: 303, headers: { Location: membersUrl(next) } });
  }

  return null;
}
