# Tokens

DTCG-shaped JSON sources. Four layers:

1. `primitive.tokens.json` — raw values (color scales, spacing, radii, font sizes).
2. `semantic.tokens.json` — UI meaning (bg, surface, text, border, action.primary).
3. `component.tokens.json` — component values (button height, input border, card radius).
4. `theme.*.tokens.json` and `density.*.tokens.json` — light/dark, comfortable/compact/dense.

The build emits `dist/hc.tokens.css` with `--hc-*` custom properties.
