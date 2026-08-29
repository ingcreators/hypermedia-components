# result-cap + datagrid-snapshot-pager — bounded search results and frozen work queues

Status: **plan — PR 1 (this doc), PR 2 (`result-cap`), PR 3
(`datagrid-snapshot-pager`, after PR 2 merges).**

Motivation (2026-08-29 design discussion): the approval-queue paging
problem. A user searches "pending approval", gets 56 hits paged 20 at a
time, approves 10 on page 1 — and with the stock
`datagrid-pager` contract the next page click re-runs the query against
the now-46-row pending set: the count shifts, page boundaries move, and
former rows 21–30 silently slide onto page 1 where the user never
returns. In a work queue that is a missed-approval bug, not a UI
nicety. The companion problem is unbounded searches: a queue screen
must cap what one search can return before a snapshot of it can exist
at all.

Two zero-new-JS, zero-new-CSS contract recipes, composable but
independently useful:

| Recipe | Concern |
| --- | --- |
| `result-cap` | Bound any search: `LIMIT cap+1` detection, "5,000+" counts, a persistent truncation banner (or a hard reject) — never a toast, never a dialog. |
| `datagrid-snapshot-pager` | Freeze a work queue's membership at search time: the form carries the row keys, paging re-fetches *those* rows in *that* order, processed rows stay visible as processed. |

## 1. Goal markup

### result-cap (truncated mode)

```html
<div id="results">
  <!-- Rendered by the server ONLY when hit cap+1 rows: -->
  <div class="hc-alert" data-variant="warning" role="status">
    <p class="hc-alert__title">Showing the first 5,000 results.</p>
    <p class="hc-alert__body">The search matched more than 5,000
      records (sorted by request date, oldest first). Narrow the
      filters to see the rest, or export to CSV.</p>
  </div>
  <p id="rows-status" aria-live="polite">5,000+ results</p>
  <div class="hc-datagrid">…first 5,000, paged as usual…</div>
</div>
```

### datagrid-snapshot-pager

```html
<form method="post" action="/approvals/page">
  <!-- The snapshot: every row key, in display order, minted by the
       server at search time. Outside the swap target, so paging and
       row updates never disturb it. -->
  <input type="hidden" name="keys" value="tok_a1">
  <input type="hidden" name="keys" value="tok_b2">
  <!-- …one per hit (≤ cap)… -->

  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead>…</thead>
        <tbody class="hc-datagrid__body" id="rows"><!-- page 1, server-rendered --></tbody>
      </table>
    </div>
  </div>

  <p id="rows-status" aria-live="polite">1–20 of 56 (as of search)</p>
  <nav class="hc-pagination" id="pager" aria-label="Pagination">
    <button class="hc-pagination__item" name="page" value="1"
            data-hx-post="/approvals/page" data-hx-target="#rows"
            data-hx-swap="innerHTML" aria-current="page">1</button>
    <button class="hc-pagination__item" name="page" value="2"
            data-hx-post="/approvals/page" data-hx-target="#rows"
            data-hx-swap="innerHTML">2</button>
    <button class="hc-pagination__item" name="page" value="3"
            data-hx-post="/approvals/page" data-hx-target="#rows"
            data-hx-swap="innerHTML">3</button>
  </nav>
</form>
```

## 2. Design decisions (argued in the discussion, fixed here)

- **Snapshot semantics beat live re-query for work queues.** Membership
  freezes at search time; row *state* stays live (approved rows render
  approved, actions disabled). Removal happens on re-search only.
- **The DOM is the snapshot store.** No server session, no client JS
  state: hidden inputs carry the keys, native form serialization
  submits them. Order is guaranteed — the HTML entry-list algorithm
  walks submittable elements in tree order (the `sortable` recipe
  already relies on exactly this).
- **`keys` vs `ids`.** `ids` stays what `datagrid-bulk-actions` made it:
  the rows *selected for an action*. `keys` is the snapshot membership —
  the two coexist in one form, so they must not share a name. Documented
  as a naming rule in both contracts.
- **Keys are opaque server-minted tokens.** Composite primary keys and
  arbitrary characters fold into e.g. `base64url(JSON)`; the client
  echoes tokens verbatim, never composes or parses them. Delimiter
  design is thereby out of contract.
- **Server slices, client doesn't.** The whole `keys` list + `page`
  (+ optional `size`) travels on every page request; the server cuts
  out the page. Keeps the client zero-JS (no slicing logic) and the
  no-JS fallback a plain form POST.
- **`WHERE key IN (…)` does not order.** The contract requires
  returning rows in received-`keys` order and names the two standard
  implementations (ordinal join / app-side reorder via a key→row map);
  the app-side map doubles as tombstone detection.
- **Vanished rows render tombstones** ("no longer in this queue"), so
  the page arithmetic and the user's mental count both survive.
- **Cap detection is `LIMIT cap+1`,** display is "cap+", no `COUNT(*)`.
- **Over-cap is a state, not an error: HTTP 200.** htmx ≥ 2 doesn't
  swap non-2xx, and the no-JS fallback renders the same branch. The
  *page* endpoint, by contrast, 422s on a `keys` list over the cap
  (that's a broken client, not a user state).
- **Banner, not toast, not dialog.** Truncation is a persistent
  condition; it must stay visible (`role="status"`, `hc-alert`
  warning). Hard-reject mode (render no rows, demand narrowing) is the
  documented alternative and the recommended default for
  process-everything queues; truncated mode fits general lookup
  screens. Truncated mode MUST name its sort order.
- **Recommended caps.** Interactive search: the 500–2,000 industry
  band; snapshot queues: 500–1,000 (keys payload stays tens of KB).
  Page size: 20–50 default, user-selectable 20/50/100; a `size` change
  resets to page 1.

## 3. Server contracts (summary — full text in each contract.md)

### result-cap

| Request | Response |
| --- | --- |
| search, ≤ cap hits | `200`, rows + exact count, no banner |
| search, cap+1 hits (truncated mode) | `200`, first cap rows + warning `hc-alert` + "cap+" status |
| search, cap+1 hits (hard-reject mode) | `200`, no rows + `hc-empty`/alert asking to narrow |

### datagrid-snapshot-pager

| Request | Response |
| --- | --- |
| `POST /approvals/page` with `keys[]` (all, in order) + `page` (+ `size`) | `200`, that page's `<tr>`s in `keys` order, current state, tombstones for vanished rows + OOB pager (`aria-current` moved) + OOB status |
| `keys[]` longer than the cap | `422` (broken client) |
| any key the user may not see | `404`/`403` per row policy — authz re-checked every request |

Notes shared by both: pair with `datagrid-bulk-actions` in one form
(action responses swap rows to their processed state and leave `keys`
untouched); reload = new search (page URLs don't exist — documented
trade-off); sort/filter change = new snapshot.

## 4. Deliverables per recipe PR

The standard recipe kit, mirroring the last eight recipe PRs:

1. `recipes/<name>/` — `recipe.html`, `expanded.html`, `contract.md`,
   `checks.json` (CLI discovers recipes; no CLI code change).
2. Demo API: `apps/docs/demo-api/recipes/<name>.mjs` + registration in
   `index.mjs` + `test/<name>.test.mjs`. Stateless per the demo-API
   design rules (snapshot lives in the submitted keys, so statelessness
   is free).
3. Docs: `recipes/<name>.mdx` EN + `ja/` twin, live demo
   `<Name>Demo.astro`, rows in `recipes/README.md` and the docs recipe
   index (EN + ja).
4. `CHANGELOG.md` Unreleased entries.

checks.json sketches: `result-cap` — banner is `role="status"` +
`data-variant="warning"` on `.hc-alert` (error), status element exists
(warn). `datagrid-snapshot-pager` — `keys` inputs not inside the swap
target (error, `closest`), pager buttons carry `name="page"` (error),
`data-hx-swap="innerHTML"` (error, same rule as `datagrid-pager`),
`ids`≠`keys` name collision guard (error: no `[name="keys"]` checkbox).

## 5. Out of scope

- No new behaviors, CSS, or tokens. `hc-alert`, `hc-empty`,
  `hc-pagination`, `hc-datagrid` cover the UI.
- No server-side snapshot store (tokens/temp tables) and no `as_of`
  timestamp variant — both are described in contract Notes as
  alternatives with their trade-offs, not specified.
- Page-size preference persistence (`datagrid-prefs` covers it).
