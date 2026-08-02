# email/text — body copy

Paragraphs with reset margins and a 1.6 line-height; `hc-em-text` /
`hc-em-muted` classes pick up the dark-mode overrides.

## Fragments

- `hcText(text)` — default body copy (`font-size-md`, `color-text`).
- `hcTextMuted(text)` — secondary copy (`font-size-sm`,
  `color-text-muted`).

## Tokens

`font-family-sans` `font-size-md` `font-size-sm` `color-text`
`color-text-muted` `space-4`.

## Notes

`text` is escaped by `th:text` (plain flavor: escape yourself). For
multi-paragraph bodies repeat the fragment — spacing comes from the
bottom margin.
