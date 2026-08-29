# result-cap — server response contract

Purpose: bound what one search may return — cap+1 detection, "cap+" counts, and a persistent truncation banner (or a hard reject) instead of an unbounded result set.

## Required client markup

- An ordinary search form (see [live-search](../live-search/contract.md))
  or filter bar targeting a results region (`data-hx-target="#results"`,
  `data-hx-swap="innerHTML"`), with a real `action` as the no-JS path.
- Nothing else — the recipe is a server contract. The banner below is
  **server-rendered inside the results fragment**, so it appears and
  disappears with the result set it describes.
- `data-hc-result-cap` on the banner is a **contract marker only** — no
  behavior attaches to it; `hc validate` uses it to find the banner.

## The cap+1 check

Query with `LIMIT cap + 1` (one row more than the cap — e.g. 1,001 for
a 1,000 cap):

- **≤ cap rows returned** — render them all with the exact count.
- **cap+1 rows returned** — the search is over the cap. Do **not** run
  `COUNT(*)` to learn the real total (that is the query you introduced
  the cap to avoid); render the count as "**cap+**" (`1,000+ results`)
  and branch into one of the two modes below.

## Mode A — truncated (general lookup screens)

Render the **first cap rows** (paged as usual — compose with
[datagrid-pager](../datagrid-pager/contract.md)) plus a persistent
warning banner at the top of the results region:

```html
<div class="hc-alert" data-variant="warning" role="status" data-hc-result-cap>
  <p class="hc-alert__title">Showing the first 1,000 results.</p>
  <p class="hc-alert__body">More than 1,000 orders match, sorted by
    order date (oldest first). Narrow the filters to see the rest,
    or export the full set to CSV.</p>
</div>
<p aria-live="polite">1,000+ results</p>
```

The banner **must name the sort order** — "the first 1,000" is
meaningless until the user knows first *by what* — and should offer the
escape hatches: narrow the filters, or export the full set (exports run
under their own, much larger, usually asynchronous limit).

## Mode B — hard reject (process-everything work queues)

Same check; over the cap, render **no rows** — an `hc-empty` block
asking the user to narrow:

```html
<div class="hc-empty" data-hc-result-cap role="status">
  <div class="hc-empty__media" aria-hidden="true">🔍</div>
  <p class="hc-empty__title">More than 1,000 items match.</p>
  <p class="hc-empty__description">Narrow the search to at most 1,000
    items, then work the list.</p>
</div>
```

Prefer this mode when the screen's premise is *every item gets
processed* (approval queues, triage inboxes): a truncated queue
silently hides the items past the cap from every operator, and "the
oldest 1,000 first" only mitigates that if the sort guarantees eventual
coverage. Truncated mode fits lookup screens where the user is hunting
for *one* record.

## Responses

| Request | Response |
| --- | --- |
| search, ≤ cap hits | `200` — rows + exact count, no banner |
| search, over the cap (mode A) | `200` — first cap rows + warning banner + "cap+" count |
| search, over the cap (mode B) | `200` — no rows + `hc-empty` reject block |
| search, 0 hits | `200` — the normal empty state (see live-search) |

Over-cap is **always `200`** — it is a user state, not an error, and
the same branch renders the no-JS full page. (htmx ≥ 2 would not swap
a non-2xx anyway, which would strand the *previous* results on screen —
exactly wrong for a banner that describes the current ones.) Reserve
non-2xx for actual failures.

## Progressive enhancement

The form's `action` performs a full-page GET without JavaScript; the
server branches on `HX-Request` (fragment vs. full page) and renders
the same banner/reject markup in both. No behavior is involved
anywhere in this recipe.

## Accessibility

- The banner is **`role="status"`, not `role="alert"`** — truncation is
  a persistent condition to be noticed, not an interruption; `status`
  announces politely and the banner stays for re-reading. Keep the
  count line's `aria-live="polite"` outside the banner so page changes
  announce independently.
- Never a toast (it disappears while the condition persists) and never
  a modal dialog (it blocks, then vanishes without leaving the state
  visible).

## Notes

- **Choosing the cap.** Interactive search screens commonly cap at
  500–2,000. Pair the cap with a page size of 20–50 (user-selectable
  20/50/100). Screens that feed a
  [datagrid-snapshot-pager](../datagrid-snapshot-pager/contract.md)
  snapshot should cap lower (500–1,000) — the cap bounds the snapshot's
  key list.
- The count element pairs naturally with datagrid-pager's out-of-band
  `#rows-status` — over the cap, its text stays "1,000+" on every page
  (`1–100 of 1,000+`).
