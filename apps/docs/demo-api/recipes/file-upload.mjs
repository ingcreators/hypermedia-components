// file-upload — recipes/file-upload/contract.md
//
//   POST /files  (multipart/form-data, file field: doc)
//     → 200 + the new item's `<li>` (lands `afterbegin` in the files
//       list, the form's declared target) + the pristine composer form
//       as an `data-hx-swap-oob` fragment (the blessed file-input reset) +
//       `HX-Trigger: {"hc:toast": …}` naming the file       (htmx)
//     → 422 + `HX-Retarget: #file-upload-demo-errors` +
//       `HX-Reswap: innerHTML` + the canonical field-errors fragment
//       (missing file → `required`; extension not .pdf/.png → `type`;
//       > 1 MiB → `size`) — the form's declared target is the files
//       list, so the exceptional path steers itself via headers
//
//   The demo page renders TWO composer forms against this endpoint:
//   the plain-input form and the dropzone variant. The dropzone form
//   submits a hidden `form=dropzone` field; that discriminator picks
//   which pristine form the OOB reset re-sends and which in-form
//   errors container the 422 retargets. Anything else (missing field,
//   unexpected value, a File part) falls back to the plain form —
//   a strict allow-list, never echoed back into the response.
//     → 303 → the recipe page (no-JS post/redirect/get; a real app
//       would redirect to its file list)
//   GET  /files  → 200, two canned items (the demo list's load trigger)
//
// Stateless on purpose: the success fragment is derived from the
// uploaded file's metadata (name/size) and immediately forgotten —
// nothing is stored, so reloading the page resets the list to the
// canned items.

import {
  DOCS_BASE,
  escapeHtml,
  html,
  hxTrigger,
  isHtmx,
  page,
} from '../html.mjs';
import { errorsFragment } from './field-errors.mjs';

/**
 * App-level size limit (1 MiB). A demo-grade stand-in for the
 * contract's proxy-413 note: a real deployment keeps its own limit
 * below the reverse proxy's, so this friendly 422 path wins over an
 * opaque proxy 413 in practice.
 */
const MAX_BYTES = 1024 * 1024;

/** Validate the uploaded file; returns 0..1 field-error items. */
export function validateUpload(doc) {
  // A missing part is null; a non-file part is a string; an empty
  // file input serializes as a File with an empty name.
  if (!(doc instanceof File) || doc.name === '') {
    return [{ field: 'doc', code: 'required', message: 'doc: a file is required' }];
  }
  if (!/\.(pdf|png)$/i.test(doc.name)) {
    return [{ field: 'doc', code: 'type', message: 'doc: only PDF or PNG files are allowed' }];
  }
  if (doc.size > MAX_BYTES) {
    return [{ field: 'doc', code: 'size', message: 'doc: files must be 1 MB or smaller' }];
  }
  return [];
}

/** Human-readable size, e.g. `1.2 MB` / `340 kB`. Also used by the
 * chat-messages attachments demo's hc-attachment cards. */
export function humanSize(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} kB`;
  return `${bytes} B`;
}

/** One uploaded-file line, mirroring recipes/file-upload/expanded.html. */
function itemHtml(doc) {
  return `<li class="hc-item" id="file-upload-demo-file-${Date.now()}">${escapeHtml(doc.name)} — ${humanSize(doc.size)}</li>`;
}

/** The canned starting list (GET /files — the demo's load trigger). */
const CANNED_ITEMS = `<li class="hc-item">spec.pdf — 340 kB</li>
<li class="hc-item">logo.png — 12 kB</li>`;

/** In-form errors container per composer — where the 422 retargets. */
const ERRORS_TARGET = {
  plain: '#file-upload-demo-errors',
  dropzone: '#file-upload-demo-dropzone-errors',
};

/**
 * Which composer posted. The dropzone form submits a hidden
 * `form=dropzone` field; anything else — missing field, unexpected
 * value, a File part — is the plain form. Strict allow-list: the
 * submitted value is only ever compared, never echoed back.
 */
export function formVariant(data) {
  return data.get('form') === 'dropzone' ? 'dropzone' : 'plain';
}

/**
 * The composer forms. This is the single source of their markup:
 * FileUploadDemo.astro (apps/docs/src/components/recipe-demos/)
 * mirrors both attribute-for-attribute for the initial render, and
 * every successful upload re-sends the posting form here with
 * `data-hx-swap-oob="true"` — file inputs cannot be reset by value
 * assignment from markup, so the server returns a pristine copy and
 * htmx re-initializes it (the recipe's blessed reset). The `dropzone`
 * variant swaps the plain field for the hc-dropzone markup and carries
 * the hidden `form=dropzone` discriminator; nothing else differs
 * (recipe contract.md, "Dropzone variant"). Keep the two files in sync.
 */
export function composerFormHtml({ oob = false, variant = 'plain' } = {}) {
  const url = `${DOCS_BASE}/api/recipes/file-upload/files`;
  const oobAttr = oob ? ' data-hx-swap-oob="true"' : '';
  if (variant === 'dropzone') {
    return `<form id="file-upload-demo-dropzone-form"${oobAttr} method="post" action="${url}" enctype="multipart/form-data" data-hx-post="${url}" data-hx-encoding="multipart/form-data" data-hx-target="#file-upload-demo-files" data-hx-swap="afterbegin" data-hx-indicator="find progress" data-hx-disabled-elt="find button[type=submit]">
  <input type="hidden" name="form" value="dropzone">
  <div id="file-upload-demo-dropzone-errors"></div>
  <label class="hc-dropzone">
    <input class="hc-dropzone__input" name="doc" type="file" required accept=".pdf,.png">
    <span class="hc-dropzone__body">
      <span class="hc-dropzone__hint">Drop a file here, or click to browse</span>
      <span class="hc-dropzone__files"></span>
    </span>
  </label>
  <progress class="hc-progress htmx-indicator" data-hc-upload-progress value="0" max="100" aria-label="Upload progress"></progress>
  <button class="hc-button" data-variant="primary" type="submit">Upload</button>
</form>`;
  }
  return `<form id="file-upload-demo-form"${oobAttr} method="post" action="${url}" enctype="multipart/form-data" data-hx-post="${url}" data-hx-encoding="multipart/form-data" data-hx-target="#file-upload-demo-files" data-hx-swap="afterbegin" data-hx-indicator="find progress" data-hx-disabled-elt="find button[type=submit]">
  <div id="file-upload-demo-errors"></div>
  <div class="hc-field">
    <label class="hc-field__label" for="file-upload-demo-doc">Document</label>
    <input class="hc-input" id="file-upload-demo-doc" name="doc" type="file" required accept=".pdf,.png">
  </div>
  <progress class="hc-progress htmx-indicator" data-hc-upload-progress value="0" max="100" aria-label="Upload progress"></progress>
  <button class="hc-button" data-variant="primary" type="submit">Upload</button>
</form>`;
}

export async function handle({ method, path, request }) {
  if (method === 'GET' && path === '/files') {
    if (isHtmx(request)) return html(CANNED_ITEMS);
    // No-JS fallback: a direct navigation gets a readable page.
    return page('File upload demo', `<ul>\n${CANNED_ITEMS}\n</ul>`);
  }

  if (method === 'POST' && path === '/files') {
    const data = await request.formData();
    const doc = data.get('doc');
    const variant = formVariant(data);
    const errors = validateUpload(doc);

    if (errors.length > 0) {
      const fragment = errorsFragment(errors, 'The file was not accepted.');
      if (isHtmx(request)) {
        // The form's declared target is the files list; the error
        // response retargets itself into the posting form's own
        // errors container (contract.md's exceptional path).
        return html(fragment, {
          status: 422,
          headers: {
            'HX-Retarget': ERRORS_TARGET[variant],
            'HX-Reswap': 'innerHTML',
          },
        });
      }
      // No-JS: full page with the fragment inline.
      return page(
        'File not uploaded',
        `<p>The upload failed validation:</p>\n${fragment}`,
        { status: 422 },
      );
    }

    if (isHtmx(request)) {
      // hxTrigger \uXXXX-escapes non-ASCII (header values are latin-1)
      // and JSON.stringify escapes the quotes around the filename.
      return html(`${itemHtml(doc)}\n${composerFormHtml({ oob: true, variant })}`, {
        headers: {
          'HX-Trigger': hxTrigger({
            'hc:toast': { message: `"${doc.name}" uploaded`, variant: 'success' },
          }),
        },
      });
    }

    // No-JS: plain post/redirect/get. A real app would redirect to its
    // file list; the demo stores nothing, so back to the recipe page.
    return new Response(null, {
      status: 303,
      headers: { Location: `${DOCS_BASE}/recipes/file-upload/` },
    });
  }

  return null;
}
