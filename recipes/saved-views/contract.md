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
| `PUT /views/<name>` (the current filter pairs) | `200` + the strip — **update in place**, so a view can be corrected without being deleted and recreated |
| `POST /views/<name>/default` | `200` + the strip with that view marked default |
| `DELETE /views/<name>` | `200` + the strip |
| bare list URL with a default set | **`303`** to the default view's URL — never a hidden filter; the address bar shows the real conditions |

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
- Storage, limits and **scope** (personal / shared / default) are the
  server's business; the wire contract is the same either way. See
  *Scope* below — do not assume every view belongs to one person.

## Modified state

Applying a view and then changing one condition is the commonest thing a
user does with saved views, and the least served: nothing said whether
what you are looking at is still the view. The user either loses the
tweak or believes the saved version has changed.

The apply link therefore names the view it came from
(`?…&from-view=<name>`), and the server **compares the incoming
conditions with the stored ones**. When they differ the strip renders
the current chip as modified and offers all three ways out:

```html
<li class="hc-chip" aria-current="true" data-modified>
  <a href="…">Overdue shipments</a>
  <span class="hc-badge" data-variant="warning">Modified</span>
  <button data-hx-put="/views/Overdue%20shipments" data-hx-include="#filters">Update</button>
  <button …>Save as new…</button>
  <a href="/items?view=Overdue%20shipments">Reset</a>
</li>
```

Compare **normalized** querystrings — same params, sorted, repeated
values in a stable order — or two identical questions will look
different because one was assembled by a form and the other by a link.

## What a view captures

A view is a question you want to ask again, not a place you were
standing:

| In | Out |
| --- | --- |
| filter conditions | page number |
| sort (ordered, multi-column) | row selection |
| column set / order, if the view pins them | scroll position |
| page size, grouping | expanded rows |

Page number is the dangerous one: "page 7 of yesterday's data" means
nothing, and a shared link lands the recipient somewhere else entirely.

**Columns are a preference first, a view's business second.** A user's
column choice follows them between screens and devices, so it is stored
per user, not in every URL. A view **may** pin a column set — "Shipping
check" usually means the filters *and* the columns for that job — and
when it does, applying it visibly changes the columns and offers a way
back. Resolution order is always **URL → user preference → app
default**, so a shared link beats a stored layout; that is what makes
sharing work.

## Scope

Views are not necessarily personal. A department standard is the normal
case in business software, so **the server owns scope** and the strip
says which is which: a shared view is labelled, and editing one is a
distinct, visible action rather than something that happens because
somebody pressed Update. Offer "copy to my views" instead of silently
forking.

## Applying re-authorises

A stored view can contain conditions the user has since lost the right
to run — a cost centre they no longer belong to, a region that changed
hands. **Re-check on every apply and fail closed**: answer `403` (or
re-ask), never quietly drop the condition. Dropping it would widen the
result set, which is the one failure mode a business screen cannot
afford.

## Ordering and overflow

A strip is comfortable at five views and unusable at thirty. Render
**pinned and recently-used first**, cap the strip, and put the rest
behind a menu. The cap is the server's call, and it should say what it
did rather than silently truncating.

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
