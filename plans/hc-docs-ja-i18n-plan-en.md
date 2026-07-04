# Docs Japanese i18n — phase 1 plan

Status: **complete — all 12 phases shipped (#314–#325); the mirror has
since grown with the docs (125 en / 125 ja as of 2026-07-04). Every
docs page has a Japanese counterpart, and since #339 CI enforces the
§6 same-PR rule: the docs job fails a PR that changes an English page
without touching its `ja/` twin
(`apps/docs/scripts/check-i18n-drift.mjs`).**

The v0.5 plan's P3 backlog item: *"Japanese i18n — translate the first
10 docs pages (§7.6) after the English IA settles."* The English IA
has settled (~113 pages, six stable sections); this plan ships the
Starlight multilingual scaffolding plus the first Japanese pages.

## 1. Goal & scope

Phase 1 = **infrastructure + the identity pages**:

- Starlight `locales` configuration: English stays at the root URLs
  (zero churn for existing links, bookmarks, and the Lighthouse/perf
  probes); Japanese lives under `/ja/`.
- Sidebar group labels translated via Starlight's per-item
  `translations` key.
- **11 translated pages**: the docs landing page plus the ten from
  v0.4 plan §7.6 (all still exist in the current IA):

  | # | Page | Why |
  | --- | --- | --- |
  | 0 | `index` (landing) | The `/ja/` entry point — the language picker must land somewhere translated. |
  | 1–4 | `start/introduction` · `installation` · `quick-start` · `philosophy` | The onboarding path. |
  | 5–6 | `fundamentals/naming` · `fundamentals/tokens` | The two conceptual pages everything else leans on. |
  | 7–8 | `components/button` · `components/field` | The §7.7 component-page template, exemplified. |
  | 9–10 | `recipes/confirm-action` · `recipes/live-search` | The recipe contract format, exemplified. |

Everything else stays English and is served under `/ja/**` via
Starlight's built-in **fallback** (English content + a "this page is
not yet translated" notice, localized chrome) — no broken routes, no
duplicated files.

Out of scope for phase 1 (later phases pick from): the remaining
~100 pages, translated code-comment strings inside examples, a
translated README. Translation proceeds section-by-section in
follow-up PRs, entry-path first (fundamentals → components overview →
integrations), each PR a reviewable batch (~10 pages).

## 2. Mechanics — Starlight locales

```js
starlight({
  title: 'Hypermedia Components',
  defaultLocale: 'root',
  locales: {
    root: { label: 'English', lang: 'en' },
    ja: { label: '日本語', lang: 'ja' },
  },
  ...
})
```

- Content mirrors paths under `src/content/docs/ja/**` — e.g.
  `ja/start/installation.mdx`.
- Starlight ships built-in Japanese UI strings (search, ToC, prev/next,
  theme picker); no `i18n` data collection entries needed for stock
  chrome.
- The language picker appears automatically once two locales exist.
- `<html lang>` per locale; RTL untouched (`ja` is LTR).

## 3. Sidebar

Only explicit `label:` entries need translating — string-shorthand
items and `autogenerate` directories take titles from each page's own
frontmatter (per-locale automatically, falling back to English):

```js
{ label: 'Start', translations: { ja: 'はじめに' }, items: [ ... ] }
```

~25 labels total (six top groups + component categories + recipe
groups). Untranslated *page titles* inside groups intentionally render
in English — an honest signal of what is translated so far.

## 4. Translation conventions

- **Identifiers stay English**: class names, attributes, tokens,
  file paths, `installXxx()`, component names (`hc-button`), code
  blocks and their comments. Never translate markup in `<Demo>` slots
  or fenced code.
- Prose in です・ます体; established loanwords over coinages
  (コンポーネント, レシピ, トークン, ビヘイビア, マクロ, テーマ,
  アクセシビリティ).
- Glossary pins (consistency across pages): behavior → ビヘイビア ·
  recipe → レシピ · design token → デザイントークン · progressive
  enhancement → プログレッシブエンハンスメント · semantic HTML →
  セマンティック HTML · light DOM → Light DOM · roving tabindex →
  ロービングタブインデックス.
- Frontmatter `title` / `description` translated; heading anchors are
  auto-slugged per page, and cross-page links from ja pages point at
  `/hypermedia-components/ja/...` (fallback routes exist for every
  page, so links to untranslated targets still resolve).
- Relative import depth changes under `ja/` — e.g.
  `../../../../components/Demo.astro` from `ja/components/*.mdx`.

## 5. Validation

- `pnpm -w run docs:build` — the page count roughly doubles (each
  page gains a `/ja/` route, translated or fallback);
  `starlight-links-validator` (0.25) validates the rendered route
  graph. Fallback pages are not treated as errors by default
  (`errorOnFallbackPages: false`); ja→ja links resolve because every
  route exists under `/ja/`.
- Manual pass: language picker round-trip on a translated and an
  untranslated page; search index (Pagefind indexes per-language).
- No JS/CSS surface changes — no unit/browser test impact. Lighthouse
  probes hit root-locale URLs and are unaffected.

## 6. Maintenance policy

English is the source of truth. A PR that edits one of the translated
English pages should update the `ja/` counterpart in the same PR (the
translated set is small and listed here). If a page drifts anyway,
the damage is bounded: stale-but-honest translations beat fallback
churn; `git log --follow` on the English file shows what changed.
This policy lands as a short section in CONTRIBUTING.md.

## 7. PR plan (one PR)

### PR — `docs(i18n): Japanese locale — scaffolding + the first 11 pages`
- [ ] `astro.config.mjs`: `defaultLocale: 'root'` + `locales` + sidebar
      `translations` labels.
- [ ] `src/content/docs/ja/` — the 11 pages (§1 table).
- [ ] CONTRIBUTING.md — translation maintenance policy (§6).
- [ ] CHANGELOG under Unreleased (docs-facing Added entry).
- [ ] Docs build green (links validated); deployed `/ja/` spot-check
      after merge.
- [ ] Plan Status → shipped.

## 8. Risks / notes

- **Staleness** is the real cost of any translation — mitigated by the
  small curated set + §6 policy, not by tooling, for now. A future
  phase can add a CI check diffing translated-page mtimes if drift
  becomes real.
- Starlight fallback copies render English body text under `/ja/**` —
  acceptable and clearly labeled by the built-in notice.
- The docs URL space under `/ja/` is additive; no existing URL moves.
- Search: Pagefind builds a per-locale index automatically; Japanese
  segmentation quality is acceptable out of the box.
