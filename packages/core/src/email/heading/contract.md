# email/heading — h1 / h2

`margin:0`-reset headings on the heading font stack; `hc-em-heading`
class picks up the dark-mode text override.

## Fragments

- `hcHeading(text)` — `<h1>`, `font-size-lg`.
- `hcSubheading(text)` — `<h2>`, `font-size-md`.

## Tokens

`font-family-heading` `font-size-lg` `font-size-md`
`font-weight-semibold` `color-text` `space-3` `space-4`.

## Notes

`text` is escaped by `th:text` (plain flavor: escape yourself).
Semantic h1/h2 keeps screen-reader outline navigation working in
clients that expose it.
