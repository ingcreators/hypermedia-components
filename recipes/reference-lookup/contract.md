# reference-lookup — server response contract

Purpose: the master-reference field (customer, item, cost centre): direct code entry for users who know the code, a search dialog for those who don't, and one truth for what the field holds — a hidden id plus a visible code.

## The two-fields-one-truth rule

- The visible **`*_code`** input is what users type and see.
- The hidden **`*_id`** is what the form submits as identity — an
  opaque token (the
  [datagrid-snapshot-pager](../datagrid-snapshot-pager/contract.md)
  key rule: composite keys fold into one token, the client never
  parses it).
- The display **name** is presentation (the hint line) and is never
  submitted.
- **An unresolved code means an empty id.** The classic defect is a
  stale id riding under a corrected code — every unresolved response
  must clear the hidden input.
- The consuming endpoint **re-validates `*_code`/`*_id` on submit
  anyway**: the id is client-supplied and means nothing by itself.

## Required client markup

See recipe.html: an `hc-field` (marked `data-hc-lookup` — a contract
marker, no behavior attaches) with the code input, the 🔍 button, the
hint line, and the hidden id; plus a
[remote-dialog](../remote-dialog/contract.md) root for the dialog.
The dialog plumbing needs `installRemoteDialog()` +
`installCloseDialog()` (both in the auto-init bundle).

- The code input: `data-hx-get="…/resolve"`,
  `data-hx-trigger="change"`, target = **the whole field**,
  `data-hx-swap="outerHTML"`.
- The 🔍 button: `type="button"` (never submits), `aria-haspopup="dialog"`,
  htmx-loads the dialog into the remote-dialog root.

## Endpoints

| Method | URL | Returns |
| --- | --- | --- |
| GET | `/customers/resolve?customer_code=…` | the whole field re-rendered: **200 resolved**, **422 unresolved**, **200 cleared** (empty code) |
| GET | `/customers/lookup` | the search `<dialog>` (remote-dialog shape, `data-hc-close-dialog-on-success`) |
| GET | `/customers/lookup/results?q=…` | the result list fragment (live-search inside the dialog) |
| GET | `/customers/pick?id=…` | the whole field re-rendered, resolved — same fragment as a resolved `/resolve` |

## Resolve (direct entry)

- **Resolved** — `200`, hint = display name, hidden id = the token,
  no `aria-invalid`. Normalising the code (case, width, padding) is
  allowed and encouraged — render the canonical form back.
- **Unresolved** — `422`, `aria-invalid="true"` on the input, the
  message replaces the hint (`hc-field__message`,
  [field-errors](../field-errors/) look), **hidden id empty**.
- **Cleared** — an empty code is not an error: `200`, empty id, hint
  emptied (or "—"). Required-ness is the submit endpoint's business.

htmx sends the input's own value (`?customer_code=…`) because the
input is the triggering element; the `422` needs the standard
one-line `beforeSwap` allowance (see mutating-form).

## The dialog

- A [remote-dialog](../remote-dialog/contract.md) carrying a
  [live-search](../live-search/contract.md) form and a result list.
- **Each selectable row is a button** whose request targets
  **`#customer-field` with `outerHTML`** — picking re-renders the
  field directly; no OOB needed. The successful request also closes
  the dialog (`data-hc-close-dialog-on-success`).
- **Inactive / blocked master rows render visible but refused** —
  `aria-disabled="true"`, no htmx wiring, the reason in the row text
  ("inactive since 2026-04"). Visible-but-refused beats silently
  missing (the [result-cap](../result-cap/contract.md) stance), and
  the search should say when results are capped.
- Authorization applies per row: never list masters the user may not
  reference.

## Progressive enhancement

Without JavaScript the field is a plain code input: the 🔍 button is
`type="button"` and inert, and validation happens at submit time —
which the consuming endpoint performs regardless (see the
two-fields-one-truth rule). No dead ends, one fewer convenience.

## Accessibility

- The 🔍 button carries `aria-haspopup="dialog"` and an `aria-label`
  ("Search customers") — an icon is not a name.
- The unresolved state is `aria-invalid` + a text message adjacent to
  the input; the resolved name lives in the hint the field already
  owns (`hc-field__hint`).
- The dialog titles itself (`aria-labelledby`) and the result list is
  a list of buttons — arrow-key niceties can come from `hc-menu`
  semantics, but plain buttons are the contract.

## Notes

- **Free-text + id is the same recipe with a nullable id** — a field
  that accepts either a master reference or free text keeps the code
  input's raw value on submit and simply leaves the id empty; the
  contract only insists the two never disagree.
- **Multi-select references** (several cost centres) are
  [transfer](../transfer/contract.md) territory, not this field.
- For pure typeahead over a small list, `hc-combobox` is lighter —
  this recipe earns its dialog when the master is large, searchable
  by several columns, or needs the browse experience.
- Compose with [postal-address](../postal-address/contract.md) for
  the one-way variant (code → fields, no dialog).
