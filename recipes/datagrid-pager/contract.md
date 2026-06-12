# datagrid-pager — server response contract

Purpose: paginate an `hc-datagrid` from the server with htmx. The grid is
built for paged data — the server owns the data window; htmx swaps one
page of rows; `installDatagrid()` re-initialises the swapped rows.

## Required client markup

- The grid's `<tbody class="hc-datagrid__body" id="rows">` is the swap
  target, with `data-hx-target="#rows"` and **`data-hx-swap="innerHTML"`**.
- The pager is an `hc-pagination` `<nav id="pager">`; each `.hc-pagination__item`
  carries `data-hx-get="/…?page=N"`, `data-hx-target="#rows"`,
  `data-hx-swap="innerHTML"`.
- Optional status text (`#rows-status`, `aria-live="polite"`).

## Why `innerHTML` (not `outerHTML`)

`installDatagrid()` watches the **`<tbody>` element** for child changes.
Swapping the rows *inside* the tbody (`innerHTML`) keeps that element, so
the observer fires and the grid re-applies its roles, sticky offsets, and
any resized column widths to the new rows. Replacing the whole `<tbody>`
(`outerHTML`) would discard the observed node — avoid it.

## Server response

`GET /products?page=N&size=100` returns **only the page's rows** (the
`innerHTML` of the tbody):

```html
<tr class="hc-datagrid__row">
  <td class="hc-datagrid__cell" data-frozen><input type="checkbox" class="hc-checkbox" aria-label="Select row …"></td>
  <th class="hc-datagrid__cell" data-frozen data-frozen-edge scope="row">101</th>
  <td class="hc-datagrid__cell" data-col="name">…</td>
  <td class="hc-datagrid__cell">$…</td>
</tr>
<!-- …one <tr> per row in the page… -->
```

Render each row with the **same column structure** as the header
(`data-frozen` / `data-frozen-edge` on frozen cells, `data-col` on
resizable/editable columns). Frozen-column `--hc-datagrid-left` offsets and
resized widths are re-applied automatically after the swap — the server
does not need to compute them per row.

Status: `200 OK` with the rows (and the out-of-band pager/status
fragments below). A non-2xx response is not swapped (htmx ≥ 2 default),
so the current page stays — surface failures via an `HX-Trigger` toast.

### Updating the pager and status (out-of-band)

Return the new pager and status as out-of-band fragments in the same
response so they update without a second request:

```html
<nav class="hc-pagination" id="pager" hx-swap-oob="true" aria-label="Pagination">
  …items with aria-current="page" on the active page…
</nav>
<p id="rows-status" hx-swap-oob="true" aria-live="polite">101–200 / 5,000</p>
```

Mark the current page with `aria-current="page"`, and disable Prev/Next at
the ends with `aria-disabled="true"`.

## Notes

- **Focus.** Swapping rows removes the previously active cell; the grid
  resets a tabbable cell but does not move focus. Restore focus from the
  server with `HX-Retarget` / an out-of-band focus target if needed.
- **Selection** is per page unless the server re-renders selected rows with
  `aria-selected="true"` (server-tracked selection across pages).
- This recipe targets the standard one-`<tbody>` rows layout. For multi-row
  records (`.hc-datagrid__record` tbodies) swap a wrapping region and let
  the document-level observer re-initialise the grid.
