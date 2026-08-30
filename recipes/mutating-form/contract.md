# mutating-form — server response contract

Purpose: the canonical composition for a form that mutates server state
over htmx — inline 4xx field errors, a success redirect, a
double-submit guard with a busy spinner, an optional confirmed
destructive variant, and a no-JS degradation path. It composes three
already-blessed pieces (the [field-errors](../field-errors/) fragment,
the [request-action](../request-action/) busy/disabled pattern, and the
[confirm-action](../confirm-action/) gate) into one form a code
generator can emit verbatim. Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

- A `<form>` that keeps **both** `method`/`action` and `data-hx-post`
  (same URL), so a no-JS submit still works.
- An in-form error container the 4xx fragment swaps into
  (`<div id="member-form-errors"></div>` + `data-hx-target` /
  `data-hx-swap="innerHTML"`).
- `installFieldErrors()` (auto-init `@hypermedia-components/core/behaviors`
  bundle). For the confirmed variant, also `installConfirm()`.
- The one-time `htmx:beforeSwap` allowance for the 4xx swap (see
  *htmx wiring* below) — unless you answer `200` with the fragment.

## Endpoints

| Method | URL                    | Returns |
| ------ | ---------------------- | ------- |
| POST   | `/members`             | **303** + `Location` (non-htmx), or **422** + field-errors fragment, or **200/204** + `HX-Redirect` (htmx success) |
| POST   | `/members/:id/delete`  | Same success/failure contract; gated by the confirm dialog client-side |

## Success — branch on `HX-Request`

Every htmx request carries `HX-Request: true`. The handler branches so
both callers get correct post/redirect/get:

```text
POST /members
  (no HX-Request)   → 303 See Other,  Location: /members/42
  HX-Request: true  → 204 No Content,  HX-Redirect: /members/42
```

- **Non-htmx (no-JS):** a plain `303 Location`. The browser follows it
  natively — classic post/redirect/get.
- **htmx:** an **empty body** with **`HX-Redirect: /members/42`**. htmx
  performs a full `window.location` navigation — the same destination,
  no DOM swap, no glue behavior. (`200` with an empty body works too;
  `204` is tidier.)

Why `HX-Redirect` and not `HX-Location`: `HX-Location` does an
AJAX-style boosted navigation (swap into `<body>` + history push),
which is *not* post/redirect/get and drags full-page-response concerns
into a form post. `HX-Redirect` is the conservative, native-equivalent
answer. Do **not** let htmx transparently follow a raw `303` — it would
swap the *redirected page* into the form's target.

## Failure — inline field errors (4xx)

Status `422 Unprocessable Entity`, body = the canonical
[field-errors](../field-errors/) fragment, swapped into
`#member-form-errors`:

```html
<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
  <p class="hc-alert__title">Please fix the errors below.</p>
  <ul class="hc-alert__errors">
    <li class="hc-alert__error" data-field="email" data-code="duplicate"
        data-message-key="members.email.duplicate">email: already registered</li>
  </ul>
</div>
```

`installFieldErrors()` distributes each item to the field it names
(`aria-invalid`, `aria-describedby`, `.hc-field__error`, focus the
first), and leaves items naming no control visible in the summary. See
the [field-errors contract](../field-errors/contract.md) for the full
fragment spec (i18n keys, `data-message-params`, the boolean-field
group resolution, …).

## Double-submit guard and busy indicator

Part of the same form, htmx-native — no custom JS:

- `data-hx-disabled-elt="find button[type=submit]"` adds the native
  `disabled` attribute to the submit button for the duration of the
  request, so a double-click can't post twice.
- `data-hx-indicator="find .hc-spinner"` reveals the
  `.hc-spinner.htmx-indicator` inside the `.hc-action` wrapper while the
  request is in flight (`hc.htmx.css` styles the states).

## Confirmed destructive variant

For a delete (or any destructive submit), gate it with the
[confirm-action](../confirm-action/) pattern: `data-hc-confirm` on the
submit button and `data-hx-trigger="hc:confirmed"` on the form, so htmx
fires on the confirm event rather than the native submit. Everything
else (errors, redirect, busy/disabled) is identical. The no-JS path
still posts through the plain submit — without the confirmation step,
which is the safe degradation for a server that re-validates anyway.

## Progressive enhancement (no JS)

The form keeps `method`/`action`, so when the behaviors never load:

- **Submit** posts natively. The server returns the full page
  re-rendered with the field-errors fragment inline (the summary alert
  renders every error as a plain list — nothing is lost), or a `303`
  redirect on success.
- The double-submit guard and spinner are htmx enhancements; their
  absence doesn't break the submit.
- The confirmed variant submits without the confirmation dialog.

## htmx wiring

htmx ≥ 2 does not swap non-2xx responses by default. Allow the 422 swap
once, globally:

```js
document.body.addEventListener('htmx:beforeSwap', (event) => {
  if (event.detail.xhr.status === 422) {
    event.detail.shouldSwap = true;
    event.detail.isError = false;
  }
});
```

The one alternative that needs no client configuration is answering
`200` with the fragment. `HX-Retarget: #member-form-errors` +
`HX-Reswap: innerHTML` only steer *where and how* a swap lands; in
htmx ≥ 2 they don't license one, so a `422` carrying them still needs
the allowance above (or an `htmx.config.responseHandling` rule).

## Accessibility

- `role="alert"` on the summary makes the swap announced.
  `installFieldErrors()` sets `aria-invalid` + `aria-describedby` on
  each named control and focuses the first invalid one.
- The submit button's `disabled` state during the request is the native
  attribute, so assistive tech reports it.
- Keep a real `<label class="hc-field__label" for="…">` per control.
