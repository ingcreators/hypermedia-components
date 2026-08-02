# email/styles — embedded enhancement partial

The one `<style>` block, baked into the layout's `<head>` at
generation. **Enhancement-only by contract**: mobile container width
and `prefers-color-scheme: dark` overrides via `hc-em-*` classes.
Every rule must stay safe to strip — the Gmail app reading IMAP/POP
accounts and most forwards drop `<head>` styles entirely, leaving the
inline baseline.

This is the only source allowed to use `{name.dark}` placeholders
(resolved against the dark token map).

## Dark-mode reality

- Apple Mail / Outlook macOS: honors the media query (with
  `!important` over inline styles).
- Gmail: ignores it and applies its own auto-invert to light emails —
  accepted; do not fight it.
- `<meta name="color-scheme">` in the layout opts the document in.

## Tokens

Light + dark pairs of `color-bg` `color-surface` `color-border`
`color-text` `color-text-muted` `separator-color`; `space-4` `space-5`
for the mobile padding override.
