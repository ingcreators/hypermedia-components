# datagrid-bulk-actions — server response contract

Purpose: run one action against many datagrid rows at once — select with
the grid's checkboxes, act from a selection bar, POST the ids over htmx.
It composes already-blessed pieces (the datagrid's row selection +
[`installDatagridActions()`](../../packages/core/src/js/datagrid-actions.js),
the [datagrid-pager](../datagrid-pager/) `innerHTML` swap, the
[confirm-action](../confirm-action/) gate, the [toast](../toast/)
`HX-Trigger`, and the [csrf](../../packages/core/src/js/csrf-header.js)
meta convention) into one form a code generator can emit verbatim.
Stable under the [markup versioning policy](../../VERSIONING.md).

## Required client markup

- **One `<form method="post" action="…">` wraps the grid and the bar.**
  Row checkboxes are `name="ids" value="<id>"` — the ids travel by
  native form serialization: htmx includes the enclosing form's values
  on non-GET requests, and unchecked checkboxes never serialize. No
  `data-hx-include`, no JS payload assembly.
- **The header select-all checkbox has no `name`** so it can never leak
  into the payload.
- Each action is a `type="submit"` button with `name="action"
  value="<verb>"` plus `data-hx-post`, `data-hx-target="#rows"`,
  `data-hx-swap="innerHTML"` (the [datagrid-pager](../datagrid-pager/)
  swap rules apply — keep the `<tbody>`), and
  `data-hx-disabled-elt="this"`. htmx submits the triggering button's
  name/value, so one endpoint can branch on `action`; the native submit
  does the same when JS is off. Per-action URLs are an acceptable
  variant.
- The selection bar is any element with
  `data-hc-datagrid-actions="<grid selector>"`; its
  `[data-hc-datagrid-count]` child shows the translated count (i18n key
  `datagrid.selected`) and the bar is `hidden` while nothing is
  selected. `installDatagridActions()` ships in the auto-init
  `@hypermedia-components/core/behaviors` bundle; for the confirmed
  variant, also `installConfirm()`.

## Endpoints

| Method | URL              | Returns |
| ------ | ---------------- | ------- |
| POST   | `/products/bulk` | **200** + re-rendered rows + OOB fragments + `HX-Trigger` toast (htmx), or **303** + `Location` (non-htmx) |

## The request

```text
POST /products/bulk
Content-Type: application/x-www-form-urlencoded

ids=101&ids=102&action=archive
```

CSRF: the htmx path uses the page-level
`<meta name="csrf-token">` header convention (`installCsrfHeader()`);
the no-JS path needs the framework's hidden-field mechanism, exactly as
in [mutating-form](../mutating-form/).

## Success (htmx) — always `200` with the re-rendered rows

Branch on `HX-Request` (every htmx request carries `HX-Request: true`).
The htmx answer is the **page's truth**: the current rows as the
`innerHTML` of the tbody (same shape as
[datagrid-pager](../datagrid-pager/contract.md) — same column structure
as the header), plus out-of-band status/pager fragments, plus a toast:

```text
HTTP/1.1 200 OK
HX-Trigger: {"hc:toast":{"message":"3 archived","variant":"success"}}
```

```html
<tr class="hc-datagrid__row">
  <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" name="ids" value="101" aria-label="Select Anvil"></td>
  <th class="hc-datagrid__cell" scope="row">101</th>
  <td class="hc-datagrid__cell">Anvil</td>
  <td class="hc-datagrid__cell">Archived</td>
</tr>
<!-- …one <tr> per remaining row… -->
<p id="rows-status" data-hx-swap-oob="true" aria-live="polite">42 products</p>
```

There is **no status-code choreography** — the same `200` shape covers
every outcome; only the rows and the toast differ:

- **Full success** — rows reflect the result; toast
  `variant: "success"` (`"3 archived"`).
- **Partial failure** — rows reflect what actually happened; toast
  `variant: "warning"` (`"3 archived, 1 failed"`).
- **Empty or stale `ids`** — treat as a no-op: current rows unchanged,
  toast `variant: "info"`. The hidden-at-zero bar prevents an empty
  POST normally, but **the server must not trust it** — re-validate ids
  server-side (they can be stale after another user's change).

The swapped-in rows arrive with fresh checkbox state, and the grid
re-derives selection from them (re-syncing the select-all checkbox and
re-emitting `hc:datagridselectionchange`), so the selection clears and
the bar hides **by construction** — no reset code anywhere.

**This describes the best-effort branch — the action ran.** An action
with **all-or-nothing** semantics answers a *refusal* instead
(`409` / `422`, rows unchanged), and there the same mechanism becomes a
hazard: clearing the selection throws away the user's hand-picked rows
when nothing happened. Render the refusal's rows with their checkboxes
**`checked`** — the checkboxes are the selection truth, so that is the
whole fix. The
[datagrid-bulk-errors](../datagrid-bulk-errors/) recipe documents both
execution modes, the pre-flight that avoids the refusal in the first
place, and how failures are reported at scale.

## Success (no JS) — `303` post/redirect/get

```text
POST /products/bulk
  (no HX-Request)   → 303 See Other,  Location: /products?page=3
  HX-Request: true  → 200 (rows + OOB + HX-Trigger, above)
```

The browser follows the `303` natively — classic post/redirect/get,
same branching as [mutating-form](../mutating-form/contract.md). Result
messaging on this path is the framework's flash mechanism.

## Confirmed destructive variant

Gate a destructive bulk action (delete) with the
[confirm-action](../confirm-action/) pattern **on the button**:
`data-hc-confirm="…"` plus `data-hx-trigger="hc:confirmed"`. htmx then
fires on the confirm event instead of the click; the response contract
is unchanged. The no-JS path submits without the dialog — the safe
degradation for a server that re-validates anyway.

## Progressive enhancement (no JS)

The form keeps `method`/`action` and the buttons are real submit
buttons with `name`/`value`, so without htmx or behaviors:

- Checking rows and pressing an action posts
  `ids=…&action=…` natively; the server answers `303`.
- The selection bar stays as authored. Ship it **without** the `hidden`
  attribute if it must be usable with JS off (the behavior hides it at
  install when nothing is selected); with `hidden` in the markup the
  actions are simply unavailable until JS loads — choose per app.
- The count and the select-all convenience are enhancements; their
  absence breaks nothing.

## Composition with the pager

Selection is **per page** (the [datagrid-pager](../datagrid-pager/)
stance). When the two recipes compose, keep the current page in the
form and let the server re-render it out-of-band alongside the pager:

```html
<input type="hidden" id="bulk-page" name="page" value="3" data-hx-swap-oob="true">
```

so bulk POSTs carry the page the user is looking at and the server can
re-render that window.

## Accessibility

- The bar is a `role="toolbar"` `hc-toolbar` with an `aria-label`
  (`installToolbar()` provides the roving-tabindex arrow-key pattern).
- The count element gets a default `role="status"` from
  `installDatagridActions()`, so selection changes are announced
  politely without markup.
- Row checkboxes need per-row `aria-label`s (`"Select Anvil"`), the
  select-all its own (`"Select all"`); its `:indeterminate` mixed state
  is native and re-synced after swaps.
- The in-flight `disabled` on the action button is the native
  attribute (`data-hx-disabled-elt="this"`), reported by assistive
  tech; error/success feedback arrives as a toast (`role="status"` /
  `role="alert"` per variant — see the [toast](../toast/) contract).

## Notes

- **Cross-page selection** ("select all N matching", Gmail-style
  banner), undo, and server-tracked selection persistence are future
  extensions, deliberately out of scope here.
- **Multi-row records** (`.hc-datagrid__record` tbodies): selection and
  counting already work per record, but this recipe's swap targets the
  standard one-`<tbody>` layout — for record layouts swap a wrapping
  region and let the document-level observer re-initialise the grid
  (same stance as datagrid-pager).
