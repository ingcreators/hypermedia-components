# file-upload — recipe + progress-bridge behavior plan

Status: **shipped — PR 1 (bridge, #296) and PR 2 (recipe + browser test, #297).**
The last big everyday gap in the recipe layer: multipart uploads with a
real progress bar. htmx owns the transport (`data-hx-encoding` +
`htmx:xhr:progress` are native); one ~60-line bridge behavior drives the
native `<progress>` element, and the contract blesses the traps —
including the double-`enctype` requirement and the
progress-event rewind. Baseline: post-#294, 18 recipes.

## 1. Goal

```html
<form method="post" action="/files" enctype="multipart/form-data"
      data-hx-post="/files"
      data-hx-encoding="multipart/form-data"
      data-hx-target="#files" data-hx-swap="afterbegin"
      data-hx-indicator="find progress"
      data-hx-disabled-elt="find button[type=submit]">
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

Selecting a file and uploading shows a live progress bar, appends the
new file's fragment to the list, resets the form, and toasts. Without
JavaScript the same form posts natively (`enctype` + `303`).

## 2. Verified facts the design stands on

- `hc-progress` is a **native `<progress>`** — the bridge sets
  `el.value`; role/ARIA are free.
- htmx registers `{loadstart,loadend,progress,abort}` on **both `xhr`
  and `xhr.upload`**, firing `htmx:xhr:progress` on the requesting
  element with `{ lengthComputable, loaded, total }` (verified in the
  vendored 2.0.4 source). Consequence: after the upload reaches 100 %,
  the **response-download phase re-fires the event with a new, small
  `total`** — a naive `loaded/total` binding rewinds the bar at the end.
- Indicator visibility is already htmx-native:
  `data-hx-indicator="find progress"` + the `htmx-indicator` class
  (styled by `hc.htmx.css`) shows the bar only while a request is in
  flight. The bridge never touches visibility.

## 3. The bridge — `installUploadProgress()`

New `src/js/upload-progress.js`, the sse-dispatch shape (root-delegated,
idempotent, uninstaller, no network, no i18n):

- Markup contract: the `<progress data-hc-upload-progress>` element
  lives **inside the requesting form** (the same closest-association
  htmx uses for `find …` selectors).
- `htmx:beforeRequest` on a form containing a bridge bar → `value = 0`.
- `htmx:xhr:progress` → if `lengthComputable && total > 0`:
  `value = max(value, round(100 * loaded / total))` — **monotonic
  within one request**, which neutralizes the response-phase rewind
  (§2) without trying to distinguish event sources.
- `htmx:afterRequest` → `value = 100` (settled; the indicator hides it).
- Registered in `behaviors.js` auto-init, exported from `index.js`,
  added to `bundle-js.mjs` FILES.

## 4. Server contract (recipe `file-upload`)

| Case | Response |
| --- | --- |
| htmx success | `200` — the new file's list-item fragment (swapped `afterbegin` into `#files`) + an **out-of-band fresh form** (`hx-swap-oob="true"` on the same form id — the blessed self-reset, htmx re-initializes it) + `HX-Trigger` toast (`\uXXXX`-escaped per the undo-delete blessing) |
| validation failure (type/size/required) | `422` + the [field-errors](../recipes/field-errors/) fragment into the in-form error container (mutating-form's `htmx:beforeSwap` allowance) — the server is the validator; client `accept`/size hints are UX only |
| proxy-level `413` | May arrive **before the app sees the request**; htmx swaps nothing (non-2xx) and the form stays. Documented with an optional `htmx:responseError` toast snippet — not engineered around |
| no-JS | `303` PRG (mutating-form branching); `enctype` makes the native post correct |

**The double-encoding trap is contract**: `data-hx-encoding` affects
only the htmx path; the native fallback needs the real
`enctype="multipart/form-data"` attribute. Both are required
(`hc validate` error rule — this is the mistake everyone ships once).

## 5. checks.json

`detect: form[data-hx-encoding="multipart/form-data"]` — rules:
`enctype` present + equals `multipart/form-data` (**error**, §4 trap);
a file input exists (**error**); `data-hx-disabled-elt` (warn);
a `[data-hc-upload-progress]` bar exists (warn).

## 6. Public API surface

Additive → patch: 1 export (`installUploadProgress`), 1 attribute
(`data-hc-upload-progress`), 1 recipe contract. No new events (htmx's
own), no CSS, no i18n.

## 7. PR split (sequential, no stacking)

### PR 1 — `feat(behaviors): upload progress bridge (installUploadProgress)`
- [ ] `src/js/upload-progress.js` + registration (behaviors / index /
      bundle-js FILES).
- [ ] `test/upload-progress.test.mjs` — synthetic htmx events:
      reset-on-beforeRequest, ratio mapping, **monotonic guard**
      (a late small-total event cannot rewind), non-computable skipped,
      settle-at-100, forms without a bar untouched, idempotent,
      uninstall.
- [ ] htmx integration guide: row in the events table.
- [ ] CHANGELOG; plan Status update.

### PR 2 — `docs(recipes): bless file-upload (multipart + live progress)`
- [ ] `recipes/file-upload/{recipe,expanded,contract,checks}` +
      `recipes/README.md` row + docs page (incl. the double-encoding
      trap and the hc-dropzone follow-up note).
- [ ] serve.mjs mock: `POST /mock/upload` — reads the multipart body
      with a small delay (in-flight window observable); filename
      `fail.*` → `422` field-errors fragment; otherwise `200` + item
      fragment + OOB fresh form + escaped toast.
- [ ] Fixture + `test-browser/file-upload.spec.mjs`: bar visible
      mid-flight and reaches 100; the list gains the item; **the form
      resets via the OOB swap** (file input empty again); `422` renders
      inline errors; axe.
- [ ] CHANGELOG; plan Status → shipped.

## 8. Risks / notes

- **Progress event cadence on loopback** is bursty — the browser spec
  asserts outcomes (bar was visible during flight, ends at 100), while
  the monotonic/rewind logic is pinned deterministically in jsdom.
- **OOB form replacement** swaps a form mid-lifecycle — after
  `htmx:afterRequest`, so the indicator/disabled cleanup has already
  run on the old node; the fresh form arrives inert. Pinned by the
  reset assertion in the spec.
- `hc-dropzone` (drag-and-drop UI) is the natural follow-up component
  and slots into this same contract — deliberately out of scope here,
  noted in the docs page.
