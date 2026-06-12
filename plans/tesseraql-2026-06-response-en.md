# Response to the TesseraQL improvement brief (2026-06)

**To:** the TesseraQL project
**Re:** [`tesseraql-2026-06-brief.md`](tesseraql-2026-06-brief.md)
**Baseline:** `@hypermedia-components/core` `0.0.1-alpha.0` — the version TesseraQL pins.

## Summary

Thank you — the brief is precise and the "markup is a wire contract"
framing now shapes our versioning policy directly. Two headline answers:

1. **A significant part of what the brief requests already exists in
   `0.0.1-alpha.0`**, the very version TesseraQL pins. In particular
   `hc-field` (Theme 2), the global i18n catalog (Theme 6a), semantic
   status tokens with dark-theme overrides (Theme 3's foundation),
   `hc-empty`, `hc-item`, and an htmx integration guide + 12 recipes.
   Details and exact usage below — much of Appendix A is deletable
   today without waiting for a release.
2. **The genuinely new work is accepted** and planned as one PR per
   theme: the field-errors fragment contract + `installFieldErrors()`
   (Theme 1), status modifiers for arbitrary elements (Theme 3),
   chip / KV table / sidebar nav items (Theme 4), blessed htmx
   patterns incl. a confirm-with-htmx spec (Theme 5),
   `installThemeToggle()` (Theme 6b), and a versioning policy +
   graduation to a tagged **`0.1.0`** (`latest` dist-tag) once
   Themes 1–3 land (Theme 7).

Per your request, the Theme 1 fragment shape is **redesigned to kit
conventions** (`data-variant`, BEM-ish `__` parts, a `data-hc-*` glue
attribute) and published as a canonical contract for you to re-emit.

---

## Theme 1 — validation-error fragment contract + behavior

**Status: accepted — new work.**

The canonical fragment (kit conventions; your compiler re-emits this
shape):

```html
<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
  <p class="hc-alert__title">Unprocessable Entity</p>
  <ul class="hc-alert__errors">
    <li class="hc-alert__error" data-field="email" data-code="duplicate"
        data-message-key="members.email.duplicate">email: duplicate</li>
  </ul>
  <p class="hc-alert__body">optional conflict hint line</p>
</div>
```

Mapping from your invented shape:

| TesseraQL today | Canonical |
| --- | --- |
| `hc-alert hc-alert-error` | `hc-alert` + `data-variant="error"` (existing component) |
| `hc-alert-message` | `hc-alert__title` (existing part) |
| `hc-field-errors` / `hc-field-error` | `hc-alert__errors` / `hc-alert__error` |
| `hc-alert-hint` | `hc-alert__body` (existing part) |
| `data-field` / `data-code` | kept as-is |
| `data-message` | `data-message-key` (it carries a key, not text); the `<li>` text is the display fallback |
| — | `data-hc-field-errors` — the behavior opt-in. Empty = distribute into `closest('form')`; or a CSS selector for the form (OOB swaps) |

`installFieldErrors()` (shipped in the auto-init `./behaviors` bundle,
so TesseraQL gets it without bootstrap changes) distributes each
`hc-alert__error` into the field whose control `name` matches
`data-field`: writes the message into the field's `.hc-field__error`
(creating one next to a bare input when there is no `hc-field`
wrapper), sets `aria-invalid` + `aria-describedby` on the control and
`data-invalid` on the field, focuses the first invalid control, and
clears stale errors on the next input/submit/swap. Unresolved
`data-field` names stay visible in the summary alert.

Message-key resolution reuses the existing i18n catalog — no new API:

```js
import { setMessages } from "@hypermedia-components/core";
setMessages({ "members.email.duplicate": "このメールアドレスは既に登録されています" });
```

If `data-message-key` is found in the catalog it wins; otherwise the
`<li>` text renders. When your server-side localization ships, emit
final text as the `<li>` text and drop the key — no client change.

The full server contract ships as `recipes/field-errors/contract.md` +
a docs page with a live demo form.

## Theme 2 — form field composition

**Status: already in `0.0.1-alpha.0`** — `hc-field` appears to have
been missed; that is a docs-discoverability failure on our side, which
the same PR addresses.

```html
<div class="hc-field">
  <label class="hc-field__label" for="realm-id">Realm id</label>
  <input class="hc-input" id="realm-id" type="text" name="realmId"
         required placeholder="local" aria-describedby="realm-id-help">
  <p class="hc-field__message" id="realm-id-help">Lowercase letters only.</p>
</div>
```

- Label association is native `for`/`id` (clicking focuses the input).
- The **required marker is automatic**: any field containing a
  `[required]` control gets an asterisk on its label
  (`--hc-field-required-color` to restyle). Your `.req` span is not
  needed.
- `.hc-field__message` is the help-text slot (your `.hint`);
  `.hc-field__error` is the error slot Theme 1's behavior fills — and
  `installValidation()` (also already shipped) fills it from native
  constraint validation with the same ARIA wiring.
- Radio/checkbox groups: `fieldset.hc-field` is supported (fieldset
  chrome is reset by the kit).
- Form actions row (your `.toolbar`): `hc-toolbar` or the `.hc-cluster`
  layout utility.

Deletable from `tesseraql.css` once templates adopt `hc-field`:
`form label{…}`, `form .hc-input,form .hc-select{width:100%…}`,
`.req`, `.hint`, `.toolbar`.

## Theme 3 — semantic status colors on arbitrary elements

**Status: tokens exist; the application mechanism is new work.**

`0.0.1-alpha.0` already ships theme-aware status tokens —
`--hc-color-status-{neutral,info,success,warning,error}-{bg,fg,border}` —
overridden under `[data-theme="dark"]` (this is what alert/badge/toast
resolve through). What is missing, as you say, is a way to apply them
to a `td`, `tr`, or a span without a component. The Theme 3 PR adds
documented status modifiers usable on arbitrary elements (text
emphasis and row/surface highlight as separate axes), with both-theme
WCAG AA contrast verified in browser tests. Your `.status-*` /
`tr.warn` block and its dark-mode duplicates become deletable.

## Theme 4 — generic utilities

Per item:

| Brief item | Status |
| --- | --- |
| Chips (`.chips`/`.chip`) | **New** — `hc-chip` planned (the existing `hc-badge` is the small label pill; the docs will state the division of labor). |
| Empty state (`.empty`) | **Exists** — `hc-empty` (`__media`/`__title`/`__description`/`__actions`), incl. an htmx no-results example on its docs page. |
| Hint text (`.hint`) | **Exists** — `hc-field__message` in forms; a generic muted-text answer ships with Theme 4's docs. |
| Key-value table (`table.kv`) | **New** — an `hc-table` KV variant planned. |
| Page-header back/actions (`.back`/`.actions`) | **New (docs-first)** — a documented header pattern (`.hc-cluster` + logical margins) plus minimal CSS if needed. |
| Inline status banner (`.status`) | **Exists** — `hc-alert` with `data-variant="success"` (your green banner is exactly this, theme-aware). |
| Sidebar nav items | **New** — first-class nav-item styling for `hc-shell__sidebar` (hover + `aria-current="page"`), building on the existing `hc-item` row primitive. Your `.hc-shell__sidebar a` rules stop reaching into shell internals. |
| `.alerts` list reset | **Exists** — `.hc-stack` utility (or keep a one-liner; list resets ship with `hc-chip`'s `.hc-chips` wrapper as precedent). |

## Theme 5 — blessed htmx patterns

**Status: partially exists; the spec/recipe gaps are accepted.**

Already shipped: an [htmx integration guide]
(indicators via `data-hx-indicator`, disabling controls during
requests, `HX-Trigger` patterns, CSRF) and recipes including
`data-region` (refresh a section on load/event) and `request-action`
(busy spinner + disabled state on POST).

New in the Theme 5 PR: a polling auto-refresh recipe (your
`every 15s` + `hx-select` self-replacement, and when to prefer
event-driven `data-region` over polling), an explicit
**confirm-with-htmx specification with browser tests** — short
version: `data-hc-confirm` intercepts the click in the capture phase
and fires `hc:confirmed` on confirm, so htmx requests must be
triggered with `data-hx-trigger="hc:confirmed"`; do not combine it
with `hx-confirm` — and the recommended non-2xx targeting of Theme 1's
error fragment (`htmx:beforeSwap` / `HX-Retarget`).

## Theme 6 — i18n and theming

**(a) Strings — already in `0.0.1-alpha.0`.** Every string the kit
renders routes through one catalog with exactly the precedence you
ask for (per-element attributes win):

```js
import { setMessages } from "@hypermedia-components/core";
setMessages({
  "confirm.title": "確認",
  "confirm.confirm": "実行",
  "confirm.cancel": "キャンセル",
  // … all keys documented on Fundamentals → Internationalization
});
```

So the four per-button confirm attributes remain available but are no
longer the only way — set the defaults once globally. The Theme 6 PR
adds a Japanese worked example and verifies the docs table covers
every `DEFAULT_MESSAGES` key.

**(b) Theming.** Dark-theme parity received a dedicated pass in
`0.0.1-alpha.0` (status surfaces, disabled controls, hovers, tracks
all re-emitted under `[data-theme="dark"]`); a remaining error-text
contrast fix is already on `main`. The Theme 6 PR adds an
`installThemeToggle()` behavior (`prefers-color-scheme` default,
persisted toggle, FOUC-avoidance snippet) and a both-themes audit.

## Theme 7 — release maturity

**Status: accepted.**

- [`VERSIONING.md`](../VERSIONING.md) now defines the public API
  exactly as the brief frames it: **CSS class names, data attributes,
  `--hc-*` custom properties, JS exports, `hc:*` events, i18n keys,
  export paths, and recipe contracts**. Renames ship behind a
  deprecation alias for ≥1 minor before removal; the pre-alpha
  "no aliases" rule ended with `0.0.1-alpha.0`.
- `CHANGELOG.md` (Keep a Changelog) and tag-driven npm publishing
  (pre-releases under derived dist-tags, releases under `latest`)
  already exist.
- Once Themes 1–3 land, we cut **`0.1.0`** — a tagged, non-alpha
  release whose notes flag every markup change and include a
  TesseraQL-oriented migration section (primarily: adopting the
  Theme 1 canonical fragment).

## Sequencing

As suggested by the brief: Theme 7 policy (this document's PR) →
Theme 1 → Theme 2 (docs gap-fill) → Themes 3, 4 → Themes 5, 6 →
`0.1.0` release. One reviewable PR per theme.
