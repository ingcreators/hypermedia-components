# OKLCH — perceptual color primitives plan

Status: **shipped** — PRs 2, 4 and 5 implemented; PR 3 dropped as a
measured no-op (§9). The
primitive ramps are Tailwind's sRGB palette, where the step number does
not mean a lightness. Across the seven chromatic ramps the spread at
step `500` is **18.3 L points** (indigo 58.5 vs amber 76.9), which is
why `color.amber` is the one accent axis carrying a hand-written
exception — dark foreground instead of white, and an 18% soft tint
instead of 12%. Moving the primitives to `oklch()` and regularizing
lightness replaces that exception with a threshold, and makes the docs
theme builder a **consumer of the same ladder** rather than a parallel
sRGB implementation. Preserving today's exact appearance is explicitly
not a goal. Baseline: core `0.1.15` (#456), 139 hex values in one file,
zero `oklch()` anywhere in the repo.

## 1. Goal

```json
"blue":  { "600": { "$type": "color", "$value": "oklch(0.540 0.232 264.4)" } },
"amber": { "600": { "$type": "color", "$value": "oklch(0.540 0.106  70.1)" } }
```

Every chromatic ramp shares one lightness ladder, so `600` means the
same darkness on every hue. Adding a `data-color` axis becomes "pick a
hue angle" — and the theme builder can do it in the browser, because
the ladder ships as a shared module (§6) instead of being re-derived
from hex arithmetic.

Non-goals (v1): no change to the **neutral** ramps (already uniform,
§2.3), no P3 / out-of-gamut values, no relative color syntax
(`oklch(from …)`), no Style Dictionary migration, no new tokens, no
renames. Names and paths are untouched — this is a **values-only**
change.

## 2. Verified facts the design stands on

Measured on `origin/main` @ `270cf31`, not assumed:

1. **One file holds every literal color.**
   `packages/core/src/tokens/primitive.tokens.json` — 139 hex values
   (7 chromatic ramps × 11 steps = 77; 5 neutral ramps × 12 = 60;
   white + black). Every other token file (`semantic`, `component`,
   `theme.dark`, the 5 `color.*` axes, the 8 `neutral.*` files) is 100%
   `{ref}` indirection with zero literal hex.
2. **The build pipeline never parses colors.** `$value` is coerced with
   `String()` (`scripts/token-transform.mjs:48`), reference-substituted
   textually (`:69-73`), and interpolated into a declaration (`:212`,
   `:222`, `:228`, `:233`). `$type` is never read —
   `grep '\$type' scripts/` returns 0 hits. `oklch(…)` passes through
   verbatim; **zero changes to `token-transform.mjs` are needed.**
3. **The neutral ramps are already perceptually uniform.** Lightness
   spread across gray/slate/zinc/neutral/stone is ≤ 1.8 L points at
   every step (vs up to 18.3 for the chromatic ramps). They were built
   as a coherent set — 12 steps each, including the extra `350` the
   chromatic ramps lack — and need no redesign. Dark mode, which is
   entirely neutral-driven, therefore barely moves.
4. **Browser support is already assumed.** `color-mix()` (Baseline
   2023) is used in 11 token values and ~17 authored declarations;
   `oklch()` is the same Baseline year. The support floor does not move.
5. **The theme builder already imports a core `.mjs` module into its
   client bundle.** `ThemeBuilder.astro:283` does
   `import { buildTokensCss, resolveTokens, DEFAULT_SOURCES } from
   '@hypermedia-components/core/token-transform'`, backed by the
   `"./token-transform": "./scripts/token-transform.mjs"` exports entry
   and a matching `files` entry. **The mechanism §6 needs is already
   proven in the exact file that needs it.**

## 3. Why this shape (alignment with HC principles)

| HC principle | How OKLCH primitives honour it |
| --- | --- |
| DTCG tokens are the visual source of truth | The ladder *is* the truth; ramps stop being 77 independent opinions. |
| State in HTML attributes | Unchanged — `data-color` / `data-neutral` / `data-theme` keep their selectors and names. |
| Behaviors stay small | No JS involved at runtime; `src/js/` has zero color math today and gains none. |
| Light DOM, no build step for consumers | Output is still plain custom properties in `dist/hc.tokens.css`. |
| Accessibility is not optional | Contrast becomes a *constructed* property of the ladder (§5), not something axe discovers afterwards. |
| Macros are optional, never the only way | The builder generates the same token JSON a human could hand-write. |

## 4. The ladder

Each chromatic ramp is `oklch(L C H)` with **H constant down the ramp**,
anchored on the hue of its most-saturated existing step, so each ramp
keeps its identity: blue 264.4, red 27.3, green 163.2, amber 70.1,
indigo 277.0, rose 17.6, violet 293.0.

| step | L | rel. C | step | L | rel. C |
| --- | --- | --- | --- | --- | --- |
| 50 | 0.97 | 1.00 | 600 | **0.54** | 0.91 |
| 100 | 0.94 | 0.95 | 700 | 0.47 | 0.92 |
| 200 | 0.89 | 0.97 | 800 | 0.40 | 0.89 |
| 300 | 0.82 | 0.96 | 900 | 0.33 | 0.85 |
| 400 | 0.72 | 0.94 | 950 | 0.24 | 0.85 |
| 500 | 0.62 | 0.92 | | | |

> **Superseded during implementation.** The `rel. C` column below —
> chroma as a fraction of the in-gamut maximum — was replaced by an
> **absolute** per-step chroma clamped to the gamut. See PR 4 in §9 for
> the measurement; the short version is that a fraction traces the
> gamut boundary, which is a different shape per hue, so `green.200`
> came out more chromatic than `green.500`. The shipped ladder is in
> `scripts/oklch.mjs`; the `L` column is unchanged and is what carries
> the contrast guarantee either way.

`C = rel. C × max_in_gamut_chroma(L, H)`.

The reasoning that led here still holds for why a *naive* absolute
ladder fails: a single absolute chroma applied to every hue has to fit
the worst one, and at L 0.54 that is ≈200° (cyan), which holds only
**C 0.092** where blue sits at 0.215. What works is an absolute target
that hues clamp against individually — pastel where sRGB forces it,
full chroma everywhere else.

The `rel. C` column is the median relative chroma today's ramps already
use at each step, so light steps keep their tint (`blue.50` `#eff6ff` →
`#f0f6ff`, ΔE 0.14) rather than collapsing toward gray.

Resulting drift, in Oklab ΔE ×100 (≈2 is just-noticeable):

| ramp | mean | max | ramp | mean | max |
| --- | --- | --- | --- | --- | --- |
| violet | 2.0 | 5.4 | blue | 3.5 | 7.5 |
| red | 2.7 | 6.8 | green | 4.9 | 8.7 |
| rose | 3.3 | 9.0 | **amber** | **8.9** | **15.4** |
| indigo | 3.5 | 5.5 | | | |

Amber moves the most because it is the ramp that was off the ladder;
green gets punchier at `200`–`300` (it ran unusually soft at 0.59–0.73
relative chroma). Both are accepted — matching today's appearance is a
stated non-goal.

## 5. The contrast invariant

The finding that makes the whole design work:

> **At fixed L, contrast is very nearly independent of hue and chroma.**

Measured at L 0.54 over **all 360 hues** at the §4 envelope, white text
scores **4.73 … 5.86 : 1** — every hue passes 4.5:1. Holding hue at 264
and sweeping chroma from 0.00 to 0.25 moves the ratio only 5.06 → 5.43.
Lightness is the sole lever.

`L(600) = 0.54` is therefore the load-bearing number: the crossover
where white stops clearing 4.5:1 is L 55.4 (green, the strictest hue),
so 0.54 has margin on **every** hue, present and future.

This collapses the amber exception into a threshold:

> `action.primary.fg` = `white` when `L(bg) ≤ 0.55`, else
> `{primitive.color.gray.900}`.

Verified across all seven ramps at the proposed ladder:

- white on `600` — **4.79 … 5.79 : 1** (PASS)
- white on `700` — 6.50 … 7.81 : 1 (PASS)
- white on `500` — 3.43 … 4.09 : 1 (correctly refused)
- gray.900 on `400` — 6.63 … 7.63 : 1 (PASS)
- gray.900 on `300` — 9.77 … 10.88 : 1 (PASS)

A bright accent like amber stays bright by taking a **lighter step**
(`400`, L 0.72) with dark text; a deep accent takes `600` with white
text. Both answers come from one rule. The 18%-vs-12% soft-tint
divergence dissolves the same way — at equal L, equal mix percentage
reads as equal emphasis.

## 6. The theme builder

Today `ThemeBuilder.astro` carries a private sRGB implementation:
`hexToRgb` / `rgbToHex` / `darken` / `luminance` / `contrast` /
`hslToHex` (`:338-342`, `:501`), an "auto" foreground that runs a WCAG
comparison at `:525`, and `darken()`-by-percentage for the hover state.
It is a second, independent theory of color that can disagree with the
tokens.

After this plan it becomes a consumer:

```js
// apps/docs/src/components/ThemeBuilder.astro (client script)
import { LADDER, rampStep, autoForeground }
  from '@hypermedia-components/core/oklch';

const bg    = rampStep(hue, '600');   // oklch(0.540 C 264.4)
const hover = rampStep(hue, '700');
const ring  = rampStep(hue, '500');
const fg    = autoForeground(bg);      // §5 threshold, not a WCAG search
```

New shared module `packages/core/scripts/oklch.mjs`, exported as
`"./oklch": "./scripts/oklch.mjs"` with a matching `files` entry —
**the same shape as the existing `./token-transform` export the builder
already imports** (§2.5). It holds the §4 ladder constants, an
OKLCH↔sRGB pair, a chroma-gamut bisection (~20 lines), and
`autoForeground()`. The token generator (§9 PR 4) and the builder read
the identical constants, so they cannot drift.

What this buys the builder concretely:

- **`darken()` becomes a ladder step.** Hover is `700`, not "the brand
  color times 0.85" — so a generated axis derives its hover exactly the
  way the five built-in axes do.
- **The contrast readout stops being a search.** §5 makes the answer a
  constant comparison; the live "Text on primary: N : 1" panel
  (`:626-630`) keeps working but can now *promise* a pass rather than
  report one.
- **Any hue works.** Spot-checked: teal 195, cyan 225, lime 130,
  fuchsia 330, orange 55 — white on `600` scores 4.86 / 4.93 / 4.85 /
  5.75 / 5.28 : 1 respectively. No hue needs review.
- **`<input type="color">` stays.** It is hex-only by spec, so the
  picker converts hex → OKLCH on read and keeps the hue; an added
  L/C/H triple exposes the ladder directly. This is also why P3 is a
  non-goal (§1) — the native picker cannot express it.

## 7. What does NOT change

Stated explicitly because the blast radius looks larger than it is:

- **No token names, paths, or selectors.** `--hc-*` names, DTCG paths,
  `[data-color="…"]`, `[data-neutral="…"]`, `[data-theme="dark"]` all
  identical. Nothing in VERSIONING.md §1–3 is renamed or removed.
- **No neutral ramp values** (§2.3) — dark mode, surfaces, borders and
  text colors stay byte-identical.
- **No `token-transform.mjs`** (§2.2).
- **No `src/js/`** — the package has zero color math; the only runtime
  color read is `chart.js:424` passing `--hc-chart-series-*` strings
  straight to Observable Plot (§11 risk 2).

## 8. Blast radius

| Surface | Count | Action |
| --- | --- | --- |
| `primitive.tokens.json` chromatic values | 77 | generated from the ladder |
| … neutral + black/white values | 62 | format conversion only, ΔE 0 |
| `scripts/oklch.mjs` + exports map + `files` | new | §6 |
| `token-transform.mjs` | 0 | none |
| VRT baseline PNGs | 14 | regenerate |
| Playwright specs asserting literal colors | 18 files, 68 assertions | route through the sRGB normalizer (done, PR 2) |
| Vitest real-token assertions (`test/tokens.test.mjs`) | 8 lines | update |
| Axe specs running `color-contrast` | 66 files | no edit; must stay green |
| Docs pages printing hex | 6 EN (+6 ja) | 35 of 40 literals are in `tokens/themes.mdx` + `tokens/neutral.mdx` |
| `PrimitivePalette.astro` | `readableOn()` `:14-23` | hex regex → shared `autoForeground()`, else labels silently go black |
| `ColorThemeSwatches.astro` | ref resolver | verify format-agnostic |
| `ThemeBuilder.astro` | `:338-342`, `:501`, `:524-531`, `:626` | §6 |

Every EN docs page edited needs its `ja/` twin in the **same** PR —
`.github/workflows/ci.yml:91` runs
`apps/docs/scripts/check-i18n-drift.mjs` on PRs and fails otherwise.

## 9. PR split (sequential, each off fresh `origin/main`; no stacking)

### PR 1 — this plan (`chore(plans)`)

### PR 2 — `refactor(tokens): express primitives in oklch` — **done**

No visual change; every value round-trips to the same 8-bit sRGB hex.

- [x] `primitive.tokens.json`: all 139 values → `oklch()` at precision
      L4/C4/H2 — the smallest that round-trips **all** 139 exactly, with
      more than half an ulp of margin on every one.
- [x] `scripts/oklch.mjs` + `"./oklch"` export (pulled forward from
      PR 4: the docs palette needs sRGB *now*, and a throwaway local
      converter would have been rewritten in PR 4 anyway). Conversion
      primitives only — the ladder still lands in PR 4.
- [x] `test/tokens.test.mjs`: the two real-token colour assertions now
      compare OKLCH *lightness* (dark error must be perceptibly lighter
      than light error) instead of pinning a literal, so they survive
      PR 4 and would catch a ramp mistake.
- [x] `test-browser/helpers/color.mjs` + 68 assertions across 18 spec
      files (§11 risk 5 — far larger than predicted).
- [x] `PrimitivePalette.astro`: `readableOn()` is now a single
      threshold on OKLCH L (0.55, the §5 pivot); swatches label with
      sRGB hex and keep the authored token value in the tooltip.
- [x] `ColorThemeSwatches.astro`: resolver confirmed format-agnostic.
- [x] `chart.js`: comment guarding the continuous-scale landmine
      (§11 risk 2).
- [x] VRT: all 14 baselines **byte-identical** — the acceptance proof.
      767 browser tests, 863 unit tests, lint, typecheck, docs build
      all green.
- [x] CHANGELOG (*Changed*, "no visual change"); plan Status.

### PR 3 — **dropped; folded into PR 4**

The premise ("`in srgb` tints go muddy, `in oklab` keeps the hue") is
true in general but **false for every mix this codebase actually
performs.** Measured in Chromium:

| mix | max channel Δ (srgb vs oklab) |
| --- | --- |
| any `… N%, transparent` (26 of 31 sites) | **0** |
| `focus-ring 10/14/18%, surface` | 1–2 |
| `border 55%, surface` · `muted-bg, white 35%` | 0 |
| *(reference)* blue 50% + amber | 41 |
| *(reference)* green 50% + rose | 42 |

Two reasons. `color-mix()` interpolates **premultiplied**, so mixing
with `transparent` is interpolation-space-independent by construction —
and 26 of the 31 sites mix with `transparent`. The other 5 mix a colour
into a near-neutral surface at 10–55%, where the two paths barely
diverge. The classic sRGB failure needs two saturated, differently-hued
colours, which HC never mixes.

A ≤2/255 change is not worth regenerating 14 VRT baselines for: doing
so spends the "baselines are meaningful" signal that PR 2 depended on.
The `in oklab` switch still lands — as intent and future-proofing —
inside PR 4, which regenerates the baselines anyway.

### PR 4 — `feat(tokens): regularize chromatic ramps` — **done**

- [x] `scripts/oklch.mjs` gains `LADDER`, `maxChroma`, `rampStep`,
      `formatOklch`, `autoForeground`, `FG_LIGHTNESS_PIVOT`.
- [x] **Chroma is absolute, not relative — the plan had this wrong.**
      §4 argued for chroma as a fraction of the in-gamut maximum. In
      practice that traces the gamut boundary, whose shape swings by
      hue: green's sRGB gamut is widest at high lightness, so the
      fraction made `green.200` *more* chromatic than `green.500` and
      the light tints came out neon. Switching to an absolute per-step
      target clamped to the gamut fixed it and was better on every
      count — no ramp peaks in the light half (was: green), overall
      drift fell from ΔE 4.1 to 3.7, and each step now has comparable
      colourfulness across hues.
- [x] `scripts/build-ramp.mjs` generates the 77 chromatic values;
      `--check` reports drift. Neutrals stay hand-maintained.
- [x] All five axes unified — not just amber. `emerald` and `rose`
      were also reaching down to `700`/`800`; every axis is now
      `600` / `700` / `500` with white text and a 12% soft tint.
- [x] `color-mix` → `in oklab` at all 31 sites (folded up from PR 3).
- [x] `test/ramp.test.mjs` — 37 assertions: ladder conformance,
      hue constancy, gamut, generator parity, the contrast table, and
      that any hue produces an AA-safe `600` (what the builder relies
      on). It also **found a real edge**: step `500` clears neither
      white nor dark text on the saturated hues, so it is asserted as
      the dead band and documented as ring-only.
- [x] 33 colour literals across 13 specs; 14 VRT baselines
      deleted-then-regenerated. 767 browser tests, 900 unit, lint,
      typecheck, docs build green.
- [x] `examples-plain-html.spec.mjs` gains `reducedMotion: 'reduce'`.
      The narrower contrast margins made the known axe-samples-a-
      transition flake reachable (observed once at 4.34:1 on a blue
      that rests at 5.31:1); same guard the `code-*` specs use.
- [x] Docs + `ja/` twins: `tokens/themes.mdx`, `tokens/palette.mdx`.
      `tokens/neutral.mdx` needed no edit — its hexes are neutral-ramp
      values, which did not change. The `fundamentals/tokens.mdx`,
      `recipes/chart.mdx` and `components/button.mdx` hexes are
      consumer-override *examples*; still valid CSS, left alone.
- [x] CHANGELOG (*Changed*, flagged as a visual change); plan Status.

Known caveat: `oklchToRgb` is not bit-exact against a browser. Three of
the 139 committed values land within half an ulp of an 8-bit boundary
and differ by 1/255 from what Chromium paints. Fine for swatch labels;
assert browser output in tests.

### PR 5 — `refactor(docs): OKLCH theme builder` — **done**

- [x] `hexToRgb` / `rgbToHex` / `darken` / `luminance` / `hslToHex`
      deleted; the builder imports the shared ladder. `contrast()`
      stays but now takes OKLCH and is used only for the read-out.
- [x] Hover is a lightness step holding hue and chroma; "auto"
      foreground is the §5 threshold.
- [x] Exports emit `oklch()` and `color-mix(in oklab, …)`.
- [x] `<input type="color">` kept, converts on read. Instead of a raw
      L/C/H triple the panel shows an **In OKLCH** read-out plus a
      **Snap to ladder** button — more useful, since the question a
      user actually has is "how far is my brand colour from how you
      build yours". Shuffle rolls a hue through the ladder, so it can
      no longer produce a theme that fails AA.
- [x] Built-in presets re-seeded from the new `600` values; amber's
      dark-foreground override dropped.
- [x] Docs + `ja/tokens/theme-builder.mdx` twin.
- [x] CHANGELOG; plan Status → shipped.

Verified by driving the built page in Chromium: the read-out, snap,
pale-colour foreground flip, six shuffles (all AA, 4.81–5.73:1), and
the exports. The builder has **no automated coverage** — that gap
predates this work and is worth closing separately.

## 10. Test plan

- **Unit — ladder invariant.** For each chromatic ramp, parse the
  emitted `--hc-*` values and assert L matches the §4 table within
  ±0.005 and H is constant down the ramp. This is the regression guard
  that keeps the ladder true.
- **Unit — contrast rule.** Assert §5 holds for all five `color.*` axes
  (white / gray.900 vs the resolved `action.primary.bg`), so a bad axis
  fails in Vitest rather than in a 66-file axe sweep.
- **Unit — builder parity.** Assert `rampStep()` reproduces the
  committed `primitive.tokens.json` values for the seven built-in hues.
  This is what stops §6's shared module from drifting from the ramps it
  generated.
- **Browser** — the 66 axe specs must stay green with no edits; that is
  the acceptance signal for PR 4.
- **VRT** — 14 baselines. PR 2 must **not** move them; PRs 3 and 4 must
  regenerate them from scratch.

## 11. Risks / notes

1. **Amber changes visibly** (mean ΔE 8.9, max 15.4) and green gets
   more saturated at `200`–`300`. Accepted per §1 non-goals; called out
   here so the CHANGELOG entry for PR 4 says so plainly.
2. **Observable Plot / d3-color — checked in PR 2, not a defect.**
   Probed against the real `@observablehq/plot` 0.6.17 (the browser
   fixture *stubs* Plot, so the suite never exercised this):
   - Ordinal ranges pass `oklch()` straight through to SVG `fill` —
     correct. This is the only path `resolveSeriesRange()` feeds.
   - A **continuous** scale given an `oklch()` range interpolates via
     d3-color and silently renders **every cell black**. Reproduced.
   - hc-chart never hits that: the one continuous preset (heatmap)
     *replaces* `base.color` rather than merging it (the shallow spread
     in `renderFigure`), so the token range is dropped and Plot's own
     scheme applies.

   It stays a live landmine for anyone who adds a continuous scale fed
   from the series tokens, so `resolveSeriesRange()` now carries a
   comment saying exactly this.
3. **Client-bundle size.** `scripts/oklch.mjs` enters the docs client
   bundle. It is math-only (no dependencies) and replaces a comparable
   amount of inline code, so the net should be ≈ zero — but the builder
   page is the only place it ships, and `token-transform.mjs` is
   already bundled there (§2.5), so the precedent is set.
4. **Stylelint.** `.stylelintrc.json` pins `color-function-notation:
   "legacy"` (rgb/hsl only — inert for `oklch()`) and bans literal
   colors in `box-shadow`. Neither blocks this, but the shadow rule
   fires if a shadow token ever resolves to an `oklch()`-bearing string
   inside an authored `box-shadow`.
5. **Serialization in tests — this was wrong, and it cost the most.**
   Chromium does **not** re-serialize `oklch()` to `rgb()`.
   `getComputedStyle(el).backgroundColor` returns
   `"oklch(0.5461 0.2152 262.88)"` verbatim, and once `color-mix()` is
   involved it returns `color(srgb 0.14 0.39 0.92 / 0.12)`. Canvas
   `fillStyle` round-trips the colour space too, so it is not a
   normalizer either.

   So it was not "just raw custom-property comparisons": **68 assertions
   across 18 spec files** broke, every one that reads a resolved colour.
   Fixed in PR 2 by `test-browser/helpers/color.mjs` — paint the value
   onto a 1×1 canvas and read the pixel back, which yields the sRGB
   triple that actually rasterizes, in any engine and colour space. The
   existing `rgb(…)` expectations then stay literally true, so PR 4 only
   has to change *values*, not mechanism.

## 12. Sequencing against 1.0.0

[`hc-road-to-1.0-en.md`](./hc-road-to-1.0-en.md) freezes the public
surface and **skips `0.2.0`**. Per [`VERSIONING.md`](../VERSIONING.md),
a patch may contain "no behavior-default changes", so PR 2 is
patch-safe (ΔE 0) but PRs 3–5 are not — a visible palette change needs
a minor, and the only minor left before the freeze is `1.0.0` itself.

**Recommendation: land PRs 2–5 before `1.0.0`**, as the last
value-level change, and let the freeze cover the regularized palette.
Doing it after 1.0.0 forces the ramp redesign into a `2.0.0` or into an
awkward "values aren't API" carve-out that VERSIONING.md does not
currently make.
