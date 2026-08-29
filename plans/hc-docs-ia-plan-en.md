# Docs information-architecture overhaul — plan

**Status: implemented** (2026-08-29, all three phases on this branch)

The docs grew to 68 components, 53 recipes, and 5 templates while the
navigation kept the shape it had at a fraction of that size. A
docs-writer audit (2026-08-29) found the individual pages consistently
strong — every recipe has a live demo, the page templates are uniform,
52/54 recipes carry a Related section — and the problems concentrated
in the *entrances and paths*: the sidebar, the index pages, and the
cross-links between layers. This plan fixes the IA in three phases
without moving any URL.

## Audit findings (ranked)

1. **The Recipes sidebar is a flat, alphabetical, 53-entry list**
   (`autogenerate`). The task-oriented grouping exists only inside
   `recipes/index.mdx` — and its own "Actions & forms" group has grown
   to 29 rows, no longer functioning as a group.
2. **The data grid is a product-within-a-product with no hub**: the
   `hc-datagrid` component, 13 grid recipes (spread over three index
   groups), the Data grid page template, and several behaviors have no
   single page that maps them.
3. **Hand-written counts on the landing page went stale** ("64
   components · 25 recipes · 2 page templates" vs. the real
   68 / 53 / 5) — a trust problem for evaluators, and structurally
   inevitable while the numbers are typed by hand.
4. **"Tokens" exists twice** — Fundamentals → Tokens (the DTCG
   pipeline concept) and the top-level Tokens section (theme switching
   in practice). The top-level section is really *Theming*.
5. **No `collapsed` anywhere** — the sidebar renders every group of
   every section expanded.
6. **Component → recipe links are weak**: 24/66 component pages
   mention any recipe; the reverse direction is dense.
7. **Integrations is alphabetical**, burying the shared foundation
   page (htmx) mid-list.
8. **Fundamentals mixes must-read and deep-dive** pages in one
   13-item reading order (naming vs. anchored internals).
9. **Search-synonym coverage is uneven** — pages are findable only
   under HC's chosen name (dialog, toast, live search), not the names
   users type (modal, snackbar, typeahead), in either locale.

## Phase 1 — entrances (config + index pages)

- **P1a Grouped Recipes sidebar + regrouped index.** Replace the
  `autogenerate` with an explicit, purpose-grouped list (ja labels via
  `translations`), and regroup `recipes/index.mdx` (+ ja twin) into the
  same nine groups, splitting the 29-row table:
  - Forms (10): mutating-form, field-errors, conditional-fields,
    multi-step-form, inline-edit, file-upload, postal-address,
    reference-lookup, cascading-select, transfer
  - Form safety (6): unsaved-changes, autosave, edit-conflict,
    idempotency-key, session-expiry, network-retry
  - Actions (5): request-action, confirm-action, undo-delete, copy,
    sortable
  - Business flows (4): line-items, workflow-actions, csv-import,
    async-job
  - Data grid (13 + the Phase-2 hub): datagrid-pager, -sort, -filter,
    -columns, -prefs, row-detail, -tree, -infinite, -snapshot-pager,
    -edit-errors, -edit-conflict, -bulk-actions, -bulk-errors
  - Search & filter (4): live-search, result-cap, filter-popover,
    saved-views
  - Loading & regions (3): lazy-panel, lazy-tree, data-region
  - Server push & chat (4): sse-updates, sse-toast, chat-messages,
    streaming-response
  - Overlays & notifications (3): remote-dialog, toast, unread-badge
  - Data visualization (1): chart — a deliberate single-item group;
    the domain is distinct and the index already models it this way.
- **P1b Live counts.** A tiny `Count.astro` (`<Count of="recipes" />`)
  reading `packages/core/dist/manifest.json` (the docs build already
  chains the core build) and a `templates` glob; replace every
  hand-written count on the landing pages (en + ja). Numbers can no
  longer rot — same CI-verified source as `/api/manifest.json`.
- **P1c Sidebar ergonomics.** Integrations in explicit journey order
  (htmx → plain-html → frameworks → hyperscript → html-email);
  `collapsed: true` on all top-level groups except Start and on the
  Components / Recipes subgroups (Starlight auto-expands the active
  trail).

## Phase 2 — hubs and reverse links

- **P2a Data grid guide** at `recipes/datagrid.mdx` (safe: the
  manifest enumerates root `recipes/<name>/` scaffold dirs, not docs
  pages), heading the Data grid sidebar group as "Overview". Maps the
  subsystem in build order — display (component + template) → operate
  (pager/sort/filter/columns/prefs/row-detail/saved-views) → edit
  (edit-errors/edit-conflict) → scale (bulk/infinite/snapshot/tree/
  result-cap) — each stage a "You need to… | Recipe" table. Linked
  from the datagrid component page, the data-grid-page template, and
  the recipes index (+ ja twins).
- **P2b Used-in-recipes.** `UsedInRecipes.astro` inverts the
  recipe→component links at build time (`import.meta.glob` over the
  locale's recipe pages, matching `/components/<slug>/` hrefs) and
  renders a "Used in recipes" list; added under Related on every
  component page at least one recipe links to (en + ja). Generated, so
  it cannot go stale as recipes are added.
- **P2c Tokens → Theming.** Rename the top-level section label and the
  `tokens/index.mdx` title to *Theming* (ja: テーマ). URLs unchanged —
  no redirects, no link churn; resolves the double "Tokens" entry.
  (Relocating `tokens/variants.mdx` is deliberately out of scope; noted
  as a follow-up.)

## Phase 3 — audiences and vocabulary

- **P3a Fundamentals split** into two labelled subgroups — Core
  concepts (naming, tokens, layout, responsive, i18n, accessibility)
  and Deep dives (print, errors, audit-trail, writing, motion, icons,
  anchored) — sidebar + the index's reading-order list (en + ja).
- **P3b Synonym audit.** An *Also known as:* line after the intro
  paragraph of every component/recipe page with a well-known alias
  (modal, snackbar, typeahead, wizard, cascader, dual listbox,
  optimistic locking／排他制御, 二重送信防止, …), both locales, so
  Pagefind matches the words users actually type. One uniform,
  greppable format: `*Also known as: …*` / 「別名: …」.

## Non-goals

- No URL moves, no redirects (every slug stays).
- No content rewrites of recipe/component bodies beyond the alias line
  and Related additions.
- No new top-level sections (the grid hub lives in Recipes).

## Verification

- `pnpm -w run docs:build` — links validator over the full route graph.
- `node apps/docs/scripts/check-i18n-drift.mjs origin/main HEAD` — the
  CI ja-parity guard, run locally.
- Manual: sidebar renders grouped + collapsed in `docs:dev`, counts
  match the manifest, UsedInRecipes lists are non-empty where expected.
