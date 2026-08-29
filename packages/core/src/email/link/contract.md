# email/link — inline text link

Underlined link in the theme's link colour (`color-link`). Use inside
`hcText`-style copy or standalone.

## Fragment

`hcLink(href, label)`.

## Tokens

`color-link`.

## Notes

- Keep `text-decoration:underline` — color alone fails WCAG 1.4.1 and
  several clients recolor links anyway.
- Use absolute URLs. `label` is escaped by `th:text` (plain flavor:
  escape yourself).
- Carries `class="hc-em-link"` so the layout's
  `@media (prefers-color-scheme: dark)` block can re-colour it. The inline
  colour is the light value; without that class the dark flip leaves it
  behind. The accent holds on both surfaces as a *background* with white
  text on it — that is what `color-action-primary-bg` is for — but as
  *text* on the dark email surface the same value scores 2.77:1.
  `color-link` reads the ramp a few rungs lighter in dark and scores
  5.85:1. Pinned by a spec, since nothing about the markup would show the
  difference.
