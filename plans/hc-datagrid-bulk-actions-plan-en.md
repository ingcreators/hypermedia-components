# datagrid-bulk-actions — recipe + behavior plan

Status: **shipped — PR 1 (behavior + core sync, #280) and PR 2 (recipe + docs + browser test, #281).**
Net-new scope; bulk actions are not covered by the v0.4/v0.5 plans. The
recipe composes existing blessed patterns (`request-action`,
`confirm-action`, `toast`, the CSRF header convention, the
`datagrid-pager` `innerHTML` swap) and adds one small behavior plus one
core fix. Baseline: core `0.1.6`.

## 1. Goal

A blessed wire contract for **bulk operations on an `hc-datagrid`**:
rows are selected with the grid's existing checkboxes, a selection
actions bar (an `hc-toolbar`) shows the count and holds the action
buttons, and each action POSTs the selected ids over htmx. The server
answers with **the re-rendered rows** (the page's truth) plus a toast —
never with client-side bookkeeping.

Non-goal: cross-page "select all N matching" (Gmail-style banner),
undo, optimistic UI, or server-tracked selection persistence. These are
listed as future extensions in the contract's Notes, not silently
omitted.

## 2. Why this shape (alignment with HC principles)

| HC principle | How the recipe honours it |
| --- | --- |
| State in HTML attributes | Selection lives in `aria-selected` / `data-selected` / checkbox `checked` — the behavior only reads it. |
| htmx owns the network | Ids travel by **native form serialization** (checkboxes `name="ids"`); the bar's buttons are ordinary `data-hx-post` triggers. No new glue for the request. |
| Behaviors stay small | The new behavior only mirrors selection state into the bar (count text, `hidden`). ~100 lines. |
| Progressive enhancement | The `<form method="post" action>` wrapper makes every action a native submit when JS is off; the server branches on `HX-Request` (mutating-form precedent). |
| Server owns the truth | Success and partial failure both return **200 + re-rendered rows + toast** — no status-code choreography. |
| Macros are optional | No macro; the recipe is plain markup. |

## 3. What already exists (reused, not built)

- **Row selection** in `datagrid.js`: checkbox → `aria-selected` /
  `data-selected`, Space toggle, header select-all with `:indeterminate`,
  `hc:datagridselectionchange` `{ selected, total }` on the grid.
- **`hc-checkbox`** `:indeterminate` styling.
- **`hc-toolbar` + `installToolbar`** — the bar gets APG toolbar
  keyboard nav for free (`role="toolbar"`).
- **`confirm-action`** — destructive variant: `data-hc-confirm` +
  `data-hx-trigger="hc:confirmed"` on the same button.
- **`toast`** — result feedback via `HX-Trigger: {"hc:toast":{…}}`.
- **`csrf-header`** — the `<meta name="csrf-token">` convention covers
  the htmx path; the no-JS path uses the framework's hidden field
  (same caveat as mutating-form).
- **`datagrid-pager` contract** — `data-hx-target="#rows"` +
  `data-hx-swap="innerHTML"` (keep the `<tbody>` so the grid's observer
  survives the swap); OOB pager/status fragments.
- **i18n** `{param}` interpolation + `locales/ja.js` (+ the CI
  completeness guard from #226).

## 4. Gap analysis (what is actually new)

1. **Selection actions bar wiring** — new `src/js/datagrid-actions.js`
   exporting `installDatagridActions()` (§6).
2. **Core fix: post-swap selection sync.** The per-grid
   `MutationObserver` on the tbody only calls `rebuild()` + `measure()`
   today (`datagrid.js:839–845`); after a row swap the header
   select-all checkbox and any selection-count consumers go stale. Add:
   sync the select-all `checked`/`indeterminate` state and re-emit
   `hc:datagridselectionchange` after tbody childList mutations. This
   is what makes the bar hide itself after a bulk action replaces the
   rows (new rows arrive unchecked → `{ selected: 0 }`).
3. **i18n key** `datagrid.selected` (en: `"{selected} selected"`,
   ja: `"{selected} 件選択中"`; `{total}` is also passed so overrides
   can render "x of y").
4. Recipe scaffold, docs page, unit + browser tests (§8–9).

## 5. Markup & wire contract

### Client markup (recipe.html sketch)

```html
<form id="bulk" method="post" action="/products/bulk">
  <div class="hc-toolbar" role="toolbar" aria-label="Bulk actions"
       data-hc-datagrid-actions="#grid" hidden>
    <span data-hc-datagrid-count role="status"></span>
    <button class="hc-button" type="submit" name="action" value="archive"
            data-hx-post="/products/bulk"
            data-hx-target="#rows" data-hx-swap="innerHTML"
            data-hx-disabled-elt="this">Archive</button>
    <button class="hc-button" data-variant="error" type="submit"
            name="action" value="delete"
            data-hc-confirm="Delete the selected products?"
            data-hx-trigger="hc:confirmed"
            data-hx-post="/products/bulk"
            data-hx-target="#rows" data-hx-swap="innerHTML"
            data-hx-disabled-elt="this">Delete</button>
  </div>

  <div class="hc-datagrid" id="grid">
    <div class="hc-datagrid__scroll">
      <table class="hc-datagrid__table">
        <thead class="hc-datagrid__head">
          <tr>
            <th class="hc-datagrid__headcell">
              <!-- select-all: NO name attribute — must never serialize -->
              <input type="checkbox" class="hc-checkbox" aria-label="Select all">
            </th>
            …
          </tr>
        </thead>
        <tbody class="hc-datagrid__body" id="rows">
          <tr class="hc-datagrid__row">
            <td class="hc-datagrid__cell">
              <input type="checkbox" class="hc-checkbox"
                     name="ids" value="101" aria-label="Select row 101">
            </td>
            …
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</form>
```

Key points:

- **Ids travel natively.** The form wraps grid + bar; row checkboxes
  are `name="ids" value="<id>"`. htmx includes the enclosing form's
  values on non-GET requests, and unchecked checkboxes never serialize
  — no `data-hx-include`, no JS assembly of ids.
- **The select-all checkbox has no `name`** so it cannot leak into the
  payload.
- **Action discrimination**: each button is `type="submit"
  name="action" value="…"`; htmx also submits the triggering button's
  name/value, and the native submit does the same when JS is off. One
  endpoint, `action` branches server-side. (Per-action URLs are an
  acceptable variant; the contract documents the single-endpoint form.)
- **Double-submit guard**: `data-hx-disabled-elt="this"` (native
  `disabled` during flight); optional `data-hx-indicator` spinner as in
  request-action.
- **Destructive variant** is exactly `confirm-action` composed onto the
  button. No-JS degrades to submit-without-dialog (documented, same as
  mutating-form).

### Server contract

Request (both paths): `POST /products/bulk` with
`ids=101&ids=102&action=archive` (+ CSRF: htmx header per the meta
convention / hidden field on the native path).

| Path | Response |
| --- | --- |
| htmx (`HX-Request: true`) | `200` — body is the **re-rendered rows** for the current page (tbody `innerHTML`, same shape as datagrid-pager) + OOB status/pager fragments + `HX-Trigger: {"hc:toast":{"message":"3 archived","variant":"success"}}`. |
| htmx, partial failure | Same `200` shape — rows show the resulting truth; toast `variant: "warning"` ("3 archived, 1 failed"). No status-code branching. |
| htmx, empty/stale `ids` | Same `200` shape — treat as no-op, `variant: "info"` toast. The hidden-at-zero bar prevents this normally, but the **server must not trust it**. |
| no-JS | `303 Location: /products…` (Post/Redirect/Get; branch on `HX-Request`, mutating-form precedent). Flash messaging is the framework's concern. |

After the swap the new rows arrive unchecked; the grid's post-swap sync
(§4.2) emits `{ selected: 0 }` and the bar hides itself — selection
clears **by construction**, no reset code.

### Composition with datagrid-pager

The core contract is a single-page grid. When composed with the pager,
keep the current page in the form as
`<input type="hidden" id="bulk-page" name="page" value="N">` and have
the server re-render it via `hx-swap-oob="true"` alongside the pager
fragment, so bulk POSTs carry the page the user is looking at. One
Notes subsection; not part of the core markup.

## 6. Behavior design (`src/js/datagrid-actions.js`)

`installDatagridActions(root = document)` — idempotent, returns an
uninstaller; registered in `behaviors.js` auto-init (dependency-free)
and exported from `index.js`.

- A bar is any element with `data-hc-datagrid-actions="<selector>"`;
  the value resolves to its grid (the `.hc-datagrid` container).
- One delegated `hc:datagridselectionchange` listener on the root
  serves all bars; on each event, bars pointing at the emitting grid
  update.
- Updates: the bar's `[data-hc-datagrid-count]` gets
  `t('datagrid.selected', { selected, total })`; the bar gets `hidden`
  when `selected === 0`, removed otherwise.
- Initial state is computed at install by reading the grid's public
  state attributes (`data-selected` records / `aria-selected` rows,
  excluding nested grids) — no install-order coupling with
  `installDatagrid`.
- Authors who want an always-visible bar (or bespoke rendering) listen
  to `hc:datagridselectionchange` themselves; the event is already
  public API. The behavior stays opinionated and small.

The `datagrid.js` change (§4.2) lives in the existing tbody observer
callback: recompute `{selected, total}` over the new rows, set the
select-all checkbox `checked`/`indeterminate`, dispatch
`hc:datagridselectionchange`. Same detail shape; no new event.

## 7. Public API surface (VERSIONING)

All additive → **patch** under the pre-1.0 rules:

- New export: `installDatagridActions`.
- New data attributes: `data-hc-datagrid-actions`,
  `data-hc-datagrid-count`.
- New i18n key: `datagrid.selected` (en + ja).
- New recipe contract: `recipes/datagrid-bulk-actions/contract.md`.
- **No new events** (reuses `hc:datagridselectionchange`), **no new CSS
  classes** (`hc-toolbar` + `hidden`), no deprecations.

## 8. PR split (sequential, each off fresh `origin/main`; no stacking)

Mirrors the CSRF (#249) → mutating-form (#250) pattern.

### PR 1 — `feat(behaviors): datagrid selection actions bar`

- [ ] `src/js/datagrid-actions.js` (`installDatagridActions`).
- [ ] `datagrid.js`: post-swap select-all sync + selection re-emit.
- [ ] `i18n.js` `DEFAULT_MESSAGES` + `locales/ja.js`: `datagrid.selected`.
- [ ] `behaviors.js` registration + `index.js` export.
- [ ] `test/datagrid-actions.test.mjs` (count rendering, hidden-at-zero,
      i18n override, idempotency, uninstall) +
      `test/datagrid.test.mjs` additions (post-swap re-emit, select-all
      sync after row replacement).
- [ ] `components/datagrid.mdx`: "Selection actions bar" section.
- [ ] CHANGELOG (Unreleased / Added); update this plan's Status line.

### PR 2 — `docs(recipes): bless datagrid bulk actions` (after PR 1 merges)

- [ ] `recipes/datagrid-bulk-actions/{recipe,expanded,contract}` —
      Status convention per #236, `Purpose:` line (CLI + README index
      pick it up).
- [ ] `recipes/README.md` index row.
- [ ] `apps/docs/src/content/docs/recipes/datagrid-bulk-actions.mdx`
      (sidebar autogenerates).
- [ ] Browser test: `serve.mjs` mock (`POST /mock/bulk` — with
      `HX-Request`: 200 rows + OOB + toast trigger; without: 303),
      `fixtures/datagrid-bulk-actions.html`,
      `test-browser/datagrid-bulk-actions.spec.mjs` (+ axe, selection
      on and off).
- [ ] CHANGELOG; update this plan's Status line to shipped.

## 9. Test plan

Unit (jsdom): the PR 1 list above; the post-swap re-emit test replaces
tbody children directly and asserts the event + select-all state.

Browser (real htmx, mutating-form spec pattern):

1. Check two rows → bar appears with "2 selected" → Archive → request
   body contains `ids=…&ids=…&action=archive` → rows swap, toast
   shows, bar hides, select-all unchecked.
2. Delete path: confirm dialog gates the request; `hc:confirmed`
   triggers it; cancel sends nothing.
3. Select-all → indeterminate → full-selection states reflected in the
   bar count.
4. Axe scan with bar hidden and visible.

The browser test also **pins the enclosing-form semantics** (htmx
includes form values + button name/value, and native submit stays
suppressed) — that is the contract's foundation, so it must be tested
against real htmx, not assumed.

## 10. Risks / notes

- **htmx submit-button semantics** are the main assumption — pinned by
  the browser test (§9), exactly how mutating-form pinned
  `HX-Redirect`.
- **Multi-row records** (`.hc-datagrid__record`): selection counting
  already works per record; the recipe's expanded form targets the
  single-tbody layout and points record layouts at the same Notes
  stance as datagrid-pager.
- **Selection scope is the page.** Stated in the contract; cross-page
  patterns are future extensions (§1 non-goals).
- The count element uses `role="status"` — selection changes are
  announced politely; the browser axe scan covers both bar states.

## 11. Recipe DoD mapping (v0.4 plan §17.4)

1. Basic HTML — recipe.html. 2. htmx — `data-hx-*` throughout.
3. `data-hc-*` behavior — `data-hc-datagrid-actions` documented.
4. Macro — none (allowed). 5. Expanded HTML — expanded.html.
6. Server contract — contract.md (§5 above). 7. Progressive
enhancement — native form path + 303. 8. Accessibility — toolbar
pattern, `role="status"` count, checkbox labels, confirm dialog focus.
9. Tests — unit + browser (§9).
