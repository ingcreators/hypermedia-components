// remote-dialog — recipes/remote-dialog/contract.md
//
//   GET  /items/123/edit  → 200, a complete not-open
//                           `<dialog class="hc-dialog">` fragment
//                           (installRemoteDialog showModal()s it after
//                           the swap into the dialog root)
//   POST /items/123       → 200 + empty body + `HX-Trigger:
//                           {"hc:toast": …}` on success — the
//                           outerHTML swap of the empty body removes
//                           the dialog (and close-on-success fires)
//                         → 422 + the dialog re-rendered with the Name
//                           field in its error state when `name` is
//                           blank (non-2xx, so the dialog stays open)
//
// Stateless: "saving" only raises the toast; reopening the dialog
// always shows the canned value again.

import {
  DOCS_BASE,
  escapeHtml,
  html,
  hxTrigger,
  isHtmx,
  page,
} from '../html.mjs';

const ITEM_URL = `${DOCS_BASE}/api/recipes/remote-dialog/items/123`;
// The [data-hc-remote-dialog-root] host in RemoteDialogDemo.astro —
// the 422 branch retargets here so the behavior re-opens the dialog.
const ROOT_ID = 'remote-dialog-demo-root';

/**
 * The complete dialog fragment, mirroring
 * recipes/remote-dialog/expanded.html: not `open`, Cancel in its own
 * `<form method="dialog">` (forms cannot nest, so the footer sits
 * outside the edit form and Save reaches it via the `form` attribute).
 */
function dialogHtml({ name = 'Acme widgets', invalid = false } = {}) {
  const errorAttrs = invalid
    ? ' aria-invalid="true" aria-describedby="remote-dialog-demo-name-error"'
    : '';
  const errorMessage = invalid
    ? '\n        <p id="remote-dialog-demo-name-error" class="hc-field__message">Name is required.</p>'
    : '';
  return `<dialog class="hc-dialog">
  <header class="hc-dialog__header">
    <h2 class="hc-dialog__title">Edit item</h2>
  </header>

  <form
    id="remote-dialog-demo-edit-form"
    data-hx-post="${ITEM_URL}"
    data-hx-target="closest dialog"
    data-hx-swap="outerHTML"
    data-hc-close-dialog-on-success>
    <div class="hc-dialog__body">
      <div class="hc-field"${invalid ? ' data-invalid="true"' : ''}>
        <label class="hc-field__label" for="remote-dialog-demo-name">Name</label>
        <input id="remote-dialog-demo-name" class="hc-input" name="name" value="${escapeHtml(name)}"${errorAttrs}>${errorMessage}
      </div>
    </div>
  </form>

  <footer class="hc-dialog__footer">
    <form method="dialog"><button class="hc-button">Cancel</button></form>
    <button class="hc-button" data-variant="primary" type="submit"
      form="remote-dialog-demo-edit-form">Save</button>
  </footer>
</dialog>`;
}

export async function handle({ method, path, request }) {
  if (method === 'GET' && path === '/items/123/edit') {
    if (isHtmx(request)) return html(dialogHtml());

    // No-JS fallback: this fragment only makes sense swapped into a
    // `[data-hc-remote-dialog-root]` host. A direct navigation gets a
    // short explanation instead of a floating dialog skeleton.
    return page(
      'Remote dialog demo',
      `<p>This endpoint returns a <code>&lt;dialog class="hc-dialog"&gt;</code>
fragment meant to be fetched by htmx and swapped into a
<code>data-hc-remote-dialog-root</code> host, where the
<code>installRemoteDialog</code> behavior opens it. On its own it is not a
usable page — see the recipe docs for the full pattern.</p>`,
    );
  }

  if (method === 'POST' && path === '/items/123') {
    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();

    if (name === '') {
      // Re-render the whole dialog in its error state, retargeted at
      // the dialog ROOT (innerHTML). The form's own `closest dialog`
      // outerHTML target must not be used for the error: an outerHTML
      // swap replaces the showModal()-ed node with a fresh closed
      // <dialog> and fires afterSwap on the new content — not on the
      // [data-hc-remote-dialog-root] host installRemoteDialog watches
      // — so the error dialog would land invisible. Swapping the root
      // re-fires the behavior and the dialog re-opens in error state.
      // (Still needs the docs pages' one-time 422 allowance to swap.)
      const invalidDialog = dialogHtml({ name: '', invalid: true });
      if (isHtmx(request)) {
        return html(invalidDialog, {
          status: 422,
          headers: {
            'HX-Retarget': `#${ROOT_ID}`,
            'HX-Reswap': 'innerHTML',
          },
        });
      }
      return page(
        'Item not saved',
        `<p>The submission failed validation — the name is required.</p>`,
        { status: 422 },
      );
    }

    if (isHtmx(request)) {
      // Empty 200 body: the outerHTML swap removes the dialog node
      // (and data-hc-close-dialog-on-success fires too — both fine).
      return html('', {
        headers: {
          'HX-Trigger': hxTrigger({
            'hc:toast': { message: `"${name}" saved`, variant: 'success' },
          }),
        },
      });
    }
    return page('Item saved', `<p>Saved “${escapeHtml(name)}”.</p>`);
  }

  return null;
}
