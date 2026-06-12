# field-errors — server response contract

Purpose: render server-side validation errors next to the form fields
they belong to, with correct ARIA wiring and **zero custom JavaScript**
on the consumer side. The fragment below is the canonical wire format —
template engines and code generators can emit it verbatim.

## Required client markup

- A `<form>` whose controls have `name` attributes (an `hc-field`
  wrapper per control is recommended but not required).
- An error container the response is swapped into — inside the form
  (`<div id="form-errors"></div>` + `data-hx-target="#form-errors"`),
  or anywhere else if the fragment points back at the form (see
  `data-hc-field-errors` below).
- `installFieldErrors()` (included in the auto-init
  `@hypermedia-components/core/behaviors` bundle).

## Server response (validation failure)

Status: `422 Unprocessable Entity` (any status works — htmx ≥ 2 does
not swap non-2xx responses by default; see “htmx wiring” below).

```html
<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
  <p class="hc-alert__title">Unprocessable Entity</p>
  <ul class="hc-alert__errors">
    <li class="hc-alert__error" data-field="email" data-code="duplicate"
        data-message-key="members.email.duplicate">email: duplicate</li>
  </ul>
  <p class="hc-alert__body">optional hint line</p>
</div>
```

| Part | Required | Meaning |
| --- | --- | --- |
| `.hc-alert[data-variant="error"]` | yes | The summary container (the existing alert component). `role="alert"` makes screen readers announce the swap. |
| `data-hc-field-errors` | yes | Behavior opt-in. Empty value: distribute into `closest('form')`. Non-empty value: a CSS selector for the form (use for out-of-band swaps or an alert rendered outside the form). |
| `.hc-alert__title` | no | Summary line. |
| `.hc-alert__errors` > `.hc-alert__error` | yes (≥ 0 items) | One `<li>` per field error. Repeating a `data-field` is allowed (messages render one per line). |
| `data-field` | yes (per item) | The control's `name`. Radio/checkbox groups resolve via `form.elements` (the group's shared field receives the error). Items naming no known control stay visible in the summary. |
| `data-code` | no | Machine-readable error code; passed to the message resolver as `{code}` and left on the element. |
| `data-message-key` | no | A lookup key for client-side localization. Resolved through the i18n catalog (`setMessages()`); when the catalog has no such key, the `<li>` text renders instead. Servers that localize themselves just emit final text and omit this attribute. |
| `data-message-params` | no | A JSON object of interpolation values for the catalog lookup (e.g. `data-message-params='{"stock": 5}'` for a translation using `{stock}`). Merged over the implicit `{field}`/`{code}` params (item values win). Malformed or non-object JSON is ignored — the fallback chain is unchanged. |
| `data-summary="auto"` | no | Hide the whole alert once every item was distributed (for responses that carry only field errors). |
| `data-focus="none"` | no | Don't focus the first invalid control. |
| any other `data-*` (e.g. `data-error-code`) | no | Passed through untouched — consumer-specific metadata is fine. |

## Client behavior

On `htmx:afterSwap` / `htmx:oobAfterSwap` (plus a `MutationObserver`
fallback and an install-time scan for full-page renders),
`installFieldErrors()`:

1. Clears all previous server errors in the target form.
2. For each `.hc-alert__error[data-field]` whose `data-field` matches a
   control: resolves the message (`data-message-key` via the i18n
   catalog — interpolating `{field}`, `{code}` and any
   `data-message-params` — → `<li>` text → `fieldErrors.unknown`),
   writes it into the
   field's `.hc-field__error` (created after a bare control when there
   is no `.hc-field`), sets `aria-invalid="true"` +
   `aria-describedby` on the control and `data-invalid="true"` on the
   field, and marks the `<li>` `data-distributed="true"` (hidden in
   the summary by CSS).
3. Stamps the alert `data-distributed="all" | "partial" | "none"` and
   focuses the first invalid control.

A field's server error is cleared as soon as the user edits that field
(`input`/`change`), when the form is submitted again or reset, and
before a newly swapped-in fragment is distributed. Native constraint
validation (`installValidation()`) outranks a server error on the same
control — the native message reflects the current value.

## htmx wiring

htmx does not swap non-2xx responses by default. Allow the 422 swap
once, globally:

```js
document.body.addEventListener('htmx:beforeSwap', (event) => {
  if (event.detail.xhr.status === 422) {
    event.detail.shouldSwap = true;
    event.detail.isError = false;
  }
});
```

Alternatively respond `200` with the fragment, or send
`HX-Retarget: #form-errors` + `HX-Reswap: innerHTML` headers to
redirect an arbitrary response into the error container.

## Progressive enhancement

Without JavaScript (full-page re-render of the form + fragment), the
summary alert renders all errors as a plain list — nothing is lost;
distribution is an enhancement. Without htmx, the install-time scan
distributes errors present in the initial HTML.
