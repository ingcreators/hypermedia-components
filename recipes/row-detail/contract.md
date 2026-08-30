# row-detail — server response contract

Purpose: open the record a row is about, work on it, and come back to the same list — with the same conditions, the same sort, the same page, and the row you left from still under the cursor.

## The link is a real link, in the identity cell

```html
<tr class="hc-datagrid__row" id="row-4903" data-row-no="137">
  <td class="hc-datagrid__cell">
    <input class="hc-checkbox" type="checkbox" name="ids" value="4903"
           aria-label="Select order SO-4903">
  </td>
  <th class="hc-datagrid__cell" scope="row">
    <a href="/orders/4903" data-hc-row-link>SO-4903</a>
  </th>
```

- The **identity** column carries it — the thing the row *is*, not a
  verb appended to it. Being an ordinary `<a href>` buys middle-click,
  ⌘-click, copy-address, Back, the keyboard, and the no-JS path; a
  click handler re-implements all of that badly.
- **One link per row is marked** `data-hc-row-link`. A row with several
  links (an order, its customer, a document) must say which one is the
  record — guessing "the first" turns a column reorder into a change of
  behavior.
- `installRowLink()` adds the only thing the anchor cannot do itself:
  **Enter anywhere on the row**. Editing wins where it applies (the
  datagrid cancels the event before opening an editor), a control that
  owns its Enter keeps it, and a modifier means the user asked for
  something else.

**Do not stretch the link over the row.** The `::after`-overlay trick
is right for a card and wrong here: the datagrid ships text selection,
range selection and TSV copy, and a transparent anchor over the cells
eats all three. For pointer users on wide rows, add a trailing chevron
link in a narrow last column — same href, an `aria-label` naming the
record.

**Do not let `data-hx-get` swallow the navigation.** htmx takes the
click, so an `hx-get` aimed at the record page itself turns the
identity link into a peek-only row with a decorative href — no plain
click ever reaches the page rendering. Layering on the identity link
is legitimate only as the deliberate peek below: the `hx-get` is an
explicit peek variant (`?peek=1`), the `href` stays the canonical
record page, and the peek links to that page. If clicking should mean
*open the record*, give the peek its own control and leave the name a
plain link.

## Coming back

| State | Restored by |
| --- | --- |
| conditions, sort, columns, page | the list URL |
| **which row** | `#row-<id>` — `installDatagrid()` lands the active cell there and scrolls **the grid's own scrollport** |
| selection ticks | only when the trip started from a selection (see below) |
| scroll offset | nothing, deliberately — focus on the row beats a pixel offset, which points at a different row after any insert |
| an in-progress inline edit | nothing — [unsaved-changes](../unsaved-changes/) warns before leaving |

The detail therefore needs the list URL. In order of preference:

1. **The app knows it** (one list per record type) and appends the
   fragment. Nothing to carry.
2. **The link carries it** — `?from=<url-encoded list url>` — when a
   record is reachable from several lists. **Validate it server-side**
   (same origin, a known route) before echoing it into a link; an
   unvalidated `from` is an open redirect.

Never reconstruct the list from "the last search" held in a session: a
user with two tabs has two lists, and shared state gets one of them
wrong.

## Returning fresh beats returning identical

| Case | Return |
| --- | --- |
| nothing changed | **Back** — the browser's own history is the cheapest correct restore |
| something was saved | **`303`** to the list URL + `#row-<id>` |

The redirect is not ceremony: a restored snapshot shows the data as it
was *before the user's own edit*, which is the one stale value they are
guaranteed to notice, and the pager totals go with it.

If row links are **boosted**, htmx restores the list from its history
snapshot and reintroduces exactly that staleness. Either leave row
links unboosted — a real navigation, and Back is perfect — or set
`data-hx-history="false"` on the list so a restore re-fetches.

## Peek or page: one URL, two renderings

```html
<a href="/orders/4903" data-hc-row-link
   data-hx-get="/orders/4903?peek=1"
   data-hx-target="#record-dialog"
   data-hx-swap="innerHTML">SO-4903</a>
```

- The `href` stays canonical, so JavaScript failing means a full page,
  not a dead row.
- The overlay is the [remote-dialog](../remote-dialog/) recipe, and it
  **contains a link to the full page** — a peek that traps you is worse
  than no peek.
- Editing inside the peek answers the row out of band
  ([inline-edit](../inline-edit/)), so the list behind it stays true.

## Walking a sequence

The detail carries prev / next, and the sequence is whatever the user
was looking at.

| Sequence | Wire | Notes |
| --- | --- | --- |
| the **result set** (default) | `?seq=list&i=<ordinal>` | the server resolves neighbours by re-running the list query, so "next" crosses a page boundary without the client knowing pages exist. The ordinal is the one `data-row-no` shows |
| the **selection** | `POST /orders/selections` (the `ids` checkboxes) → `303` to the first record with `?seq=<token>&i=1` | ids in a URL run out at a few hundred, so this reuses the escape hatch the filter recipes ship for long value lists |

The selection token names an **ordered snapshot**, and the screen says
so: *Record 3 of 12 selected at 14:32*. A "selection" that changes
under the user is not one.

- **A missing record is a step, not a wall.** If number 7 was deleted
  or moved out of scope mid-walk, render that step as a tombstone with
  Next still working; aborting at the first gap makes the feature
  untrustworthy exactly when data is moving.
- **An expired token fails closed** — `410` and a link back to the list
  — never a silent fallback to walking everything.

### Where the walk goes — not the bottom

Prev / next belong in the record's **header**, beside its identity and
the way back to the list. They are not pagination of the content below
them, and treating them like it costs the user the thing they came for:

- The decision to move on is usually made **before** reading to the
  bottom — glance, judge, next. A control that requires scrolling to
  reach turns a two-second judgement into a scroll each time.
- The detail body scrolls, so a bottom control either **scrolls away**
  (useless exactly when the queue is long) or needs a second fixed
  strip — chrome bought for a rarely-reached position.
- After a save the `303` lands the user at the top; the next move
  should be where they already are.

A long detail may repeat prev / next at the bottom as a **secondary**
copy. Both copies are the same links — no state, nothing to keep in
sync — and the header one stays primary.

Within the header:

```text
← Back to list        …record identity…        1 / 15,129  ‹  ›
```

the **exit** goes at the start — where a person looks to get out — and
the **walk** (position, then prev / next) at the end, where the pointer
already is and where moving on is the frequent act. It is the
arrangement every mail client has already taught users, and the same
rule the list's navigation strip follows.

### A grid inside a detail pages itself

A detail screen often holds grids of its own (lines, shipments,
history), and each pages **directly under itself**, in its own strip —
never in a page-level footer:

- A page-level pager on a screen with three grids cannot say **which
  grid it pages**. The list template's rule ("navigation under the data
  it moves through") is about *that* data, not about the page.
- Only the grid that carries [`hc-fill`](../../apps/docs/src/content/docs/fundamentals/layout.mdx)
  takes the remaining height; the others keep their own caps, and each
  keeps its own pager, count and empty state.

So the bottom of a detail screen carries **its actions** (Save,
Cancel), not navigation.

## Endpoints

| Case | Response |
| --- | --- |
| `GET /orders/<id>` | the detail page (or fragment for `?peek=1`), with **Back to list** pointing at the list URL + `#row-<id>` |
| `GET /orders/<id>?seq=list&i=<n>` | the same, plus prev / next hrefs resolved by re-running the list query |
| `POST /orders/selections` (`ids`) | **`303`** to the first record of the ordered snapshot (`?seq=<token>&i=1`) |
| `GET /orders/<id>?seq=<token>&i=<n>` | the record at that position, the counter, and prev / next within the snapshot |
| a record in the snapshot that no longer exists | `200` + the tombstone step; Next still works |
| an expired or unknown token | **`410`** + a link back to the list |
| `POST /orders/<id>` (save) | **`303`** to the list URL + `#row-<id>` |
| an invalid `from` (foreign origin, unknown route) | ignore it and use the canonical list URL — never echo it into a link |

## Progressive enhancement (no JS)

Every part is a link or a form: the row link navigates, prev / next are
links, Back to list is a link, "Open selected" is a submit button on
the selection form. `installRowLink()` only adds Enter, and
`installDatagrid()` only moves the active cell on arrival.

## Accessibility

- The link text is the **identity** (`SO-4903`); a trailing chevron
  link, if present, carries an `aria-label` naming the record so it is
  not "link, link, link" in a list of controls.
- Do not nest interactive elements inside the row link.
- The landing row is focused, not merely scrolled to: keyboard and
  screen-reader users arrive where the eye does.
- The counter (*Record 3 of 12*) is text, not a title attribute.

## Notes

- The row link and the checkbox are different affordances: one opens,
  one selects. A row-sized click target has nowhere to put the second.
- `data-row-no` is a **locator**, the id is the **identity** — a walk
  or a report names the id and displays the ordinal.
