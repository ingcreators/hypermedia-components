# email/alert — callout box

Full-width toned box (bg + border + radius) with a bold title line and
a body line, on the status palette.

## Fragments

`hcAlertInfo` · `hcAlertSuccess` · `hcAlertWarning` · `hcAlertError` —
all `(title, text)`.

## Tokens

`alert-{info,success,warning,error}-{bg,fg,border}` `alert-radius`
`alert-border-width` `alert-padding-block` `alert-padding-inline`
`alert-title-weight` `font-size-md` `font-size-sm` `font-family-sans`
`space-1`.

## Notes

- No dark override: the toned backgrounds are baked light values;
  Gmail auto-inverts them acceptably, Apple Mail keeps them readable
  (fg/bg from the same status ramp).
- Status must also be carried by the title wording, not color alone.
- `title`/`text` are escaped by `th:text` (plain flavor: escape
  yourself).
