# From a row to its detail screen — and back

Status: **approved** (2026-08-12). Sibling of the
[list screen controls plan](hc-list-screen-controls-plan-en.md) and the
[bulk-error surface plan](hc-bulk-error-surface-plan-en.md).

The kit documents how a list *is* a URL, how conditions and sort and
columns ride in it, and how a row reports its own state. What it has
never documented is the single most-used interaction on a business
list: **open this record**, work on it, come back, open the next one.

Every app invents it, and most inventions lose the same three things:
the middle-click, the Back button, and the place in the list.

## 1. The link is a real link, in the identity cell

```html
<tr class="hc-datagrid__row" id="row-4903" aria-rowindex="137">
  <td class="hc-datagrid__cell" data-frozen>
    <input class="hc-checkbox" type="checkbox" name="ids" value="4903"
           aria-label="Select order SO-4903">
  </td>
  <th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row">
    <a href="/orders/4903" data-hc-row-link>SO-4903</a>
  </th>
  …
```

The **identity** column carries it — the thing the row *is*, not a
verb bolted onto the end. Being an ordinary `<a href>` buys, for free,
everything a click handler has to re-implement badly: middle-click and
⌘-click open a tab, right-click copies the address, Back returns,
the keyboard works, crawlers and no-JS clients work, and the browser
shows the destination on hover.

**Do not stretch the link over the whole row.** The pattern (a
`::after` overlay filling the row) is right for a card and wrong here:
this grid ships text selection, range selection and TSV copy, and a
transparent anchor on top of the cells eats all three. A whole-row
click target also has nowhere to put the checkbox, the inline editor,
or a second link.

What replaces "click anywhere":

- **Enter opens the row** when the active cell is not editable.
  `installDatagrid()` already owns Enter for editing (`Enter` / `F2` on
  `[data-editable]`); on every other cell it is free, and following the
  row's `[data-hc-row-link]` is what a grid user expects.
- **An optional trailing affordance** — a chevron link in a last,
  narrow column — for touch and for wide rows where the identity has
  scrolled out of view. Same href, `aria-label` naming the record.

## 2. Coming back is the part everyone drops

The list is already a URL carrying its conditions, sort, columns and
page. What Back does not restore is **which row you came from**, so the
user lands at the top of five thousand rows and hunts.

The convention is one fragment:

```text
/orders?f-ship=@week-start..&sort=-ship,order&page=4#row-4903
```

`installDatagrid()` already lands the active cell on the row a fragment
names (`focusHashRow()`), so this needs no new client code — only that
the detail screen's **Back to list** link is the list URL it arrived
with, plus `#row-<id>`.

The detail therefore needs to *know* that URL. Two honest options, in
order of preference:

1. **The app knows the canonical list URL** (one list per record type)
   and appends the fragment. Nothing to carry.
2. **The link carries it** — `?from=<url-encoded list url>` — when a
   record is reachable from several lists and the back link must go to
   the right one. Validate it server-side (same-origin, known route)
   before echoing it into a link; an unvalidated `from` is an open
   redirect.

Never reconstruct the list from memory of "the last search". A user
with two tabs open has two lists, and shared state gets one of them
wrong.

### What actually comes back, and what does not

Everything that is *the question* is already in the URL, so it returns
by construction:

| State | Restored by | Notes |
| --- | --- | --- |
| conditions, sort, column set, page | the list URL | this is what the whole programme put there |
| **which row** | `#row-<id>` | `focusHashRow()` sets the active cell, and `setActive()` already calls `scrollIntoView({block: 'nearest'})` — which scrolls **the grid's own scrollport**, not the window |
| **selection ticks** | `?sel=<token>` on the back link | only when the detail was opened *from* a selection (below). Otherwise selection is transient by design |
| scroll offset | *deliberately not* | focus on the row beats a pixel offset: after an insert or a delete the same offset points at a different row |
| expanded groups / tree rows | *nothing yet* | today expansion is client-side only. A handful belongs in the URL (`expand=4903,4911`); "always expand to level 2" is a preference, not a URL |
| an in-progress inline edit | *never* | `installDirtyGuard()` warns before leaving instead |

**Selection survives the trip when it was the reason for the trip.** If
the user ticked twelve rows and opened one, the back link carries the
same token the walk uses, and the server re-renders those checkboxes
checked. Nothing is stored on the client, and the list is still a URL
somebody else can open — they just get it unticked.

### Returning fresh beats returning identical

There are two return paths and they are not the same trip:

- **Nothing changed → Back.** The browser's own history (bfcache where
  it applies) is the cheapest possible restore, and it is correct
  because nothing moved.
- **Something was saved → `303` to the list URL + `#row-<id>`.** The
  classic post/redirect/get, and the reason to prefer it over Back is
  truth: the row you just edited must show its new values, and the
  totals in the pager must be right. A restored snapshot shows the data
  as it was before your own edit — the one stale value the user is
  guaranteed to notice.

:::caution
If row links are **boosted**, htmx restores the list from its history
snapshot, which reintroduces exactly that staleness. Either leave row
links unboosted (a real navigation, and Back is perfect), or mark the
list `hx-history="false"` so a restore re-fetches instead of replaying
a snapshot.
:::

## 3. Peek or page: one URL, two renderings

A "peek" (open the record without leaving the list) is a **rendering**
of the same resource, never a different one:

```html
<a href="/orders/4903" data-hc-row-link
   data-hx-get="/orders/4903?peek=1"
   data-hx-target="#record-dialog"
   data-hx-swap="innerHTML">SO-4903</a>
```

- The `href` stays canonical, so every browser affordance still works
  and JavaScript failing means a full page, not a dead row.
- The dialog is the [remote-dialog](https://ingcreators.com/hypermedia-components/recipes/remote-dialog/) recipe,
  and it **contains a link to the full page** — a peek that traps you
  is worse than no peek.
- Editing inside the peek answers the row out of band, so the list
  behind it stays true (the `inline-edit` / `datagrid-edit-errors`
  contracts already say how).

## 4. Walking a sequence

Opening one record is half the job. Business work is a *queue*: forty
orders to approve, twelve failed rows to correct. The detail screen
gets prev / next, and **the sequence is whatever the user was looking
at**.

```text
‹ Previous   Record 3 of 12   Next ›        Back to list
```

Two sequences, one shape:

### The result set

The default. The list query *is* the sequence, and the ordinal is the
position — the same number
[`aria-rowindex`](hc-bulk-error-surface-plan-en.md) puts on the row:

```text
/orders/4903?seq=list&from=<list url>&i=137
```

The server resolves neighbours by running the same query — it already
knows the sort and the conditions — so the walk survives paging, and
"next" crosses a page boundary without the client knowing pages exist.

### The selection

The one the user asked for: **tick twelve rows, then walk only those.**
The selection is not a query, so it cannot be re-derived; it has to be
carried. Ids in the URL work until they do not (a few hundred
identifiers and the URL is over the limit), so this reuses the escape
hatch the filter recipes already ship for long value lists:

```text
POST /orders/selections     ids=4901&ids=4903&ids=4907…
  → 303 /orders/4901?seq=<token>&i=1
```

- **The toolbar action is "Open selected (12)"** — a submit button on
  the existing selection form, so the ids arrive the way every other
  bulk action already sends them. Nothing new on the client.
- The token names an **ordered snapshot**, and the detail says so:
  *Record 3 of 12 selected at 14:32*. A snapshot is honest; a
  "selection" that silently changes under the user is not.
- **A missing record is a step, not a wall.** If number 7 was deleted
  or moved out of scope mid-walk, show that step as a tombstone with
  Next still working. Aborting the walk at the first gap makes the
  feature untrustworthy exactly when data is moving.
- **An expired token fails closed** — `410` plus a link back to the
  list — and never falls back to walking everything. Widening the set
  is the failure mode this whole programme refuses.
- **Back to list** returns to the list URL with `#row-<id>` for the
  record last seen, so the walk and the list agree about where the user
  is.

Both sequences answer the same markup, so a screen supports either by
changing what it puts in `seq=`.

## 5. What this is not

- **Not a router.** Every link is a real URL answered by the server;
  the client stores nothing about the walk.
- **Not a wizard.** Prev / next moves between *records*, never between
  steps of one form — the [multi-step-form](https://ingcreators.com/hypermedia-components/recipes/multi-step-form/)
  recipe owns that.
- **Not modal-only.** A record reachable only through a dialog cannot
  be linked, bookmarked, or opened in a second tab.

## Work items

| # | Content |
| --- | --- |
| 1 | `row-detail` recipe: the identity-cell link, the `#row-<id>` return, the validated `from`, and why the row is not one big link |
| 2 | `installRowLink()` / `data-hc-row-link` — Enter on a non-editable cell follows the row's primary link; pointer users get the optional trailing chevron |
| 3 | The peek rendering (`?peek=1` + remote-dialog, canonical href kept, "open full page" inside) |
| 4 | Walking the **result set**: `seq=list` + `i=<ordinal>`, neighbours resolved by re-running the query, page boundaries invisible |
| 5 | Walking the **selection**: `POST /orders/selections` → `303` with a token, snapshot semantics, tombstone step, `410` on expiry, "Open selected (N)" in the toolbar |
| 6 | The return trip: the state table, the selection token round trip (checkboxes re-checked server-side), `303` + `#row-<id>` after a save, and the boosted-history caveat |
| 7 | Template + demo adoption, and a browser spec: Enter opens, middle-click still works, Back lands on the row **inside the grid's scrollport**, next crosses a page boundary |
