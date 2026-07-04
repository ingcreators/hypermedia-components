# TesseraQL → hypermedia-components: improvement brief

Status: **answered and closed out** — see
[`tesseraql-2026-06-response-en.md`](./tesseraql-2026-06-response-en.md);
all 7 themes shipped in `0.1.0` (#192–#198) and the follow-up issues
through `0.1.6`. Kept verbatim as the inbound record.

**From:** the TesseraQL project (downstream consumer)
**Date:** 2026-06-11
**Scope:** requests distilled from building TesseraQL 0.1.0 system apps (Studio, Operations console, IAM Admin) on hypermedia-components.

## How to use this brief (instructions for the coding agent)

You are working in the hypermedia-components repository. The TesseraQL repository is NOT available to you; every piece of evidence you need is inlined below.

1. Read the whole brief first.
2. Produce a prioritized implementation plan (or GitHub issues): one theme = one reviewable unit of work. Confirm the plan with the maintainer before making breaking changes.
3. Treat published class names, data-* attributes, CSS custom properties, and behavior exports as public API (Theme 7): TesseraQL's route compiler emits hc markup from Java, so renames break consumers at build-output level, not just visually. Prefer additive changes; provide deprecation aliases otherwise.
4. Each theme lists acceptance criteria — self-verify against them, and update this repo's docs/demo pages as part of each change, following its existing conventions.

## How TesseraQL consumes the kit (facts)

- Dependency: WebJar `org.webjars.npm:hypermedia-components__core` version `0.0.1-alpha.0` (npm `@hypermedia-components/core`), self-hosted via version-less URLs `/assets/vendor/hypermedia-components__core/dist/...`.
- Files used: `dist/hc.min.css` and `dist/hc.behaviors.min.js` (ES module). Behaviors installed: `installShell()`, `installConfirm()` — nothing else.
- Rendering model: server-side Thymeleaf + htmx (loaded alongside from its own WebJar). No SPA framework.
- Components in use (approx. occurrences across templates): `hc-card` 29, `hc-table` 17, `hc-input` 16, `hc-button` 8, `hc-badge` 6, `hc-select` 5, `hc-shell` (+ `__header`/`__sidebar`/`__main`), plus server-emitted `hc-alert`. `data-variant` values in use: `primary`, `error`, `ghost`, `success`, `warning`.
- The shared page shell hardcodes `lang="en" data-theme="dark"` today; a Japanese/English UI is on TesseraQL's roadmap (see Theme 6).
- Critical constraint: part of the markup is emitted by TesseraQL's compiler from Java string building (Theme 1). The markup is effectively a wire contract between the two projects.

## Theme 1 — Own the validation-error fragment contract and add a field-error behavior (highest priority)

**Problem.** TesseraQL renders validation errors for htmx requests as an hc-flavored fragment built by string concatenation in Java. The class names (`hc-alert`, `hc-alert-error`, `hc-alert-message`, `hc-field-errors`, `hc-field-error`, `hc-alert-hint`) were *invented on the consumer side* because the kit specifies no error/alert fragment contract. Nothing in the kit consumes it either: `data-field` is emitted "so a form can retarget errors next to fields", but no behavior does that.

**Exact fragment TesseraQL emits today** (response to requests carrying `HX-Request: true`, e.g. on a 422):

```html
<div class="hc-alert hc-alert-error" data-error-code="TQL-FIELD-4220">
  <p class="hc-alert-message">Unprocessable Entity</p>
  <ul class="hc-field-errors">
    <li class="hc-field-error" data-field="email" data-code="duplicate"
        data-message="members.email.duplicate">email: duplicate</li>
  </ul>
  <p class="hc-alert-hint">optional conflict hint line (optimistic-locking conflicts)</p>
</div>
```

`data-message` carries a message key (not display text) intended for client-side lookup until server-side localization ships downstream.

**Request.**
1. Specify an alert/validation-error fragment contract as documented API: alert container with severity variant, message line, field-error list items keyed by `data-field`/`data-code`/`data-message`, optional hint line. Adjust the shape above if you have a better design — but then publish the canonical shape so consumers can re-emit it.
2. Add a behavior (e.g. `installFieldErrors()`) that, when such a fragment is swapped into/near a form, distributes each `hc-field-error` next to the input whose `name` matches `data-field`, marks the input invalid (modifier class + `aria-invalid` + `aria-describedby`), and clears stale errors on the next submit/swap.
3. Define a hook to resolve the `data-message` key to display text (callback or lookup table), so localized rendering can plug in later.

**Acceptance.** The contract is documented; a demo form shows a swapped-in error fragment distributed to fields with correct ARIA wiring; a consumer emitting exactly the fragment above gets inline field errors with zero custom JS.

## Theme 2 — Form field composition

**Problem.** The kit offers `hc-input`/`hc-select` as element classes only. Every TesseraQL form hand-writes label structure with no `for=`/`id` association, and the consumer supplies its own CSS for label layout, required marker, and help text. Typical consumer markup today:

```html
<label>Realm id <span class="req">*</span><br>
  <input class="hc-input" type="text" name="realmId" required placeholder="local"></label>
```

Consumer CSS papering over the gap:

```css
form label{display:block;margin:0 0 14px;font-size:13px}
form .hc-input,form .hc-select{width:100%;margin-top:4px}
.req{color:#dc2626}
.hint{color:var(--hc-color-text-muted);font-size:12px;margin:0 0 16px}
.toolbar{display:flex;gap:10px;margin:10px 0 4px}
```

**Request.** A field-composition pattern (e.g. `hc-field`): label + control + required marker + help text + an error slot (where Theme 1's behavior places field errors). Must work fully server-side-rendered with no JS. Plus a form actions/toolbar row pattern.

**Acceptance.** A demo form built only from kit classes shows correct label association (clicking the label focuses the input), required marker, help text, and a field error in the error slot; the consumer CSS above becomes deletable.

## Theme 3 — Semantic status tokens usable on arbitrary elements

**Problem.** `data-variant` colors exist only on components (badge/button). For table cells, rows, and plain text, TesseraQL binds server-computed classes and maintains raw hex colors with hand-duplicated dark-theme overrides:

```css
.status-completed{color:#15803d}.status-active{color:#15803d}
.status-failed{color:#dc2626}.status-disabled{color:#dc2626}.status-locked{color:#dc2626}
.status-running{color:#2563eb}
[data-theme="dark"] .status-completed,[data-theme="dark"] .status-active{color:#86efac}
[data-theme="dark"] .status-failed,[data-theme="dark"] .status-disabled,[data-theme="dark"] .status-locked{color:#fca5a5}
[data-theme="dark"] .status-running{color:#93c5fd}
tr.warn td{background:#7f1d1d33}
```

```html
<td th:class="${e.statusClass}" th:text="${e.status}"></td>  <!-- statusClass computed in Java -->
```

**Request.** Theme-aware semantic color tokens (`--hc-color-success`, `--hc-color-danger`, `--hc-color-warning`, `--hc-color-info`, with muted/surface variants) that switch with `data-theme`, and modifier classes or attributes applicable to arbitrary elements — including `td` text emphasis and `tr` row highlight.

**Acceptance.** The consumer block above is replaceable by kit tokens/modifiers with equivalent rendering in both themes; no raw hex needed downstream.

## Theme 4 — Absorb generic utilities the consumer had to write

**Problem.** ~40 lines of consumer CSS define patterns that are generic, not app-specific (full file in Appendix A): chips (`.chips`/`.chip`), empty-state text (`.empty`), hint text (`.hint`), key-value table (`table.kv`), page-header back link and action links (`.back`, `.actions`), inline status banner (`.status`). Worse, the consumer styles the kit's own internals — `.hc-shell__sidebar a` — because the shell ships no nav-item styling (sidebar children are raw `<a>` tags, no hover/active treatment):

```css
.hc-shell__sidebar a{display:block;padding:6px 8px;color:inherit;text-decoration:none;border-radius:6px}
.hc-shell__sidebar a:hover{background:var(--hc-color-bg)}
```

A related repeated template pattern — every list view pairs an empty-state with a guarded table:

```html
<p class="empty" th:unless="${outbox.hasRows}">No outbox events recorded.</p>
<table class="hc-table" th:if="${outbox.hasRows}">…</table>
```

**Request.** Add to the kit: chip/tag, empty-state, help/hint text, key-value table variant, page-header action area + back/breadcrumb link, inline status banner, and first-class sidebar nav items with hover and current-page (`aria-current="page"`) styling.

**Acceptance.** Appendix A shrinks to truly app-specific rules (source/editor styling); no consumer selector needs to reach into `hc-shell__*` internals.

## Theme 5 — Blessed htmx integration patterns

**Problem.** The kit targets hypermedia apps but ships no htmx-facing guidance or behaviors. Consumers hand-write polling-refresh boilerplate on every live view:

```html
<div id="page-content" hx-get="/_tesseraql/ops/console/outbox" hx-trigger="every 15s"
     hx-select="#page-content" hx-target="this" hx-swap="outerHTML">
```

Questions a consumer currently answers alone: does `data-hc-confirm` intercept `hx-*`-triggered requests (vs `hx-confirm`)? What is the recommended busy/loading indicator during swaps? How should Theme 1's error fragment be targeted on non-2xx responses?

**Request.** Document blessed recipes (and small behaviors where they pay off): auto-refresh region, busy indicator, confirm semantics with htmx, error-fragment targeting. Explicitly specify `installConfirm()`'s interaction with htmx-issued requests.

**Acceptance.** A docs page covers these recipes; confirm-with-htmx behavior is specified and tested.

## Theme 6 — i18n hooks and theme completeness

**Problem.** (a) Built-in strings: the confirm dialog takes per-use attributes — four of them repeated for every destructive action (as rendered):

```html
<button type="submit" class="hc-button" data-variant="error"
        data-hc-confirm="Disable user alice?" data-hc-confirm-title="Confirm disable"
        data-hc-confirm-ok="Disable" data-hc-confirm-variant="error">Disable user</button>
```

Defaults the kit renders itself (e.g. the cancel label) appear to be English-only with no locale hook. TesseraQL's roadmap requires a Japanese/English UI, so every kit-rendered string must be overridable globally, not only per element. (b) Theming: consumers currently run `data-theme="dark"` permanently; light-theme parity and a theme-toggle story (`prefers-color-scheme` default + persisted toggle) are unverified/absent.

**Request.** A global configuration point for all built-in strings (per-element attributes still win); document every built-in string. Light-theme parity across components; optionally an `installThemeToggle()` behavior.

**Acceptance.** All strings the kit renders can be set globally once (demo configured in Japanese); both themes render every component acceptably.

## Theme 7 — Release maturity: the markup is a public API

**Problem.** TesseraQL 0.1.0 — a released product — pins `0.0.1-alpha.0`. Because a compiler emits the markup, renames of classes/attributes are breaking changes for build outputs.

**Request.** Tagged releases with a changelog; a semver policy explicitly covering CSS class names, data attributes, custom properties, and behavior exports; deprecation aliases for at least one minor version before removals; publish the markup contracts (Themes 1–4) as the API reference. Graduate from `alpha` once Themes 1–3 land.

**Acceptance.** A CHANGELOG and a versioning-policy doc exist in-repo; the next release is a tagged non-alpha version whose notes flag any markup change.

## Suggested sequencing

1. Theme 7's policy bones (changelog + versioning policy doc) — cheap, and makes everything after reviewable.
2. Themes 1–2 (error contract + form fields) — TesseraQL's upcoming scaffolding generator will mass-produce form/error markup; the contract must be right before then.
3. Themes 3–4 (tokens + utilities).
4. Theme 5 (htmx recipes) and Theme 6 (i18n/theming) — needed before TesseraQL's internationalization phase.

## Appendix A — full consumer CSS layered on the kit today

`tesseraql.css`, served as the app stylesheet on top of `hc.min.css`. Everything here is a candidate for absorption except the source/editor and trace-span rules near the end.

```css
.hc-shell__main section{margin-block-end:20px}
.hc-shell__sidebar a{display:block;padding:6px 8px;color:inherit;text-decoration:none;border-radius:6px}
.hc-shell__sidebar a:hover{background:var(--hc-color-bg)}
h2{font-size:15px;margin:0 0 12px}
.back{font-size:13px;text-decoration:none;margin-inline-start:auto}
.actions{margin-inline-start:auto;font-size:13px}
.actions a{margin-inline-start:12px;text-decoration:none}
.actions + .hc-badge,.back + .hc-badge{margin-inline-start:8px}
.chips{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px}
.chip{background:var(--hc-color-surface);border:1px solid var(--hc-color-border);border-radius:999px;padding:4px 12px;font-size:12px}
.alerts{list-style:none;padding:0;margin:0;display:grid;gap:6px}
.empty{color:var(--hc-color-text-muted);font-style:italic;margin:0 0 12px}
.summary{margin:0 0 12px}
.hint{color:var(--hc-color-text-muted);font-size:12px;margin:0 0 16px}
.status{background:#14532d;color:#dcfce7;border-radius:6px;padding:8px 12px;margin:0 0 12px}
tr.warn td{background:#7f1d1d33}
.status-completed{color:#15803d}.status-active{color:#15803d}
.status-failed{color:#dc2626}.status-disabled{color:#dc2626}.status-locked{color:#dc2626}
.status-running{color:#2563eb}
[data-theme="dark"] .status-completed,[data-theme="dark"] .status-active{color:#86efac}
[data-theme="dark"] .status-failed,[data-theme="dark"] .status-disabled,[data-theme="dark"] .status-locked{color:#fca5a5}
[data-theme="dark"] .status-running{color:#93c5fd}
table.kv th{width:160px}
.wizard-list{list-style:none;padding:0;margin:0;font-size:14px}
.wizard-list li{padding:8px 0;border-bottom:1px solid var(--hc-color-border)}
.source{font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-word}
pre.source{background:var(--hc-color-surface);border:1px solid var(--hc-color-border);border-radius:6px;padding:14px;overflow:auto}
textarea.source{width:100%;resize:vertical}
form label{display:block;margin:0 0 14px;font-size:13px}
form .hc-input,form .hc-select{width:100%;margin-top:4px}
.req{color:#dc2626}
.toolbar{display:flex;gap:10px;margin:10px 0 4px}
.span-name{font-weight:600}
.slow .span-name{color:#dc2626}
[data-theme="dark"] .slow .span-name{color:#fca5a5}
.span-error{color:#dc2626;font-size:11px;text-transform:uppercase}
[data-theme="dark"] .span-error{color:#fca5a5}
```

## Appendix B — shell integration for reference

The shared layout every TesseraQL page uses (Thymeleaf slots elided):

```html
<html lang="en" data-theme="dark">
<head>
  <link rel="stylesheet" href="/assets/vendor/hypermedia-components__core/dist/hc.min.css">
  <link rel="stylesheet" href="/assets/_tesseraql/tesseraql.css">
  <script src="/assets/vendor/htmx.org/dist/htmx.min.js" defer></script>
  <script type="module" src="/assets/_tesseraql/tesseraql.js"></script>
</head>
<body>
<div class="hc-shell">
  <header class="hc-shell__header">
    <button class="hc-button" data-variant="ghost" data-hc-shell-toggle
            aria-label="Open navigation" type="button">&#9776;</button>
    <strong>Page title</strong>
    <!-- per-page header extras: back link / action links / badges -->
  </header>
  <nav class="hc-shell__sidebar" aria-label="Primary">
    <a href="/_tesseraql/ops/console">Operations</a>
    <a href="/_tesseraql/studio/ui">Studio</a>
    <a href="/_tesseraql/admin/users">IAM Admin</a>
  </nav>
  <main class="hc-shell__main"><!-- page content --></main>
</div>
</body>
</html>
```

And the bootstrap module (`tesseraql.js`):

```js
import { installShell, installConfirm }
    from "/assets/vendor/hypermedia-components__core/dist/hc.behaviors.min.js";
installShell();
installConfirm();
```
