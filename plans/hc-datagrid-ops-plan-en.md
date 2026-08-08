# datagrid-ops — column chooser, saved views, CSV import, infinite scroll

Status: **proposed.**
Sixth theme of the business-app gap analysis (2026-08-08): the datagrid
renders and edits well but has no *operations* layer — the things every
line-of-business list grows within a quarter: per-user column choice,
named filter sets, bulk CSV in, and unbounded lists. All four are
**zero-new-JavaScript recipes**: the server owns preferences, views,
validation reports, and pagination; htmx moves the fragments. Baseline:
post-error-paths (30 recipes, 52 behaviors).

## 1. The four recipes

### 1.1 `datagrid-columns` — column chooser

A popover (the shipped [filter-popover](../recipes/filter-popover/)
shell) listing one checkbox per column; **Apply** GETs the grid URL
with `cols=` repeated params; the server re-renders the whole grid
with only those columns (and persists the choice per user if it wants
to). No client column-hiding: the server deciding *which columns
exist* is the hypermedia answer — one round trip, zero state drift,
and printing/exports match the screen for free.

Contract sketch (`GET /items?cols=name&cols=status&…`):

| Case | Response |
| --- | --- |
| any `cols` set | the grid fragment with exactly those columns (order = the server's canonical order); the chooser re-rendered with matching checked states |
| empty/absent `cols` | the server's default column set |
| unknown col name | ignored (the server is the schema) |

checks: the chooser form's checkboxes share `name="cols"` (**error**);
the form GETs the grid target (**error**, resolves); grid target is the
datagrid wrapper (**warn**).

### 1.2 `saved-views` — named filter sets

The current search's querystring, named and kept server-side:

- **Save**: a small form (`name` input) posts `POST /views` with
  `data-hx-include` of the filter form — the server stores the pairs
  and answers the updated views strip.
- **Apply**: each view is a plain `GET` link (`/items?view=quarterly`)
  — bookmarkable, shareable, zero client state.
- **Delete**: `data-hx-delete="/views/quarterly"` on each chip's ×,
  answering the strip.

| Case | Response |
| --- | --- |
| `POST /views` (name + filter pairs) | `200` + the views strip fragment (the new view marked current) |
| duplicate name | `422` + the strip with an inline field error (field-errors shape) |
| `GET /items?view=<name>` | the full list page/fragment with that view's filters applied — **the querystring the view expands to is visible in the rendered filter form** (the server fills the controls), so a view is never opaque |
| `DELETE /views/<name>` | `200` + the strip |

### 1.3 `csv-import` — upload, validate, confirm

The missing wire contract for bulk-in. Two phases, no surprises:

1. **Upload** — the [file-upload](../recipes/file-upload/) form posts
   the CSV. The server parses and validates **without importing**.
2. **Report + confirm** — the response is a validation report fragment:
   a summary line, an error table (`row`, `field`, `message` columns —
   real `<table>`), and — when importable rows exist — a confirm form
   whose hidden `token` references the server-held parsed batch.
   Confirming `POST /imports/<token>/commit` executes exactly what was
   validated; re-uploading replaces the batch.

| Case | Response |
| --- | --- |
| upload, all rows valid | report: "N rows ready" + confirm form (`token`) |
| upload, some rows invalid | report: error table + "import the valid N?" confirm form + the tombstoned count |
| upload, nothing valid / unreadable file | `422` + the error report (or the file-level error) — no confirm form |
| commit with a live token | `200` + result summary + `HX-Trigger` toast; the grid region refreshes (`data-hx-swap-oob` or a triggering event per the data-region recipe) |
| commit with an expired/consumed token | `409` + the "re-upload" hint fragment (tokens are single-shot) |
| no-JS | native multipart post → full-page report (PRG) |

checks: the upload form follows file-upload's rules (reuse via its own
checks — this recipe's `detect` targets the confirm form:
`form[data-hx-post*="/commit"]` with a hidden `token` (**error**)).

### 1.4 `datagrid-infinite` — revealed-sentinel paging

The [datagrid-pager](../recipes/datagrid-pager/) sibling for feeds and
long lists: the last row is a sentinel —

```html
<tr data-hx-get="/items?after=item-40" data-hx-trigger="revealed"
    data-hx-swap="outerHTML" data-hx-select="tbody > tr">
  <td colspan="4"><span class="hc-spinner" aria-hidden="true"></span> Loading…</td>
</tr>
```

— whose `outerHTML` swap replaces it with the next rows **plus the
next sentinel** (or nothing at the end). Cursor (`after=`), not page
numbers: append-only lists shift under offset paging.

| Case | Response |
| --- | --- |
| `GET /items?after=<cursor>` | the next `<tr>` batch + a new sentinel row carrying the next cursor |
| end of list | the batch (possibly empty) with **no** sentinel + an end-of-list row (`aria-live` polite "40 of 40") |
| stale cursor | `200` + the batch from the nearest stable point (cursors are resumable, never 4xx — scrolling is not an error) |

checks: sentinel has `revealed` trigger (**error**), `outerHTML` swap
(**error**), an `aria-live` end-marker documented (**warn** — exists
`[aria-live]`).

## 2. Explicitly not in this theme

- **Client column hiding / reordering** (drag headers): the v0.6/0.7
  "client-side data layers stay out" doctrine holds; reordering is the
  server's `cols=` order.
- **CSV export** — a plain `<a href="/items.csv?view=…">` needs no
  recipe; one line in the datagrid-columns docs covers it.
- Merge/diff UIs for import conflicts (the 409 token answer is
  re-upload).

## 3. Public API surface

Additive → patch: **4 recipe contracts, zero exports, zero attributes,
zero events, zero CSS.** The whole theme is markup + contracts — the
strongest possible statement that the datagrid ops layer is
server-owned.

## 4. PR split (sequential, no stacking)

1. `chore(plans)`: this document.
2. `docs(recipes): bless datagrid-columns` — scaffolds + demo-api +
   docs (en/ja) + browser spec + CHANGELOG.
3. `docs(recipes): bless saved-views` — same shape.
4. `docs(recipes): bless csv-import` — same shape (demo-api parses a
   real 3-line CSV; the browser spec uploads a fixture file).
5. `docs(recipes): bless datagrid-infinite` — same shape; the spec
   scrolls and asserts batch+sentinel replacement and the end marker.

## 5. Risks / notes

- `revealed` fires eagerly for sentinels already in the viewport —
  demo rows must overflow the frame or the demo degenerates to
  load-everything (fixture pins the two-batch flow with a short
  viewport).
- CSV parsing belongs to the server; the demo-api implements a tiny
  strict parser (comma, quoted fields, `\r\n?`) and documents that
  real apps bring their own.
- Saved views are per-user by definition; the demo threads them
  statelessly through the strip fragment (the live-demos doctrine)
  and says so.
