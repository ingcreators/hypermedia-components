# HC Docs Clarity Plan — full-site review for framework users

Status: **shipped in full** (2026-07-04, PRs #349–#354: the plan,
four docs batches — #350 breakage, #351 component template, #353
recipes, #352 connective tissue — and the #354 toast Escape fix).
Review basis: all 125 English pages read against origin/main
`512c0b2`, claims verified against core sources; ~85 findings, all
addressed or explicitly deferred in §Out of scope. Reader persona:
a server-side framework developer (Rails / Django / Thymeleaf / Razor /
htmx) emitting HC markup from templates.

Every docs-page change ships **en + ja in the same PR** (the #339
drift check enforces it). Findings are batched into four docs PRs +
one component PR, ordered by user impact. Effort: S < M < L.

## Batch 1 — copy-paste breakage & contradictions (S-level)

Things that are wrong, not just unclear. All verified against source.

| # | Page(s) | Problem | Fix |
| --- | --- | --- | --- |
| 1.1 | `start/quick-start` | Toast demo dispatches a non-bubbling event on the button; `installToast()` listens on `document.body` (`toast.js:284`) — the first interactive demo does nothing | Dispatch on `document.body` with `bubbles: true` (kitchen-sink pattern) |
| 1.2 | `components/combobox` | Form participation undocumented: `installCombobox` writes the **display label** into `input.value` (`combobox.js:230`), so plain form posts submit the label, not the code; no example carries `name` | Add "Form participation" section modeled on calendar's "Who carries the form name": `name` example, label-vs-value warning, hidden-input pattern for code values |
| 1.3 | `components/hovercard` | htmx example is gated on `hc:hovercardrequest`, an event the behavior never fires (no dispatch in `hovercard.js`) | Replace with a working trigger-side pattern (`data-hx-trigger="mouseenter once, focus once"`); link the lazy-panel recipe |
| 1.4 | `components/tabs` | Example uses `<hc-spinner></hc-spinner>` — no custom elements exist in this kit | `<span class="hc-spinner" aria-hidden="true"></span>` |
| 1.5 | `recipes/live-search`, `recipes/filter-popover`, `recipes/remote-dialog` | Copy-paste markup uses classes that do not exist in core: `hc-search`, `hc-list`, `hc-form` | Replace with real classes or remove (class names are public API per VERSIONING.md) |
| 1.6 | `recipes/toast` + `recipes/toast/contract.md` | Detail-shape table omits shipped `id` (update-by-id) and `action` — undo-delete and sse-toast link here for exactly those | Add both rows + a short "Action button / update-by-id" section in page and contract |
| 1.7 | `components/slider` | Stale "Range constraints (single thumb)" section recommends two linked sliders "until multi-thumb lands" — `hc-range` shipped; Related omits it | Replace section with a pointer to `hc-range`; add Related entry |
| 1.8 | `tokens/density` | Page contradicts itself: table says `sm`/`lg` shift with density (correct per `density.compact.tokens.json`); tail section claims they are independent. Also a garbled 3-row table and missing vars in the tail list | Delete the stale tail claim, repair the table, complete the var list |
| 1.9 | `integrations/rails`, `django`, `razor` | CSRF sections teach hand-written `htmx:configRequest` hooks although the blessed `installCsrfHeader()` convention (auto-init, `behaviors.js:88`) makes Rails zero-config and Django/Razor a one-line `<meta data-header>` | Two-tier rewrite: convention first, manual hook only for genuinely dynamic header names (Thymeleaf case) |
| 1.10 | `integrations/razor` | Broken `HX-Trigger` serialization example (self-admitted) is presented first | Lead with the working `JsonObject` version; demote the broken one to a caution |
| 1.11 | `components/meter` | htmx example triggers on `hc:uploaded from:body` — not a kit event, no note that it is app-defined | Note "your app fires this" or switch to `every 30s` |
| 1.12 | `components/pagination` | "Disabled" prev/next uses `pointer-events:none` only — keyboard users still activate `href="#"`; server contract implicit; `data-hc-rel` undocumented | Guidance: omit `href` at boundaries; add one server-return sentence + datagrid-pager link; mention `data-hc-rel` |
| 1.13 | Link/text hygiene (batch) | `button` Related unlinked; `input` live-search unlinked; `progress` missing file-upload link; `table` missing datagrid signpost; `reference/index` lists 2 of 4 pages; `request-action` "when shipped" + spinner link to index; `confirm-action` Related unlinked; `htmx`/`hyperscript` Related point at integrations index; `plain-html`/`htmx` size numbers contradict `reference/size`; `themes` `data-theme` link points at site root; `performance` "nothing merges through it" phrasing; `introduction` "early development" note | Fix all; size numbers become approximations linking `reference/size` |
| 1.14 | `components/toast` | Sticky toasts (`duration: 0`) recommended for important messages but keyboard-undismissable (no close/Escape in `toast.js`) while a11y section assumes auto-dismiss | Docs rule now: "a sticky toast must carry an `action`"; component fix in Batch 5 |

## Batch 2 — cross-page template unification (components)

| # | Scope | Problem | Fix |
| --- | --- | --- | --- |
| 2.1 | All behavior-backed component pages (~30; complete today on only ~5) | Auto-init vs opt-in, idempotency, uninstaller, htmx-swap pickup stated inconsistently or not at all (carousel, combobox, drawer, dialog, dropzone, menu, menubar, navmenu, hovercard, multicombobox, sparkline, slider, tabs, tooltip, toc…) | Standard 2-line block under every install snippet: "Included in the zero-config `/behaviors` bundle. `installX()` is idempotent and returns an uninstaller; swapped-in content is picked up." Sparkline gains its missing import snippet; dialog names `installCloseDialog` |
| 2.2 | popover / navmenu / multicombobox / menubar / accordion / combobox / rating / scroll-area | "Browser baseline" blocks vary in presence, format, position (menu leads with it, pushing markup off the first screen) | One standard 2-row block (feature / fallback sentence), placed after the feature sections, before Accessibility; menu's moves down; missing pages gain it |
| 2.3 | aspect / button-group / context-menu / shell / stepper / tree / range / multicombobox / dropzone | Tail template drift: missing "Theming tokens" or "CSS variables" headings; dropzone has real `dropzone.*` tokens but lists none; token-less pages need the "None of its own —" stub under a proper heading | Normalize every tail to Accessibility → Theming tokens → CSS variables (`<details>`) → Related |
| 2.4 | datagrid | 7 events + many `data-*` scattered over 635 lines with no consolidated reference | Add an Events table (name / target / detail) and a per-feature `data-*` summary table |
| 2.5 | code | "Server-tokenized" component with no htmx section | 10-line round trip: editable POST → server returns tokenized read-only/diff fragment |
| 2.6 | shell | No htmx section on the page where `hx-boost` + swap-only-`__main` is the canonical question; "Theming tokens" heading missing | Add both |
| 2.7 | multicombobox | `.hc-multicombobox__empty` authorship ambiguous; `data-hc-empty` completely undocumented; CSS variables section missing; server-lens sentences missing | Anatomy table with Required column; document `data-hc-empty`; add CSS vars details; add "server returns…" sentences |
| 2.8 | stepper / tree / dropzone / rating | Newer pages below the bar: prose-only Sizes, run-on token lists, missing baseline note (rating `:has()`), missing size demos | Bring to house format with demos + tables |
| 2.9 | tabs / inputotp / splitter / toggle-group / calendar / kbd | Misc: `hc:tabactivated` contract undocumented; raw `hc-preview` divs without code slots; toolbar/separator + toolbar/shell spacer idiom cross-references | Document the event; convert to `<Demo>`; add the two cross-reference sentences |
| 2.10 | accordion / carousel | Anatomy table missing (`__icon` optionality unclear); pre-rendered dots example promised but absent | Add Anatomy table; add dots example |

## Batch 3 — recipes

| # | Scope | Problem | Fix |
| --- | --- | --- | --- |
| 3.1 | All 23 recipe pages + index | `npx @hypermedia-components/cli add <name>` mentioned nowhere; `hc validate` on only 5 pages; contract.md linked from only half | Standard aside on every page (cli add + validate + contract link); index gains a CLI intro |
| 3.2 | cascading-select, data-region, lazy-panel, live-search, filter-popover, datagrid-pager, request-action | Old-generation pages lack the Request→Response contract table the new generation established | Retrofit the standard table |
| 3.3 | live-search, data-region, datagrid-pager, filter-popover | No failure-path notes (live-search's exists in contract.md but not the page) | 2–3 line "On failure" note each (htmx keeps prior state on non-2xx; HX-Trigger toast pattern) |
| 3.4 | datagrid-pager | First page fetched client-side (`hx-trigger="load"`) → empty table without JS; no PE section | Server-render page 1; add PE section (`href` fallback + `HX-Request` branch) |
| 3.5 | inline-edit | 422 answer diverges from page↔contract and from the kit-standard `htmx:beforeSwap`; display state is a keyboard-unreachable `<span>`; inline `onkeydown` | Align on the standard; promote button-based display form; drop inline handlers |
| 3.6 | remote-dialog | Inline `onclick` in blessed markup; invalid `<button>`-inside-`<a>` PE advice | Declarative dismiss pattern; link-as-trigger rewrite |
| 3.7 | lazy-panel | Hand-rolled tab switching although `hc-tabs` exists | Rewrite with `hc-tabs` or link it |
| 3.8 | index | Bullet lists hard to scan; no synonyms | Table per category (Recipe / what you need / needs-behavior); weave in search synonyms |

## Batch 4 — new connective tissue (IA)

| # | Item | Fix |
| --- | --- | --- |
| 4.1 | "How HC works" one-screen cheat sheet | New fundamentals page (or index rewrite): the six conventions + the 5-axis table (`data-theme`/`data-color`/`data-neutral`/`data-density`/`dir`) — currently assembled nowhere |
| 4.2 | CDN path buried | installation gains a "CDN (no build)" first-class section + a save-and-open single-file example; quick-start links htmx CDN |
| 4.3 | Behaviors reference table | New reference page: behavior → component/recipe → auto-init? (44 rows) |
| 4.4 | tokens/index is a 6-line stub | Real landing: 4-layer model, axis quick table, "change your brand color" quick answer; `data-theme` gets a canonical home; explicit sidebar order |
| 4.5 | fundamentals sidebar | Alphabetical autogenerate contradicts the stated reading order — explicit items array; index lists all 9 pages |
| 4.6 | Landing page routing | Hero/cards route the four intents (evaluate / install / copy / integrate); kitchen-sink linked from landing + introduction |
| 4.7 | philosophy "so what" lines; blocks layout-utility cleanup | Each principle gains a one-line consequence; blocks' raw flex styles → `hc-stack`/`hc-cluster` |

## Batch 5 — component-side changes (code, not docs)

| # | Item | Fix |
| --- | --- | --- |
| 5.1 | Sticky toasts keyboard-undismissable | `installToast()`: Escape dismisses when focus is within the region (+ tests); docs follow |
| 5.2 | hovercard htmx event | Resolved doc-side in 1.3 (no component change — the trigger-side pattern is strictly simpler) |

## Out of scope

- Live demos for more recipes (L; revisit after the batches).
- Toolbar spacer idiom unification in CSS (docs cross-reference only for now).
- ja-locale-specific IA (mirrors en).

## Good patterns the batches propagate (found during review)

calendar "Who carries the form name" · checkbox wire-contract framing ·
toast "Update by id" server lens · select native-forward baseline
honesty · tabs decision table · empty Anatomy-with-Required table ·
"What `installX()` does" contract lists · i18n completeness guarantee.
