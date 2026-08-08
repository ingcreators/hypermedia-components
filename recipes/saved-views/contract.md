# saved-views — server response contract

Purpose: named filter sets — the current search's querystring saved under a name; save/delete re-render the server-owned views strip, applying is a plain GET link, and the server fills the filter controls so a view is never opaque.

## Required client markup

- The **filter form** carries a stable id (`#filters`) — it is both
  the `data-hx-include` anchor for saving and the out-of-band swap
  anchor the apply response re-renders with the values filled.
- The **save form** posts the name plus the filter pairs:
  `data-hx-post="/views"`, `data-hx-include="#filters"`, a labeled
  `name` input, and `data-hx-target="#views"` (the strip region,
  `innerHTML` default). Keep `method="post"` + `action` as the no-JS
  path, and `data-hx-disabled-elt` as the double-submit guard.
- The **views strip** is a server-rendered region (`<div id="views">`)
  holding a real list (`<ul class="hc-chips">`): each chip is a plain
  apply link (`href="/items?view=<name>"`, enhanced with
  `data-hx-get` → `#results`) plus a delete button
  (`data-hx-delete="/views/<name>"` → `#views`) whose accessible name
  names the view.
- The **results region** (`#results`) is `aria-live="polite"`.

## Endpoints

| Case | Response |
| --- | --- |
| `POST /views` (name + filter pairs) | `200` + the strip fragment (the `#views` contents), the new chip marked current (`aria-current="true"`) |
| duplicate name | `422` + the strip with an inline field error (the [field-errors](../field-errors/) shape, `data-field="name"`); swaps via the standard 422 allowance |
| `GET /items?view=<name>` | the list fragment for `#results` with that view's filters applied, **plus an OOB `outerHTML` re-render of the filter form with the controls filled** — the querystring the view expands to is visible, so a view is never opaque |
| `DELETE /views/<name>` | `200` + the strip |

## Strip rules

- The strip re-render is the region's complete contents (the `<ul>`,
  or an empty-state line when no views remain) — the client never
  splices chips.
- The view's name is its key: URL-encode it in the `DELETE` path and
  the `view=` param. The name renders as typed in the chip label and
  the delete button's accessible name.
- `aria-current="true"` marks the chip the strip considers current
  (the one just saved); the server may also mark the applied view when
  it re-renders the strip on navigation.
- Views are **per user** by definition — storage, limits, and sharing
  semantics are the server's business; the wire contract is the same.

## Progressive enhancement (no JS)

Apply links are real hrefs — bookmarkable, shareable, and full-page
navigations without JavaScript. The save form keeps `method="post"` +
`action="/views"`, so a native submit works (answer a full page or a
classic 303 post/redirect/get). The delete button is htmx-only; wrap
it in a tiny POST form if deletion must work without JavaScript.

## Accessibility

- The strip is a real list — `ul.hc-chips` / `li.hc-chip` announces
  as "list, N items".
- Every delete button has an accessible name naming its view
  ("Delete view quarterly"), not a bare ×.
- The results region is `aria-live="polite"`, so applying a view
  announces the new list without stealing focus; the duplicate-name
  error is a `role="alert"` field-errors fragment.
- The OOB filter re-render keeps ids stable, so `<label for>`
  associations survive.

## Notes

- The querystring **is** the view — never an opaque server blob. The
  apply response filling the controls is what keeps views editable:
  apply, tweak a field, save under a new name.
- Saving is silent beyond the strip re-render; pair with the
  [toast](../toast/) recipe (`HX-Trigger`) if saves should be
  announced.
- Deleting a view is low-stakes (the querystring still exists in any
  bookmark); add [confirm-action](../confirm-action/) gating only if
  your views encode real work.
