# file-upload — server response contract

Purpose: multipart file upload with a live progress bar — htmx owns the
transport (`data-hx-encoding` + `htmx:xhr:progress`), the
`installUploadProgress()` bridge drives the native `<progress>`, and
the response prepends the new file's fragment (the `afterbegin` swap)
and resets the form via an out-of-band swap. Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

```html
<form id="upload-form" method="post" action="/files"
      enctype="multipart/form-data"
      data-hx-post="/files"
      data-hx-encoding="multipart/form-data"
      data-hx-target="#files" data-hx-swap="afterbegin"
      data-hx-indicator="find progress"
      data-hx-disabled-elt="find button[type=submit]">
  <div id="upload-errors"></div>
  <div class="hc-field">
    <label class="hc-field__label" for="doc">Document</label>
    <input class="hc-input" id="doc" name="doc" type="file" required
           accept=".pdf,.png">
  </div>
  <progress class="hc-progress htmx-indicator" data-hc-upload-progress
            value="0" max="100" aria-label="Upload progress"></progress>
  <button class="hc-button" data-variant="primary" type="submit">Upload</button>
</form>

<ul id="files">…server-rendered current files…</ul>
```

- **Both encodings, always.** `data-hx-encoding="multipart/form-data"`
  affects only the htmx request; the native no-JS submit needs the real
  `enctype` attribute. Shipping only one of them is the classic mistake
  — `hc validate` flags it.
- `installUploadProgress()` and `installToast()` (auto-init
  `@hypermedia-components/core/behaviors`). The progress bar's
  visibility is htmx-native (`data-hx-indicator` + `htmx-indicator`);
  the bridge only drives `value` — monotonic within the request, so the
  response-download phase cannot rewind the bar.
- The one-time `htmx:beforeSwap` allowance for `422` (the
  [mutating-form](../mutating-form/contract.md) wiring).

## Success — `200` + the item fragment + an out-of-band fresh form

```text
POST /files            (htmx, HX-Request: true)
HTTP/1.1 200 OK
HX-Trigger: {"hc:toast":{"message":"\"report.pdf\" uploaded","variant":"success"}}
```

```html
<li class="hc-item" id="file-317">report.pdf — 1.2 MB</li>

<form id="upload-form" data-hx-swap-oob="true" …the pristine form markup…>
  …
</form>
```

- The item fragment lands `afterbegin` in `#files` (the form's declared
  target).
- The **out-of-band fresh form** replaces the used one — file inputs
  cannot be reset by value assignment from markup, so the server sends
  a pristine form (the same fragment the full page renders); htmx
  re-initializes it on swap. This is the blessed reset.
- The toast is optional but recommended; escape non-ASCII as `\uXXXX`
  (header values are latin-1 — see the
  [undo-delete contract](../undo-delete/contract.md)).

## Validation failure — `422`, steered into the error container

The server is the validator (type, size, required); client `accept` /
size hints are UX only. Because the form's declared target is the
files list, the error response **retargets itself**:

```text
POST /files            (file too large / wrong type)
HTTP/1.1 422 Unprocessable Entity
HX-Retarget: #upload-errors
HX-Reswap: innerHTML
```

Body = the canonical [field-errors](../field-errors/) fragment
(`data-field="doc"` …). `installFieldErrors()` distributes it
(`aria-invalid`, `.hc-field__error`, focus). The primary path stays
attribute-declared in markup; only the exceptional path uses response
headers — mutating-form's documented alternative.

## Proxy-level `413`

A reverse proxy may reject an oversized body **before the app sees
it** — the response is not htmx-shaped, htmx swaps nothing (non-2xx),
and the form simply stays. Surface it globally if desired:

```js
document.body.addEventListener('htmx:responseError', (event) => {
  if (event.detail.xhr.status === 413) {
    document.body.dispatchEvent(new CustomEvent('hc:toast', {
      bubbles: true,
      detail: { message: 'File too large', variant: 'error' },
    }));
  }
});
```

Keep the app's own size limit below the proxy's so the friendly `422`
path wins in practice.

## Progressive enhancement (no JS)

`method` + `action` + `enctype` make the native submit a correct
multipart post; the server branches on `HX-Request` and answers `303`
(post/redirect/get — [mutating-form](../mutating-form/contract.md)).
The progress bar and inline errors are enhancements; their absence
breaks nothing.

## Accessibility

- The native `<progress>` keeps its `progressbar` role; give it an
  `aria-label`. It is visible only while the request is in flight.
- The file input is a real `<input type="file">` with a real
  `<label for>`; validation errors arrive via field-errors' standard
  `aria-invalid` / `aria-describedby` / focus handling.
- Success is announced by the toast (`role="status"`).

## Dropzone variant

Swap the plain field for an [hc-dropzone](../../packages/core/src/css/hc-dropzone.css)
— **nothing else changes**. The dropzone assigns dropped files to the
same native input and fires a normal `change`, so serialization, the
progress bridge, the OOB fresh-form reset and the `422` path are
identical:

```html
<label class="hc-dropzone">
  <input class="hc-dropzone__input" id="doc" name="doc" type="file" required>
  <span class="hc-dropzone__body">
    <span class="hc-dropzone__hint">Drop a file here, or click to browse</span>
    <span class="hc-dropzone__files"></span>
  </span>
</label>
```

The OOB fresh form the server re-sends simply contains the pristine
dropzone markup (the empty `__files` span collapses again).
`installDropzone()` ships in the auto-init behaviors bundle.

## Notes

- Multiple-file inputs (`multiple`) work unchanged: the server returns
  one fragment per stored file (or a wrapping fragment) and the same
  OOB fresh form.
