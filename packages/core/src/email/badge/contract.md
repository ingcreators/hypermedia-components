# email/badge — status badge

Inline-block `<span>` pill on the status palette.

## Fragments

`hcBadge(label)` (default) · `hcBadgeInfo` · `hcBadgeSuccess` ·
`hcBadgeWarning` · `hcBadgeError` — all `(label)`.

## Tokens

`badge-{default,info,success,warning,error}-{bg,fg,border}`
`badge-padding-x/y` `badge-radius` `badge-font-size`
`badge-font-weight` `font-family-sans`.

## Notes

- Status meaning must also be in the label text (WCAG 1.4.1 — color is
  not the only channel).
- Pill radius squares off in Outlook; accepted.
- `label` is escaped by `th:text` (plain flavor: escape yourself).
