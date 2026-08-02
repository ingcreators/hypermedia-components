# email/table — key-value table

Two-column bordered table for order summaries, account details, etc.
Key cells sit on the table header palette at 35% width.

## Fragment

`hcKvTable(rows)` — `rows` iterates with `th:each`, reading
`row.key` / `row.value`. A `LinkedHashMap<String,String>` or any
iterable of key/value pairs works:

```html
<div th:replace="~{email/hc-email :: hcKvTable(${order.summary})}"></div>
```

## Tokens

`table-border` `table-header-bg/fg` `table-header-weight` `table-fg`
`table-font-size` `table-cell-padding-x/y` `font-family-sans`.

## Notes

- This is a data table — no `role="presentation"`, unlike the layout
  skeletons, so screen readers announce it as tabular data.
- Values are escaped by `th:text`. Plain flavor: the `th:each` strips
  to a single static row — duplicate it in your engine's loop and
  escape both cells.
- Cell borders use `border-bottom` per cell (no `border-collapse`
  dependence — Outlook's collapse handling is unreliable).
