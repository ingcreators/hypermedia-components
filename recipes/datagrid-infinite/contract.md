# datagrid-infinite — server response contract

Purpose: revealed-sentinel cursor paging for feeds and long lists — the tbody's last row fetches the next batch when scrolled into view and replaces itself with the rows plus the next sentinel, or the end-of-list marker.

## Required client markup

- **Uncap the grid's own scroll area**: set
  `--hc-datagrid-max-height: none` on the `hc-datagrid` root so the
  *page* is the scroller. The default cap (70vh) turns the grid into an
  overflow container — and htmx's `revealed` is a window-viewport
  trigger, so a sentinel that overflows *inside* the grid never fires
  again (the feed deadlocks after the first batch). Grids that must
  keep their own scrollbar use the `intersect` carve-out below
  instead.

- **Page 1's rows render server-side** — the grid is full without
  JavaScript; the sentinel is the tbody's **last row**.
- The sentinel: `data-hx-get="/items?after=<last id>"`,
  `data-hx-trigger="revealed"`, **`data-hx-swap="outerHTML"`** — it
  replaces *itself*, so the batch and the next sentinel land in its
  slot and the tbody never accumulates loading rows.
- The sentinel's cell spans the table (`colspan`) and is
  `aria-live="polite"` — the same slot becomes the end-of-list marker,
  so "40 of 40" is announced without focus theft.
- The cursor is the **last row's id** (`after=`), never a page number:
  append-only lists shift under offset paging; ids do not.
- `revealed` is a **window-viewport** trigger — feeds scroll the page.
  This recipe targets that case; container-scrolled grids take the
  carve-out below.

## Container-scrolled carve-out

A grid that keeps its own scrollbar (the default
`--hc-datagrid-max-height: 70vh`, or any `overflow-y: scroll` wrapper)
swaps the trigger for the container-aware one — everything else in
this contract is unchanged:

```html
<tr class="hc-datagrid__row"
    data-hx-get="/items?after=item-5"
    data-hx-trigger="intersect once root:#feed-scroll threshold:0.5"
    data-hx-swap="outerHTML">…</tr>
```

- `root:` is a selector for the scroll container (usually
  `.hc-datagrid__scroll` — give it an id); `once` retires the observer
  with its sentinel; `threshold:` sets how much of the row must show.
- **The server must echo the same trigger on every renewed sentinel** —
  thread the root through the cursor URL (`?root=…`) or template it in.
  A renewed sentinel that falls back to `revealed` deadlocks.

Two failure modes the choice decides between:

- **Deadlock** — a `revealed` sentinel that overflows *inside* the grid
  never enters the window viewport: the feed stops after batch one.
- **Chain-load** — on a tall window a *short* list's fresh sentinel is
  already visible, so every batch fires without scrolling and the
  "infinite" list arrives complete. Harmless for real feeds (hundreds
  of rows overflow the first screen), fatal for demos and small
  fixtures.

## Batch — `GET /items?after=<cursor>`

| Case | Response (200 — always) |
| --- | --- |
| more rows exist | the next `<tr>` batch **plus a new sentinel row** carrying the next cursor |
| end of list | the batch (possibly empty) with **no** sentinel, closed by the end-of-list row: `<td colspan aria-live="polite">40 of 40</td>` |
| stale cursor | the batch from the **nearest stable point** — cursors are resumable, never 4xx; scrolling is not an error |

The endpoint answers **just the rows** — the `outerHTML` swap needs
nothing else. A server that can only render full pages adds
`data-hx-select="tbody > tr"` on the sentinel to carve the rows out of
the page; the wire contract is otherwise identical.

## Sentinel rules

- Exactly one sentinel exists at any time — each response either
  renews it (with a fresh cursor) or retires it (end marker). The
  client never creates one.
- Row markup in the batch mirrors the initial rows (same classes,
  `scope="row"` id header) — the swapped rows are indistinguishable
  from the server-rendered page 1.
- `revealed` fires eagerly for a sentinel already in the viewport —
  short lists simply load to the end, which is correct; the pattern
  pays off once rows overflow the viewport.

## Progressive enhancement (no JS)

Page 1 is server-rendered, so the list is useful as delivered. Without
JavaScript the sentinel is an inert loading row; offer a plain
"more" link (`<a href="/items?after=…">`) in or after the table if the
full set must stay reachable — the same endpoint serves both shapes
via the `HX-Request` branch (fragment vs. full page).

## Accessibility

- The sentinel/end cell is one `aria-live="polite"` slot: "Loading…"
  and the final "40 of 40" are announced without stealing focus.
- The spinner is `aria-hidden="true"` — the announced text carries the
  meaning, not the ornament.
- Rows stay real `<tr>`s in one `<tbody>` of a real `<table>` —
  assistive tech sees one growing table, never a stack of tables.

## Notes

- Pair with [datagrid-pager](../datagrid-pager/) when users need to
  *address* a page (jump, share, resume); infinite scroll is for
  feeds where only "more" matters.
- Cursors being resumable means a device waking from sleep with a
  weeks-old sentinel still gets rows, not an error — the nearest
  stable point is the server's call (the id itself, or the closest
  surviving neighbor).
