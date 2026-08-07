# OKLCH — perceptual color primitives plan

Status: **proposed.** The primitive ramps are Tailwind's sRGB palette,
where the step number does not mean a lightness. Across the seven
chromatic ramps the spread at step `500` is **18.3 L points** (indigo
58.5 vs amber 76.9), which is why `color.amber` is the one accent axis
that needs a hand-written exception — dark foreground instead of white,
and an 18% soft tint instead of 12%. Moving the primitives to `oklch()`
and regularizing lightness makes that exception **derivable** instead of
hand-tuned, so a new accent axis becomes a hue angle rather than a
design session. Baseline: core `0.1.15` (#456), 139 hex values in one
file, zero `oklch()` anywhere in the repo.

## 1. Goal

```json
"blue":  { "600": { "$type": "color", "$value": "oklch(0.540 0.243 264.4)" } },
"amber": { "600": { "$type": "color", "$value": "oklch(0.540 0.104  70.1)" } }
```

Every chromatic ramp shares one lightness ladder, so `600` means the
same darkness on every hue, and `white` on `600` clears 4.5:1 on all
seven ramps (measured: 4.79–5.79:1). Adding a `data-color` axis becomes
"pick H, reuse the ladder"; the foreground choice follows a threshold
rule (§5) instead of a per-axis note in the token file.

Non-goals (v1): no change to the **neutral** ramps (already uniform,
§2), no P3 / out-of-gamut values, no relative color syntax
(`oklch(from …)`), no Style Dictionary migration, no new tokens, no
renames. Names and paths are untouched — this is a **values-only**
change.

## 2. Verified facts the design stands on

Measured on `origin/main` @ `270cf31`, not assumed:

1. **One file holds every literal color.**
   `packages/core/src/tokens/primitive.tokens.json` — 139 hex values.
   Every other token file (`semantic`, `component`, `theme.dark`, the 5
   `color.*` axes, the 8 `neutral.*` files) is 100% `{ref}` indirection
   with zero literal hex. The migration is a single-file edit.
2. **The build pipeline never parses colors.** `$value` is coerced with
   `String()` (`scripts/token-transform.mjs:48`), reference-substituted
   textually (`:69-73`), and interpolated into a declaration
   (`:212`, `:222`, `:228`, `:233`). `$type` is never read —
   `grep '\$type' scripts/` returns 0 hits. `oklch(…)` passes through
   verbatim; **zero build-script changes are needed.**
3. **The neutral ramps are already perceptually uniform.** Lightness
   spread across gray/slate/zinc/neutral/stone is ≤ 1.8 L points at
   every step (vs up to 18.3 for the chromatic ramps). They were built
   as a coherent set — 12 steps each, including the extra `350` the
   chromatic ramps do not have — and need no redesign. Dark mode,
   which is entirely neutral-driven, therefore barely moves.
4. **Browser support is already assumed.** `color-mix()` (Baseline
   2023) is used in 11 token values and ~17 authored declarations;
   `oklch()` is the same Baseline year. The support floor does not
   move.
5. **The amber exception is documented in the source.**
   `color.amber.tokens.json` `$description` records "uses gray.900 text
   (not white) … ≈ 9.4:1" and its soft tint is 18% where the other four
   axes use 12%.

## 3. Why this shape (alignment with HC principles)

| HC principle | How OKLCH primitives honour it |
| --- | --- |
| DTCG tokens are the visual source of truth | The ladder *is* the truth; ramps stop being 139 independent opinions. |
| State in HTML attributes | Unchanged — `data-color` / `data-neutral` / `data-theme` keep their selectors and names. |
| Behaviors stay small | No JS involved; `src/js/` has zero color math today and gains none. |
| Light DOM, no build step for consumers | Output is still plain custom properties in `dist/hc.tokens.css`. |
| Accessibility is not optional | Contrast becomes a *constructed* property of the ladder (§5), not something axe discovers afterwards. |

## 4. The ladder

Each chromatic ramp is `oklch(L C H)` with **H constant down the ramp**,
anchored on the hue of its most-saturated existing step (so identity is
preserved: blue 264.4, red 27.3, green 163.2, amber 70.1, indigo 277.0,
rose 17.6, violet 293.0).

| step | L | rel. C | step | L | rel. C |
| --- | --- | --- | --- | --- | --- |
| 50 | 0.97 | 1.00 | 600 | **0.54** | 0.91 |
| 100 | 0.94 | 0.95 | 700 | 0.47 | 0.92 |
| 200 | 0.89 | 0.97 | 800 | 0.40 | 0.89 |
| 300 | 0.82 | 0.96 | 900 | 0.33 | 0.85 |
| 400 | 0.72 | 0.94 | 950 | 0.24 | 0.85 |
| 500 | 0.62 | 0.92 | | | |

`C = rel. C × max_in_gamut_chroma(L, H)`, so every value stays inside
sRGB by construction and each hue is as saturated as that lightness
allows. **The `rel. C` column is not invented** — it is the median of
the relative chroma the current ramps already use at that step, which
is why the light steps keep their tint (`blue.50` `#eff6ff` → `#f0f6ff`,
ΔE 0.14) instead of collapsing to gray.

`L(600) = 0.54` is the load-bearing number: the measured crossover where
white text stops clearing 4.5:1 is L 55.4 (green, the strictest hue), so
0.54 has margin on **every** hue.

Resulting drift, in Oklab ΔE ×100 (≈2 is just-noticeable):

| ramp | mean | max | ramp | mean | max |
| --- | --- | --- | --- | --- | --- |
| violet | 2.0 | 5.4 | blue | 3.5 | 7.5 |
| red | 2.7 | 6.8 | green | 4.9 | 8.7 |
| rose | 3.3 | 9.0 | **amber** | **8.9** | **15.4** |
| indigo | 3.5 | 5.5 | | | |

Six of seven ramps move modestly. **Amber moves a lot and that is the
point** — it is the ramp that was off the ladder. See §10 for the
identity trade-off it forces.

## 5. The foreground rule

Today: a sentence in `color.amber.tokens.json`. After: a threshold.

> `action.primary.fg` = `white` when `L(bg) ≤ 0.55`, else
> `{primitive.color.gray.900}`.

Verified across all seven hues at the proposed ladder:

- white on `600` — **4.79 … 5.79 : 1** (PASS)
- white on `700` — 6.50 … 7.81 : 1 (PASS)
- white on `500` — 3.43 … 4.09 : 1 (correctly refused)
- gray.900 on `400` — 6.63 … 7.63 : 1 (PASS)
- gray.900 on `300` — 9.77 … 10.88 : 1 (PASS)

So a bright-accent axis like amber stays bright by choosing a **lighter
step** (`400`, L 0.72) with dark text, and a deep-accent axis uses `600`
with white text. Both answers come from the same rule; neither is a
per-axis exception. The 18%-vs-12% soft-tint divergence dissolves the
same way — at equal L, equal mix percentage reads as equal emphasis.

## 6. What does NOT change

Stated explicitly because the blast radius looks larger than it is:

- **No token names, paths, or selectors.** `--hc-*` names, DTCG paths,
  `[data-color="…"]`, `[data-neutral="…"]`, `[data-theme="dark"]` all
  identical. Nothing in VERSIONING.md §1–3 is renamed or removed.
- **No neutral ramp values** (§2.3) — so dark mode, surfaces, borders,
  and text colors are byte-identical.
- **No build scripts** (§2.2).
- **No `src/js/`** — the package has zero color math; the only runtime
  color read is `chart.js:424` passing `--hc-chart-series-*` strings
  straight to Observable Plot (see §10 risk 3).

## 7. Blast radius

| Surface | Count | Action |
| --- | --- | --- |
| `src/tokens/primitive.tokens.json` | 77 chromatic values | rewrite as `oklch()` |
| … its neutral + black/white values | 62 | convert format only, ΔE 0 |
| Build scripts | 0 | none |
| VRT baseline PNGs | 14 | regenerate |
| Playwright specs asserting literal colors | 16 files | update values |
| Vitest real-token assertions (`test/tokens.test.mjs`) | 8 lines | update |
| Axe specs running `color-contrast` | 66 files | no edit; must stay green |
| Docs pages printing hex | 6 EN (+6 ja) | update; 35 of 40 literals are in `tokens/themes.mdx` + `tokens/neutral.mdx` |
| `PrimitivePalette.astro` | `readableOn()` `:14-23` | hex regex → OKLCH-aware, else labels silently go black |
| `ColorThemeSwatches.astro` | ref-resolving regex | verify against `oklch()` values |
| `ThemeBuilder.astro` | `:338-342`, `:501`, `:524-531` | **the real work** — `hexToRgb` / `luminance` / `contrast` / `darken` / `hslToHex` + `<input type="color">` (hex-only by spec) |

Every EN docs page edited needs its `ja/` twin in the **same** PR —
`.github/workflows/ci.yml:91` runs
`apps/docs/scripts/check-i18n-drift.mjs` on PRs and fails otherwise.

## 8. PR split (sequential, each off fresh `origin/main`; no stacking)

### PR 1 — this plan (`chore(plans)`)

### PR 2 — `refactor(tokens): express primitives in oklch (no visual change)`

- [ ] `primitive.tokens.json`: all 139 values → `oklch()`, chosen to
      round-trip to the same 8-bit sRGB hex. Target ΔE 0.
- [ ] `test/tokens.test.mjs`: 8 real-token assertions → `oklch(` forms.
- [ ] `PrimitivePalette.astro` `readableOn()` → parse `oklch()` (or
      switch the label to `color-contrast()`-free luminance math).
- [ ] `ColorThemeSwatches.astro`: confirm the `{primitive.color.X.N}`
      resolver is format-agnostic.
- [ ] VRT: expect **no** regeneration; if any of the 14 baselines
      exceeds `maxDiffPixels: 2400`, the conversion is wrong — fix the
      values, do not update the snapshots.
- [ ] CHANGELOG (*Changed*, "no visual change"); plan Status update.

### PR 3 — `feat(tokens): oklab interpolation for color-mix` (after PR 2)

- [ ] The 11 `color-mix(in srgb, …)` token values → `in oklab`.
- [ ] The ~17 authored `color-mix(in srgb, …)` in `src/css/` → `in
      oklab` (focus rings, selected rows, date ranges).
- [ ] Regenerate all 14 VRT baselines — **delete the PNGs first**, then
      `--update-snapshots`; diffs under 2400 px are otherwise silently
      kept as stale.
- [ ] CHANGELOG (*Changed*); plan Status update.

### PR 4 — `feat(tokens): regularize chromatic ramps` (after PR 3)

- [ ] The 77 chromatic values → the §4 ladder.
- [ ] `color.amber.tokens.json`: drop the `fg` and 18%-tint exceptions;
      re-point the axis at the step the §5 rule selects.
- [ ] Apply the §5 rule to all five `color.*` axes; record it in the
      files' `$description`.
- [ ] Update the 16 Playwright specs' literal color assertions.
- [ ] Regenerate all 14 VRT baselines (delete-then-update).
- [ ] Docs: `tokens/themes.mdx`, `tokens/neutral.mdx`,
      `tokens/palette.mdx`, `tokens/theme-builder.mdx`,
      `fundamentals/tokens.mdx`, `recipes/chart.mdx`,
      `components/button.mdx` — **each with its `ja/` twin**.
- [ ] CHANGELOG (*Changed*, flagged as a visual change); plan Status.

### PR 5 — `refactor(docs): OKLCH theme builder` (after PR 4)

- [ ] `ThemeBuilder.astro`: replace the sRGB pipeline with OKLCH math;
      `darken()` becomes an L step, "auto" foreground becomes the §5
      threshold, the generated `color.<name>.tokens.json` export emits
      `oklch()`.
- [ ] Keep `<input type="color">` as the picker (hex-only by spec) and
      convert on read; add an L/C/H triple of number inputs.
- [ ] `ja/tokens/theme-builder.mdx` twin.
- [ ] CHANGELOG; plan Status → shipped.

## 9. Test plan

- **Unit** — extend `test/tokens.test.mjs` with a ladder invariant: for
  each chromatic ramp, parse the emitted `--hc-*` values and assert
  L matches the §4 table within ±0.005 and H is constant down the ramp.
  This is the regression guard that keeps the ladder true.
- **Contrast** — a new unit test asserting the §5 rule holds for all
  five `color.*` axes (white/gray.900 vs the resolved
  `action.primary.bg`), so a bad axis fails in Vitest rather than in a
  66-file axe sweep.
- **Browser** — the 66 axe specs must stay green with no edits; that is
  the acceptance signal for PR 4.
- **VRT** — 14 baselines. PR 2 must **not** move them; PRs 3 and 4 must
  regenerate them from scratch.

## 10. Risks / notes

1. **Amber loses brightness if forced to `600`.** At L 0.54, h 70 is an
   ochre-brown, not an amber. The §5 rule is what saves it — the axis
   points at `400` (L 0.72) and takes dark text. If the user prefers
   amber's current exact appearance over ladder membership, PR 4 can
   ship a **variant 4a**: regularize L only and preserve each ramp's
   existing per-step relative chroma. That keeps mean drift ≈ 2–3 ΔE on
   every ramp including amber, and still fixes the contrast problem —
   it just leaves the chroma envelope non-uniform. Decide before PR 4.
2. **Green's chroma envelope.** The median `rel. C` (0.97) over-saturates
   green at `200`–`300` (ΔE 8.7); green currently runs 0.59–0.73 there.
   Either accept the punchier green or give green its own envelope —
   a one-column override, not a redesign.
3. **Observable Plot / d3-color.** `chart.js:424` hands
   `--hc-chart-series-*` strings to Plot. Ordinal ranges pass through
   to SVG `fill` and are fine, but Plot's legend swatches and any
   continuous scale route through `d3-color`, which **cannot parse
   `oklch()`** and returns `null`. Must be checked in PR 2; if it
   breaks, keep the six `--hc-chart-series-*` tokens in a
   `d3`-parseable form and note why in the token file.
4. **Stylelint.** `.stylelintrc.json` pins `color-function-notation:
   "legacy"` (rgb/hsl only — inert for `oklch()`) and bans literal
   colors in `box-shadow`. Neither blocks this, but the shadow rule
   fires if any shadow token ever resolves to an `oklch()`-bearing
   string inside an authored `box-shadow`.
5. **Serialization in tests.** Chromium serializes in-gamut `oklch()`
   back to `rgb()` for *used* values, so `toHaveCSS('color', 'rgb(…)')`
   specs keep working — but `nested-theme.spec.mjs` compares the **raw
   custom-property text** and breaks the moment `$value` becomes
   `oklch()`, even at ΔE 0. That is a PR 2 edit, not a PR 4 one.
6. **`<input type="color">` is hex-only** by spec, so the theme builder
   cannot express out-of-gamut colors through the native picker. This
   is why P3 is a non-goal in v1.

## 11. Sequencing against 1.0.0

[`hc-road-to-1.0-en.md`](./hc-road-to-1.0-en.md) freezes the public
surface and **skips `0.2.0`**. Per
[`VERSIONING.md`](../VERSIONING.md), a patch may contain "no
behavior-default changes", so PR 2 is patch-safe (ΔE 0) but PRs 3–4 are
not — a visible palette change needs a minor, and the only minor left
before the freeze is `1.0.0` itself.

**Recommendation: land PRs 2–5 before `1.0.0`**, as the last
value-level change, and let the freeze cover the regularized palette.
Doing it after 1.0.0 forces the ramp redesign into a `2.0.0` or into an
awkward "values aren't API" carve-out that VERSIONING.md does not
currently make.
