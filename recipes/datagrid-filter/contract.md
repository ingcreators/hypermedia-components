# datagrid-filter — server response contract

Purpose: per-column filter entry for hc-datagrid — a filter-popover off a header cell's filter button GETs the grid URL with namespaced `f-<col>` params, and the server re-renders the grid filtered, the trigger marked `data-filtered`, and the form's checked states matching.

## Required client markup

- Each filterable column's header cell holds a trigger
  `<button popovertarget>` (give it an `aria-label` naming the column,
  e.g. "Filter Status") opening a [filter-popover](../filter-popover/)
  shell: a `.hc-popover[popover]` with a form carrying
  `data-hc-close-popover-on-success` (`installClosePopover()`,
  auto-installed).
- The form's controls are **namespaced per column**: `name="f-<col>"`
  (here `f-status`), one checkbox per distinct value — Apply serializes
  repeated `f-status=` params. The server picks the control type per
  column (checkbox list, range pair, text) — the names stay `f-<col>`.
- The form **GETs** (`data-hx-get`) the grid URL — filtering is
  idempotent navigation, never a mutation — and targets the datagrid
  wrapper (`data-hx-target="#items-grid"`, `innerHTML` default), so
  header (with the trigger's filtered state) and rows change together.
- Keep `action` + `method="get"` on the form as the no-JS path.
- The trigger button and the form's fieldset keep stable ids
  (`#filter-status-trigger`, `#filter-status-fields`) — the trigger
  comes back *inside* the grid fragment; the fieldset is the
  out-of-band swap anchor.

## Filter — `GET /items?f-status=active&…`

| Case | Response (200) |
| --- | --- |
| any `f-<col>` set | the grid fragment (the wrapper's innerHTML: scroll + table) with only matching rows; the trigger in the header renders **`data-filtered`** with an `aria-label` naming the active values (e.g. "Filter Status — active: Active"); plus an OOB `outerHTML` re-render of the form's **fieldset** with matching checked states (`data-hx-swap-oob="outerHTML"`, same `#filter-status-fields` id) |
| empty/absent `f-<col>` | the unfiltered grid — an all-unchecked Apply serializes no `f-status` at all, so it lands here; the trigger renders without `data-filtered` |
| unknown value | ignored (the server is the schema); if nothing recognized remains, the unfiltered grid |

## Filter rules

- **Filters compose across columns**: each column's form carries the
  *other* columns' active filters as server-rendered
  `<input type="hidden" name="f-<col>" value="…">` — so applying the
  Status filter preserves the Owner filter. The querystring is the
  whole filter state; name it with
  [saved-views](../saved-views/) for one-click recall.
- The OOB unit is the fieldset, **never the form**: the form carries
  `data-hc-close-popover-on-success`, and replacing it mid-request
  detaches the attribute carrier before `htmx:afterRequest` — the
  popover would never close. The fieldset must be **complete** —
  `outerHTML` replaces the whole thing.
- `data-filtered` is a semantic marker (style it, or lean on a variant
  switch like `data-variant="primary"` as in the expanded state); the
  `aria-label` carries the same information for assistive tech.
- Sorting and paging params ride along untouched — the filter form only
  owns its `f-<col>` names.

## Progressive enhancement (no JS)

The filter is a real GET form: without JavaScript, Apply navigates to
`/items?f-status=…` and the server renders the full page filtered. The
grid itself is server-rendered HTML — filtering never depends on
client JavaScript.

## Accessibility

- Native checkboxes with visible labels (`hc-checkbox-label`) — the
  filter is a plain form; no menu semantics to fake.
- The trigger's `aria-label` names the column and, when filtered, the
  active values — the state is announced, not just tinted.
- Closing the popover on success returns focus to the trigger button
  (native popover behavior).

## Notes

- No client-side filtering — the server renders the filtered page; one
  round trip, zero state drift, and print/export match the screen.
- The popover *content* is server-rendered too: distinct values, value
  counts, or a range control are the server's choice per column — the
  wire stays `f-<col>` params either way.
- Pair with [datagrid-pager](../datagrid-pager/): page links keep
  their `f-<col>` params so paging preserves the filter.
