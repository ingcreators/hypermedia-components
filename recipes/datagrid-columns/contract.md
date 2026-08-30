# datagrid-columns — server response contract

Purpose: a column chooser for hc-datagrid — a popover form of `cols=` checkboxes GETs the grid URL, and the server re-renders the grid with exactly those columns and the chooser with matching checked states.

## Required client markup

- The chooser is the [filter-popover](../filter-popover/) shell: a
  trigger `<button popovertarget>`, a `.hc-popover[popover]`, and a
  form inside it carrying `data-hc-close-popover-on-success`
  (`installClosePopover()`, auto-installed).
- Every chooser checkbox shares **`name="cols"`**, one per column,
  `value` = the column key — Apply serializes repeated `cols=` params.
- The form **GETs** (`data-hx-get`) the grid URL — choosing columns is
  idempotent navigation, never a mutation — and targets the datagrid
  wrapper (`data-hx-target="#items-grid"`, `innerHTML` default), so
  header and rows always change together.
- Keep `action` + `method="get"` on the form as the no-JS path.
- The chooser form keeps a stable id (`#cols-chooser`) and wraps its
  checkboxes in a stable fieldset (`#cols-fields`) — the fieldset is the
  out-of-band swap anchor for the re-rendered checked states.

## Choose — `GET /items?cols=name&cols=status&…`

| Case | Response (200) |
| --- | --- |
| any `cols` set | the grid fragment (the wrapper's innerHTML: scroll + table) with **exactly those columns, in the submitted order** (see Column rules), plus an OOB `outerHTML` re-render of the chooser **fieldset** with matching checked states (`data-hx-swap-oob="outerHTML"`, same `#cols-fields` id) |
| empty/absent `cols` | the server's default column set — note an all-unchecked Apply serializes no `cols` at all, so it lands here |
| unknown col name | ignored (the server is the schema); if nothing recognized remains, the default set |

## Column rules

- The requested *set* wins, and — since the
  [datagrid-prefs](../datagrid-prefs/) upgrade — so does the requested
  *sequence*: the server renders the columns **in the submitted
  `cols=` order** (a sortable chooser serializes its DOM order).
  Absent/empty params still mean the default set in canonical order,
  and unknown names are still ignored.
- Persisting the choice per user (session, profile) is the server's
  option; the wire contract is the same either way.
- The OOB unit is the fieldset, **never the form**: the form carries
  `data-hc-close-popover-on-success`, and replacing it mid-request
  detaches the attribute carrier before `htmx:afterRequest` — the
  popover would never close. The fieldset must be **complete** (id and
  all checkboxes) — `outerHTML` replaces the whole thing; the form's
  htmx wiring stays untouched around it.

## Progressive enhancement (no JS)

The chooser is a real GET form: without JavaScript, Apply navigates to
`/items?cols=…` and the server renders the full page with those
columns. The grid itself is server-rendered HTML — column choice never
depends on client JavaScript, and print/export match the screen
because the columns simply do not exist client-side.

## Accessibility

- Native checkboxes with visible labels (`hc-checkbox-label`) — the
  chooser is a plain form; no menu semantics to fake.
- Every response keeps the grid a real `<table>` with `scope="col"`
  headers — a removed column is removed for assistive tech too, which
  is the point.
- Closing the popover on success returns focus to the trigger button
  (native popover behavior).

## Notes

- No client column hiding or drag reordering — the server deciding
  which columns exist is the hypermedia answer: one round trip, zero
  state drift.
- CSV export needs no recipe: `<a href="/items.csv?cols=…">` reuses
  the same params, so the file matches the screen.
- Pair with [datagrid-pager](../datagrid-pager/): page links keep
  their `cols=` params so paging preserves the chosen columns.
