# datagrid-prefs — server response contract

Purpose: per-user column preferences (widths, order) persisted the hypermedia way — the behavior mirrors resize commits into hidden inputs, htmx autosaves them, and the server renders the remembered state back on later loads.

## Required client markup

### Widths

- Resizable columns declare `data-resizable` + `data-col` as usual.
- A prefs form holds one
  `<input type="hidden" name="w-<col>" data-hc-datagrid-width="<col>">`
  per column to remember. `installDatagrid()` writes every **committed**
  resize into the matching input **before** dispatching
  `hc:datagridcolumnresize` — so an event-triggered request serializes
  the fresh value. Scope: inputs inside the grid's closest `<form>`,
  else document-wide.
- The form autosaves with a debounced event trigger:
  `data-hx-post` + `data-hx-trigger="hc:datagridcolumnresize from:body
  delay:500ms"` + `data-hx-include="this"`, targeting a `role="status"`
  fragment.

### Order

- The [datagrid-columns](../datagrid-columns/) chooser, upgraded with
  [`installSortable()`](../sortable/): the fieldset is `data-hc-sortable`
  and each label carries a `data-hc-sortable-handle` button. Checkbox
  serialization follows DOM order, so **the submitted `cols=` sequence
  is the column order** — the upgraded datagrid-columns contract.

## Save widths — `POST /prefs/columns` (`w-<col>` pairs)

| Case | Response (200) |
| --- | --- |
| any `w-<col>` set | the status fragment (`role="status"` text, e.g. "Saved — Name 220px"); the server persists per user |
| invalid value (non-numeric, out of range) | clamp or ignore server-side; still `200` + status — a width is a preference, never an error |
| no-JS | native POST → `303` PRG back to the grid page |

**Rendering back is the other half of the contract**: on later loads
the server renders remembered widths as inline
`style="inline-size: <w>px; max-inline-size: <w>px"` + `data-resized`
on the column's header and cells (exactly what the behavior would have
set) — the width is a server-rendered fact, so print/export and other
sessions agree with the screen.

## Apply order — `GET /items?cols=status&cols=name&…`

As [datagrid-columns](../datagrid-columns/), with the order upgrade:
the grid renders the requested columns **in the submitted sequence**
(unknown names still ignored; empty still the default set). Persisting
the order per user is the server's option, same as the set.

## Progressive enhancement (no JS)

Widths degrade gracefully — without JavaScript there is no client
resize, and the server-rendered widths still apply. The order chooser
stays a real GET form; without `installSortable()` the checkboxes still
choose the set (order falls back to the rendered sequence).

## Accessibility

- The autosave status is a `role="status"` live region — saves are
  announced, not silent.
- The sortable handles are real buttons with the keyboard grammar of
  [`installSortable()`](../sortable/) (Space/Enter grabs, arrows move,
  Escape cancels).

## Notes

- The behavior never fetches — the mirror-input + event-trigger pair is
  the whole bridge (same doctrine as the upload-progress bridge).
- Storage shape is the server's business (session, profile table); the
  wire is only `w-<col>` pairs and the `cols=` sequence.
- Pair with [saved-views](../saved-views/) for named filter sets — the
  column prefs are per-user defaults underneath any view.
