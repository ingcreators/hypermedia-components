# Tokens

DTCG-shaped JSON sources. Four layers:

1. `primitive.tokens.json` — raw values (color scales, spacing, radii, font sizes).
2. `semantic.tokens.json` — UI meaning (bg, surface, text, border, action.primary,
   the `shadow.*` elevation scale).
3. `component.tokens.json` — component values (button height, input border, card radius).
4. `theme.*.tokens.json` and `density.*.tokens.json` — light/dark, comfortable/compact/dense.

The build emits `dist/hc.tokens.css` with `--hc-*` custom properties.

Values are CSS strings. Composite values (the `shadow.*` scale,
`color.overlay`'s `rgba()`) are stored as the literal CSS string — the
transformer emits `$value` verbatim and resolves embedded `{refs}`, it
does not understand DTCG composite objects. Component CSS reads the
elevation scale directly (`box-shadow: var(--hc-shadow-lg)`); the dark
theme overrides the four steps with stronger alphas.
