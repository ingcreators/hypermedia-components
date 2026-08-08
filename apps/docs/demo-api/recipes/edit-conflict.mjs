// edit-conflict — recipes/edit-conflict/contract.md
//
//   PUT /tickets/7            → 200 when version == 13 (the demo's
//                               "current" record) · 409 + conflict
//                               dialog when stale
//   PUT /tickets/7?force=1    → 200 when the dialog's fresh version
//                               rides along (13)
//   GET /tickets/7/edit       → 200, the edit form at the current
//                               version (?stale=1 renders v12 — the
//                               demo's reset into the conflicting state)
//
// Stateless: the record is pinned at version 13 / title "Restock the
// beans (theirs)". A v12 form always conflicts — which is exactly the
// story the demo wants to tell.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/edit-conflict`;
const CURRENT = { version: '13', title: 'Restock the beans (theirs)' };

function editForm({ version, title, note = '' }) {
  return `<form id="edit-conflict-demo-form" class="hc-stack"
      data-hx-put="${API}/tickets/7"
      data-hx-target="#edit-conflict-demo-status" data-hx-swap="innerHTML">
  <input type="hidden" name="version" value="${escapeHtml(version)}">
  <div class="hc-field">
    <label class="hc-field__label" for="edit-conflict-demo-title">Title</label>
    <input class="hc-input" id="edit-conflict-demo-title" name="title"
           value="${escapeHtml(title)}">
  </div>
  <p class="hc-field__hint" id="edit-conflict-demo-status" aria-live="polite">${note}</p>
  <button class="hc-button" data-variant="primary" type="submit">Save</button>
</form>`;
}

function conflictDialog(yourTitle) {
  return `<dialog class="hc-dialog" aria-labelledby="edit-conflict-demo-conflict-title">
  <div class="hc-stack">
    <h2 class="hc-dialog__title" id="edit-conflict-demo-conflict-title">Someone saved first</h2>
    <table class="hc-table">
      <thead>
        <tr><th scope="col"></th><th scope="col">Theirs (v${CURRENT.version})</th><th scope="col">Yours</th></tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Title</th>
          <td>${escapeHtml(CURRENT.title)}</td>
          <td>${escapeHtml(yourTitle)}</td>
        </tr>
      </tbody>
    </table>
    <form class="hc-cluster">
      <input type="hidden" name="version" value="${CURRENT.version}">
      <button class="hc-button" data-variant="error" type="button"
              data-hc-close-dialog-on-success
              data-hx-put="${API}/tickets/7?force=1"
              data-hx-include="#edit-conflict-demo-form [name='title'], closest form"
              data-hx-target="#edit-conflict-demo-status" data-hx-swap="innerHTML">
        Overwrite with mine
      </button>
      <button class="hc-button" type="button"
              data-hc-close-dialog-on-success
              data-hx-get="${API}/tickets/7/edit"
              data-hx-target="#edit-conflict-demo-form" data-hx-swap="outerHTML">
        Reload theirs
      </button>
    </form>
    <form method="dialog">
      <button class="hc-button" data-variant="ghost">Keep editing</button>
    </form>
  </div>
</dialog>`;
}

export async function handle({ request, url, method, path }) {
  if (path === '/tickets/7' && method === 'PUT') {
    const body = await request.formData();
    const version = body.get('version') ?? '';
    const title = body.get('title') ?? '';
    const force = url.searchParams.get('force') === '1';
    // force only wins alongside the CURRENT version (the dialog's fresh
    // hidden field) — a force against a moved-again record re-conflicts.
    if (version === CURRENT.version) {
      return html(`<span>Saved as v14${force ? ' (overwrote v13)' : ''}.</span>`);
    }
    return html(conflictDialog(title), {
      status: 409,
      headers: { 'HX-Retarget': '#edit-conflict-demo-dialog', 'HX-Reswap': 'innerHTML' },
    });
  }

  if (path === '/tickets/7/edit' && method === 'GET') {
    if (url.searchParams.get('stale') === '1') {
      return html(
        editForm({
          version: '12',
          title: 'Restock the beans (mine)',
          note: 'This form was rendered from v12 — saving will conflict.',
        }),
      );
    }
    return html(editForm({ version: CURRENT.version, title: CURRENT.title }));
  }

  return null;
}
