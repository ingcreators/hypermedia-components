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

## The applied-conditions bar

Column popovers are how a condition is *created*; they are a poor way to
find one again. In a wide grid the column may be scrolled out of view,
and plenty of conditions do not belong to a column at all. So the
response also renders an **`hc-filterbar`** — the read-out of the whole
querystring, and its edit surface.

| Element | What the server renders |
| --- | --- |
| one `.hc-filterbar__item` per applied condition | in the order the user added them, if you track it; otherwise the column order |
| `__label` / `__op` / `__value` | the field's label, the operator used, and the value **summarised** — `3 values` for a multi-value condition, never three chips and never the whole list |
| the chip's `popovertarget` | an editor holding **only that condition**, pre-filled, submitting the same `f-<col>` names as the column popover |
| `__remove` `href` | the current URL **minus that one param**, everything else intact |
| `__clear` `href` | the URL with no `f-` params (sort, columns and page size stay) |

The bar rides with the grid fragment, so one response updates rows,
header triggers and bar together. Give it a stable id and swap it out of
band if your layout puts it outside the grid wrapper.

**The server owns the text.** Only it knows the label, the operator and
how many values a condition holds — the client never composes this
string.

**Removing is navigation.** `__remove` and `__clear` are real links to
real URLs, so dropping a condition works without JavaScript, is
shareable, and **Back puts it back**. Add `data-hx-get` to swap in
place; the `href` stays the no-JS path.

## Empty results

A list filtered to nothing is a dead end, and the more conditions are
applied the less obvious which one is at fault. Answer the empty grid
with the way out:

```html
<p role="status">
  No orders match these 4 conditions.
  <a href="/orders?f-ship-from=2026-08-01&f-status=open">Drop “Buyer code”</a>
</p>
```

Name the condition to drop — the **newest** one, since it is what the
user just did — and make it a link to the URL without it. The bar is
right above, so the offer and the controls read as one thing.

## Multi-value conditions

A condition can hold many values — the wire already says so, since
`f-<col>` repeats. What business users need is a way to *enter* them: a
column of order numbers pasted out of a spreadsheet.

```html
<textarea class="hc-input" name="f-buyer" data-hc-multi="lines">ZAB001000000
ZAB001000001
ZAB001000002</textarea>
```

`installMultiValue()` splits each line into its own entry on the
**`formdata` event**, so `f-buyer=…&f-buyer=…&f-buyer=…` reaches the
server through htmx and a native submit alike. Values are trimmed and
de-duplicated, and a control emptied of everything contributes no entry
at all — an empty condition is not a condition.

**Accept the raw value too.** Without JavaScript the textarea submits
one entry containing newlines. That is a perfectly good request; split
it server-side and the no-JS path stays honest.

Pick the control by the job: a textarea takes a paste of unknown size,
while [`hc-multicombobox`](../multicombobox/) is for choosing from a
small known set with suggestions.

The bar summarises what it cannot show — `Buyer code is 3 values` — and
the chip's editor holds the list.

### When the list outgrows a URL

Repeats are fine into the low hundreds. Past that a querystring stops
fitting through proxies and servers (~2 KB in the wild, 8 KB is a
typical default), and the answer is not a longer URL but a **condition
set**:

| Step | Request |
| --- | --- |
| store | `POST /orders/condition-sets` with the values → `201` + an id |
| filter | `GET /orders?f-buyer-set=<id>` |

The id lives in the querystring, so sharing, bookmarking, paging and
saved views keep working unchanged.

**An unknown or expired set must not fail open.** Answer `404`, or
re-ask for the list — never fall back to "no filter". Dropping a
condition silently shows the user *more* data than they asked for,
which in a business screen is a safety problem, not a cosmetic one. The
same rule governs how long a set lives: long enough that a saved view
using one still resolves, or the view must fail visibly.

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
- **Every entry point writes the same params.** The column popover, a
  bar chip's editor and a hand-typed URL are three doors into one wire;
  there is no second filter format to keep in step.

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
