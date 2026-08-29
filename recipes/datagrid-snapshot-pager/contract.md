# datagrid-snapshot-pager — server response contract

Purpose: freeze a work queue's membership at search time — the form carries every hit's row key, paging re-fetches those rows in that order, and processed rows stay visible as processed instead of shifting page boundaries under the user.

## The problem this fixes

With a live re-query pager ([datagrid-pager](../datagrid-pager/)) a
"pending approval" search of 56 items pages honestly — until the user
approves 10 on page 1. The pending set is now 46; page 2 is sliced
from the *new* set, so ten formerly-page-2 rows slide up onto page 1,
which the user has already left. In a work queue that is a
missed-item bug. This recipe makes the *membership* a snapshot (frozen
at search time) while each row's *state* stays live: approved rows
render approved, and nothing moves until a new search.

## Required client markup

- **One `<form method="post" action="…">`** wraps the snapshot, the
  grid, the status line and the pager (and, when composed with
  [datagrid-bulk-actions](../datagrid-bulk-actions/), the selection
  bar — see expanded.html).
- **The snapshot: one `<input type="hidden" name="keys" value="…">` per
  hit, in display order, outside the swap target.** The server renders
  them at search time. Form serialization is tree-order by spec (the
  [sortable](../sortable/) recipe rests on the same guarantee), so the
  wire order *is* the display order. Never place them inside `#rows` —
  the page swap would destroy the snapshot.
- **Keys are opaque, server-minted tokens.** A composite primary key
  folds into one token (e.g. `base64url(JSON)` of the key columns, or
  a surrogate id); the client echoes tokens verbatim and never
  composes, parses, or delimits them. Tokens are not secrets and not
  proof of authorization.
- **`keys` vs `ids`.** `keys` is the snapshot membership; `ids` (from
  datagrid-bulk-actions) is the rows *selected for an action*. They
  coexist in this form and must never share a name — `keys` is always
  hidden inputs, `ids` is always row checkboxes.
- **The pager is `type="submit"` buttons, `name="page" value="N"`,**
  each with `data-hx-post`, `data-hx-target="#rows"`,
  `data-hx-swap="innerHTML"` (keep the `<tbody>` — the
  [datagrid-pager](../datagrid-pager/contract.md) swap rules apply).
  Buttons, not links: the snapshot travels in the POST body.
- **A hidden `name="page"` field (`id="page-field"`), updated
  out-of-band by every page response**, records the current page so
  *action* requests (which aren't triggered by a pager button) know
  which page to re-render. On a pager click both serialize — the
  button is the later entry, so **read the last `page` value**.

## Endpoints

| Method | URL | Returns |
| --- | --- | --- |
| POST | `/approvals/page` | **200** + the requested page's rows + OOB pager / status / page-field |
| POST | `/approvals/approve` (any action URL) | **200** + the *current* page's rows re-rendered + OOB status (+ `HX-Trigger` toast) — per datagrid-bulk-actions |

## The page request

```text
POST /approvals/page
Content-Type: application/x-www-form-urlencoded

keys=tok_a1&keys=tok_b2&…(all of them, in order)…&page=1&page=2
```

The server must:

1. **Validate the count** — a `keys` list longer than the search cap
   (see [result-cap](../result-cap/contract.md)) is a broken or hostile
   client: respond `422`, not a truncated page.
2. **Re-check authorization for every key, every time.** Keys arrive
   from the client; "it was in the search result once" proves nothing
   now. A key the user may not see renders as a tombstone (or the
   request 403s wholesale, per your policy) — never leaks data.
3. **Slice the page server-side** (`page`, optional `size`) — the
   client never slices.
4. **Return the rows in received-`keys` order.** `WHERE key IN (…)`
   guarantees nothing: either join an ordinal (`JOIN (VALUES (key, 1),
   (key, 2)…) ORDER BY ord` / `unnest WITH ORDINALITY` /
   `ORDER BY FIELD(…)`), or fetch unordered and reorder in the app via
   a key→row map — whose misses are exactly the tombstones (5).
5. **Render vanished rows as tombstones** — a row deleted or reassigned
   since the search stays a `<tr data-tombstone>` ("No longer in this
   queue"), so the page arithmetic and the user's mental count hold.
6. **Render current state** — an approved row renders approved
   (`hc-badge`, checkbox `disabled`), not pending-as-of-search.

## The page response

The requested page's `<tr>` rows (the tbody's `innerHTML`, same column
structure as the header), plus out-of-band fragments:

```html
<tr class="hc-datagrid__row">…</tr>
<!-- …one per key in the page slice, in order, tombstones included… -->

<nav class="hc-pagination" id="pager" data-hx-swap-oob="true" aria-label="Pagination">
  …buttons, aria-current="page" moved…
</nav>
<p id="rows-status" data-hx-swap-oob="true" aria-live="polite">21–40 of 56 (as of search) — 10 approved</p>
<input type="hidden" name="page" value="2" id="page-field" data-hx-swap-oob="true">
```

The status line says "of 56 **(as of search)**" — the count is the
snapshot's, deliberately, and only a new search changes it.

## Composing with bulk actions

The action button POSTs `ids` + `action` (+ the whole form, so `keys`
and the hidden `page` ride along). The response re-renders the current
page's rows — processed rows in their new state — and **leaves the
`keys` inputs alone**: the snapshot still lists 56 items on 3 pages.
Only the current page's rows exist in the DOM, so `ids` can only name
current-page rows.

## Progressive enhancement

The pager buttons are native submits: without htmx the form POSTs to
`action` and the server (no `HX-Request` header) renders the full page
with that page's rows. Page 1 and the snapshot are server-rendered at
search time, so the queue is complete before any JavaScript runs.

## Accessibility

- Pager semantics follow datagrid-pager: `<nav aria-label="Pagination">`,
  `aria-current="page"` on the active button, `aria-disabled="true"`
  ends.
- The status line is `aria-live="polite"` and announces page changes
  and processing progress ("… — 10 approved").
- Tombstone rows keep their identity cell (the user can still see
  *which* item left) and state the reason in text.

## Notes

- **Scope.** Work queues and to-process lists, at work-queue scale —
  cap the search at 500–1,000 keys (result-cap's hard-reject mode) and
  the payload stays tens of KB. For unbounded lookup screens use
  [datagrid-pager](../datagrid-pager/) (live re-query) instead; if you
  need snapshot semantics without a key list, an `as_of` timestamp
  threaded through the query (`pending OR processed_after(as_of)`) is
  the stateless alternative.
- **Reload = new search.** The snapshot lives in the DOM, so there is
  no URL for "page 2 of this snapshot" — bookmarking and sharing are
  deliberately out; document it, don't fight it.
- **Sort or filter change = new snapshot** (a fresh search response
  with fresh keys).
- **`size` (optional)** rides as a form field like `page`; changing it
  resets to page 1.
- A single CSV/JSON field instead of repeated `keys` inputs is a valid
  variant only while keys are simple ids — with opaque tokens,
  repeated inputs need no delimiter rules at all, which is the point.
