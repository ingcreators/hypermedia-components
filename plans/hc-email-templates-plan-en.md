# email templates — token-themed email fragments, theme-builder export, CLI eject plan

Status: **approved 2026-08-02** — §9 questions resolved: full ten-fragment
inventory; docs page under integrations/; dark-mode partial default-on.
Goal: let an application built on Hypermedia Components send HTML email
whose visual theme matches the app — including custom themes built in
the theme builder — without adding Node to the application's runtime.
The deliverable is **generated, theme-baked template fragments** (plain
HTML or Thymeleaf natural templates), obtainable two ways: a download
tab in the docs theme builder, and a `hypermedia-components email eject`
CLI command. No runtime rendering package.

## 1. Why "generate and copy", not a runtime API

HTML email requires resolved literal values: Gmail and Outlook strip
`var()` / custom properties even where embedded `<style>` survives, so
`--hc-*` variables cannot reach the wire. Token resolution therefore
happens **once, at generation time** (browser or dev machine), and the
consuming app (Thymeleaf, Freemarker, ERB, …) just includes the
generated fragments. This keeps the core doctrine intact: the
**documented expanded HTML is the contract**; the generators are
conveniences, never the only way.

Rendering strategy (industry-standard hybrid):

- **Inline `style` = load-bearing** (colors, backgrounds, padding,
  typography) — survives every client, forwarding, and the
  Gmail-app-with-IMAP-account case that drops `<head>` styles.
- **One shared embedded `<style>` partial = enhancement only**
  (mobile media query, `prefers-color-scheme: dark` overrides via
  `hc-em-*` classes) — allowed to be stripped.
- Table-based skeletons, `role="presentation"`, 600 px container,
  web-safe font stacks with system-font fallback. No VML/`mso-`
  conditionals in v1 (Outlook renders square corners; acceptable
  degradation, documented per fragment).

## 2. Verified facts the design stands on

- `token-transform.mjs` is **pure, dependency-free, browser-safe**; the
  theme builder already imports `buildTokensCss` + `DEFAULT_SOURCES`
  from `@hypermedia-components/core/token-transform` and feeds it the
  real DTCG trees ([ThemeBuilder.astro](../apps/docs/src/components/ThemeBuilder.astro)
  line 248). Reference resolution (`resolveValue`) exists; only the
  "flat literal map" output mode is missing.
- The theme builder already has Blob-anchor download plumbing
  (`data-download` buttons) and a **DTCG JSON export** of the custom
  theme — which becomes the hand-off artifact to the CLI (§6).
- The CLI ships repo-root source dirs into its package at prepack
  (`scripts/sync-recipes.mjs`), dispatches subcommands via
  `node:util` `parseArgs`, and already depends on **linkedom** (used by
  `validate`) — enough to strip `th:*` attributes for the plain flavor.
- Thymeleaf natural templates: `th:*` attributes are inert in a
  browser and invisible to other engines once stripped; several
  `th:fragment` blocks per file is idiomatic, so "all components" fits
  in **one fragments file + one layout file** — no zip dependency.

## 3. Token layer — `resolveTokens()` (core)

New export from `scripts/token-transform.mjs` (same purity rules):

```js
resolveTokens({ sources, trees })
// -> Map<string, string>  e.g. 'button-primary-bg' -> '#4f46e5'
```

- Same name-shaping as `buildTokensCss` (drop file namespace, join with
  hyphens) so the flat keys match the `--hc-*` names minus the prefix.
- Callers assemble `sources`/`trees` for a concrete axis combination
  (base + `color.<x>` + `neutral.<y>` [+ `theme.dark` for the dark
  map]); the email generator calls it twice (light + dark).
- Unit tests beside the existing token-transform suite.

Additive → core **patch** per VERSIONING.md.

## 4. Fragment sources — repo-root `email/` (mirrors `recipes/`)

```
email/
  layout/    fragment.html  contract.md
  button/    fragment.html  contract.md
  heading/   …  text/ …  link/ …  separator/ …
  badge/     …  alert/ …  panel/ …  table/ …  footer/ …
  styles/    fragment.html  contract.md   # the shared <style> partial
```

- `fragment.html` is the canonical source: table skeleton, Thymeleaf
  annotations included (`th:fragment` signature, `th:text`/`th:href`
  slots with visible placeholder content — natural-template style),
  inline styles written with DTCG references:
  `style="background-color:{component.button.primary.bg};…"`.
- Generation = resolve `{refs}` via `resolveTokens` + (plain flavor)
  strip `th:*` attributes. The tiny shared engine lives in core as
  `scripts/email-transform.mjs`, exported as **`./email-transform`** —
  pure and browser-safe, the exact `token-transform` pattern, consumed
  by both the theme builder and the CLI. `email/` sources are exported
  as **`./email/*`** (precedent: `./tokens/*`).
- Escaping is the template engine's job (`th:text`); the plain flavor
  documents "escape your interpolations" per slot in `contract.md`.
- Fragment DoD (recipe DoD §17.4 transposed): documented expanded
  HTML · slot list + escaping note · client-support matrix (Gmail /
  Apple Mail / Outlook Word engine / Gmail-app-IMAP) · dark-mode note ·
  token references only (no hard-coded colors) · snapshot test.
- Guard test in core: scan `email/**/fragment.html` against an
  **email-safe CSS property allowlist** (no flex/grid/position/var()),
  same spirit as the shadow-token stylelint guard.

Axes: `color` + `neutral` + optional custom DTCG overrides. `density`
is **out of scope** (email paddings are fixed per fragment); dark is
not an axis but a generated overlay (§1). `dir`/RTL deferred to a
follow-up.

## 5. Theme builder — "Email" export tab (docs)

Extend [ThemeBuilder.astro](../apps/docs/src/components/ThemeBuilder.astro)
with an Email section:

- **Preview**: srcdoc iframe rendering the generated fragments
  (kitchen-sink sample email) with the builder's current axes + custom
  tokens — what you download is what you see.
- **Flavor toggle**: Thymeleaf (annotated) / plain HTML (stripped —
  in-browser via DOMParser, no linkedom needed).
- **Downloads** (existing Blob plumbing): `hc-email.html` (all
  fragments), `hc-email-layout.html` (layout + embedded style partial),
  `email-tokens.json` (flat resolved light/dark maps, for the
  runtime-theming escape hatch, §7).
- Every generated file starts with a **manifest comment**: core
  version, axis settings, custom-token DTCG (or its absence), and the
  equivalent `email eject` command line — the reproducibility bridge.
- New docs page under tokens/ or integrations/ ("HTML email") — EN +
  JA twins in the same PR (ja-parity CI guard).

## 6. CLI — `email` subcommand

```
hypermedia-components email list
hypermedia-components email eject [--color <name>] [--neutral <name>]
    [--tokens <custom.dtcg.json>] [--flavor thymeleaf|plain]
    [--dir <target>] [--force]
```

- `eject` writes the same three files as §5 into `<target>/`
  (default `./email/`), refusing to overwrite without `--force`
  (the `add` convention).
- `--tokens` accepts the theme builder's **DTCG JSON export**, closing
  the loop: build a custom theme visually once, regenerate forever in
  CI/scripts.
- Sources: extend the prepack sync to copy repo-root `email/` into the
  package; token JSONs + `token-transform` + `email-transform` come
  from a new dependency on `@hypermedia-components/core` (source-file
  exports only — nothing bundled into the consumer app).
- Vitest coverage: eject output snapshot (both flavors), `--tokens`
  override, overwrite refusal. CLI **minor** (new command).

## 7. Runtime multi-tenant theming (documented escape hatch, no code)

Apps that switch themes per tenant at request time cannot bake values.
The docs page documents the pattern: load `email-tokens.json` per
tenant and write inline styles from it
(`th:style="'background-color:' + ${t['button-primary-bg']}"`).
Verbose by design — recommended only for the tenant-variable subset.

## 8. PR sequence (one concern per PR, no stacking)

| PR | Scope | Release |
| --- | --- | --- |
| 1 | core: `resolveTokens` + tests | core patch |
| 2 | core: `email/` sources + `email-transform` + contracts + guard/snapshot tests | core patch |
| 3 | docs: theme-builder Email tab + preview + "HTML email" page (EN+JA) | docs deploy |
| 4 | cli: `email list` / `email eject` + prepack sync + tests | cli minor |

Each PR lands on main before the next starts (fast-merge rule — no
stacked branches). CHANGELOG under Unreleased in PRs 1, 2, 4.

## 9. Resolved review questions (2026-08-02)

1. Fragment inventory v1: **all ten** in §4.
2. Docs IA: "HTML email" page under **integrations/** (guide-shaped).
3. Dark-mode overlay: **default-on** in the style partial (degrades
   safely where `prefers-color-scheme` is unsupported).
