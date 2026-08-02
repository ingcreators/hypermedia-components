# email/link — inline text link

Underlined link in the brand accent (`color-action-primary-bg` — the
primary action color doubles as the link accent; there is no separate
link token). Use inside `hcText`-style copy or standalone.

## Fragment

`hcLink(href, label)`.

## Tokens

`color-action-primary-bg`.

## Notes

- Keep `text-decoration:underline` — color alone fails WCAG 1.4.1 and
  several clients recolor links anyway.
- Use absolute URLs. `label` is escaped by `th:text` (plain flavor:
  escape yourself).
- No dark override: the accent is designed to hold on both surfaces,
  and Gmail's auto-invert leaves link colors alone.
