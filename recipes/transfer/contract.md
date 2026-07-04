# transfer — server response contract

Purpose: a dual listbox (assign / unassign members, permissions,
categories) as a **server round trip** — membership lives on the
server, every move is a POST that re-renders the whole form. Zero
custom JavaScript: checkboxes carry the ids, submit buttons carry the
verb, htmx swaps the form. Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

- **One `<form class="hc-transfer" method="post" action="…">`** with
  `data-hx-post` (same URL), `data-hx-target="this"`, and
  `data-hx-swap="outerHTML"` — the form is the swap unit.
- **Two panes** (`<fieldset class="hc-transfer__pane">` with a
  `<legend class="hc-transfer__title">`): the *available* pane's
  checkboxes are `name="available" value="<id>"`, the *assigned*
  pane's are `name="assigned" value="<id>"`. Unchecked boxes never
  serialize — no JS payload assembly.
- **Two submit buttons** (`type="submit"`, `name="action"`,
  `value="add"` / `value="remove"`) with `data-hx-disabled-elt="this"`.
  htmx submits the triggering button's name/value; the native submit
  does the same when JS is off. Glyph-only buttons need an
  `aria-label`; wrap the glyph in `.hc-transfer__arrow` so it mirrors
  under RTL.

## Endpoints

| Method | URL                  | Returns |
| ------ | -------------------- | ------- |
| POST   | `/roles/42/members`  | **200** + the re-rendered `<form class="hc-transfer">` (htmx), or **303** + `Location` back to the page (non-htmx) |

## The request

```text
POST /roles/42/members
Content-Type: application/x-www-form-urlencoded

available=7&available=9&action=add
```

`action=add` moves the checked `available` ids into the assigned set;
`action=remove` moves the checked `assigned` ids out. Ids from the
other pane may appear in the payload (a user can check both sides) —
the server reads only the pane matching the verb. Requests are
idempotent per id: adding an already-assigned id is a no-op, not an
error.

CSRF: the htmx path uses the page-level `<meta name="csrf-token">`
header convention (`installCsrfHeader()`); the no-JS path needs the
framework's hidden-field mechanism, as in
[mutating-form](../mutating-form/).

## Success — `200` with the re-rendered form (htmx)

Branch on `HX-Request`. The response body is the **whole
`<form class="hc-transfer">`** re-rendered from the server's truth:
both panes updated, `.hc-transfer__count` values refreshed, all
checkboxes unchecked. Because the swap is `outerHTML` on the form,
ids, focus targets, and htmx attributes come back consistent.

Non-htmx: **303** + `Location` back to the page (POST-redirect-GET).

## Validation failure — `422` with the re-rendered form

Same fragment shape with an inline `.hc-alert[role="alert"]` as the
form's first child (e.g. "Select at least one member"). Panes reflect
the unchanged server truth. htmx swaps 4xx responses per the kit's
[error-handling convention](../mutating-form/).

## Progressive enhancement

Without JavaScript the form posts natively and the server answers
303 → GET → full page with the updated form: the pattern works
end-to-end, htmx only removes the full-page reload.
