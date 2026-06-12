# Versioning policy

Hypermedia Components follows [Semantic Versioning](https://semver.org/).
This document defines **what counts as the public API** — and therefore
what counts as a breaking change — and how deprecations and releases
work. [`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog format) records
every notable change.

The key fact driving this policy: consumers of this kit emit our markup
from **server templates and code generators** (Thymeleaf, Razor, ERB,
string-building compilers). A renamed class or data attribute does not
just change how a page looks — it breaks a consumer's *build output*.
The markup is a wire contract, and we version it like one.

---

## The public API surface

A change is **breaking** if it forces any consumer that follows the
documented usage to change its templates, generated markup, CSS, or
JavaScript. The public API is:

1. **CSS class names** — every `hc-*` class documented on a docs page,
   recipe, or contract file (`hc-button`, `hc-card__header`,
   `hc-field__error`, …), including the documented element structure
   they imply.
2. **Data attributes** — configuration and glue attributes
   (`data-variant`, `data-size`, `data-density`, `data-hc-confirm`, …)
   *and* the state attributes components/behaviors reflect
   (`data-invalid`, `aria-expanded`, `data-sidebar-collapsed`, …),
   because consumers style and test against them.
3. **CSS custom properties** — every generated `--hc-*` variable in
   `dist/hc.tokens.css` and the component variables documented on docs
   pages, plus the DTCG token paths under
   `@hypermedia-components/core/tokens/*`.
4. **JavaScript exports** — the named exports of
   `@hypermedia-components/core` (`installXxx()` functions, i18n
   functions, …), their signatures, and the auto-init `./behaviors`
   entry. Behaviors returning idempotent uninstallers is part of the
   contract.
5. **Events** — `hc:*` event names and their `detail` shapes.
6. **i18n message keys** — the keys in `DEFAULT_MESSAGES`
   (`confirm.title`, `combobox.empty`, …), since consumers override
   them via `setMessages()`.
7. **Package export paths** — the `exports` map of
   `@hypermedia-components/core` (`./css`, `./css/min`, `./behaviors`,
   `./tokens.css`, per-component `./css/*`, …).
8. **Recipe server contracts** — the request/response shapes published
   in `recipes/<name>/contract.md` (headers, fragment markup, status
   codes), including server-emitted fragments such as the
   field-errors fragment.

### Not public API

- DOM that behaviors create **internally** and that is not documented
  as a hook (exact node order inside the shared confirm dialog, helper
  wrapper elements, generated `id` values).
- CSS declarations themselves (we may change how a look is achieved as
  long as the documented classes, variables, and states keep working).
- Anything marked *experimental* on its docs page.
- The docs site, examples, and test fixtures.

When in doubt: if a docs page or contract file tells a consumer to
write it, it is API.

## What semver means here (0.x)

While the major version is `0`:

| Release | May contain |
| --- | --- |
| **Patch** (`0.1.0` → `0.1.1`) | Bug fixes and strictly additive changes — new components, new optional attributes, new tokens, new exports. No renames, no removals, no behavior-default changes. |
| **Minor** (`0.1.0` → `0.2.0`) | Everything above, plus breaking changes — **each one flagged in the CHANGELOG** under *Changed* / *Removed* and, where feasible, shipped behind a deprecation alias first. |
| **Pre-release** (`-alpha.N` / `-beta.N`) | Anything; no stability promise. Published under the matching npm dist-tag (`alpha`, `beta`), never `latest`. |

From `1.0.0` on, standard semver applies: breaking changes only in
majors, deprecation aliases kept for at least one full minor cycle.

## Deprecation aliases

When something in the public surface is renamed, the release that
introduces the new name also keeps the old one working as an alias —
a duplicated CSS selector, a re-exported function, a forwarded data
attribute, or a forwarded event — for **at least one minor version**,
and the CHANGELOG lists it under *Deprecated* with the replacement.
The removal happens in a later minor (0.x) or the next major (1.x+),
listed under *Removed*.

Exceptions (alias not feasible — e.g. a changed default, a layout
restructure) are called out explicitly in the CHANGELOG entry with a
migration note.

The pre-alpha "no back-compat aliases" rule ended when
`0.0.1-alpha.0` shipped.

## Release mechanics

1. Move the **Unreleased** block of `CHANGELOG.md` under the new
   version heading with the release date; breaking markup changes are
   flagged inline.
2. Bump `version` in `packages/core/package.json`.
3. Tag the commit `v<version>` and push the tag.
4. `.github/workflows/release.yml` builds and publishes to npm —
   pre-releases under their derived dist-tag (`alpha`, `beta`),
   releases under `latest`.

Release notes for a version with markup changes must include a
migration section addressed to template/codegen consumers.
