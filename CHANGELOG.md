# Changelog

All notable changes to Hypermedia Components are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

Sections used:

```text
Added       — new features
Changed     — changes in existing functionality
Deprecated  — soon-to-be removed features
Removed     — features removed in this release
Fixed       — bug fixes
Security    — security-relevant changes
```

---

## [Unreleased]

### Added

- Docs information-architecture overhaul
  ([plan](plans/hc-docs-ia-plan-en.md)) — findability work at the
  68-component / 53-recipe scale, no URL moves:
  - the Recipes sidebar and index share nine goal groups (Forms /
    Form safety / Actions / Business flows / Data grid / Search &
    filter / Loading & regions / Server push & chat / Overlays &
    notifications) instead of a flat alphabetical 53-entry list;
  - `recipes/datagrid` — the **Data grid guide**, mapping the
    component, the page template, and the thirteen grid recipes in
    build order (display → operate → edit → bulk & scale);
  - landing-page counts are generated from `manifest.json` at build
    time (`Count.astro`), replacing hand-typed numbers that had
    rotted to "25 recipes";
  - component pages gain a generated **Used in recipes** list
    (`UsedInRecipes.astro` inverts the recipe pages' component links
    per locale — 28 pages today, self-updating);
  - the Tokens section is relabelled **Theming** (ja: テーマ) — URLs
    unchanged — ending the collision with Fundamentals → Tokens;
  - Fundamentals splits into **Core concepts** (six must-reads) and
    **Deep dives**; Integrations is ordered by journey (htmx →
    plain-html → frameworks); sidebar groups are collapsed at rest;
  - a search-synonym sweep adds a uniform *Also known as* / 別名 line
    to 86 component and recipe pages (both locales), so Pagefind
    matches modal / snackbar / typeahead / 楽観ロック / 二重送信防止
    and the rest of the names users actually type.

- `fundamentals/audit-trail` guide — who changed what, when, as
  doctrine: the appended row (`actor` from the session never the
  form, domain verb, server clock, `request_id`, one-sentence
  summary, changed-fields before → after), write points mapped to
  the shipped contracts (409 losers and 422s write nothing; bulk
  writes per-row + batch; undo-delete writes delete *and* restore;
  **idempotency-key replays write no second entry** — the trail is
  exactly-once because commits are), append-only with corrections as
  new entries, and the hc-timeline read side (`data-hc-time` dates,
  lazy-panel loading, `beforeend` load-more, hc-code diffs on
  demand). Docs-only, EN + ja; the fundamentals reading-order list
  also regains its missing `print` and `errors` bullets (docs drift).
  ([plan](plans/hc-gap-followups-plan-en.md))
- `templates/confirm-page` — the 入力 → 確認 → 完了 flow as a full-page
  template: one `#flow` region with whole-region `outerHTML` swaps
  (the multi-step-form shape), an input step that 422s into field
  errors, a **review step the server renders from what it parsed**
  (the read-back is the point) with the values as hidden fields and
  an idempotency key **minted at the review render**, a named-button
  Back (`formnovalidate`, never `history.back()`), and a done step
  whose double submit replays the same receipt. Zero new JS/CSS;
  live demo + dedicated demo API + tests. The templates index also
  gains its missing `data-entry` row (docs drift).
  ([plan](plans/hc-gap-followups-plan-en.md))
- `network-retry` recipe + **`installNetworkRetry()`** — surface the
  request that got no answer at all (offline / dropped socket /
  declared `data-hx-request` timeout), the one error with no server
  response to narrate with: `htmx:sendError` / `htmx:timeout` render
  a retry `hc-alert` (`role="status"`, i18n keys `networkRetry.failed`
  / `networkRetry.retry`, per-host `data-hc-network-retry-message` /
  `-label` overrides) into the client-owned `[data-hc-network-retry]`
  host — one slot latest-wins, re-rendered never stacked. Retry
  re-issues through `htmx.ajax(verb, path, { source })` with no
  values override (a fresh attempt re-collecting current inputs, so
  an idempotency-key field rides along unchanged — the marquee
  pairing); any real response on the failed element clears the
  banner, the failure's own status 0 never does; never auto-retries.
  The fundamentals/errors map gains its "(no response)" row. Live
  demo + demo API included.
  ([plan](plans/hc-gap-followups-plan-en.md))
- `unread-badge` recipe — the notification count in app chrome as a
  wire contract: the fragment is the nav item (badge + accessible
  name change in the same swap; the `hc-badge` is `aria-hidden`
  presentation), it polls itself (the async-job self-swap rule, so
  the server owns the cadence), zero renders no badge, past the cap
  display and name both say "more than N", the fragment is never a
  live region, and every response that changes unread state ships
  the corrected fragment out-of-band. `data-hc-unread` is a contract
  marker only. Zero new JS/CSS; live demo + demo API included.
  ([plan](plans/hc-gap-followups-plan-en.md))
- `async-job` recipe — one contract for work that outlives a request
  (CSV exports, PDF rendering, batch imports): the kick-off answers
  `202` with a job card that polls itself (`data-hx-target="this"` +
  `outerHTML`, so terminal cards stop polling by carrying no trigger
  and the server owns the poll cadence), with enumerated terminal
  states (done / failed / cancelled / expired-as-tombstone) and
  no-op-200 cancel. Zero new JS/CSS; live demo + demo API included.
  ([plan](plans/hc-business-flow-contracts-plan-en.md))
- `line-items` recipe — the order/quote/invoice detail table as a
  hypermedia contract: rows align positionally by repeated names
  (tree-order serialization), add/remove/recalculate are the same
  whole-form POST + `outerHTML` swap, the server owns all arithmetic
  (totals render "—" while any row is invalid), and 422 echoes the
  bad raw value back. Zero new JS/CSS; live demo + demo API included.
  ([plan](plans/hc-business-flow-contracts-plan-en.md))
- `reference-lookup` recipe — the master-reference field (F4-style):
  a visible `*_code` input validated on `change`, a hidden `*_id`
  (opaque token) as the submitted identity, a remote-dialog +
  live-search picker whose rows re-render the whole field, inactive
  masters rendered visible-but-refused, and the rule that an
  unresolved code always clears the id. Zero new JS/CSS (composes
  `installRemoteDialog()`/`installCloseDialog()`); live demo +
  demo API included.
  ([plan](plans/hc-business-flow-contracts-plan-en.md))
- `workflow-actions` recipe — a record's lifecycle as a
  server-rendered actions region: the server renders only the legal
  transitions (can-never = not rendered; could-but-not-now =
  `aria-disabled` + reason), the verb is the button and the version
  rides along, whole-region `outerHTML` swaps keep state / version /
  stepper / buttons in lockstep, comment-required transitions `422`
  with the field rendered only then, and stale or illegal transitions
  `409` with the region re-rendered from current truth. Zero new
  JS/CSS; live demo + demo API included.
  ([plan](plans/hc-business-flow-contracts-plan-en.md))
- `idempotency-key` recipe — server-side duplicate-submit defence:
  one fresh opaque key per rendered form, first commit stores
  `key → (request-hash, response)`, a replayed key gets the original
  response back (never an error), same-key-different-payload is a
  real `422` conflict, and validation failures leave the key live so
  the corrected resubmit can commit. Composes with PRG, async-job
  kick-offs, workflow transitions, and session-expiry replays. Zero
  new JS/CSS; live demo + demo API included.
  ([plan](plans/hc-business-flow-contracts-plan-en.md))

- `result-cap` recipe — bound what one search may return: `LIMIT cap+1`
  detection, "cap+" counts, and a persistent truncation banner
  (`hc-alert` warning, `role="status"`, marked `data-hc-result-cap`) or
  a documented hard-reject mode for process-everything work queues.
  Zero new JS/CSS; live demo + demo API included.
  ([plan](plans/hc-result-cap-snapshot-plan-en.md))
- `datagrid-snapshot-pager` recipe — freeze a work queue's membership
  at search time: the form carries every hit's opaque row key
  (`name="keys"`, tree-order serialization), paging POSTs the whole
  ordered list and the server slices; processed rows stay visible as
  processed, vanished rows render as tombstones, and page boundaries
  never shift under the user. Composes with `datagrid-bulk-actions`
  (`keys` vs `ids` naming rule) and `result-cap` (the cap bounds the
  snapshot). Zero new JS/CSS; live demo + demo API included.
  ([plan](plans/hc-result-cap-snapshot-plan-en.md))

- `hc-popover__body` / `hc-popover__footer` — the structure parts the
  datagrid filter / sort / column panels already used are now real:
  a stacked, fieldset-resetting body (`--hc-popover-body-gap`) and an
  end-aligned action row (`--hc-popover-footer-gap`; separation via
  padding, so unlayered host margin-resets can't collapse it).
  Documented on the popover page with the panel pattern.

### Changed

- The multicombobox selected check mark is painted through a CSS mask
  instead of a hardcoded-color data-URI image, so the documented
  `--hc-multicombobox-option-check-color` token actually applies: the
  glyph now follows `data-color` accents (it was sRGB blue-600 under
  every theme) and renders in `SelectedItem` under forced colors.

### Fixed

- Full interactive QA pass over every live demo (72 pages driven in
  headless Chromium — all 53 recipes, the 5 templates, and the
  overlay components — with generic invariants after every step:
  console/page errors, 404/5xx, duplicate ids, open dialogs and
  popovers visible inside the viewport, `data-side` popovers anchored
  near their triggers, progress/meter content boxes not squashed, and
  DOM lints for the two bug classes below). Three additional defects
  found and fixed:
  - `installNetworkRetry`: a retry that failed again surfaced an
    uncaught promise rejection (`htmx.ajax` rejects with undefined) —
    the failure path is already handled by the sendError/timeout
    re-render, so the rejection is now swallowed.
  - data-entry template (demo + skeleton, en + ja): the form-level
    `data-hx-disabled-elt="find button[type=submit]"` was inherited
    by the postal-lookup input and the autosave div, which have no
    submit-button descendants — htmx logged an error on every lookup
    and every draft tick. The form now carries
    `data-hx-disinherit="hx-disabled-elt"`, with the reason
    documented in the skeleton comment.
  - The docs site had no favicon at all — every page load 404ed on
    `favicon.svg`. Added the mark (accent square, "hc").
- async-job: the job cards put their contents — including the
  `<progress>` — directly under `.hc-card`, so the card's
  loose-content padding landed on each child; with `box-sizing:
  border-box` the 0.5rem-tall progress became a 2rem all-padding bar
  whose content box (where the fill paints) had zero height — the bar
  looked inert at any percentage. Card contents now ride in a
  `hc-card__body` stack (demo, scaffolds, page fences, en + ja).
- line-items: the remove button was `name="remove"`, and named form
  controls shadow the form element's DOM API — `form.remove` became
  the button, htmx's `outerHTML` swap of the form threw on
  `target.remove()`, and the old form never left the page: every add
  / remove / recalc **duplicated the whole table**. Renamed to
  `name="remove-row"` across the demo, scaffold, contract and pages,
  with a documented caution (the same trap bites `submit`, `action`,
  `method`, `reset`, `elements`).
- Demo & code quality audit (every component/recipe/template page's
  live demo and Code tab reviewed against the shipped CSS/JS and the
  demo API, both locales):
  - **Core**: the tabs overflow chevrons read an undefined
    `--hc-tabs-tab-color` (now `--hc-tabs-tab-fg`); keyboard focus on
    menu items now consumes the documented
    `--hc-menu-item-focus-bg` instead of silently reusing hover;
    `hc-datagrid`'s error slot gained the missing
    `data-tone="warning"` rule so a confirmable warning row no longer
    wears the rejection palette.
  - **Live demos, browser-verified**: reference-lookup's searcher
    dialog no longer closes on the first search keystroke (the
    live-search form opts out of close-on-success); remote-dialog's
    422 re-opens the dialog in its error state (retargeted at the
    dialog root — the old closest-dialog outerHTML landed a closed,
    invisible dialog); row-detail's *Open selected* no longer
    navigates the whole page to the API URL (one 303 serves both
    paths, exactly the contract); lazy-tree's restricted branch
    answers a No-access leaf (an empty 200 could never clear
    `aria-busy`); bulk-errors' failure toasts are sticky
    (`duration: 0`) and its dead report link is explicitly
    illustrative; the docs' mobile display-settings pickers work
    (per-instance ids — five ids were duplicated on every page).
  - **Docs**: data-region rewritten around the contract's outerHTML
    self-replacing shape; HX-Retarget/HX-Reswap no longer presented
    as an alternative to the 422 `beforeSwap` allowance (they only
    steer a permitted swap); phantom classes removed everywhere
    (`hc-list`, `hc-item__label` → `__title`,
    `hc-input-group__addon` → `hc-input-addon`, `<hc-spinner>`,
    `hc-code__legend`, `hc-form`, `hc-toolbar__separator`); shell
    hamburger fences regained `hc-shell__toggle`; token tables
    reconciled with the CSS (missing calendar-range / switch-warning /
    inputotp / dialog-duration / datagrid zebra & attention / field
    applied-marker entries added; never-consumed avatar-border and
    multicombobox check-color removed; bad `-sm-`/`-label-` shorthand
    expansions fixed); label wrappers, aria wiring and
    `type="button"` restored across fences; scaffold contracts
    normalized to the `data-hx-swap-oob` spelling.

## [0.3.0] - 2026-08-29

The data-grid release: the operations a business grid is actually used
for, PRs #487–#577. Eight new recipes (44 total) — `datagrid-sort`,
`datagrid-filter`, `datagrid-prefs`, `datagrid-tree`, `datagrid-edit-errors`,
`datagrid-edit-conflict`, `datagrid-bulk-errors`, `row-detail` — a fourth
page template (*Data grid page*, 4 total), the `hc-filterbar` component
(67 stylesheets), four new behaviors (`installRangeValue()`,
`installMultiValue()`, `installRowLink()`, `installSortList()` — 57 total),
the `.hc-fill` layout utility, row ordinals, and collapsible splitter
rails.

Minor rather than patch because of one behaviour-default change: bare
`<a>` now takes the theme's link colour (see *Changed*). Everything else
is strictly additive. The CLI ships 0.4.2 to re-bundle the eight new
recipes; `@hypermedia-components/editor-kit` is unchanged and stays at
0.2.0.

The link work reached the **email** render target too, where it turned up
a defect of its own: the dark flavor had been leaving links and tables on
their light colours — 2.77:1 and 1.21:1 against the dark container — because
a fragment can only be re-coloured by the dark media query if it carries an
`hc-em-*` class, and neither had one (see *Fixed*).

### Added

- **tokens / base**: **document-level link colours** —
  `--hc-color-link`, `--hc-color-link-hover` and `--hc-color-link-visited`,
  generated per theme like every other token, plus bare-anchor rules in
  `@layer hc.base`. `hc.base.css` already owned the document's background
  and text but stopped short of `<a>`, so every anchor outside a component
  fell to the UA's `-webkit-link` blue and `:visited` purple — two colours
  that follow neither `data-theme`, `data-color` nor `data-neutral`, and on
  a dark surface the visited purple is close to illegible. This is what an
  app hits wherever it renders prose rather than components: a description
  field, a rendered markdown cell, an error page body.

  The `:visited` half is the part a consumer **cannot** write. Engines
  refuse to resolve `var()` in a visited-dependent declaration on purpose —
  resolving it would let a page read the history bit back out through the
  cascade — so the colour has to be a literal, which means it cannot be a
  token. The build bakes one literal per theme instead, straight off the
  same declaration it emits `--hc-color-link-visited` from, so the rule and
  the token cannot drift.

  Links are also the one accent value that is theme-dependent. Every other
  accent token holds one value in both themes, because ramp step `600` is
  white-text-safe on any hue; a link is text on the page surface instead,
  and no single rung clears 4.5:1 against both backgrounds (`blue.500` is
  3.61:1 on light, `blue.600` is 3.33:1 on dark). Light reads
  `600`/`700`/`800`, dark reads `400`/`300`/`200`, and each non-default
  accent gained a `color.<name>.dark.tokens.json` emitted under the
  compound `[data-theme="dark"][data-color="<name>"]` selector — the same
  two-form selector the neutral ramps already use. All fifteen colours are
  pinned at AA against `--hc-color-bg` and `--hc-color-surface` by a spec, so
  a future re-ladder cannot quietly drop one below 4.5:1;
  `--hc-color-muted-bg` sits outside that guarantee on purpose, being a
  component tint whose foreground the component owns — and `hc-chat` now
  does own it: an assistant bubble is painted with `muted-bg` and is prose,
  so a link genuinely lands there, and the document's resting step would
  score 4.40:1 (light) / 3.85:1 (dark) on it. A bubble re-pins its links one
  rung further along the same ramp. It carries no `:visited` rule, which is
  not an oversight: a layer beats specificity and `hc.components` sits after
  `hc.base`, so the resting rule covers the visited state too. Visited is
  unified with unvisited inside a bubble — partly the console-not-a-browser
  argument, partly arithmetic, since the bubble's surface leaves only two
  usable rungs in dark (the third, `accent.100`, scores 1.08:1 against the
  bubble's own text and would read as body copy). The theme builder learned
  the same trio, so a custom theme re-themes its links too.
  ([#569](https://github.com/ingcreators/hypermedia-components/issues/569))


- **docs**: the template says **when a fixed-height grid is the right
  shape** — and when letting the page scroll is. It is the operational
  pattern (Fiori list reports, Salesforce list views, ServiceNow, AG
  Grid, Ant Design's `scroll.y`) and it needs four things to be true:
  the screen is an app frame, there is a fallback under the breakpoint,
  print un-caps the scrollport, and the rows are paged rather than
  infinite. If any is false, page scroll plus a sticky header buys most
  of the benefit for none of the cost.


- **docs**: the **data-grid page template works now**. Its rows,
  conditions bar, pager, failure summary and docked panel are answered
  by the docs demo API, so the contracts can be watched meeting each
  other instead of being described one page at a time: filter and
  remove a chip, sort (paging stays stable because ties break on the
  primary key), open a record from its identity cell — the peek carries
  the exit at the start and `n / 24 ‹ ›` at the end, and **Next crosses
  the page boundary** because the server re-runs the query — save and
  see the row behind update out of band, then tick rows and press
  Approve to watch some fail: rows marked, one line of chrome with the
  moves and *Show only failed*, and the breakdown waiting in the docked
  panel's rail. The full-size preview is the same screen with the
  viewport to itself.


- **docs**: the data-grid page template gets a **full-size preview** at
  its own URL. The template is about a screen that takes the whole
  viewport — chrome fixed, the grid taking the rest — and showing it
  inside a documentation column is a picture of the idea rather than
  the idea; at 36rem tall next to a 9rem sidebar it was simply too
  small to read. The embedded demo is taller now, and *Open the
  full-size preview* leads to a plain, chrome-free route where the
  template owns the screen. One markup source serves both: the demo
  component takes a `standalone` prop and swaps its wrapper.

- **layout**: **`.hc-fill`** — take the remaining space of a flex
  column and let the children scroll. The composition every full-height
  app screen needs, previously written as a structural rule in the
  data-grid template (`.page > form > .hc-datagrid`), which was wrong
  twice: **a page may hold several grids** — a detail screen stacks a
  header grid, a lines grid and a history grid, and only one of them
  should take the remaining height — and a descendant rule **stops
  matching the day someone wraps the grid in a `<div>`**, silently,
  with the symptom (the page scrolls instead of the grid) showing up
  nowhere near the change. It carries both minimums, one per axis, and
  goes on every element between the column and the filling region,
  including a wrapping `<form>`. On an `hc-datagrid` it also switches
  `--hc-datagrid-max-height` from the default `70vh` — right for a grid
  *inside* a scrolling page — to `100%`, right for a grid that **is**
  the page.

- **components**: `hc-splitter` panes can **collapse to a rail** —
  `data-collapsed` gives a pane its content's size, hands the freed
  space to its sibling (a fixed `--hc-splitter-pos` basis would leave a
  hole) and hides the drag handle, since there is nothing to drag. The
  state belongs to whoever owns the pane's content, so a server
  re-rendering that region sets it on the fragment it already sends —
  no client state, and the two panes cannot disagree. **Collapse to a
  rail, not to nothing**: a panel that disappears when closed is a dead
  end for the person who closed it. The `datagrid-bulk-errors` docked
  panel adopts it: collapsed is the **default**, the rail carries the
  count (`Reasons (5)`), and **the response does not open it** — the
  summary already said what happened, and giving away the grid's width
  is the reader's decision. A screen whose job *is* triage may start
  open; whether it is open is workspace state, remembered per user
  rather than in the URL.

- **docs**: the `datagrid-bulk-errors` demo now **shows the docked
  panel** the contract describes, instead of only describing it. The
  chrome keeps one line — count, prev / next, *Show only failed* — and
  the grouped breakdown rides to an `hc-splitter` panel beside the
  grid, resizable by pointer or keyboard, collapsing when there is
  nothing to report. The panel is a **server-owned region**: hiding it
  is a response (`GET /report?close=1`), not client state, so the two
  surfaces cannot disagree.

- **recipes**: the bulk-error summary is also the **navigator**.
  Twelve failures scattered through five thousand rows is a queue, so
  the O(1) line carries `Previous · Error 3 of 12 — row 137 · Next` as
  **real `#row-<id>` fragment links** with a server-rendered counter:
  Back works, the keyboard works, `installDatagrid()` lands the *active
  cell* on the row a fragment names, and there is no client state to
  drift from the panel. Rows are named by **id** and the ordinal is
  *shown* beside it, because ordinals move when the sort or the
  conditions change and ids do not. A **Go to row** control
  (`?goto=137`) covers the number somebody read out loud — the server
  resolves the ordinal to the page that contains it, since only it
  knows where row 137 currently is.

- **recipes**: `row-detail` gains the **walks**, with a live demo. Two
  sequences, one shape: the **result set** (`seq=list` — the server
  resolves neighbours by re-running the list query, so *Next* crosses a
  page boundary without the client knowing pages exist) and the
  **selection** — tick rows, *Open selected (N)* posts the same `ids`
  every other bulk action sends, and the answer is a **`303`** to the
  first record of an **ordered snapshot**. A record that vanished
  mid-walk is a **tombstone step** with *Next* still working, because
  aborting at the first gap makes the feature untrustworthy exactly
  when data is moving; an unreadable or expired snapshot **fails
  closed** (`410` + a way back), never a silent fallback to walking
  everything. The data-grid page template adopts the identity-cell link
  and *Open selected*.

- **recipes**: **`row-detail`** + `installRowLink()` /
  `data-hc-row-link` — the most-used interaction on a business list,
  and the one every app reinvents: *open this record, work on it, come
  back, open the next one*. The link is an ordinary `<a href>` in the
  row's **identity** cell, so middle-click, ⌘-click, copy-address,
  Back, the keyboard and the no-JS path all work without any of them
  being re-implemented; the behavior adds only what an anchor cannot do
  itself, **Enter anywhere on the row**. Editing wins where it applies
  (the datagrid cancels the event before opening an editor), a control
  that owns its Enter keeps it, and a modifier means the user asked for
  something else. **The row is deliberately not one big link** — the
  datagrid ships text selection, range selection and TSV copy, and a
  stretched anchor eats all three. Coming back is the part everyone
  drops: the list URL already carries the conditions, sort, columns and
  page, so the detail's *Back to list* is that URL plus `#row-<id>`,
  which `installDatagrid()` lands the active cell on. After a save the
  detail **`303`**s there instead, because a restored snapshot shows
  the data as it was before the user's own edit. The contract also
  covers the peek rendering (canonical href kept), and walking a
  sequence — the result set (`seq=list`) or **the selection** (an
  ordered snapshot token, a tombstone step for a record that vanished,
  `410` and fail-closed on expiry).

- **datagrid**: **row ordinals** — `data-row-no` on a row and
  `data-row-total` on the grid, from which `installDatagrid()` derives
  `aria-rowindex` and `aria-rowcount`. A business grid is discussed out
  loud ("row 137 is the one that failed") and the record id is right
  for the system but wrong for the sentence. The ARIA numbers count DOM
  rows *including* header rows while a server counts matching records,
  so the offset is derived here rather than asked of every server —
  getting it wrong is an off-by-header nobody notices without a screen
  reader. It also fixes a lie the kit has been telling: without these
  attributes a paged grid announces "row 3 of 40" on page four. Two
  rules keep the number honest — **the ordinal is a locator, the id is
  the identity** (ordinals move when the sort or the conditions change,
  so anything stored names the id and merely displays the ordinal), and
  **it counts the result set, not the page**. An omitted
  `data-row-total` means unknown (`aria-rowcount="-1"`, the honest
  answer for an infinite grid mid-load), and a row the server did not
  number is left unnumbered rather than given a position it does not
  have.

- **recipes**: `saved-views` — **saving asks three things, not one**.
  A dialog that asks only for a name pushes the other two decisions onto
  whoever notices later, so the save form now carries **scope**
  (personal / shared — a department standard is the normal case in
  business software, and silently forking a colleague's view is an
  accident) and **default** (a screen that opens on the wrong question
  wastes a step every day; the bare list URL then `303`s to it, so the
  address bar still shows the real conditions). The server owns the
  rules: **at most one default** — a screen that opens on two different
  questions has none — and `PUT /views/<name>` corrects what a view
  *asks* without ever re-homing it or moving the default, because scope
  and default are not conditions. The strip labels shared and default
  views, and every chip offers **Copy link**
  (`data-hc-copy-text`), because a view *is* a URL: sharing one costs
  nothing and needs no shared object at all. The data-grid page
  template's *Save as new…* now opens the dialog it always implied.

- **components**: the filter panel's typography, as reusable API. A
  panel is read far more often than it is filled in, so `hc-grid` gains
  **`data-align="start"`** (items align to the top of their row instead
  of stretching — a three-row textarea stops inflating its neighbour
  into a tall empty box) and **`data-span="full"`** (an item takes a
  whole row; `auto-fill` means *which* items pair up changes with
  width, so nothing may depend on a pairing that holds at one width).
  `hc-field` gains **`data-applied`**, marking a set condition with a
  dot — a scanning aid, since the announcement is the conditions bar
  above the data — with `--hc-field-applied-marker-color` / `-size`.
  `hc-input-group` now strips a nested `<select>`'s chrome, so *value +
  operator* reads as one control with one ring, and **`data-quiet`**
  drops that select's voice (not its hit area or its keyboard) for the
  operator nearly every row leaves at its default. The data-grid page
  template adopts all four, settles on **one vocabulary (Apply)**, and
  makes Cancel a native `formmethod="dialog"` submit instead of inline
  JS. `fundamentals/icons` gains the policy the screen follows: icon +
  label unless the meaning is universal, icon-only for close / overflow
  / pager chevrons, counts in the label rather than a badge, and **a
  gear is not a columns icon** — it reads as screen settings and
  collides with them.

- **docs**: the data-grid page template gets a **columns entry point**.
  The [`datagrid-columns`](https://github.com/ingcreators/hypermedia-components/blob/main/recipes/datagrid-columns/contract.md)
  recipe already existed and the wiring map already named it — what the
  screen lacked was a way in, so the chooser was unreachable. A toolbar
  control opens it, with the count in the label (`Columns (7 of 12)`),
  because a grid missing the column you are looking for is
  indistinguishable from a grid whose data is missing. The template also
  now states the rule the recipe assumes: a column set is a
  **preference**, not a condition — it follows the user between screens,
  so resolution is **URL → user preference → app default**, which is what
  keeps a shared link authoritative.

- **recipes**: **`datagrid-sort`** — the sort set as a control, plus
  `installSortList()` / `data-hc-sort-list`. Header clicks are the fast
  path and stay; what they cannot do is answer *what the current sort
  set is*. Shift-click for multi-sort is undiscoverable, with thirty
  columns the sorted one is usually scrolled out of view, a key on a
  hidden column has no header at all, and re-ordering keys means
  re-clicking headers in the right sequence. So sort gets what the
  conditions got: one surface that is both the read-out (the trigger's
  label *is* the applied set, server-rendered) and the editor (an
  ordered list reordered by `installSortable()`, pointer **and**
  keyboard, with per-key direction, remove, and an **Add a column**
  list that includes columns the grid is not showing). **The order of
  the rows is the order of the keys** — nothing duplicates that state.
  `installSortList()` joins the rows into the unchanged
  `?sort=-ship,order` wire on the `formdata` event, in place, so a
  saved view's querystring comparison still works; without JavaScript
  the per-key `dir-<col>` controls carry the keys, directions **and**
  order, because form entries arrive in DOM order. Add and remove are
  server round trips, because which columns are available is the
  server's knowledge.

- **behaviors**: `installRangeValue()` / `data-hc-range` — **two
  controls, one range param on the wire**. A date filter is a *period*,
  and a period is one condition: one chip in the applied-conditions bar,
  one thing to remove, one value a saved view stores. So the wire
  carries `?f-ship=2026-07-01..2026-07-31`, not `f-ship-from` +
  `f-ship-to` — the two-param shape cannot let a **preset set both ends
  from one control** without a hidden input, and hidden controls keep
  submitting. Each end resolves on its own, so relative
  (`@month-start-1m..@month-end-1m`), **mixed**
  (`@month-start-1m..2026-07-15`) and open-ended (`@month-start..`)
  ranges all work without a special case. The pair of date inputs keeps
  **real names**, so the no-JS path submits a usable request and servers
  accept both shapes; the behavior joins them on the `formdata` event —
  the hook htmx and a native submit both fire — so editing either end
  costs no round trip. **`from > to` is refused, never swapped**: a
  native validity message blocks the submit (and the demo API answers
  `400`, because anyone can type a URL). The `datagrid-filter` demo's
  due-date condition is now a range with period presets, an absolute
  branch, and the offset composer.

- **docs**: **saved views move out of the filter dialog and onto the
  screen**. A list screen is asked four questions — what am I looking
  at, narrowed how, in what order, showing which columns — and each
  reads best with exactly one home; the first is answered beside the
  title by an `hc-menu` whose label *is* the applied view's name.
  Recall was costing four interactions for the screen's most frequent
  act, and a view is a **named URL**, which makes recall navigation
  rather than filter editing. Items are `role="menuitemradio"` (exactly
  one view is applied, with **Show everything** as the none-of-them
  option) and still real `<a href>`s, so views stay bookmarkable,
  middle-clickable and no-JS. The panel keeps only the terminal actions
  of composing a condition set, **Update** and **Save as new…**, which
  also leaves one undo instead of two. The `saved-views` contract and
  recipe page document the menu shape beside the chips strip, and the
  data-grid page template shows it in place.

- **recipes**: `datagrid-filter` documents (and demonstrates) **how a
  relative date gets entered**. The expressions shipped as a wire
  format with no affordance behind them — and nobody types
  `@today-7d`. The control is a server-rendered list of presets whose
  option values *are* the expressions, with the applied one rendered
  `selected` so a saved view reopens showing "This week" rather than a
  raw expression; the server owns the list because it knows which
  presets suit the column. Choosing **Custom date…** *re-renders* the
  field as a date input rather than revealing a hidden one: hidden
  controls keep submitting, so a hidden date input beside a visible
  preset select would send the param twice and leave the server
  guessing. One name, one control, always. Arbitrary offsets ("45 days
  ago") come from a **composer** — a number and a unit, deliberately not
  named after the condition, so nothing claims it until something is
  chosen — which the server composes into the expression and returns as
  a labelled selected option. A relative expression is never put in a
  date input: the browser shows an empty field there and the condition
  is lost on the next submit.


- **docs**: the `data-grid-page` template adopts the filter-UX work
  (`plans/hc-filter-ux-plan-en.md` item G). Its illustrative `hc-chip`
  strip becomes a real [`hc-filterbar`](#) whose chips open their own
  editors and whose remove links drop one param each; one condition is
  **relative**, showing the stored expression *and* what it resolved to
  (`start of this week (2026-08-10)`); the filter panel takes a pasted
  list through `data-hc-multi="lines"`, carries sort in a hidden
  `data-hc-datagrid-sort` field so a saved view captures it, and shows
  the **Modified** state with Update / Save as new / Reset. Export
  became a link carrying the current query and row count rather than a
  bare button. The wiring map gains a row per new contract.


- **recipes**: `datagrid-filter` documents that **export inherits the
  conditions** (`plans/hc-filter-ux-plan-en.md` item F). In a business
  screen "download" means *this question, these columns, every page* —
  not the forty rows on screen — so the export link is the same query
  in another representation, with its href rendered **by the server**
  (only it knows the canonical form of the conditions, and a relative
  expression must travel as the expression so the export means what the
  screen means). Columns come along, resolved the way the grid resolved
  them; the label carries the row count, because an export is a
  commitment and the number is what separates "this page" from
  "everything"; and the page number is the one param dropped. Past the
  point where a request would time out, answer `202` with a job pointer
  — a silently truncated export is a wrong answer that looks like a
  right one.
- **recipes**: `datagrid-bulk-errors` can act on **everything that
  matches**, not only on ticked ids (`plans/hc-filter-ux-plan-en.md`
  item E). Ticking rows stops working before the data does: when 4,873
  rows match, the wanted operation is "archive all of them", and 4,873
  ids fit in neither a querystring nor a form post. A request may now
  carry `scope=matching` plus the conditions themselves — the same
  `f-*` params the list URL uses — and the two shapes are mutually
  exclusive (`400` if both). The count is part of the confirmation: the
  button says the number, the server re-counts, and a **`count-token`**
  pins the count the user was shown. If it has moved — someone else's
  edit, a relative date rolling over at midnight — the answer is `409`
  with the old and new counts and a fresh token, never a silent run
  against a different set. Without the token, "archive all 4,873"
  executes against however many rows exist at execution time, which is
  a different operation from the one the user agreed to.
- **recipes**: `saved-views` gains a **modified state**, **update in
  place**, and a persistence model (`plans/hc-filter-ux-plan-en.md`
  item D). Applying a view and changing one condition is the commonest
  thing users do with saved views and was the least served: nothing
  said whether what you were looking at was still the view, so the user
  either lost the tweak or trusted a saved version that was not on
  screen. The apply link now names its view (`&from-view=<name>`), the
  server compares **normalized** conditions (sorted params, so the same
  question compares equal whether it arrived from the form or from a
  link), and the chip renders `data-modified` with **Update** and
  **Reset**. `PUT /views/<name>` updates in place, so correcting a view
  keeps its name and every link already shared — previously the only
  route was delete-and-recreate. The contract also writes down what a
  view captures (filters, sort, pinned columns; **never** the page
  number), that columns resolve **URL → user preference → app
  default**, that scope may be shared rather than personal (so editing
  a colleague's view is a visible act, not a side effect), that a
  default view redirects with `303` so the address bar shows the real
  conditions, and that applying **re-authorises and fails closed** —
  quietly dropping a condition the user may no longer run would widen
  the result set.
- **recipes**: filter conditions accept **relative date expressions**
  (`plans/hc-filter-ux-plan-en.md` item C). A saved view is a stored
  querystring, so an absolute date makes the view *wrong tomorrow* —
  "shipping this week" saved on Monday means last week by the following
  Monday, and time is what a large share of real saved views are about.
  Condition values may now be `@today`, `@week-start` / `@week-end`,
  `@month-*`, `@quarter-*`, `@year-*`, or an offset from any anchor
  (`@today-7d`, `@month-start-1m`), and the **expression** is what gets
  stored. The server resolves — never the client, whose clock and
  timezone would leak into the answer — against **one** instant per
  request, so a request near midnight cannot straddle two days.
  Absolute values stay ISO on the wire (`2026-08-01`, never
  `01/08/2026`, which means different days to different colleagues);
  localize on the way out. The applied-conditions bar shows **both**
  forms — `start of this week (2026-08-10)` — because the wording alone
  hides which rows are in, and the date alone hides that it will move.
  An expression the server does not understand answers **`400`**, never
  the unfiltered list.


- **behaviors**: `installMultiValue()` — **one control, many values on
  the wire** (`plans/hc-filter-ux-plan-en.md` item B). The filter wire
  already took repeated `f-<col>` params; nothing let a user *enter*
  them. `data-hc-multi="lines"` on a `<textarea>` (or `commas`) makes
  each line its own entry, so a column of order numbers pasted out of a
  spreadsheet becomes
  `f-buyer=A&f-buyer=B&f-buyer=C`. The split happens on the **`formdata`
  event** — the hook `installFormat()` already uses, which htmx's
  `new FormData(form)` and a native submit both fire, so one listener
  covers both transports and nothing wraps the network. Entries are
  rebuilt **in place** rather than appended, so the same conditions
  always serialize in the same order (a saved view compares
  querystrings). Values are trimmed and de-duplicated, and a control
  emptied of everything contributes no entry at all. Servers should
  still accept the raw newline-joined value, which is what the no-JS
  path sends. `datagrid-filter`'s contract gains the section, including
  what to do when the list outgrows a URL: a stored **condition set**
  addressed by id — which must answer `404` rather than fall back to
  "no filter", since a silently dropped condition shows more data than
  was asked for.


- **recipes**: `datagrid-filter` gains the **applied-conditions bar**
  (`plans/hc-filter-ux-plan-en.md` item A). Column popovers are how a
  condition is *created*; they are a poor way to find one again — in a
  wide grid the column may be scrolled out of view, and plenty of
  conditions do not belong to a column at all. The response now also
  renders an `hc-filterbar`: one item per applied condition, each chip
  opening an editor for **only that condition**, each remove control a
  real link to the current URL minus that one param (so it works
  without JavaScript, is shareable, and Back puts the condition back).
  Values arrive **summarised** — `2 values`, not one chip per value —
  because only the server knows the label, the operator and the count.
  The contract also gains the **empty-result** rule: answer a
  filtered-to-nothing list with a link that drops the *newest*
  condition, since that is what the user just did. `checks.json`
  enforces that remove controls are links and name their condition.


- **datagrid**: sort now travels with the form, so it **survives an
  Apply and is captured by a saved view**
  (`plans/hc-filter-ux-plan-en.md` PR-4). `installDatagrid()` writes the
  whole ordered sort set (`name,-price` — leading `-` for descending)
  into every `input[data-hc-datagrid-sort]` in the grid's closest
  `<form>` **before** dispatching `hc:datagridsort`, exactly as it
  already does for column widths, so an event-triggered request
  serializes the fresh value. Sort used to arrive from the grid's own
  `data-hx-vals` wiring, outside the filter form — which meant filtering
  could silently reset the order, and `saved-views` (which stores the
  form's fields) saved a view that had forgotten how the list was
  ordered. The docs also stop contradicting themselves: the page
  documented `?sort=name,-price` and then wired a single-column
  `{ sort, dir }` pair that cannot round-trip multi-column sorting.
  Additive — a grid without the input behaves exactly as before.
- **filterbar**: new component — the **applied-conditions bar** above a
  list (`plans/hc-filter-ux-plan-en.md` PR-1). Applied filters had no
  component: `hc-chip` is documented as presentational and `hc-chips`
  wraps, while a condition bar is one line that **scrolls** and whose
  chips are *controls*. Each `.hc-filterbar__chip` is a
  `<button popovertarget>` that opens the editor for its own condition
  — reachable even when that column is scrolled out of the grid, and
  available for conditions that are not columns at all — and
  `.hc-filterbar__remove` is a real `<a href>` to the same URL minus
  that condition, so dropping a filter works without JavaScript, is
  shareable, and **Back** puts it back. Chips do not shrink (the bar
  scrolls instead) and `.hc-filterbar__clear` is pinned to the trailing
  edge, because clearing everything must not require first scrolling to
  the end of what you want to clear. The server owns the chip's text —
  label, operator and value — so a multi-value condition arrives
  summarised ("3 values") rather than as three chips or one 200-character
  one, and a long single value truncates at `--hc-filterbar-value-max`
  with the full text in the editor. New `filterbar.*` tokens.


- **docs**: the datagrid page documents **the scroll area**. The grid has
  one scroll container holding header, body and footer, and the header
  holds still because its *cells* are sticky — so the vertical scrollbar
  necessarily runs alongside the header, not only beside the data.
  Records what a data-only scrollbar would cost (two tables, scripted
  column-width and horizontal-scroll sync, and explicit
  `aria-colindex` / `aria-rowindex` in place of the single accessible
  table `role="grid"` derives for free), and the cheap alternative when
  the goal is a quieter bar rather than a shorter one
  (`scrollbar-width: thin`, deliberately not a default). Also notes that
  sticky lives on the header **cells**, not the row — measuring the row
  reports a bug that is not there.


- **docs**: a fourth page template — **Data grid page**
  (`templates/data-grid-page`). The business list screen: an `hc-shell`
  frame whose grid takes the remaining height so **only the grid
  scrolls** (both axes) under sticky multi-level headers and frozen
  columns, with a toolbar whose trailing group is pushed by
  `data-hc-spacer`, and filter input in a dialog. Documents the trap
  that makes or breaks the layout — every element between the page
  column and the grid needs `flex: 1; min-block-size: 0`, and the grid
  needs `--hc-datagrid-max-height: 100%`; miss one and the *page*
  scrolls instead, taking the toolbar with it. Includes a wiring map
  from each region to the recipe contract its endpoint implements.


- **recipes**: `datagrid-edit-errors` gains a fourth outcome —
  **confirmable warnings**
  (`plans/hc-datagrid-state-clarity-plan-en.md` PR-4). The contract had
  accepted / `422` rejected / `409` conflict, and business apps need
  the case where the value is acceptable but **unusual** and only the
  server knows it needs asking about: a ship date in the future, a
  discount above policy. `422` would tell the user to change something
  that needs no changing, and a client-side confirm cannot express a
  rule discovered on the way in — so the branch is **`200`** (nothing
  failed; the server is continuing the conversation, and no
  `htmx:beforeSwap` allowance is needed) with the record re-rendered in
  a *confirm-pending* state: the **proposed** value in the cell marked
  `data-attention="warning"`, and a `data-tone="warning"` message row
  with `role="alert"` offering Confirm and Cancel. Cancel is a plain
  `GET` of the record — nothing was written. The confirmation token is
  **bound to (row, column, value[, version])**, so a confirmation
  obtained for one value cannot commit another or replay past the
  `409` guard; the buttons carry static `data-hx-vals` (not `js:`), so
  the value is pinned at render time and stays CSP-safe. Core adds the
  cell-level warning marking the state uses.

- **datagrid**: opt-in **zebra striping**
  (`plans/hc-datagrid-state-clarity-plan-en.md` PR-3). `data-hc-zebra`
  on the grid makes `installDatagrid()` assign `data-alt` to alternate
  rows on every rebuild, because `:nth-child()` cannot express it: it
  counts rows hidden by a collapsed group (so the stripes shuffle the
  moment a group closes) and it cannot alternate per **record** — a
  `.hc-datagrid__record` spanning three physical rows must stripe as one
  block. Both are things `rebuild()` already knows. The stripe is the
  bottom rung of the tint ladder, so hover, selection and the attention
  bar stay visible over it, and frozen columns keep their stripe. New
  `--hc-datagrid-row-alt-bg` token. Without the opt-in the behavior
  leaves `data-alt` alone, so a server that renders it directly needs no
  JavaScript.

- **datagrid**: editability states are now announced and afforded
  (`plans/hc-datagrid-editability-plan-en.md` §1.1, §1.2).
  `installDatagrid()` derives **`aria-required`** from the column
  editor template's `required` and **`aria-readonly`** from the absence
  of `data-editable` — per cell, so row-state-dependent editability
  (unshipped editable, shipped locked) works without a client-side
  rule; a server-rendered value always wins, and a wholly read-only
  grid says so once on the table (which carries `role="grid"`) instead
  of on every cell. Editable
  cells gain a hover/focus affordance by default, `*` marks anything
  `aria-required`, and the opt-in `data-hc-editable-hint="editable" |
  "readonly"` marks whichever of the two is the exception in that grid
  (forced-colors fallback included).

- **recipes**: `datagrid-bulk-errors` — bulk-action failures at scale
  (`plans/hc-datagrid-bulk-errors-plan-en.md`). Makes the **execution
  semantics** an explicit contract choice: *best-effort* (`200`, rows
  reflect what happened, failures marked with their reason, a
  "filter to the failed rows" retry link) vs *atomic* (`409` / `422`,
  rows **unchanged**, **selection preserved**, copy framed as refusal
  rather than partial completion), with a **pre-flight** step that
  reports executability before anything runs and offers to exclude the
  blockers. Failures are reported in one `aria-live` region **grouped
  by reason** with a hard cap plus a full-list escape hatch, and every
  named row links back into the grid (`#row-<id>`, or
  `?focus=<id>#row-<id>` for another page). Machine-checked contract;
  live docs demo (en/ja).

- **recipes**: `datagrid-edit-conflict` — the 409 wire for datagrid
  inline editing (`plans/hc-datagrid-edit-feedback-plan-en.md` §1.3).
  Optimistic locking per row: the record `<tbody>` carries
  `data-version` and the PATCH includes it; a stale version answers
  `409` with the record re-rendered as a conflict presentation — the
  server's current values in the cells (`data-tone="error"`), the
  fresh version, and a `role="alert"` conflict row naming both values
  with **Overwrite** (static-vals re-submit against the fresh version)
  and **Discard** (`GET` of the row) actions. The row is the merge UI;
  overwrite is last-writer-wins by explicit consent. Machine-checked
  contract; live docs demo (en/ja).

- **recipes**: `datagrid-edit-errors` — the 422 wire for datagrid
  inline editing (`plans/hc-datagrid-edit-feedback-plan-en.md` §1.2).
  Each row is its own record `<tbody>` carrying the persistence wiring
  (`hc:datagridedit` → PATCH → `outerHTML`); `200` answers
  the record with the row alone (server formatting confirms the
  optimistic commit and clears `data-pending`), `422` answers the
  record with the server's value restored, the cell marked
  `data-invalid` + aria wiring, and the `__error-row` naming the
  rejected input — one atomic swap unit, no stale error rows.
  Machine-checked contract; live docs demo (en/ja).

### Changed

- **base**: bare `<a>` **now takes the theme's link colour** instead of the
  UA's `-webkit-link` blue and `:visited` purple. This is the one
  behaviour-default change in the release, and the reason it is a minor
  rather than a patch: an app that relied on the UA defaults for anchors
  outside a component will see them re-coloured on upgrade. The rules land
  in `@layer hc.base`, so any unlayered app rule still wins, and every
  component anchor (`hc-button`, `hc-breadcrumb__link`, `hc-toc__link`,
  `hc-pagination__item`) is unaffected — `hc.components` is the later layer.
  To keep the old look, set the tokens to the UA colours or override `a`
  outside the `hc` layers.

- **docs / base**: two stale claims went with it — `hc.base.css`'s
  `::selection` comment still described a "12 % (18 % for amber)" tint, but
  amber stopped being an accent axis in 0.2.0 and the ladder work removed
  its soft-tint special case, so all five axes have been a flat 12 % for a
  while; and the theming guide told you to mirror `color.indigo.tokens.json`,
  a file the same release deleted when the accents became the five-hue
  pentagon.


- **docs**: in the working template, **a row click is now a real
  navigation**. The record has its own prerendered URL
  (`/templates/data-grid-page-record/<id>/`), built from the same data
  the demo API serves, so a click behaves the way business software
  does — Gmail replaces the screen, Fiori splits it, Salesforce gives
  the record a page. *Back to list* carries the list query **and** the
  row anchor, and the preview seeds its first request from that query,
  so the list really does come back as it was with the row under the
  cursor. The peek dialog stays as the enhancement layered on the same
  href, with a link to the page inside it. The previous excuse — that a
  documentation page is a single route — was only true until a second
  route was written.


- **docs**: `row-detail` ranks the three renderings the way business
  software actually does, and says why. Opening a record **replaces the
  screen** in Gmail, **splits it into columns** in SAP Fiori, and is a
  **page** in Salesforce and ServiceNow; modals in those products are
  for short, self-contained tasks — create one thing, confirm, edit a
  field — not for the record, because a record is where the work
  happens and work needs room, a URL and its own error surfaces. The
  failure mode is named too: **a modal with no URL**, where Back closes
  something the user never opened, the link they send a colleague is
  the wrong screen, and a refresh loses their place. The template says
  plainly that it peeks because a documentation page is a single route
  — the row's `href` beside it is the real page.


- **recipes**: `row-detail` states **where a detail screen's navigation
  goes**, since the list template's "navigation under the data" rule
  reads as "put a pager at the bottom" if left unqualified. Prev / next
  belong in the record's **header**: the decision to move on is usually
  made before reading to the bottom, a bottom control on a scrolling
  body either scrolls away or buys a second fixed strip, and the `303`
  after a save lands the user at the top anyway. A long detail may
  repeat them below as a secondary copy — same links, no state. And a
  **grid inside a detail pages itself**, directly under itself: a
  page-level pager on a screen with three grids cannot say which grid
  it pages. The bottom of a detail carries its **actions**, not
  navigation. Within the header the arrangement is the one every mail
  client already taught users — **the exit at the start, the walk
  (`1 / 15,129 ‹ ›`) at the end** — the same rule the list's navigation
  strip follows.

- **docs**: in the data-grid template's navigation strip, *where you
  are* stays at the start and *where you go* moves to the **end**. Two
  reasons about hands rather than taste: after scrolling the grid the
  pointer is already at the trailing edge, where the scrollbar lives,
  and **Next** is pressed far more often than anything else on the
  strip. The count keeps the start because it is a read-out and the
  frozen identity column it refers to is on that side. Logical
  properties, so RTL swaps both without a second rule.

- **docs**: the data-grid page template **groups its controls by what
  they change**, because one strip holding four kinds of control reads
  as clutter however tidy each one is. Filters, Sort and Columns now
  sit together beside the title — they answer the same question, *what
  am I looking at*, and splitting them made the screen look busier than
  it was. The toolbar keeps only actions on the **data** (Refresh,
  Import, Export). **Selection-scoped actions moved to their own bar**,
  revealed by `installDatagridActions()` when rows are ticked: Approve
  and Reject apply for the minutes a selection exists and were being
  read all day for the rest of the time — and a bar that appears is a
  better cue than a button that greys out, because a disabled button
  explains nothing. Navigation (the pager, *Go to row*) moved **under
  the grid**, where the movement happens.

- **recipes**: the `datagrid-bulk-actions` contract's "the selection
  clears by construction" is now scoped to the branch where the action
  actually ran, with a carve-out for refusals — an all-or-nothing
  refusal must re-render its rows with the checkboxes `checked`, or a
  hand-picked selection is destroyed when nothing happened.

- **datagrid**: fragment navigation and the error-tooltip carve-out
  (`plans/hc-datagrid-bulk-errors-plan-en.md` §1.4, §1.5). A link to a
  row (`#row-101` — a bulk-error report entry or a deep link) now moves
  the **active cell** to that row's first cell and focuses it (on load
  and on `hashchange`; unknown or unusable hashes are ignored), so
  keyboard and screen-reader users arrive where the eye does. The
  landing row is emphasised with `:target` and carries
  `scroll-margin-block-start` derived from the measured header heights
  so it never lands under the sticky header (forced-colors fallback
  included). A cell carrying its own message — server-rendered
  `data-invalid`, or `aria-describedby` pointing at an `hc-tooltip` —
  now suppresses the built-in overflow tooltip, so one hover never
  carries two meanings.

### Fixed

- **email**: the dark flavor **left links and tables on their light
  colours**. The layout's `@media (prefers-color-scheme: dark)` block flips
  the background, the container, headings, body copy, muted copy and the
  separator — but a fragment can only be reached by that block if it carries
  an `hc-em-*` class, and `link` and `table` had none. Email bakes every
  colour inline, so what survived the flip was a link at **2.77:1** against
  the dark container and table copy at **1.21:1**, which is dark text on a
  dark surface. Both now carry classes (`hc-em-link`, `hc-em-table` /
  `hc-em-th` / `hc-em-td`) with matching dark rules, reaching 5.85:1 and
  13.34:1. Alerts, badges and buttons are untouched: each brings its own
  background and foreground, so it is legible either way.

  The link fragment also read `color-action-primary-bg`, which is the colour
  a button sits **on** with white text over it, not a colour text is painted
  **in** — and it holds the same value in both flavors, so no dark rule could
  have saved it. It reads `color-link` now (#569).

- **theme builder**: a custom theme built in **accent mode emailed a stock
  blue dark-mode link** instead of its own accent. `theme.dark` is overlaid
  after the custom accent, and it now carries link tokens, so it won the
  resolution — a regression from adding them (#569). The builder's custom
  accent gained the dark counterpart the stock accents ship as
  `color.<name>.dark.tokens.json`, wired into all three outputs (the
  paste-ready block, the full token CSS, and the email maps), so a teal theme
  stays teal in dark.


- **tests**: the two specs that follow a `#row` fragment link **read the
  focus a task too early**, and one of them failed roughly two full-suite
  runs in three while passing every time in isolation. Following the link is
  a same-document navigation: the browser blurs the anchor on the way
  through — the active element becomes `<body>` — and queues `hashchange` as
  its own task, so `focusHashRow()` has not run when `click()` resolves.
  Measured, the active element is still `<body>` through the next microtask
  and animation frame. Both specs now use retrying locator assertions
  (`toBeFocused()`, `toHaveCount()`) instead of a one-shot
  `page.evaluate(() => document.activeElement)`. Nothing in the product
  changed: the cell was always focused, just after the assertion looked.


- **dialog**: `prefers-reduced-motion: reduce` **did not actually stop
  the dialog from animating in**. The guard was written against the
  bare `.hc-dialog`, but the enter transition is declared on
  `.hc-dialog[open]` — one attribute more specific, so the guard was
  outranked and never applied. A reader who asked for no motion still
  got the 200ms fade-and-scale; only the exit was ever zeroed. The
  guard now lists the `[open]` states (and their backdrops) so it
  matches that specificity and wins on source order. This was also the
  root of an intermittent CI failure: axe samples rendered pixels, and
  mid-fade the primary button's blue composites toward the page behind
  it and scores ~3.5:1 against white instead of the 5.31:1 it resolves
  to at rest — Chromium and WebKit usually settled before the scan,
  Firefox did not. Pinned by a spec that opens a dialog under reduced
  motion and asserts it is fully opaque on the first visible frame.


- **print**: a fixed-height datagrid **printed only the rows that
  happened to be visible**. The print sheet reset the wrapper, but the
  cap lives on the scrollport (`.hc-datagrid__scroll`), and
  `max-height: none` on a parent does not reach it — nor does the
  physical property override the logical `max-block-size` the component
  sets. On paper there is no scrolling, so whatever the cap hid was
  simply missing with nothing to say so. The scrollport now un-caps in
  print, pinned by a spec that checks the computed style under both
  media.


- **docs**: in the working template, clicking a row **still opened the
  modal** — the record's name carried both an `href` and a
  `data-hx-get`, and htmx takes the click, so the real navigation added
  alongside it was reachable only by middle-click. The peek now has
  **its own control** (a button in a trailing column) and the record's
  name is a plain link, so a click navigates. The rule is in the
  `row-detail` contract and docs now, because the markup looks correct
  either way: *one anchor cannot be both* — an `href` under a
  `data-hx-get` is a claim nobody can act on.


- **docs**: the working template opened records **only as a modal**,
  which contradicted the `row-detail` contract it is meant to
  demonstrate: a record reachable only through a dialog cannot be
  linked, bookmarked or opened in a second tab, and the peek was
  missing the *Open full page* link the contract requires — a peek that
  traps you is worse than no peek. The row's `href` is now the
  **record's own page**, which the demo API answers as a real page
  (Back carrying the list query and the row anchor); the dialog is the
  enhancement layered on top with `data-hx-get`, and it carries the way
  out. The recipe now also states plainly when each of the three shapes
  is right — page (default), peek (glance and go, short records), or a
  docked pane (when the work is comparing record and list).


- **docs**: the template's **full-size preview showed no data**. The
  page is a plain Astro route, not a Starlight one, so it never got the
  `DemoFrame` that loads htmx for every other live demo — leaving every
  `data-hx-*` attribute on the screen inert: the grid's `load` request
  never fired, the rows stayed empty and the chrome kept its
  placeholder text. It loads htmx now (with the same 401 / 409 / 422
  swap allowance the recipe contracts document) and the two docs
  stylesheets Starlight applies through `customCss`, so the shell's own
  chrome stops rendering raw.


- **docs**: the `datagrid-filter` live demo was **missing two of the
  regions its own responses fill**, so both landed nowhere: the
  applied-conditions bar and the due-date control — which is where
  relative dates (`@today-7d`, `@month-start-1m..@month-end-1m`, the
  preset list, the offset composer) are entered. An out-of-band swap
  with no target does not fail loudly: htmx drops the fragment, the
  page renders, and the feature is simply invisible. Both regions exist
  now, and a test checks the demo pages against the regions their APIs
  answer — from both ends, so the list cannot drift into fiction.


- **docs**: a bulk-error report could **squeeze the grid to nothing**
  on the full-height list page. The chrome is fixed and the grid takes
  what is left, while the report's height is `O(number of failure
  reasons)` — so an action that failed in fifteen ways hid exactly the
  rows it was telling the user to go and fix. The template now states
  the corollary of its own layout rule — **the chrome is O(1)**;
  anything that grows with the data lives in the scrolling area or an
  overlay — and carries a **one-line summary** with *Show only failed
  (N)*, with the failing rows marked `data-attention="error"`. The
  `datagrid-bulk-errors` contract picks the surface by one question,
  *is there work in the grid?*: best-effort → the summary plus the rows
  (and the filter, which turns the grid **into** the report); the
  grouped breakdown → a **docked panel** beside the grid, because a
  side panel spends horizontal space, which this layout has; atomic →
  a **modal**, where blocking is the message. The region is bounded as
  a backstop (`max-block-size: min(25vh, 12rem); overflow: auto`), so
  even a full report scrolls inside its own box and the data never gets
  less room than the diagnostics.


- **tests**: the session-expiry dialog's axe scan emulates reduced
  motion (the #342 pattern) — it could sample the dialog mid-transition
  and report a colour-contrast violation that is gone once it settles.

- **behaviors**: `data-hc-close-popover-on-success` /
  `data-hc-close-dialog-on-success` gained a **nearest-carrier opt-out**
  (`="false"`). A panel that edits itself — a sort control adding a key,
  a column chooser — issues successful requests from inside the carrier,
  and every one of them dismissed the panel the user was still working
  in. The nearest carrier now wins, so an inner region can opt its own
  round trips out while Apply still closes the panel.

- **docs**: two defects in the data-grid page template's filter panel.
  Its **Reset** was `<button type="reset">`, which restores the values
  the server rendered into the controls — after an apply plus a tweak,
  *the modified state*: the one control promising to undo the tweak was
  the one guaranteed not to. It is now a link to the view's own URL, as
  the `saved-views` contract now says explicitly. The **Modified** badge
  also rendered unconditionally next to a `view` select showing "—";
  it now lives on the view menu's label, where the comparison it reports
  actually happens. The condition chips carried
  `popovertarget="…-filters"` pointing at a `<dialog>` with no `popover`
  attribute, so clicking a chip did nothing at all — they open the panel
  now.

- **recipes**: relative date expressions handle **period offsets** and
  stop overflowing. `@month-end-1m` — "end of last month", the phrase a
  business user actually reaches for — was rejected outright: offsets
  were only parsed from `today` and the `-start` anchors. Offsets now
  work from any anchor, and on a *period* anchor they shift the period
  and then take the boundary, so `@month-end-1m` is the end of the month
  a month back rather than this month's end minus a month — the same
  thing in August, not in March. Month and year arithmetic also
  **clamps** instead of rolling over: `@today-1m` evaluated on 31 March
  answered **3 March**, so a filter asking for "the last month" quietly
  covered a month it was never asked for. It now answers 28 February
  (29 February in a leap year), and `@today-1y` on 29 February answers
  28 February. Two presets are added for the common case.


- **docs**: the `data-grid-page` template scrolled its **chrome
  horizontally**. The layout rule documented `min-block-size: 0` — the
  block-axis half of the trap — and missed its inline twin. A flex item
  will not shrink below its content on *either* axis, and the datagrid's
  table is `inline-size: max-content`, so the page column grew to the
  table's width and `hc-shell__main` became the horizontal scrollport:
  scrolling right dragged the title and the toolbar along, which is
  exactly what the grid's own scrollport exists to prevent (measured:
  542 px of overflow on `hc-shell__main` at a 1280 px viewport, and the
  grid never scrolled horizontally at all). Both minimums are now
  documented per axis, in the template and its demo. The template also
  restores a `70vh` cap below `hc-shell`'s `60rem` breakpoint, where the
  shell deliberately becomes an ordinary scrolling page and `100%` stops
  capping anything — without it the grid rendered every row at full
  height. A new `datagrid-app-page` browser fixture and spec pin the
  composition on both axes; removing either minimum fails them.


- **dialog**: a dialog taller than the viewport now scrolls its
  **body**, not its header and footer. `.hc-dialog` had no column
  layout and no scrolling body, so an over-tall dialog scrolled as a
  whole under the browser's height cap — the title left the top of the
  screen and the footer, where the primary action lives, left the
  bottom (measured: at a 460 px viewport the Apply button sat at
  `y = 604`). An open dialog is now a flex column with an `overflow:
  auto` body, and the column passes through a form wrapping
  header/body/footer — the usual shape when the footer's button submits
  the body's fields, as in a filter panel. The rule is scoped to
  `[open]`: an unscoped `display` would beat the UA's
  `dialog:not([open]) { display: none }` and reveal every closed dialog.
  Markup is unchanged.


- **recipes**: the atomic branch of `datagrid-bulk-errors` now **marks
  the blocked rows**. The rule was "never mark in the atomic branch —
  nothing changed, so marking would lie", which conflated two different
  claims: a *failure* would indeed be a lie, but `data-attention="error"`
  says "this row cannot proceed", and that is a fact about the **row**,
  equally true in the pre-flight, in the `409` refusal and after a
  best-effort failure. It does not go stale when the selection changes
  either ("already shipped" stays true whether or not the row is
  ticked). Without it, the report's row links landed on a row that
  looked like every other row. The pre-flight answers a report rather
  than rows, so it carries the marks as `<template>`-wrapped
  out-of-band row updates, rendered `checked` so the selection the user
  is about to act on survives. Row **statuses** are still never changed
  by the atomic branch. Documented alongside it: `data-attention` takes
  its severity from what the row *needs* — `error` when something must
  **change** (missing required value, invalid input, wrong state, no
  permission), `warning` when someone must **decide** (a future ship
  date) — not from when it was discovered, or the same unchanged row
  would read `warning` before an action and `error` after it.

- **recipes**: the bulk retry copy no longer says "The other 1 need a
  change first" (missing singular).


- **recipes**: a partial bulk failure now leaves the **retry set
  selected** (`plans/hc-datagrid-state-clarity-plan-en.md` PR-2). The
  `datagrid-bulk-errors` best-effort branch re-rendered every row
  unchecked, so the actions bar (which hides at zero) disappeared the
  moment anything failed and the user had to hand-pick the failures out
  of a full grid to try again — the very rows the server had just
  identified. Failures the server judges **retryable** (transient: lock
  held, upstream timeout, rate limit) now come back `checked`, so
  pressing the same button retries exactly those; succeeded rows and
  permanent failures (wrong state, not permitted, invalid data) come
  back unchecked, because re-submitting either is pointless. The report
  says which is which — a partially-checked grid reads as a bug
  otherwise. Contract, recipe scaffolds, docs-site demo endpoint and
  browser fixture all carry the rule.

- **datagrid**: states no longer erase each other
  (`plans/hc-datagrid-state-clarity-plan-en.md` PR-1). Every state
  painted the same property — a `background-image` gradient on the cell
  — so exactly one won, and which one was decided by an accidental mix
  of specificity and source order: hover erased a failure tint,
  selection erased a rejected cell's ring, and a row-level `data-tone`
  erased the selection tint entirely, leaving no feedback while the
  user selected failed rows to retry them. There is now **one** paint
  fed by `--hc-datagrid-cell-tint`, and each state merely assigns it in
  a documented priority ladder (`data-tone` → `:hover` →
  `data-pending` → `data-highlight` → `data-in-range` →
  `aria-selected` → `:target` → `data-invalid`), with every selector
  specificity-normalised via `:where()` so source order alone decides.
  Anything that must survive a tint moved to an **attention channel**
  that never touches the background: the new
  **`data-attention="error" | "warning"`** (row / record / head cell)
  draws an inline-start edge bar composed from a shadow channel, so it
  coexists with a freeze line; the rejected cell's ring and corner flag
  now use `--hc-datagrid-attention-error-bg` (`status.error.fg`)
  instead of `status.error.border`, which was nearly invisible against
  the error tint it sat on. A selected failed row now reads as both.
  Failed rows in `datagrid-bulk-errors` and the conflicted row in
  `datagrid-edit-conflict` moved from `data-tone="error"` to
  `data-attention="error"` (`data-tone` keeps its meaning: the
  **value** is notable). Fragment navigation additionally accepts a
  **cell** id (`#cell-101-ship-date`), so a failure report can land on
  the offending column — which a wide grid otherwise hides — and
  `data-attention` on a header cell marks that column.

- **datagrid**: cell state markers no longer change the column width.
  The table is `max-content` sized and cells do not wrap, so the
  saving spinner (shipped as an inline-block pseudo-element) widened
  its whole column — measured at 76 px → 121 px for one small inline
  addition — and would have been clipped away entirely in a
  `data-resized` column. The spinner, the new rejected-cell corner
  marker (`data-invalid`) and the per-cell required `*` are now
  absolutely positioned in the cell's padding gutter at zero layout
  cost, and the `datagrid-bulk-errors` recipe no longer puts an inline
  "details" link inside a data cell (Back returns to the report, which
  the row link already put in history). The rule is documented for
  app-authored markers too.

- **docs / recipes**: English-facing surfaces are English again. The
  `datagrid-bulk-errors` theme shipped its demo API, recipe scaffolds,
  server contract, English docs page and browser mocks with Japanese
  message text, so the shared live demo and the canonical English
  source format answered in Japanese for every reader. Also cleaned
  two older leaks — the `edit-conflict` and `autosave` expanded
  scaffolds glossed their buttons in Japanese. Japanese remains where
  it belongs: the `/ja/` docs mirror, the i18n message catalogs and
  their examples, and the Japanese-specific features (kana
  normalization, postal addresses, non-ASCII header escaping tests).

- **datagrid**: a row replaced **while its editor was open** (an SSE
  update, another user's change, a pager refresh) left the internal
  editing state pointing at a detached node — and since the keyboard
  handler returns early whenever an edit is in progress, **the grid's
  keyboard navigation stopped responding** until an edit was started
  and finished again; a later commit would also have written into a
  node no longer in the document. The behavior now drops the editing
  state when the edited cell leaves the grid, so navigation and
  editing resume on the swapped-in rows. Row-state-dependent
  editability makes this a routine path, not a corner case.

- **docs / recipes**: the `datagrid-infinite` live demo chain-loaded
  all 15 rows before the reader could scroll. `revealed` measures the
  **window** viewport, so on a tall screen every renewed sentinel was
  already visible and each batch fired immediately — the demo showed a
  full table instead of infinite scrolling. The demo is now the
  container-scrolled variant (the grid keeps its scrollbar; sentinels
  trigger on `intersect once root:<scroll> threshold:0.5`, with the
  root threaded through the cursor URL so renewed sentinels keep it).
  The recipe's page-scroll contract is unchanged and now carries a
  **container-scrolled carve-out** documenting the trigger swap and
  both failure modes (deadlock and chain-load); `hc validate` accepts
  either trigger.

- **datagrid**: `hc:datagridedit` now dispatches from the **edited
  cell** (bubbling through row → record → grid) instead of the grid
  element — per-record htmx wiring can finally hear only its own
  edits; grid-, body- and document-level listeners are unaffected by
  the bubble. Record-tbody swaps (the edit-errors contract's unit) now
  trigger the structural rebuild too: the behavior additionally
  observes the table's children, so swapped-in records get roles, the
  navigation matrix, and editing wired without a full grid swap.

- **datagrid**: inline-edit lifecycle states
  (`plans/hc-datagrid-edit-feedback-plan-en.md` §1.1). With
  `data-hc-datagrid-pending` on the grid wrapper, a changed commit
  marks the edited cell **`data-pending`** + `aria-busy` (busy tint +
  spinner) until the server's row re-render replaces it — opt-in
  because it assumes the re-render contract. **`data-invalid`**
  (server-rendered in a 422 re-render) paints the rejected cell with
  an error ring + tone; **`.hc-datagrid__error-row` /
  `.hc-datagrid__error`** is the message slot directly under the row
  (grid roles applied, out of keyboard navigation, `role="alert"` on
  an inner element). Forced-colors fallbacks; reduced motion stops the
  spinner.

- **datagrid**: auto-size and opt-in client page sort
  (`plans/hc-datagrid-enrichment-plan-en.md` §1.11). Double-click a
  column's resize grip (or press Enter while it has focus) to fit the
  column to its widest rendered cell — the committed width flows
  through the normal `hc:datagridcolumnresize` pipeline.
  `data-sortable="client"` sorts the *already-rendered* page rows in
  the DOM (numeric when both values parse, `data-value` preferred over
  cell text, locale compare otherwise) — allowed by the v0.6 depth
  plan for small fully-loaded tables; any htmx swap restores the
  server's order, and bare `data-sortable` stays server-instructed.

- **datagrid**: column-preference persistence + the `datagrid-prefs`
  recipe (`plans/hc-datagrid-enrichment-plan-en.md` §1.10). **Widths**:
  `installDatagrid()` mirrors every committed resize into any
  `input[data-hc-datagrid-width="<col>"]` (grid's closest form, else
  document-wide) *before* dispatching `hc:datagridcolumnresize`, so a
  debounced event-triggered form autosaves the fresh value; the server
  renders remembered widths back as inline widths + `data-resized`.
  **Order**: the datagrid-columns chooser upgraded with
  `installSortable()` — checkbox serialization follows DOM order, and
  the datagrid-columns contract now honors the submitted `cols=`
  **sequence** as the column order (absent/unknown params unchanged).
  Machine-checked contract; live docs demo (en/ja).
- **datagrid**: tree rows + the `datagrid-tree` recipe
  (`plans/hc-datagrid-enrichment-plan-en.md` §1.7). Rows carry
  `aria-level`; an expandable row carries `aria-expanded` + a
  `data-hc-datagrid-tree` lead-cell toggle, and the table upgrades to
  `role="treegrid"`. A lazy row's first expand marks `data-loaded`,
  sets `aria-busy`, and dispatches **`hc:datagridtreeload`** — htmx
  GETs the children and inserts them `afterend`, one level deeper
  (empty answers the contract's single empty-state row). Collapse /
  re-expand of loaded subtrees is client-side visibility (collapsed
  children respected; hidden rows leave keyboard navigation) and emits
  **`hc:datagridtreetoggle`** `{ row, expanded }`. Levels 2–4 indent
  via `--hc-datagrid-indent`. Machine-checked contract; live docs demo
  (en/ja).

- **datagrid**: native validation gates the inline-edit commit
  (`plans/hc-datagrid-enrichment-plan-en.md` §1.9). An editor template
  control carrying `required` / `pattern` / `min` / `max` / `maxlength`
  must satisfy them before the value is written back — the editor stays
  open with the native `reportValidity()` message, no `hc:datagridedit`
  fires, and type-to-edit on another cell won't abandon an invalid
  editor. `Escape` still cancels; combobox picks bypass (options are
  valid by construction). No new attributes — the constraints are the
  API.

- **datagrid / table**: declarative conditional formatting via
  `data-tone="info | success | warning | error"` on a cell, a row, or a
  record `<tbody>` (`plans/hc-datagrid-enrichment-plan-en.md` §1.8).
  The server evaluates the rules and renders the outcome as the
  attribute; the CSS paints it — datagrid via the new token-backed
  `--hc-datagrid-tone-<tone>-bg/-fg` (frozen-safe gradient), `hc-table`
  via the shared `--hc-color-status-*` semantic colors. Dark-theme
  aware; under forced colors the tint becomes a dotted outline.

- **datagrid**: grouped rows — server-rendered, client-toggled
  (`plans/hc-datagrid-enrichment-plan-en.md` §1.6). The server
  interleaves `.hc-datagrid__grouprow` heading rows (one `colspan` cell
  with the label and any aggregates it renders); `installDatagrid()`
  toggles the group on click / Enter / Space via the heading **cell**'s
  `aria-expanded` (render `"false"` to start collapsed), with a `▸`/`▾`
  caret, `data-group-level="1…3"` nesting (collapse runs to the next
  same-or-higher heading; re-expanding keeps collapsed sub-groups
  collapsed), and **`hc:datagridgrouptoggle`** `{ row, expanded }`.
  Headings join keyboard navigation but are not selectable units, and
  collapsing never changes the selection. Nothing is grouped or summed
  client-side.

- **datagrid**: multi-column sort
  (`plans/hc-datagrid-enrichment-plan-en.md` §1.4). `Shift+Click` /
  `Shift+Enter` on a `data-sortable` header **adds** the column to the
  sort set (a plain activation stays single-column and clears the
  rest). With two or more sorted columns each header carries
  `data-sort-index="1…n"` and the indicator shows the ordinal (`↑1`,
  `↓2`). `hc:datagridsort` detail gains **`sorts`** — the full ordered
  set as `[{ col, direction }, …]` (the existing `col` / `direction`
  fields are unchanged); the conventional wire format is
  `?sort=name,-price`.

- **recipes**: `datagrid-filter` — per-column filter entry for the
  datagrid (`plans/hc-datagrid-enrichment-plan-en.md` §1.5). A
  filter-popover off a header cell's trigger button GETs the grid URL
  with namespaced `f-<col>` params; the server re-renders the grid
  filtered (the trigger rides back inside the fragment, `data-filtered`
  + an `aria-label` naming the active values) plus an OOB re-render of
  the form's fieldset with matching checked states. Filters compose
  across columns via server-rendered hidden `f-<col>` inputs. Zero new
  JavaScript; machine-checked contract; live docs demo (en/ja).

- **datagrid**: sticky aggregate footer and trailing frozen columns
  (`plans/hc-datagrid-enrichment-plan-en.md` §1.3). A
  `<tfoot class="hc-datagrid__foot">` pins to the bottom of the scroll
  viewport (multi-row footers stack via the measured
  `--hc-datagrid-foot-1-h`), styled like the header band — the server
  renders the aggregates, the CSS only pins them. `data-frozen-end` /
  `data-frozen-end-edge` mirror `data-frozen` on the trailing edge
  (RTL-aware, per-cell `--hc-datagrid-right` measured by the behavior;
  new `--hc-datagrid-freeze-end-shadow` / `--hc-datagrid-foot-shadow`
  knobs). Footer cells carry grid roles but stay out of keyboard
  navigation.

- **datagrid**: spreadsheet-style range selection and clipboard copy
  (`plans/hc-datagrid-enrichment-plan-en.md` §1.2). `Shift+Arrow` /
  `Shift+Click` extend a rectangular cell range from the active cell
  (cells carry `data-in-range`, painted with the selection tint;
  `Escape` or any plain move clears it, as does an htmx row swap).
  `Ctrl/Cmd+C` copies the range — or the active cell alone — as TSV
  after a cancelable **`hc:datagridcopy`** (`{ text, rows, cols }`;
  `preventDefault()` claims the clipboard write). `Ctrl/Cmd+A` selects
  every row on the page through the select-all path instead of
  selecting the document.

- **datagrid**: type-to-edit is now IME-safe. Composition keystrokes on
  an editable cell (`isComposing`, key `Process`, or keyCode 229) open
  the editor *unseeded* and without `preventDefault()`, and a
  `compositionstart` listener covers engines that fire it before any
  usable keydown — CJK input is no longer swallowed by the cell or
  corrupted into a raw latin seed character.


## [0.2.1] - 2026-08-08

The business-app release: seven themes from the 2026-08-08
line-of-business gap analysis
([`plans/hc-input-format-plan-en.md`](plans/hc-input-format-plan-en.md),
[`plans/hc-form-safety-plan-en.md`](plans/hc-form-safety-plan-en.md),
[`plans/hc-error-paths-plan-en.md`](plans/hc-error-paths-plan-en.md),
[`plans/hc-datagrid-ops-plan-en.md`](plans/hc-datagrid-ops-plan-en.md)),
PRs #467–#485 — six new behaviors (53 total), nine new recipes
(36 total, five of them zero-new-JS contracts), the opt-in print
stylesheet, the errors-and-recovery map, and the data-entry template.
Strictly additive → patch per VERSIONING.md. The CLI ships 0.4.1 to
re-bundle the nine new recipes.

### Added

- **Docs: `templates/data-entry` — the business-form stack in one
  page** (theme G, the closing piece of the 2026-08-08 business-app
  gap analysis). A third full-page template (en/ja + sidebar) whose
  live preview composes everything the effort shipped into one guarded
  form: grouped amounts with raw wire values (`installFormat`), IME
  normalization (`installNormalize`), the `postal-jp` mask feeding the
  postal-address lookup with OOB autofill, debounced draft autosave, the
  unsaved-changes guard (badge on `data-dirty`), double-submit hygiene
  (`data-hx-sync` + `data-hx-disabled-elt`), and the shared
  error-dialog host for session-expiry/edit-conflict. The page
  skeleton, a nine-row wiring map (region → behavior → recipe →
  contract), and an adapt-it list (version field, real CSRF,
  server-side validation, draft hygiene) make it the entry point the
  errors-and-recovery and form-safety themes plug into.

- **`datagrid-infinite` recipe — revealed-sentinel cursor paging**
  (PR 5, final, of
  [`plans/hc-datagrid-ops-plan-en.md`](plans/hc-datagrid-ops-plan-en.md);
  the 36th recipe, zero new JS — the datagrid-ops theme closes with
  four recipes and **no new public API at all**). The last row is a
  sentinel — `data-hx-trigger="revealed"` + `data-hx-swap="outerHTML"`
  — replaced by the next `<tr>` batch plus the next sentinel; cursors
  (`?after=<id>`), not offsets, so append-only lists never shift; the
  end of the list is a batch with an `aria-live` end-marker row
  ("15 of 15") instead of a sentinel; stale cursors resume from the
  nearest stable point (`200`, never a 4xx — scrolling is not an
  error). `revealed` is a window-viewport trigger (it does not fire in
  overflow containers) — the docs spell out the `intersect` carve-out,
  and the spec pins two-batch loading with a short viewport. API
  tests, docs en/ja, cross-engine Playwright suite.

- **`csv-import` recipe — upload, validate, confirm** (PR 4 of
  [`plans/hc-datagrid-ops-plan-en.md`](plans/hc-datagrid-ops-plan-en.md);
  the 35th recipe, zero new JS). The missing bulk-in wire contract, in
  two honest phases: the [file-upload](recipes/file-upload/) form posts
  the CSV and the server **validates without importing** — the response
  is a report fragment (summary line + a real `row`/`field`/`message`
  error `<table>`) plus, when importable rows exist, a confirm form
  whose hidden `token` references the validated batch;
  `POST /imports/<token>/commit` executes exactly what was validated
  (`HX-Trigger` toast + a `items:changed` event for data-region
  pairing), tokens are single-shot (`409` + re-upload hint when
  expired/consumed — riding the consolidated allowance), re-uploading
  replaces the batch, and no-JS is a full-page PRG report. The demo
  parses a real tiny CSV (comma, quoted fields, `\r\n?`) and threads
  the batch statelessly through the token (base64url — documented as
  the demo trick; real apps hold server-side batches). API tests, docs
  en/ja, cross-engine Playwright suite incl. the stale-token 409
  branch.

- **`saved-views` recipe — named filter sets as plain links** (PR 3 of
  [`plans/hc-datagrid-ops-plan-en.md`](plans/hc-datagrid-ops-plan-en.md);
  the 34th recipe, zero new JS). The current search's querystring,
  named and kept server-side: **Save** posts a small name form with
  `data-hx-include` of the filter form and gets the views strip back;
  **Apply** is a plain `GET /items?view=<name>` link — bookmarkable,
  shareable, zero client state — whose response renders the filter
  form **with the view's values filled**, so a view is never opaque;
  **Delete** is `data-hx-delete` on each chip's ×; duplicate names are
  `422` field-errors. Stateless live demo (the demo threads views
  through the strip's hidden inputs and says so — real apps store
  per-user), docs en/ja, API tests, cross-engine Playwright suite,
  checks.json (include-resolves, target-declared, no-JS post parity,
  labeled name input).

- **`datagrid-columns` recipe — the server-owned column chooser**
  (PR 2 of
  [`plans/hc-datagrid-ops-plan-en.md`](plans/hc-datagrid-ops-plan-en.md);
  the 33rd recipe, zero new JS). A filter-popover-shell chooser with
  one checkbox per column; **Apply** GETs the grid URL with repeated
  `cols=` params and the server re-renders the whole grid with exactly
  those columns (canonical order; unknown names ignored — the server
  is the schema) plus the chooser re-rendered out of band with
  matching checked states. No client column-hiding: the server
  deciding *which columns exist* means one round trip, zero state
  drift, and print/export match the screen for free (CSV export is a
  plain link — documented, not a recipe). Stateless live demo + API
  tests, docs en/ja, cross-engine Playwright suite, checks.json
  (shared `cols` name, GET-not-POST, target resolution, no-JS
  `action`+`method=get` parity).

- **`installTime()` — client-side `<time>` localization** (theme F of
  the business-app gap analysis). Servers render UTC and a
  machine-readable `datetime`; the auto-installed behavior rewrites the
  visible text in the viewer's zone and language via `Intl`:
  `data-hc-time="relative"` ("3 minutes ago" / 「3 分前」,
  `Intl.RelativeTimeFormat` with one shared 30 s refresh interval, the
  absolute localized timestamp mirrored into `title` unless one
  exists), or `datetime` / `date` / `time` absolute rendering with
  `data-hc-time-style`. The `datetime` attribute is never touched (the
  wire truth), the server-rendered text is the no-JS fallback,
  unparseable values are left alone, the language follows the closest
  `[lang]`, and htmx-swapped content localizes automatically (the
  avatar/nav-current MutationObserver pattern). No message keys —
  `Intl` carries the language. Documented in the i18n fundamentals
  ("Localized timestamps", en/ja) + the behaviors roster (now 53);
  pinned by a 7-test jsdom suite (fake timers + system time; locale
  following; observer pickup; interval refresh; uninstall stops the
  clock).

### Fixed

- **Browser specs: dialog-opening axe scans emulate reduced motion**
  — the seven specs this effort added now set
  `page.emulateMedia({ reducedMotion: 'reduce' })` in `beforeEach`,
  matching the #342 house pattern, after a CI-only recurrence of the
  dialog-open contrast flake (PR #479's chromium job; same commit
  passed locally and on rerun).

- **`hc.print.css` — opt-in print stylesheet** (theme E of the
  business-app gap analysis; `@hypermedia-components/core/css/print`,
  also at `dist/hc.print.css`). Business pages get printed — the order
  detail for the courier, the search result for the meeting — and until
  now the kit had **zero** `@media print` rules. Everything lives in
  `@media print` inside the `hc.utilities` layer, so nothing changes on
  screen and on paper the rules win by layer order alone. Doctrine:
  **paper shows the record, not the app** (shell nav/header, toolbars,
  menubars, buttons, pagination, toasts, drawers, tooltips, hovercards,
  command palette, skeletons, spinners, htmx indicators, and closed
  dialogs hide); **data survives the page** (scroll areas un-clip,
  sticky datagrid headers go static, truncated cells un-ellipsize,
  `<thead>` repeats, rows/cards/fields/alerts refuse to split);
  **ink is honest** (shadows drop, prints light regardless of
  `data-theme`, black hairlines, status containers keep a thin border
  for grayscale). State attributes stay authoritative — `[hidden]`,
  closed details/dialogs, inactive tab panels do not print. **Not**
  concatenated into `hc.css`: printing a screen layout is a product
  decision, one `<link>`/`@import` away. Documented at
  `fundamentals/print` (en/ja, sidebar entry).

- **Docs: `fundamentals/errors` — the errors & recovery map** (PR 2 of
  [`plans/hc-error-paths-plan-en.md`](plans/hc-error-paths-plan-en.md),
  landed last so its links resolve; the plan's Status records the
  reorder). One page (en/ja) turning the scattered failure branches
  into a single table — status → what the user sees → which recipe
  owns it (`422` field-errors, `401` session-expiry, `409`
  edit-conflict, `413`/`5xx` toast branches) — plus the **one
  consolidated `htmx:beforeSwap` allowance** (`[401, 409, 422]`) the
  per-recipe pages repeat in one-status form, the two doctrines
  (server-narrated errors; 200-with-truth for domain outcomes), and
  **double-submit hygiene** (`data-hx-sync="this:abort"` +
  `data-hx-disabled-elt` + indicator — with the "hand-rolled disabling
  gets the error path wrong" warning). Session-expiry and
  edit-conflict pages gain their deferred cross-links (en/ja).

- **`edit-conflict` recipe — optimistic locking via a hidden version**
  (PR 4, final, of
  [`plans/hc-error-paths-plan-en.md`](plans/hc-error-paths-plan-en.md);
  the 32nd recipe). Two people open the same record; the slower save
  must not silently eat the faster one: a hidden `version` rides every
  save, a stale save answers `409` steered by `HX-Retarget` into the
  same shared error-dialog host session-expiry uses, and the conflict
  dialog — a real theirs/yours `<table>` — finishes the flow through
  ordinary htmx: **Overwrite** re-submits the user's fields plus the
  dialog's **fresh** hidden version (`force=1` means "I saw v13 and
  chose to overwrite"; a record that moved again re-conflicts),
  **Reload** swaps the form `outerHTML` from the current record, and
  the `<form method="dialog">` escape keeps editing. Both action
  buttons ride the shipped `data-hc-close-dialog-on-success`.
  **Zero new JavaScript, zero new public API** — hidden field +
  headers + shipped machinery. Live demo (v13-pinned stateless module,
  5 API tests), docs (en/ja), and a cross-engine Playwright suite
  (conflict dialog, overwrite-wins-and-closes, reload-discards,
  keep-editing leaves the stale version, axe with the dialog open).

- **`installSessionExpiry()` + `session-expiry` recipe — 401 → login
  dialog → request replay** (PR 3 of
  [`plans/hc-error-paths-plan-en.md`](plans/hc-error-paths-plan-en.md);
  the 31st recipe). An expired session turns any interrupted action
  into a login `<dialog>` — the server steers it with `HX-Retarget`
  into the shared `[data-hc-remote-dialog-root]` host (shipped
  machinery opens it), the page-level allowance lets the 401 fragment
  swap, and the new ~50-line bridge remembers the interrupted
  `requestConfig` and **replays it through `htmx.ajax()`** when the
  login response fires `hc:sessionrenewed` — the user's click completes
  instead of vanishing. One slot, latest wins; a rotated CSRF token is
  picked up fresh by `installCsrfHeader` on replay; nothing survives a
  page load. The docs demo frame's beforeSwap allowance widens from
  `422` to `[401, 409, 422]` (the consolidated shape the error-paths
  theme documents). Roster now 52; pinned by a 7-test jsdom suite
  (capture/replay/single-slot/host-gating via a stubbed `htmx.ajax`)
  and a cross-engine Playwright suite whose keystone asserts the
  replay: click → 401 dialog → sign in → **the approval completes by
  itself** (cookie-session mock; wrong-password 422 re-renders the
  dialog with field-errors).

- **`autosave` recipe — debounced drafts + restore banner** (PR 3,
  final, of
  [`plans/hc-form-safety-plan-en.md`](plans/hc-form-safety-plan-en.md);
  the 30th recipe). A request-owning `<div>` inside the form posts the
  whole form as a draft — `input from:closest form changed delay:2s` is
  the entire debounce loop, **zero new JavaScript / zero new public
  API**. The contract fixes the draft endpoints (drafts stored raw and
  never validated; password-type fields dropped server-side), the
  restore banner (`GET …/draft` returns the form re-rendered from the
  draft **with `data-dirty` preset** — draft content is unsaved by
  definition, and the guard warns from the attribute alone), and the
  interplay with `installDirtyGuard`: the draft's `htmx:afterRequest`
  has a different `elt`, so **a draft save deliberately does not clean
  the guard** — only the record save does. Ships with a stateless live
  demo (demo-api module + 5 tests), docs (en/ja), and a cross-engine
  Playwright suite pinning "a typing burst produces exactly one
  debounced draft post" via a fixture-side request counter.

- **`installDirtyGuard()` + `unsaved-changes` recipe — warn before
  edits are lost** (PR 2 of
  [`plans/hc-form-safety-plan-en.md`](plans/hc-form-safety-plan-en.md);
  the 29th recipe, client-only). `data-hc-dirty-guard` on a form:
  baseline snapshot on first focus (via `new FormData(form)`, so
  installFormat's canonical wire values mean display regrouping is
  never "dirty"), `data-dirty` + `hc:dirtychange` on real changes, the
  browser's beforeunload prompt while dirty (never during the form's
  own submission — the `submit` event fires only after constraint
  validation), a localized `window.confirm` on boosted-link navigation
  (`dirtyguard.leave`, en/ja), and clean-on-save keyed on
  `htmx:afterRequest` **element identity** — a draft autosaver inside
  the form deliberately does not clean the guard. The dirty check is
  attribute-driven, so a server may render `data-dirty` (a restored
  draft) and the guard warns before the form is ever focused.
  Auto-installed; behaviors roster now 51; pinned by a 9-test jsdom
  suite and a cross-engine Playwright spec (real typing, style hook,
  clean-on-save via the mock, Chromium-only real beforeunload dialog).

- **`postal-address` recipe — postal-code → address autofill** (PR 4 of
  [`plans/hc-input-format-plan-en.md`](plans/hc-input-format-plan-en.md);
  the 28th recipe). The masked postal input
  (`data-hc-mask="postal-jp"`) makes the trigger guard exact —
  `change[target.value.length==8]` fires once, on a complete code — and
  the server answers with a status line for an `aria-live` hint slot
  plus **out-of-band `outerHTML` re-renders** of the address inputs
  (stable ids keep the label associations; `autocomplete` tokens keep
  browser autofill alive). Multiple hits come back as candidate buttons
  re-calling with `&choice=<n>`; not-found is a hint; malformed is
  `422` through the standard allowance. No new JavaScript and no new
  public API — the mask shipped in #471; this PR is contract +
  composition. Ships as `recipes/postal-address/` with a live demo
  (stateless demo-api module + tests), a docs page (en/ja), and a
  cross-engine Playwright suite (mask-guarded trigger, OOB fill, the
  candidate pick, no-match, axe with the candidate list open).

- **`installMask()` — declarative fixed-format input masks** (PR 3 of
  [`plans/hc-input-format-plan-en.md`](plans/hc-input-format-plan-en.md)).
  `data-hc-mask` renders codes as the user types: `#`/`a`/`A`/`*`
  pattern tokens plus literal characters (`postal-jp` = `###-####`),
  NFKC entry so fullwidth digits fill slots, lazy literals (`1234` →
  `123-4`), caret-preserving re-renders, and Backspace/Delete that hop a
  literal run and always consume a raw character. The wire value is the
  displayed canonical form; `data-hc-mask-submit="raw"` strips literals
  via the same `formdata` hook installFormat uses. No `maxlength` is
  imposed — the render caps at the mask, so pastes like `〒123-4567`
  clean instead of truncating. Auto-installed; documented on the input
  page (en/ja) and the behaviors roster (50); pinned by an 11-test
  jsdom suite (caret math, literal hops, submit modes) and a
  cross-engine Playwright spec (real typing, caret position, raw wire
  snapshot, axe).

- **`installFormat()` / `installNormalize()` — business-form input
  hygiene** (PR 2 of
  [`plans/hc-input-format-plan-en.md`](plans/hc-input-format-plan-en.md)).
  `data-hc-format="number"` turns a plain text input into an amount
  field: fullwidth digits normalize on blur (NFKC) and the display
  groups per locale (`1,234,567`), focus shows the raw value again (no
  caret management anywhere), and the **wire value stays raw** — the
  behavior rewrites the entry list in the `formdata` event, which fires
  for both the htmx path (`new FormData(form)`) and the native submit.
  `data-decimals` pads (never rounds); `data-locale` overrides the
  grouping locale. `data-hc-normalize="ascii | kana"` self-corrects IME
  leftovers on commit (fullwidth ASCII → halfwidth, ideographic space →
  space; halfwidth kana → fullwidth, hiragana → katakana for furigana
  fields) in a capture-phase `change` listener so htmx triggers read
  the normalized value, with the same `formdata` safety net. Both are
  auto-installed, idempotent, and return uninstallers; no new events,
  CSS, or i18n keys. Documented on the input page (grouped amounts +
  IME normalization, en/ja) and the behaviors roster (now 49); pinned
  by a jsdom suite (synthetic `formdata` — jsdom lacks the event) and a
  cross-engine Playwright spec whose fixture snapshots
  `new FormData(form)` to prove raw-on-the-wire in real browsers.

### Fixed

- **Docs: the Display settings Color picker follows the accent
  pentagon** — the header popover still offered the pre-0.2.0 accent
  names (indigo / emerald / rose / amber), which core 0.2.0 no longer
  ships, so picking them did nothing. The picker, its localStorage
  whitelist, and the pre-paint head script now list
  `teal / lime / orange / fuchsia`; a stored pre-0.2.0 value falls
  back to `default` and self-heals on the next pick.

### Security

- Range-scoped `pnpm` overrides floor two vulnerable transitive
  dev-toolchain deps flagged by Dependabot: `nanoid` ≥ 3.3.17
  (GHSA-2v37-7h3g-55p8, via postcss) and `js-yaml` ≥ 4.3.1
  (GHSA-5p4m-2wfm-xmqj, via astro/stylelint). Build/lint/docs tooling
  only — nothing shipped in the published packages; the overrides
  self-retire once the parent ranges resolve at or above the floors.

## [editor-kit-0.2.0] - 2026-08-08

**`@hypermedia-components/editor-kit@0.2.0`** — the #452 dirty-region
serialization plan
([`plans/hc-editor-kit-dirty-serialize-plan-en.md`](plans/hc-editor-kit-dirty-serialize-plan-en.md)),
all three stages, strictly additive. Independent `editor-kit-v0.2.0`
tag; core and CLI are not part of this release.

### Added

- **editor-kit: dirty tracking on `CommandStack`** (#452 Stage 1, of
  three staged in
  [`plans/hc-editor-kit-dirty-serialize-plan-en.md`](plans/hc-editor-kit-dirty-serialize-plan-en.md)) —
  the stack now tracks which nodes drifted from the last clean point:
  `stack.dirty`, `stack.dirtyNodes()` (`Map<Node, Set<kind>>` with
  kinds `attr:<name>` / `text` / `children`), and `stack.markClean()`
  (emits `change` `{action: 'clean'}`). Signed-count semantics: undo
  back to the clean point is clean, undo *past* a `markClean()`
  watermark is dirty again; coalesced merges don't double-count;
  `clear()` forgets history but keeps dirt. Each of the six command
  primitives declares its dirt via a new `dirt()` method (a moved node
  is itself not dirty — only its old and new parents' child lists).

- **editor-kit: `serializePatch()` / `serializeNode()`** (#452
  Stage 2) — the dirty regions as clean HTML: `serializeNode(node)` is
  one element's scaffolding-stripped outerHTML, and
  `serializePatch(root, dirtyMap)` returns
  `{ clean, patches: [{ node, kinds, html }] }` — one patch per dirty
  node under `root` with no dirty ancestor (minimal cover; the root
  patch uses `serialize(root)`'s innerHTML). Wired into
  `createEditor()` as `editor.serializePatch()`. No text splicing yet
  — that is Stage 3.

- **editor-kit: format-stable serialization** (#452 Stage 3, closing
  the issue) — `createEditor({ source })` parses the original template
  text into the canvas (browser-parsed via `<template>`, offsets from
  a flat tokenizer, spans from aligning the two), and
  `editor.serializeStable()` splices edits into that text instead of
  re-serializing the whole canvas: moved nodes travel as verbatim
  source slices, attribute edits splice inside the start tag without
  renormalizing neighboring attributes, inserted nodes serialize
  fresh, and everything untouched keeps its original bytes — quotes,
  entities, whitespace. Returns `{ text, stable, regions }`;
  `stable: false` means alignment degraded (exotic markup) and `text`
  fell back to the plain `serialize()`. `{ commit: true }` rebaselines
  the SourceMap to the returned text without re-parsing, so
  edit → save → edit → save cycles stay spliceable. New module export
  `@hypermedia-components/editor-kit/source` (`attachSource`,
  `SourceMap`, `serializeStable`, `tokenize`), all re-exported from
  the package root.

## [0.2.0] - 2026-08-08

The OKLCH color release (#457). **Contains breaking changes** — the
first since `0.1.0` — flagged below per VERSIONING.md; shipped as a
minor while the major is 0. No adopters were on the renamed surface.

- **CLI `@hypermedia-components/cli@0.4.0`** — the email axis list
  follows the accent pentagon (`--color teal | lime | orange |
  fuchsia`; the old names are rejected). Breaking for scripts passing
  the old values, and older CLI versions cannot themed-eject against
  core `0.2.0` — upgrade both together. (Independent `cli-v0.4.0`
  tag.)

### Changed

- **The accent axes are now the accent pentagon** — `data-color`
  values are `default` (blue) / `teal` / `lime` / `orange` / `fuchsia`,
  replacing `indigo` / `emerald` / `rose` / `amber`. **Breaking** for
  markup using the old values (flagged per VERSIONING.md; pre-adoption
  window). The five hues sit exactly 72° apart around the hue wheel,
  anchored at blue (264° / 336° / 48° / 120° / 192°), which fixes two
  real defects in the old set: `rose` sat 9.7° from the error red, so a
  rose-themed app rendered primary actions and error states in visually
  identical colors, and `indigo` sat 12.6° from the default blue —
  two of five choices were nearly the same color. Every pentagon vertex
  stays ≥ 21° from the error / warning / success hues, and
  `test/ramp.test.mjs` asserts the spacing. Four new primitive ramps
  (`fuchsia` / `orange` / `lime` / `teal`) back the axes; all existing
  ramps are unchanged and remain available as primitives. A hexagon was
  considered and rejected: anchored at blue, one vertex lands 2.9° from
  the error red. For a sixth accent, the theme builder generates any
  hue through the same ladder.

### Fixed

- **Email templates baked `oklch()` — unreadable by email clients.**
  The OKLCH primitive conversion leaked into the email render target:
  `expandEmailHtml()` substituted resolved token values verbatim, so
  the baked artifacts (`./email-artifacts/*`, the builder's Email tab,
  and `hc email eject` output) carried `oklch()` colors that Outlook's
  Word engine and several webmail clients cannot parse. The
  transformer now converts every substituted color to its sRGB hex —
  the same treatment `rem→px` already got, for the same reason — and
  `email-tokens.json` carries the same email-safe values. New export
  `emailSafeValue()`; a regression test asserts no `oklch()` or custom
  property survives in any generated file.

- **`semantic.color.warning` was bronze.** It resolved to `amber.600`
  (`#986107`) — the ladder's white-text-safe step, but visibly brown as
  a warning color. Every consumer is a border, fill, or checked-state
  surface (never a text background — text-bearing warning chips use
  `status.warning`'s own pair), so the requirement is the 3:1
  graphical-object contrast, not 4.5:1. It now resolves to `amber.500`
  (`#b8760b`, 3.73:1 against white), which reads as amber. Note the
  physics: a *bright* amber like the old `#f59e0b` is 2.1:1 against
  white and cannot coexist with white glyphs at all.

### Changed

- **Theme builder derives in OKLCH.** The docs theme builder no longer
  carries its own sRGB colour theory — `hexToRgb` / `rgbToHex` /
  `darken` / `luminance` / `hslToHex` are gone, replaced by the shared
  `@hypermedia-components/core/oklch` ladder. **Hover darkness** is now
  a lightness step holding hue and chroma (default `7`, the gap the
  built-in ramps use between `600` and `700`) instead of an sRGB
  channel multiply, which dimmed warm hues faster than cool ones. The
  **Auto** foreground is the lightness threshold rather than a contrast
  search. Exports emit `oklch()` and `color-mix(in oklab, …)`.

  New **In OKLCH** read-out plus a **Snap to ladder** button that
  replaces the brand colour with step `600` for its hue — the exact
  colour a built-in axis would use, AA-safe by construction. **Shuffle**
  now rolls a hue through the ladder, so a shuffled theme always clears
  AA. The `<input type="color">` picker stays (it is hex-only by spec)
  and converts on read. Built-in accent presets updated to the new
  ramp values; amber loses its dark-foreground override.

- **Chromatic ramps regularized on a shared lightness ladder.** The
  seven chromatic ramps (blue / red / green / amber / indigo / rose /
  violet) are now generated from one hue angle per ramp plus a shared
  ladder: `L` fixed per step, `C` an absolute per-step target clamped
  to the hue's sRGB gamut, `H` constant down the ramp. **Colors change
  visibly** — mean Oklab ΔE ≈ 3.7, largest on `amber`, which was the
  ramp furthest off the ladder. The five **neutral** ramps are
  untouched (they were already even), so surfaces, borders, text and
  dark mode do not move.

  The payoff is that the step number now means a lightness, so the
  `data-color` axes collapse to one shape: **every** axis takes `600`
  for the action surface, `700` for hover, `500` for the focus ring,
  and **white** text. `amber` no longer needs dark text or an 18% soft
  tint, and `emerald` / `rose` no longer reach down to `700` / `800`.
  Contrast is now a property of the construction — white on `600`
  scores 4.73–5.86:1 across all 360 hues — so a new accent hue needs no
  contrast review. Measured margins narrow relative to before
  (`emerald` 5.48 → 4.76:1, `indigo` 6.29 → 5.44:1); all clear AA, and
  `test/ramp.test.mjs` now asserts the whole table.

  Note that step `500` is not a text surface: at L 0.62 the saturated
  hues clear neither white nor dark text, which is why it is the
  focus-ring step. Regenerate with `node scripts/build-ramp.mjs`;
  `--check` reports drift.

- **`color-mix()` interpolates in `oklab`** at all 31 sites. This is
  intent and future-proofing, not a visual change: 26 of the sites mix
  with `transparent`, which is interpolation-space-independent because
  `color-mix()` is premultiplied, and the other 5 mix into a
  near-neutral surface where the two paths differ by at most 2/255.

### Changed

- **Primitives expressed in OKLCH** — all 139 literal colors in
  `src/tokens/primitive.tokens.json` are now `oklch()` instead of hex.
  **No visual change:** every value was chosen to round-trip to the
  identical 8-bit sRGB triple, verified two ways — a conversion check
  on all 139 values, and all 14 Playwright VRT baselines staying
  byte-identical (light/dark × LTR/RTL, plus compact and accent).
  Generated `--hc-*` custom properties now carry `oklch(…)`, so code
  that compares the *text* of a resolved token against a hex string
  needs updating; what the browser paints is unchanged. This is
  groundwork for regularizing the ramps on a shared lightness ladder —
  see [`plans/hc-oklch-color-plan-en.md`](plans/hc-oklch-color-plan-en.md).

### Added

- **`@hypermedia-components/core/oklch`** — a dependency-free OKLCH ↔
  sRGB module (`parseOklch`, `oklchToRgb`, `oklchToHex`, `rgbToOklch`,
  `hexToOklch`, `inSrgbGamut`, `toHex`) plus the ramp ladder itself
  (`LADDER`, `maxChroma`, `rampStep`, `formatOklch`, `autoForeground`,
  `FG_LIGHTNESS_PIVOT`). The token generator and the docs read the same
  constants, so a generated accent is built exactly like a built-in
  one. Exported the same way as `./token-transform`.

## [0.1.15] - 2026-08-07

- **`@hypermedia-components/editor-kit@0.1.0`** — the editor-kit
  additions below ship as their own release (independent
  `editor-kit-v0.1.0` tag).

### Added

- **Scriptless static rendering** (#450) — the resting state of every
  behavior component is now a documented contract
  (`reference/static-rendering`, en + ja): native
  popover/`<dialog>`/`<details>` primitives and attribute-driven CSS
  carry it without JavaScript. New opt-in `data-hc-static` (on any
  ancestor) forces the canonical resting presentation where CSS can
  express it — tabs show the first panel only, an empty calendar
  shell keeps its framed footprint. The manifest gains a per-component
  `staticSafe` flag (exactly four are `false`: calendar, carousel,
  chart, code) so sandboxed canvases, screenshot/PDF renderers, and
  print can badge approximate previews honestly.

### Added

- **Baked email artifacts + machine contract** (#448) — the core
  package now ships the transformed email templates for the built-in
  axes under `./email-artifacts/*`: `default-<neutral>` themes (all
  five neutral ramps, default accent) × both flavors
  (thymeleaf/plain), each with `hc-email.html`,
  `hc-email-layout.html`, and `email-tokens.json`, generated by the
  same engine `email eject` uses (`scripts/build-email.mjs`, part of
  the core build). Plus `email-artifacts/contract.json` — every
  fragment's `th:fragment` name, parameter list, source, and purpose,
  parsed from the sources — so frameworks resolve versioned artifacts
  from the package instead of checking in generated files, and
  validate against data instead of regexing HTML. The CLI's
  `email eject` remains the path for custom themes/tokens.

### Added

- **editor-kit: canvas ergonomics from the first consumer** (#449) —
  `insertNode`/`moveNode` accept `{ before: Element|null }` insertion
  points alongside numeric childNodes indices; the whitespace-aware
  `indexBefore(parent, ref, exclude?)` counter is exported;
  `pickBlock(target, { root, manifest })` resolves a click target to
  the nearest manifest-block ancestor (never the mount, cross-document
  safe); and `createDragController` accepts a `frame` option — with an
  iframe-hosted canvas it listens on both documents and translates
  host coordinates through the frame rect, so palette drags from the
  parent document complete instead of falling back to click-to-insert.
- **`manifest.json`: editor composition metadata** (#447) — each
  `components[]` entry gains `containers[]` (the parts whose element
  accepts arbitrary flow children in an editor canvas; `""` marks the
  block root; structured components like datagrid/tabs/menu list
  nothing), and a new top-level `utilities[]` section lists every
  `hc-*` utility class with a `container` flag (the layout set:
  stack, cluster, grid, container, sidebar). Editors can now derive
  droppable marking and `canAccept` rules from the injected manifest
  instead of hardcoding a container list.

- **Docs: Editor kit section** (en + ja) — a new sidebar group for
  `@hypermedia-components/editor-kit`: overview + design decisions,
  the full API reference (commands/stack, selection, serializers,
  drag & drop, overlay), and a manifest-driven inspector guide with a
  **live demo** running the real editor-kit in the page (click to
  select, `attributeValues`-driven property panel, undo/redo, and a
  `serialize()` output pane proving the `data-hc-editor-*` scaffolding
  namespace never reaches the artifact).

## [0.1.14] - 2026-08-07

- **CLI `@hypermedia-components/cli@0.3.2`** — re-bundles the recipe
  set so `add sortable` works offline from the published tarball. No
  code changes. (Independent `cli-v0.3.2` tag.)

### Added

- **`installSortable()` — pointer + keyboard list reordering**, shipped
  as the **`sortable` recipe**. `data-hc-sortable` makes a container's
  children reorderable through their `data-hc-sortable-handle` buttons:
  pointer drags (4px threshold, live reorder, Escape cancel) and a
  fully announced keyboard interface (Space/Enter grab · arrows move ·
  Space/Enter drop · Escape restore; new `sortable.*` i18n keys, ja
  shipped). The behavior only moves DOM nodes and dispatches
  `hc:sortchange` `{ item, from, to, order }` — htmx owns persistence:
  each item's hidden input serializes the new order in one request.
  State is attributes (`data-dragging`, `data-grabbed`,
  `aria-pressed`). Auto-installed by `./behaviors`.


- **`@hypermedia-components/editor-kit` `0.0.1` (experimental)** —
  released via independent `editor-kit-v*` tags (first publish
  authenticates with a granular npm token; trusted publishing takes
  over once the package exists). The editor engine for visual builders
  over the kit:
  the six undoable edit primitives (`setAttribute` / `removeAttribute` /
  `setText` / `insertNode` / `removeNode` / `moveNode`) with a
  `CommandStack` (undo/redo, `transact()` grouping, coalescing for
  inspector typing), a `Selection` model, and serializers — artifact
  HTML (strips the reserved `data-hc-editor-*` / `data-hc-editor-only`
  scaffolding namespace) and a bijective JSON projection
  (`toJson()` / `fromJson()`, `component` annotation driven by the
  injected core manifest). Zero runtime dependencies; the canvas DOM
  is the document model (no parallel IR). CI lints and tests the new
  package in the existing lint/unit jobs.
- **editor-kit: drag & drop + overlay** — `createDragController()`, a
  pointer-events drag engine (palette inserts via `startInsert`,
  canvas moves via `startMove` with a click-preserving threshold,
  Escape cancel). Droppable regions are marked with the scaffolding
  attribute `data-hc-editor-container`; a `canAccept` hook lets a
  manifest-driven builder veto containers. Reported drop indices are
  childNodes positions with the dragged node absent — directly
  consumable by `insertNode`/`moveNode`, so drops stay undoable. Plus
  `Overlay`, the host-side layer that draws selection outlines and the
  row/column-aware drop indicator over an inline or iframe-hosted
  canvas.

- **`manifest.json`: enumerated attribute values + themable var surface**
  — each `components[]` entry gains `attributeValues{}` (every
  value-carrying `data-*` attribute in the block's stylesheet → its
  sorted enumerated values, e.g. `data-variant` →
  `["error","ghost","primary","secondary"]` on `hc-button`) and
  `cssVars[]` (every `--hc-*` custom property the stylesheet reads).
  Additive manifest fields — consumers that generate UI (property
  inspectors, builders, structured-output agents) can now enumerate
  variants/sizes and the themable surface without parsing CSS.

## [0.1.13] - 2026-08-07

- **CLI `@hypermedia-components/cli@0.3.1`** — re-bundles the recipe
  set so `add conditional-fields` works offline from the published
  tarball. No code changes. (Independent `cli-v0.3.1` tag.)

### Added

- **`installShowWhen()` — declarative conditional field visibility**
  (#428), shipped as the **`conditional-fields` recipe**.
  `data-hc-show-when="<value> [<value> …]"` marks any element visible
  only while the controlling switch — the closest form's
  `[data-hc-show-switch]` control, or the `data-hc-show-src` selector
  override — has one of the listed values. Visibility is the `hidden`
  attribute (never inline styles), evaluated at install (server-rendered
  state honored), on every `change` (no request, no focus loss), and for
  htmx-swapped content. Hidden controls keep submitting — filtering
  values is the server's job. Auto-installed by `./behaviors`.
- **`.hc-numeric` utility** (#433) — `font-variant-numeric:
  tabular-nums` for app-owned numeric surfaces (stat tiles, KPI values)
  outside the components that default to it. Glyphs only; alignment
  stays the context's job.
- **`data-numeric` on `hc-input`** (#433) — end-aligns an amount-style
  field (`text-align: end`, logical), the same attribute + semantics as
  table cells.
- **`data-numeric` numeric-column modifier on `hc-table` and
  `hc-datagrid`** (#430) — on a `th`/`td` (or
  `.hc-datagrid__headcell` / `.hc-datagrid__cell`) it end-aligns the
  cell (`text-align: end`, logical — flips free in RTL). Opt-in,
  CSS-only; composes with `data-sortable` headers.

### Changed

- **Table and datagrid cells render tabular figures by default**
  (#430) — `font-variant-numeric: tabular-nums` on `.hc-table` `th`/`td`
  and `.hc-datagrid__cell` / `.hc-datagrid__headcell`, so digit runs
  (counts, amounts, timestamps) align vertically down a column. Affects
  digit glyphs only; text cells are unchanged (Chromium VRT baselines
  regenerated byte-identical).
- **Tabular figures extended beyond tables** (#433) — `hc-input`,
  `hc-select`, `hc-datepicker`, `hc-calendar` day cells,
  `hc-pagination` items, `hc-badge`, and `hc-timeline` timestamps now
  default to `font-variant-numeric: tabular-nums` (digit glyphs only;
  text unchanged — Chromium VRT baselines regenerated byte-identical).

### Fixed

- **`installTree()`: interactive controls inside a row no longer
  toggle the branch** (#427) — the click handler's exemption only
  covered `a[href]`, so a per-row action `<button>` (or form control)
  fired its own action *and* collapsed the branch it acted on. The
  click guard now matches the keydown handler's control set
  (`a[href], input, button, select, textarea`); row text/whitespace
  clicks and the chevron toggle are unchanged.
- **`.hc-field` now re-asserts `[hidden]`** (#428) — its `display: grid`
  outweighed the UA hidden rule, so a server-rendered (or
  behavior-toggled) `hidden` attribute on a field silently failed to
  hide it.
- **Numeric datagrid cells no longer jump to start alignment when
  entering edit mode** (#433) — the UA sheet's `text-align: start` on
  inputs beat inheritance; the mounted editor now re-inherits the
  cell's `end` alignment.

## [0.1.12] - 2026-08-06

### Fixed

- **`installConfirm()` completes plain-form submissions** (#421) — a
  confirmed submit button inside (or `form=""`-associated with) an
  ordinary non-htmx `<form>` previously dispatched only `hc:confirmed`,
  which nothing listened for: the user confirmed and the action never
  happened. On confirm the behavior now also calls
  `form.requestSubmit(button)` — the button stays the submitter
  (`formaction`/`formmethod` honored) and constraint validation runs —
  when neither the button nor its form carries an htmx verb attribute
  (`hx-get/post/put/patch/delete` or `data-hx-*` variants). htmx-wired
  elements keep the event-only contract, so nothing double-fires;
  cancel still submits nothing.

### Added

- **`350` primitive step on the five neutral ramps** (`gray.350`
  `#a7aeb9`, `zinc.350` `#acacb4`, `slate.350` `#a1aec1`, `stone.350`
  `#b2ada9`, `neutral.350` `#adadad`) — a tuned dark-muted-text shade
  sitting between `300` and `400`, chosen per ramp for ≥ 4.5:1 on the
  ramp's `700`.

### Changed

- **Dark `text-muted` raised from the `400` to the `350` step** —
  muted text on `muted-bg` surfaces (input-group addons, stepper
  markers, multicombobox tag remove buttons, hovered menu / tab /
  command items…) sat at 4.04–4.11:1 in dark, under the WCAG AA
  4.5:1 minimum. Now 4.61–4.63:1 on `muted-bg` and ~8:1 on the page
  background (was ~7:1), so the muted-vs-body hierarchy is preserved.
  Light theme unchanged (6.9–7.2:1 already). Theme builder dark
  output and the palette docs follow. Chromium VRT baselines
  regenerated.

### Changed

- **Button-shaped boundaries moved to `border-strong`** — follow-up to
  the form-control pass: `button` `default` variant border,
  `carousel` prev/next `control-border`, and the inactive
  `carousel` `dot-color` now use `--hc-color-border-strong` (WCAG
  1.4.11). Chromium VRT baselines regenerated.

### Added

- **`--hc-color-border-strong` semantic token** — dedicated boundary
  color for form controls, meeting WCAG 1.4.11 non-text contrast
  (≥ 3:1 against both `bg` and `surface` in light *and* dark, all five
  neutral ramps; the shared `500` ramp step). Defined in
  `semantic.tokens.json` and overridden per ramp in
  `neutral.<ramp>.tokens.json`; like `focus-ring`, the same value
  serves both themes so the dark files need no override.

### Changed

- **Form-control boundaries now use `border-strong`** — the default
  `border` of `input`, `select`, `datepicker`, `checkbox`, `radio`,
  `switch`, `toggle`, `inputotp`, `dropzone`, and `input-group` moved
  from `--hc-color-border` (1.4–1.7:1 against dark surfaces, ~1.5:1 in
  light) to `--hc-color-border-strong`. Decorative borders (cards,
  separators, tables, popovers…) keep `--hc-color-border` unchanged.
  Chromium VRT baselines regenerated.

## [0.1.11] - 2026-08-02

- **CLI `@hypermedia-components/cli@0.3.0`** — the `email` release: the
  new `email list` / `email eject` commands (below) and the CLI's new
  dependency on `@hypermedia-components/core` for the shared
  token/email transforms. (Independent `cli-v0.3.0` tag.)

### Security

- **Email transformer: linear-time `th:*` stripping**
  (`scripts/email-transform.mjs`). `stripThymeleaf()`'s `\s+` prefix
  was polynomial on whitespace-heavy inputs (CodeQL
  `js/polynomial-redos`); the transformer also runs in the browser
  (theme-builder Email tab). Now a single `\s` — output is identical
  for the hc-authored fragment sources, whose attributes are
  single-space separated by convention (documented in the function
  contract).

### Added

- **CLI: `email list` / `email eject`** — generate theme-baked HTML
  email templates (`hc-email.html` / `hc-email-layout.html` /
  `email-tokens.json` into `<target>/email/`) from the command line:
  built-in axes via `--color` / `--neutral`, theme-builder DTCG exports
  (accent or full-theme patch) via `--tokens`, `--flavor
  thymeleaf|plain`, and the `add`-style overwrite refusal. Runs the
  same `resolveTokens` + email-transform engine as the theme builder's
  Email tab (new CLI dependency on `@hypermedia-components/core`), so
  the two can't drift. Closes the
  [email templates plan](plans/hc-email-templates-plan-en.md) (§6).

- **Email fragment sources + transformer** for the HTML-email render
  target ([plan](plans/hc-email-templates-plan-en.md) §4): ten
  table/inline-style fragments plus the layout and dark-mode `<style>`
  partials under `src/email/<name>/` (`fragment.html` + `contract.md`),
  authored as Thymeleaf natural templates with flat-token placeholders;
  and the pure, browser-safe
  `@hypermedia-components/core/email-transform` module
  (`buildEmailFiles` / `expandEmailHtml` / `stripThymeleaf` /
  `emailLayerStacks` / `emailManifestComment` / `emailTokensJson`).
  Generation resolves tokens to literals (rem → px) — consumed by the
  docs theme builder's Email tab and the CLI's `email eject`. A guard
  test enforces an email-safe CSS property allowlist over everything
  generated. New package exports: `./email/*`, `./email-transform`.

- **`resolveTokens()`** in the token transformer
  (`@hypermedia-components/core/token-transform`): resolves one concrete
  axis combination (ordered layer stack, later layers win) to a flat
  `Map` of literal values — the `--hc-*` names minus the prefix, e.g.
  `button-primary-bg` → `#4f46e5`. For render targets that cannot use
  CSS custom properties; first consumer is the HTML-email workstream
  ([plan](plans/hc-email-templates-plan-en.md)).

## [0.1.10] - 2026-08-02

### Security

- **Token transformer: linear-time reference scanning**
  (`scripts/token-transform.mjs`). The `{ref}` substitution regexes and
  the `--hc-*` declaration counter were quadratic on adversarial inputs
  (many `{`s with no closer; repeated `--hc-` runs) — flagged by CodeQL
  as `js/polynomial-redos`. The transformer also runs in the browser
  (docs theme builder) on user-supplied token JSON, so the scans are now
  linear: `[^{}]` char classes and an anchored per-line declaration
  count. Output is byte-identical for valid inputs.
- **Lockfile: `brace-expansion` 5.0.7 → 5.0.9** (dev/docs tooling;
  Dependabot alert 17, GHSA-mh99-v99m-4gvg — DoS via unbounded
  expansion length). Transitive under `minimatch`; nothing in the
  published core package depends on it (core has zero runtime deps).

### Added

- **Chart: `data-link` — click-through to server-authored markup**
  (recipe `chart` / `installChart`). Clicking a mark forwards the
  click to real markup the server sent — the chart never owns a URL
  or a request. Two contracts, resolved by what the figure contains:
  a first-column **anchor** (row granularity; a plain `href`
  navigates, htmx attributes swap as authored; the same link is the
  no-JS / keyboard / screen-reader path), or a figure-wide **form**
  (category × series granularity; named fields matching datum keys —
  `x`, `series`, `value`, … — are filled from the focused datum and
  the form is submitted, so htmx on the form owns the request and the
  server decides what the parameters mean; visible fields give the
  same drill-down a no-JS path). Focus tracking reuses the `data-tip`
  pointer or an invisible probe; the pointer's 40px radius guards
  empty-space clicks; the cursor turns into a pointer only while a
  clickable datum is focused. Client-side only; `histogram` excluded
  (bins aggregate rows).

- **Chart: `waterfall` — the financial bridge** (recipe `chart` /
  `installChart`). One signed-delta column becomes floating bars from
  the running total before each delta to the total after it. Rows
  marked `<tr data-total>` are absolute anchors: the cell holds the
  real total (the no-JS table stays truthful), the bar runs 0 → value,
  and the running total resets to it. Increase / decrease / total bars
  are coloured by the new `--hc-chart-waterfall-increase` /
  `-decrease` / `-total` tokens (success / error / muted); the legend
  is on unless `data-legend="false"`; `data-tip` shows step, running
  total and delta.
- **Chart: horizontal bars — `bar-x` and `bar-x-grouped`** (recipe
  `chart` / `installChart`). The ranking shape: categories on y (long
  labels stay readable), values on x; `bar-x` stacks multiple series,
  `bar-x-grouped` facets them side-by-side per category on the row
  axis. The value-axis options move with the orientation —
  `data-y-label` / `data-y-min` / `data-y-max` / `data-y-format`
  configure the x axis there, the zero baseline becomes a vertical
  `ruleX` (still dropped when 0 leaves the pinned domain), and a bare
  `data-tip` snaps along the category axis. Docs note the stacked
  horizontal bar as the recommended pie/donut substitute (Plot has no
  arc mark).
- **Chart: hover tooltips, y-axis control, and an escape hatch**
  (recipe `chart` / `installChart`). `data-tip` shows a hover tooltip —
  one standalone Plot `tip` mark per figure driven by a pointer
  transform, so even combo charts never show two tooltips at once (bare
  `data-tip` snaps along x; `scatter` defaults to nearest-point `xy`;
  `x` / `y` / `xy` pick explicitly; `histogram` and `heatmap` tip their
  own mark — bin extent + count, row × column + value). `data-y-min` /
  `data-y-max` pin the y domain (the zero-baseline rule drops out when
  0 leaves the domain) and `data-y-format` formats the y ticks with a
  d3-format string. For everything the attributes don't cover,
  `installChart(root, { plot, buildOptions })` hands the final Plot
  spec + figure to the caller just before rendering. Client-side only —
  tooltips don't apply to the linkedom SSR path (documented).
  (`test/behaviors-docs.test.mjs`). The hand-maintained behaviors
  reference has drifted from source before (three rows missing, count
  stuck at 44 — fixed in #387); the new Vitest guard pins it to
  `buildManifest()`: every behavior has exactly one row (en + ja, same
  order), the intro's count and the auto-init column match the
  manifest, every row carries the full column set, and every `hc:*`
  event the page mentions is dispatched by some source module. Same
  pattern as the existing `i18n-docs.test.mjs` docs-truth guard.

### Changed

- **Component pages — "Browser baseline" always leads the page**
  (en + ja, docs-review follow-up). The support section floated
  between the top (6 pages) and the tail (9 pages: accordion, aspect,
  combobox, hovercard, menu, menubar, navmenu, popover, scroll-area) —
  it now sits right after the intro on all 15 pages that have one,
  matching the pages with the hardest requirements (datagrid, select,
  drawer): whether you can use the component at all is the first thing
  to read, before copying markup. Pure section move, no wording
  changes; none of the moved sections referenced earlier page content.
- **Behaviors reference — Attributes & Events columns** (en + ja,
  docs-review follow-up). Each of the 45 rows now shows the opt-in /
  config attributes an author (or the server fragment) writes and the
  `hc:*` events the behavior dispatches, verified against the manifest
  and each behavior's source — the page is now an at-a-glance contract
  instead of a name roster. Dispatch-vs-listen is spelled out
  (`installToast()` *listens* for `hc:toast`; menubar's `hc:menuselect`
  comes from its menus), long option sets truncate with "…" to the
  component page, and a short legend defines both columns.
- **Component pages — one name for the entry section** (en + ja,
  docs-review follow-up). The first markup section was variously
  titled "Basic example" (15 pages), "Basic usage" (6), or "Demo"
  (command) — all now use the majority convention "Basic HTML" /
  「基本の HTML」. Component-specific first sections ("Image avatars",
  "Determinate", …) are intentionally untouched. aspect's
  "Baseline & fallback" joins the other 14 pages as "Browser
  baseline" / 「ブラウザのベースライン」. No inbound anchors existed
  for any renamed heading.
- **Recipes — every page now meets the recipe DoD** (en + ja,
  docs-review follow-up). Added the missing Accessibility sections
  (datagrid-bulk-actions, file-upload, mutating-form, lazy-tree,
  sse-updates, undo-delete; datagrid-pager's focus guidance promoted
  out of Notes), the missing progressive-enhancement sections
  (inline-edit, multi-step-form), and scannable server-contract
  sections (sse-updates and undo-delete gain request/response tables;
  toast documents its `HX-Trigger` header contract; copy states
  explicitly that it has no server contract). Contract headings are
  normalized to "Server response contract" (datagrid-pager, lazy-tree,
  file-upload, multi-step-form) and confirm-action's "Accessibility
  notes" to "Accessibility"; the ja mirror also normalizes サーバー →
  サーバ in chat-messages.
- **Docs onboarding & size truth** (en + ja, docs-review follow-up).
  Installation now teaches the kit's one external dependency — htmx —
  with a pinned script tag and a link to the htmx guide, gains a
  Troubleshooting section for the three first-hour dead ends (behaviors
  bundle missing / un-minified bundle from a script tag, htmx missing,
  swapped-in fragments with hand-picked installers), links Versioning &
  stability from the version-pinning advice, and uses `hc.min.css` in
  the production-facing static-files snippet. The bundle-size reference
  was re-measured against the published core 0.1.9 dist (the old table
  predated the kit's growth: "everything minified" is ≈ 74 KB gzip
  now, not 26 KB) and is stamped with version + date; the CDN
  paragraph on Installation quotes the honest total. Introduction's
  token link now points at the concept guide, and its opaque
  "copyable expanded HTML" bullet is folded into the macros bullet.
  Blocks and Kitchen sink link up to Templates.

### Fixed

- **Docs accuracy sweep** (en + ja, from a full-site documentation
  review). Corrected actively wrong reference material: the Naming
  page's event examples (`hc:confirm` / `hc:close-dialog` never
  existed — now `hc:confirmed` and real events, with a pointer to the
  manifest) and its phantom `<hc-remote-dialog>` macro; the Anchored
  page's granular import (`css/hc-anchored` resolved to a nonexistent
  file — now `css/anchored`); the behaviors reference (3 missing rows:
  `installToggleGroup`, `installToolbar`, `installChatScroll`; count
  44 → 45); stale pre-`installCsrfHeader()` CSRF prose in the Django /
  Rails / Go guides and the integrations overview (Thymeleaf now
  explains *why* it hand-rolls the listener); the plain-HTML guide
  naming a stylesheet the page never loads; the runtime-axis table now
  states each axis's default (and `data-theme`'s real default is the
  OS preference, not `light`); `hasMessage()` added to the i18n API
  list; smaller drifts (spinner snippet missing its `warning` variant,
  card's "Variations" heading, a bare `hx-trigger` mention,
  datagrid's JS-generated `__resizer` / `__tooltip` classes now
  documented, datagrid-pager's response example notes the demo's
  selection column, the recipes index no longer claims *every* demo
  hits the API).
- **`data-hx-swap-oob` everywhere** — the docs convention is the
  `data-hx-*` form, but three recipe pages and four demo-API handlers
  (datagrid-pager, datagrid-bulk-actions, file-upload, sse-updates)
  still emitted bare `hx-swap-oob`; docs, handlers, and their tests
  now use the `data-` form htmx equally understands.
- **Weekly Lighthouse run: retry noisy measurements, close the
  tracking issue on recovery** (dev-facing, #394). All three budget
  failures to date (2026-06-15, 07-13, 07-20) were the same false
  alarm: the first-measured page picked up runner cold-start noise
  (TBT inflated ~5×) while the identical deploy scored 97 the week
  after. `perf.yml` now re-measures a page that misses the budget (up
  to 3 attempts — real regressions fail all of them), and a green run
  closes the open "Weekly Lighthouse run failed" issue instead of
  leaving it stale (the 07-13 issue outlived its 07-27 recovery by two
  weeks).

## [0.1.9] - 2026-07-09

### Added

- **Landing page — one story, told once** (follow-up to the fold
  fixes; content consolidation). The splash was repeating itself: four
  separate "it's live" demonstrations, three links to the components
  index, two to the kitchen sink. Now each message appears once —
  hero (sharper tagline: "the markup is the wire contract" + the one
  interactive proof card), a numbers line (64 components · 25 live
  recipes · 2 templates · 0 runtime deps · MIT), the showcase band,
  principle cards that now link to their pages, a "The markup is the
  contract" section (markup ⇄ render via the Demo widget — the code
  tab is the wire format), and an "HTML over the wire" section
  (live-search round trip + recipes/templates pointers). Splash hero
  padding is compressed so the whole first story fits a 768px-tall
  viewport (en + ja).

- **Landing — live component showcase above the fold** (follow-up to
  the UX PR-6 hero). The hero's live card had pushed the breadth
  signals below the fold; a compact showcase band (ten real, live
  components + "All 64 components →" / kitchen-sink links) now sits
  under the intent row inside the first viewport, and the live-search
  strip moves below the feature cards (en + ja). First-screen answers:
  what it is, that it's real, and how much of it there is.

- **Motion tokens + guide** (PR-8 of
  `plans/hc-ux-improvements-plan-en.md`). New semantic motion scale —
  `--hc-motion-duration-{fast,base,slow}` (120/200/320 ms) and
  `--hc-motion-easing-{standard,enter,exit}` — consumed by the
  overlays: the dialog gains a tokenized fade + settle enter/exit
  (`--hc-dialog-duration`, `@starting-style` +
  `transition-behavior: allow-discrete`, zeroed under
  `prefers-reduced-motion`), the drawer's easing and the toast's
  swipe transitions move onto the scale (`--hc-toast-duration`;
  160 → 200 ms), and rating/progress durations now reference it
  (values unchanged). New `fundamentals/motion` guide (en + ja):
  the scale, what consumes it, and when to animate at all.

- **Templates — full-page compositions** (PR-7 of
  `plans/hc-ux-improvements-plan-en.md`). New docs section between
  Blocks and Recipes with two page-scale, live compositions assembled
  from existing components/blocks/recipes: a **Settings page** (shell
  + account form + field-errors round trip + success toast) and a
  **CRUD page** (shell + datagrid pager + bulk actions + remote-dialog
  editing + undo-delete), each with a framed live preview, the
  complete page skeleton, a wiring map (region → component → recipe →
  contract) and an adapt-it list (en + ja).

- **Landing hero shows the kit running** (PR-6 of
  `plans/hc-ux-improvements-plan-en.md`). The splash page's empty hero
  half now hosts a live component card (field + hint, buttons firing
  real toasts, badge), and a live-search strip under the intent row
  runs the actual htmx round trip against the demo API — the landing
  *shows* HTML-over-the-wire instead of describing it (en + ja).

- **Density × touch-target guidance** (PR-5 of
  `plans/hc-ux-improvements-plan-en.md`). The density docs gain a
  "Touch targets" section (en + ja) with the real numbers
  (comfortable = 40 px controls, `data-size="lg"` = 48 px, dense =
  28 px) and an honest reset recipe for coarse pointers (flip
  `data-density` via `matchMedia('(pointer: coarse)')` — the tiers
  are attribute-scoped overrides of the same custom properties, so
  there are no per-tier variables to target from CSS alone); the
  kitchen-sink intro cross-links it next to the density switcher.

- **Writing guide + humanized error copy** (PR-4 of
  `plans/hc-ux-improvements-plan-en.md`). New
  `fundamentals/writing` page (en + ja): UI-copy principles — error
  messages that say what happened and how to fix it (no HTTP jargon),
  verb-first toasts, confirm dialogs whose button repeats the verb,
  empty states with a next step, hint-vs-error usage, i18n pointers.
  The canonical field-errors fragment examples stop using
  "Unprocessable Entity" as a user-facing alert title ("Please fix
  the errors below." across docs, demo API and the recipe scaffold);
  status-line references to `422 Unprocessable Entity` are unchanged
  (those name the protocol, not the user copy).

- **Docs header — display-settings popover** (PR-3 of
  `plans/hc-ux-improvements-plan-en.md`). The four labeled preview
  pickers (Color / Neutral / Density / Dir) move from the header row
  into one `hc-popover` behind a compact sliders icon ("Display
  settings" / 「表示設定」), so the site title no longer truncates —
  it was clipped to "Hyperm…" even at 1280 px. Persistence
  (localStorage + pre-paint head script) unchanged; dogfoods
  `hc-popover` + `hc-select`.

- **`.hc-field__hint` — persistent helper text** (PR-2 of
  `plans/hc-ux-improvements-plan-en.md`). `data-invalid` recolors every
  `.hc-field__message`, which collapsed the hint/error hierarchy when a
  field carried both ("We never share it." turned error-red alongside
  the actual problem). `__hint` shares the message typography but keeps
  its muted color inside an invalid field. Additive; `__message` /
  `__error` behavior unchanged. Field docs gain a "Hint vs. error"
  section (en + ja); the field-errors demos use the new class.

- **Toast close button** (PR-1 of
  `plans/hc-ux-improvements-plan-en.md`). Every toast rendered by
  `installToast()` now carries a visible dismiss button
  (`.hc-toast__close`, top inline-end corner) — previously a sticky
  toast (`duration: 0`) was only dismissable via swipe or
  Escape-with-focus, neither discoverable with a mouse. The button's
  accessible name comes from the new `toast.dismiss` catalog message
  (default `Dismiss`, translatable via `setMessages()`); clicking it
  never fires the toast's `action` event; it survives update-by-id;
  swipe capture skips it like the action button. Strictly additive
  (new class, new message key); hand-authored static `.hc-toast`
  markup lays out exactly as before.

- **Recipe live demos — every documented variant demoed** (en + ja;
  audit follow-up). copy gains a `data-hc-copy-text` live preview;
  data-region adds a second region polling `every 10s` (interval-only
  trigger on the re-rendered fragment — no `load` echo); mutating-form
  demos the confirm-gated destructive variant (204 + `HX-Redirect` /
  303 PRG); file-upload adds the dropzone variant against the same
  endpoint (per-form OOB reset + retargeted 422s via a sanitized
  discriminator); sse-updates pushes two `products:rows` datagrid
  pages over the stream; chat-messages demos the attachments
  composition (multipart composer + upload progress + attachment card
  echoed in the user message, `variant="attachments"` on the shared
  ChatDemo).

- **Component docs — previews for every documented variant** (en +
  ja; audit follow-up to the chart-types fix). Fifteen pages gain
  live Demos for capabilities that were code-fence- or prose-only:
  calendar range selection, drawer `data-side` left/top/bottom,
  shell header actions / optional aside / collapsible icon rail,
  menu submenus, combobox & multicombobox rich options, datagrid
  sideways headers, timeline error/info variants, stepper clickable
  completed step, table compact density, alert validation-error
  fragment, aspect `data-fit="contain"`, carousel slide width, code
  soft-wrap, and the sparkline warning variant.

- **Chart recipe docs — a live preview for every chart type** (en +
  ja). `line`, `area`, `bar-stacked`, `bar-grouped`, `scatter`,
  `sparkline`, `histogram` and `heatmap` now each have a rendered
  Demo (preview + code) next to their table contract, so all ten
  `data-hc-chart` presets are visible on the page — previously only
  `bar` and `combo` had previews.

- **Live recipe demos — streaming & upload batch** (PR-D of
  `plans/hc-live-recipe-demos-plan-en.md`; completes the plan — all
  25 recipe pages now have a live demo). sse-toast and sse-updates
  play self-terminating scripted SSE streams (JSON-payload events
  through the `installSseDispatch` bridge with an update-in-place
  toast and an `items:changed` region refetch; single-line HTML
  events with an out-of-band badge and a `stream:done` close);
  chat-messages + streaming-response share one composed demo (the
  three-fragment POST body, chunk/done/error reply streaming over
  the placeholder's own SSE connection, Stop, the `fail` prompt for
  the error path); file-upload accepts real multipart posts with the
  progress bar, 422 field-error fragments and the out-of-band
  pristine-form reset. The recipes index (en + ja) and DEPLOYMENT.md
  smoke checks now cover the demo API.

- **Live recipe demos — collections & overlays batch** (PR-C of
  `plans/hc-live-recipe-demos-plan-en.md`). Nine more recipes gain a
  working demo API + live demo section on the en + ja pages:
  data-region, datagrid-pager, datagrid-bulk-actions, filter-popover,
  lazy-panel (incl. the 503 + `HX-Reswap` error branch), lazy-tree,
  remote-dialog, undo-delete (30 s grace threaded through the
  tombstone's restore URL — no server state) and chart; the copy page
  notes its previews are already live (client-only, no server
  contract). The datagrid pager pages 5,000 deterministic rows with
  out-of-band pager/status swaps; bulk actions thread grid state
  through an out-of-band hidden input and reach all three toast
  variants (success / partial-failure warning / stale-selection info).

- **Live recipe demos — forms & actions batch** (PR-B of
  `plans/hc-live-recipe-demos-plan-en.md`). Nine more recipes gain a
  working demo API + live demo section on the en + ja pages:
  field-errors, mutating-form, inline-edit, multi-step-form,
  cascading-select, transfer, confirm-action, request-action and
  toast. All handlers stay stateless (drafts ride as hidden inputs,
  transfer membership and the inline-edit value thread through the
  fragments' own URLs) and follow each contract's status/`HX-*`
  choreography (422 field-error fragments, `HX-Retarget`/`HX-Reswap`,
  204 + `HX-Redirect`, ASCII-escaped `HX-Trigger` toasts).

- **Live recipe demos on the docs site — foundation + live-search**
  (PR-A of `plans/hc-live-recipe-demos-plan-en.md`). The docs
  Cloudflare Worker now serves a stateless demo API under
  `/api/recipes/<name>/…` implementing each recipe's server response
  contract, with the exact same handler mounted in `docs:dev` /
  `docs:preview` via a Vite middleware (`apps/docs/demo-api/`).
  Recipe pages embed shared live-demo components (htmx is a docs-only
  devDependency; core still ships zero runtime deps), starting with a
  working live-search demo on the en + ja pages. Vitest covers the
  handler per contract (fragments, no-JS fallback, `no-store`).

- **`streaming-response` recipe — the SSE reply contract** (PR-C of
  `plans/hc-chat-streaming-plan-en.md`; closes the plan). The
  aria-busy placeholder appended by chat-messages owns its own SSE
  connection: `chunk` events append server-rendered HTML into its
  body while announcements stay deferred, `done` / `error`
  outerHTML-swap the complete final message over it (which also
  closes the EventSource — the connect element leaves the DOM), and
  the stop button cancels in one round trip. Machine-checked scaffold,
  docs (en + ja, incl. the composer + dropzone + upload-progress
  attachment composition on the chat-messages page), and a real-SSE
  Playwright suite (chunk growth under aria-busy, done/error swaps,
  stop, stick-to-bottom while streaming, axe mid-stream).

- **`chat-messages` recipe — chat as a server round trip** (PR-B of
  `plans/hc-chat-streaming-plan-en.md`). The composer nests as the
  chat root's last child; one POST returns three fragments in one
  body — the user `<li>`, the `aria-busy` assistant placeholder the
  upcoming streaming-response recipe fills, and the out-of-band
  composer reset — while a 422 re-renders only the composer, so the
  transcript never gains a bogus entry, and no-JS posts get a 303.
  Machine-checked scaffold (`hc validate` green; mutating-form's
  detect now excludes `beforeend` composers), docs (en + ja), and a
  real-htmx Playwright suite incl. the six-exchange stick-to-bottom
  ride and axe.

- **`hc-chat` — a conversation transcript** (PR-A of
  `plans/hc-chat-streaming-plan-en.md`). Chronological DOM (no
  column-reverse), a `role="log"` root whose appended complete
  messages are announced while a streaming placeholder's
  `aria-busy="true"` defers announcement until the final swap;
  `data-role="user | assistant | system"` bubbles on new `chat.*`
  tokens; a CSS-only streaming caret (blink removed under reduced
  motion); `data-state="error"` on the status tokens. Code blocks
  inside replies are plain `hc-code` markup — the server-tokenized
  highlighting story applies unchanged.
- **`installChatScroll()` — stick-to-bottom for transcripts.** Pins
  the list to the newest message while the reader is at the bottom,
  releases on scroll-up (streamed chunks never drag the reader back
  down), reflects `data-stuck` for the stylesheet, and wires the
  `.hc-chat__jump` button. Idempotent, uninstaller, auto-init.
- **`hc-attachment` — a file card** (+ the `hc-attachments` list
  wrapper). `data-state="uploading"` reveals an `hc-progress` row —
  the bar `installUploadProgress()` already drives — and
  `data-state="error"` tints via the status tokens; composes with the
  dropzone and the file-upload recipe. New `attachment.*` tokens.
  Both components ship docs (en + ja), kitchen-sink and VRT coverage,
  and land in the generated manifest automatically. The dedicated
  chat recipes (composer contract, SSE streaming reply) follow next.

- **Machine manifest — the kit as structured JSON**
  (`plans/hc-machine-manifest-plan-en.md`). The core build now emits
  `manifest.json` (components with parts / attribute surface / token
  group / behavior, behaviors with the auto-init flag, `hc:*` events,
  recipes with purpose + needed behavior + contract path, macros,
  i18n keys, export paths) — generated from the sources, deterministic,
  and enforced by a keystone test so new API surface cannot ship
  without it. Ships as `@hypermedia-components/core/manifest.json` and
  at `/api/manifest.json` on the docs site. The two macro elements
  gained a spec-shaped **`custom-elements.json`**
  (`package.json#customElements`, `/api/custom-elements.json`).
  `llms.txt` links both, and the new
  [reference/manifest](https://ingcreators.com/hypermedia-components/reference/manifest/)
  page documents the schema and guarantees.

- **Toasts: Escape dismisses the toast that contains the focus.** The
  keyboard counterpart of swipe-to-dismiss — previously a sticky toast
  (`duration: 0`) could only be dismissed with a pointer. Tab to the
  toast's action button and press <kbd>Escape</kbd>; the toast closes
  without firing the action's event. Scoped to focus-inside-a-toast,
  so dialog Escape semantics are untouched.

- **Docs: recipes carry their contracts and the CLI everywhere**
  (docs-facing; batch 3 of `plans/hc-docs-clarity-plan-en.md`, en +
  ja). Every recipe page opens with the Scaffold aside
  (`npx @hypermedia-components/cli add <name>` + `hc validate` + the
  contract.md link — previously the CLI appeared on zero recipe
  pages); the index is problem-first tables with searchable synonyms;
  the seven old-generation pages gained mutating-form-style
  Request→Response tables and "On failure" notes; datagrid-pager
  server-renders page 1 again with a real progressive-enhancement
  section; inline-edit unified on the `htmx:beforeSwap` 422 standard
  with a keyboard-reachable Edit button as the blessed display state;
  remote-dialog's Cancel is the native `<form method="dialog">` and
  its PE trigger a styled link; lazy-panel's tab variant rides
  `hc-tabs`. Scaffolds updated in lockstep (`hc validate`: 0 errors).

- **Docs: the connective tissue** (docs-facing; batch 4 of
  `plans/hc-docs-clarity-plan-en.md`, en + ja). The fundamentals index
  is now a one-screen mental model (six-conventions table + the five
  runtime axes — previously assembled nowhere); a new
  **reference/behaviors** page lists all 44 `installXxx()` behaviors
  with what each powers and the auto-init column; **CDN install** is a
  first-class path (jsDelivr one-liners in installation, an htmx CDN
  line and a complete save-and-open single-file example in
  quick-start); **tokens/** gained a real landing (four-layer model,
  axis quick table, brand-color quick answer) and an explicit sidebar
  order; the fundamentals sidebar follows the stated reading order
  instead of the alphabet; the landing routes the four visitor intents;
  philosophy principles carry "→ so what" lines for template authors;
  and the blocks gallery dogfoods `hc-stack` / `hc-cluster` instead of
  raw inline flex.

- **Docs: the component pages now share one template** (docs-facing;
  batch 2 of `plans/hc-docs-clarity-plan-en.md`, en + ja, 34 page
  pairs). Every behavior-backed page states the same three facts
  (idempotent, returns an uninstaller, auto-installed by the
  zero-config `/behaviors` entry — with the htmx-swap pickup verified
  per behavior in source); the "Browser baseline" block has one shape
  and one position on every popover/anchor page; token-less pages
  carry an explicit "None of its own" stub so the tail always scans
  the same. Content upgrades: datagrid gained consolidated **Events**
  and **Feature attributes** tables; code and shell gained htmx
  round-trip sections; multicombobox gained an Anatomy table
  (author-written vs generated parts) and the previously undocumented
  `data-hc-empty`; stepper / tree / dropzone / rating were brought up
  to the house format (size demos, token tables, CSS-variables blocks,
  rating's `:has()` baseline note); tabs documents `hc:tabactivated`
  (dispatched on the revealed panel, no detail); accordion gained an
  Anatomy table and carousel the pre-rendered-dots example. Also
  fixed: accordion's htmx example still used the non-existent
  `<hc-spinner>` element.

- **`/llms.txt` on the docs site** (docs-facing). The site now emits
  the [llms.txt](https://llmstxt.org/) convention via
  `starlight-llms-txt`: `/llms.txt` (index), `/llms-full.txt`
  (every English page), and `/llms-small.txt` (trimmed; the
  kitchen-sink and blocks galleries excluded). The preamble hands AI
  coding agents the kit's load-bearing facts (`hc-` prefix,
  `data-hx-*` htmx attributes, Light DOM, attribute-borne state,
  behaviors never own the network, recipe server contracts) so
  generated fragments match the markup-as-wire-contract design. Only
  the default English locale is emitted.

- **Weekly Lighthouse failures now file a tracking issue** (dev-facing).
  `perf.yml` is a scheduled run with no PR to go red on, so a missed
  budget (or a crashed run) was only visible in the Actions tab — the
  2026-06-15 failure went unnoticed. On failure the workflow now opens
  "Weekly Lighthouse run failed" (or comments on the open one) with a
  link to the run's score table and report artifact.

- **VRT: the 0.1.8 components joined the screenshot sheets**
  (dev-facing). `vrt-core` grows meter (the three status regions +
  size presets), rating (interactive, checked=3, plus the read-only
  display form), the dual-thumb range, the separator label variant,
  and the transfer two-pane form; `vrt-data` grows the timeline
  (success / warning / error markers, last-item connector stop).
  Chromium/linux baselines regenerated for the affected sheets.

- **Docs i18n drift check in CI** (docs-facing). The docs job now fails
  a PR that changes an English docs page without touching its `ja/`
  twin, mechanizing the CONTRIBUTING.md § "Japanese translations"
  same-PR rule now that every page is mirrored (125 en / 125 ja).
  `apps/docs/scripts/check-i18n-drift.mjs`; locally:
  `pnpm -w run docs:i18n-drift origin/main HEAD`. ja-only edits stay
  exempt (English is the source language).

- **Cross-browser CI — the Playwright suite now runs on Firefox and
  WebKit** (dev-facing). The browser job fans out to one matrix leg per
  engine (Chromium / Firefox / WebKit) behind the same required check;
  the VRT screenshot sheets keep their single Chromium/linux baseline
  set. The clipboard read-back assertions in `copy.spec.mjs` stay
  Chromium-only (`clipboard-read` is not a grantable permission
  elsewhere); every engine now asserts the copied text through the
  `hc:copied` event detail instead.

### Fixed

- **Docs: every copy-paste-broken or self-contradictory page from the
  full-site review** (docs-facing; batch 1 of
  `plans/hc-docs-clarity-plan-en.md`, en + ja). Highlights: the
  quick-start toast demo now actually fires (`document.body` dispatch
  with `bubbles`); combobox gained the missing "Form participation"
  section (plain submits carry the **label**, hidden-input pattern for
  code values); hovercard's htmx example no longer waits on an event
  the behavior never fires; `<hc-spinner>` and the non-existent
  `hc-search` / `hc-list` / `hc-form` classes are gone from examples;
  the toast recipe/contract documents the shipped `id` / `action`
  fields and the "sticky toasts must carry an action" rule; slider
  points at `hc-range` instead of its pre-range workaround; the
  density page no longer contradicts itself about `data-size` ×
  `data-density`; the Rails / Django / Razor CSRF sections use the
  blessed `installCsrfHeader()` meta convention (and Razor leads with
  the working `HX-Trigger` helper); pagination documents dropping the
  boundary link's `href` (keyboard correctness) and its server
  contract; plus a dozen dead links, stale notes, and cross-page size
  numbers now deferred to Bundle size.

- **Docs: the component overview, sidebar, and kitchen sink caught up
  with the component set** (docs-facing). The `/components/` gallery
  was missing eight shipped components (chip, dropzone, meter, range,
  rating, stepper, timeline, tree), the sidebar three (dropzone,
  stepper, tree), and the kitchen sink four (chip, dropzone, stepper,
  tree) — all added under their sidebar categories, en + ja. The
  gallery is also locale-aware now: on `/ja/` it renders the Japanese
  card blurbs and links to the `/ja/` routes instead of the English
  ones.

## [0.1.8] - 2026-07-04

### Added

- **CLI `@hypermedia-components/cli@0.2.1`** — re-bundles the recipe set
  so `npx @hypermedia-components/cli add transfer` /
  `add cascading-select` work; `hc validate` picks up their
  `checks.json` from the bundled copies too. No command changes.
  (Independent `cli-v0.2.1` tag.)

- **`cascading-select` recipe — hierarchical selection as chained
  selects** (Track C, closing `plans/hc-form-patterns-plan-v0.10-en.md`).
  Each parent select's `change` GETs the child `<select>` fragment
  (same id/name, wired for its own child); deeper levels reset
  out-of-band in the same response; re-selecting the placeholder
  unwinds the chain. Zero custom JS/CSS. Machine-checked scaffold
  (`hc validate` green), docs (en + ja), and a Playwright suite incl.
  axe. The CLI re-bundles the recipe at its next release.

- **`transfer` recipe — dual listbox as a server round trip** (Track B
  of `plans/hc-form-patterns-plan-v0.10-en.md`). One form, two checkbox
  panes (available / assigned), add/remove submit buttons: the checked
  ids travel by native serialization and every move re-renders the
  whole form (`outerHTML` swap; 422 re-render with an inline alert).
  Zero custom JS. Ships `hc-transfer` layout CSS + `transfer.*` tokens,
  the machine-checked scaffold (`hc validate` green), docs (en + ja),
  and a Playwright suite incl. axe. The CLI re-bundles the recipe at
  its next release.

- **`hc-range` — dual-thumb min/max range + `installRange()`** (Track A
  of `plans/hc-form-patterns-plan-v0.10-en.md`). Two overlapping native
  `<input type="range">`s on one container-painted rail — native form
  serialization, per-thumb labels and arrow keys. The behavior clamps
  low ≤ high, keeps the `--hc-range-low`/`-high` fill percentages live
  (inline values are the no-JS fallback), and emits `hc:rangechange`
  `{ low, high }`. Theming reuses the `slider.*` tokens. Docs (en + ja),
  kitchen-sink entry, Vitest + Playwright suites incl. axe.

- **`hc-timeline` — vertical activity / audit timeline** (T1, closing
  `plans/hc-component-breadth2-plan-v0.9-en.md`). A pure-CSS `<ol>`:
  marker rail, connector segments that stop at the last item, and
  status-colored markers via `data-variant` on the item; all logical
  properties so RTL flips for free. New `timeline.*` tokens, docs
  (en + ja), kitchen-sink entry, and a Playwright suite incl. axe.

- **`hc-separator` label variant** (S1 of
  `plans/hc-component-breadth2-plan-v0.9-en.md`). An "or" divider: a
  separator containing `.hc-separator__label` becomes a flex row whose
  `::before`/`::after` hairlines grow around a muted centred label
  (container form with an explicit `role="separator"`, horizontal only;
  the plain `<hr>` form is untouched). New `separator.label-*` tokens,
  docs (en + ja), kitchen-sink example, Playwright coverage.

- **`hc-rating` — star rating as a native radio group** (R1 of
  `plans/hc-component-breadth2-plan-v0.9-en.md`). Pure CSS: real radios
  + label glyphs (native serialization, platform arrow-key navigation),
  fill-up-to-checked via `:has()`, a read-only display form
  (`data-readonly` + `data-filled`), `data-size="sm|lg"` presets, and
  new `rating.*` tokens. Docs (en + ja), kitchen-sink entry, and a
  Playwright suite incl. axe.

- **`hc-meter` — native `<meter>` skin** (first track of
  `plans/hc-component-breadth2-plan-v0.9-en.md`). The scalar-measurement
  sibling of `hc-progress`: pure CSS over the native element, with the
  browser's optimum / suboptimum / even-less-good regions mapped onto the
  status tokens (`--hc-meter-optimum-fill` / `-suboptimum-fill` /
  `-critical-fill`) and `data-size="sm|lg"` presets. New `meter.*` tokens,
  docs (en + ja), kitchen-sink entry, and a Playwright suite incl. axe.

- **Docs: Japanese translations, phase 12 — the translation is complete**
  (#325, docs-facing). The final twelve pages: the Layout component
  category (aspect, scroll-area, shell, splitter, carousel), the
  kitchen-sink and blocks galleries, and the five reference pages
  (index, custom-elements, performance, size, versioning). Every docs
  page now has a Japanese counterpart — 119 ja pages.

- **Docs: Japanese translations, phase 11 — the Data display category
  and stepper are complete** (#324, docs-facing). Thirteen pages: badge,
  card, stepper, chip, separator, collapsible, sparkline, item,
  accordion, table, avatar, code, and datagrid. 107 ja pages total.

- **Docs: Japanese translations, phase 10 — the Overlays and Feedback
  categories are complete** (#323, docs-facing). Eleven pages: dialog,
  drawer, popover, hovercard, tooltip, alert, toast, progress, spinner,
  skeleton, and empty. 94 ja pages total.

- **Docs: Japanese translations, phase 9 — the Navigation category is
  complete** (#322, docs-facing). Nine pages: breadcrumb, toc,
  pagination, tabs, menu, menubar, navmenu, context-menu, and tree.
  83 ja pages total.

- **Docs: Japanese translations, phase 8 — the Forms category is
  complete** (#321, docs-facing). Seven pages: inputotp, combobox,
  multicombobox, slider, datepicker, calendar, and dropzone. 74 ja
  pages total.

- **Docs: Japanese translations, phase 7 — component pages begin**
  (#320, docs-facing). Eleven pages: the Actions category complete
  (button-group, toggle-group, toolbar, command, kbd) and the first
  six Forms controls (input, input-group, select, checkbox, radio,
  switch). Anchors referencing the newly translated boolean-field
  section updated across the ja pages that link to it. 67 ja pages
  total.

- **Docs: Japanese translations, phase 6 — the recipes section is
  complete** (#319, docs-facing). The final nine recipe pages: toast,
  data-region, datagrid-pager, datagrid-bulk-actions, filter-popover,
  remote-dialog, sse-updates, sse-toast, and chart. All 21 recipes plus
  every non-component section are now available in Japanese (56 ja
  pages); only the component pages remain.

### Fixed

- **Docs: the chart recipe had two "Server-side rendering" sections**
  (#319) — duplicated content (and duplicate heading slugs) merged into
  one consolidated section.

- **Docs: Japanese translations, phase 5** (#318, docs-facing). Ten
  recipe pages — the form/action core (request-action, inline-edit,
  copy, undo-delete, file-upload, multi-step-form, mutating-form,
  field-errors) and the lazy pair (lazy-panel, lazy-tree). 47 ja pages
  total; 7 recipe pages remain for the final recipes batch.

- **Docs: Japanese translations, phase 4** (#317, docs-facing). The six
  framework guides — Thymeleaf, Django, Rails, Go, Razor, and
  Hyperscript — completing the integrations section. The `/ja/` docs
  now cover the landing page, start, fundamentals, tokens, and all
  integrations (37 pages); cross-page anchors updated for the newly
  translated headings.

- **Docs: Japanese translations, phase 3** (#316, docs-facing). Nine
  more pages: the whole `tokens/` section (palette, theme-builder,
  neutral, status, variants, density, themes) and the two foundation
  integration guides (`plain-html`, `htmx` — the pages every framework
  guide inherits). 31 ja pages total; cross-page anchors into the newly
  translated pages updated to the translated heading slugs.

- **Docs: Japanese translations, phase 2** (#315, docs-facing). Eleven
  more pages: all of `fundamentals/` (index, layout, responsive,
  accessibility, anchored, icons, i18n — naming and tokens shipped in
  phase 1) plus the four section indexes (`components/`, `recipes/`,
  `tokens/`, `integrations/`). The `/ja/` entry path is now fully
  translated.

### Fixed

- **Docs: the recipes index now lists all 21 recipes** (#315). Seven
  pages were missing from the curated index (`field-errors`,
  `multi-step-form`, `undo-delete`, `file-upload`,
  `datagrid-bulk-actions`, and the two SSE recipes under a new
  "Server push" group) — they were only reachable from the sidebar.

- **Docs: Japanese locale (`/ja/`)** (#314, docs-facing). Starlight
  `locales` scaffolding — English stays at the root URLs; Japanese
  lives under `/ja/` with built-in fallback for untranslated pages
  (English content + a localized notice, so every route exists in both
  locales). Sidebar group labels translated; the first 11 pages
  translated: the landing page, `start/*` (introduction, installation,
  quick-start, philosophy), `fundamentals/naming` + `tokens`,
  `components/button` + `field`, and `recipes/confirm-action` +
  `live-search`. CONTRIBUTING gains the translation maintenance policy
  (edits to a translated English page update the `ja/` counterpart in
  the same PR).

- **`lazy-tree` recipe** (#312). The hypermedia lazy subtree: a branch
  ships an **empty group** and its children arrive as server-rendered
  `<li class="hc-tree__item">` fragments on first expand —
  `installTree()`'s `hc:treeexpand` paired with an htmx
  **`once`** trigger (re-collapse/re-expand never refetches), target
  `find .hc-tree__group`, innerHTML swap, `aria-busy` spinner while in
  flight. Nested lazy branches in the response recurse. Four-piece
  scaffold + machine-checked `checks.json` (trigger `once`, own-group
  target, innerHTML swap, empty group present, `aria-expanded`
  declared), docs page, serve.mjs mock + Playwright integration specs
  against real htmx. The `lazy-panel` detect selector is narrowed to
  `:not(.hc-tree__item)` so the two recipes don't cross-match.

- **`hc-tree` — ARIA tree view** (#311). Semantic nested lists
  upgraded by `installTree()`: tree/treeitem/group roles + a roving
  tabindex (re-applied when subtrees are swapped in), the **APG
  keyboard model over visible items** (↑/↓ skip collapsed subtrees,
  → opens/descends, ← closes/ascends, Home/End, Enter follows the
  label's real link or toggles, single-character type-ahead, RTL
  mirroring). Branch-ness is declared by `aria-expanded` (the server
  owns it); `aria-current` / selection stay server states. Every
  expansion dispatches a bubbling **`hc:treeexpand`**
  (`detail: { item }`) — new public event — and an expanding item with
  `data-hx-get` + an empty group gets `aria-busy` until children
  arrive: the hook the `lazy-tree` recipe (next PR) builds on. Tokens
  `--hc-tree-*`, chevron/guide/current styling with reduced-motion
  gates, `data-size="sm"`; docs page + VRT coverage.

- **Chart Tier 3 — `histogram`, `heatmap`, and the documented SSR
  path** (#309; completes `plans/hc-chart-recipe-plan-en.md`).
  `histogram` bins one numeric column into count bars (`data-bins`);
  `heatmap` maps the matrix shape onto `cell` with a continuous fill,
  a color legend and authored row/column order (`data-scheme`). The
  **linkedom server-side rendering path** is now contract: render with
  Plot on the server (`Plot.plot({ document })`), ship the SVG inline
  with `data-state="rendered"`, and `installChart()` leaves
  already-rendered figures alone (new guard) — SSR'd and
  client-rendered charts coexist on one page.

- **Chart Tier 2 — `bar-stacked`, `bar-grouped`, `scatter`,
  `sparkline`** (#308). Four whole-figure presets on the same
  table-as-data contract: explicit stacking; side-by-side grouping via
  faceting (the category axis carries the labels, the inner axis
  hides); scatter with a numeric default x (`data-x-type`), one dot set
  per series column and an optional `<th data-role="r">` radius
  column; and a chrome-free 48 px sparkline preset (the standalone
  dependency-free `hc-sparkline` stays the usual choice — this one is
  for Plot-consistent dashboards). Per-column `data-mark` combos remain
  a Tier 1 concept. Implements PR 2 of
  `plans/hc-chart-recipe-plan-en.md`; Tier 3 (histogram/heatmap + SSR)
  remains.

- **`multi-step-form` recipe — the hypermedia wizard** (#304). The
  server owns the current step and a **draft** of everything entered;
  the client is one `#wizard` region (whole-step `outerHTML` swaps),
  one form per step, and an `hc-stepper` the server re-renders with
  every response. Both nav directions are named submits of the same
  form (`name="nav"`), with **back carrying `formnovalidate`** — the
  load-bearing native detail (drafts save without validation; only
  "next" validates; `hc validate` errors on a back button without it).
  A `422` on next steers field-errors into the in-step container
  (`HX-Retarget`) without re-rendering — the user's in-progress values
  stay untouched; completion is the mutating-form redirect; real step
  URLs make the no-JS path classic pages. Ships as
  `recipes/multi-step-form/` (recipe/expanded/contract/checks — 20th
  recipe) plus a docs page, pinned by a real-htmx browser test:
  stepper re-render, lossless back-then-next draft round-trip, back
  escaping an invalid step, the value-preserving `422`, and
  `HX-Redirect` completion.

- **`hc-stepper` — zero-JavaScript step indicator** (#303). An
  `<ol class="hc-stepper">` whose every state arrives as
  server-rendered markup: `aria-current="step"` for the current step
  (accent follows `data-color`), `data-state="complete"` with the
  server rendering `✓` as the marker content, muted upcoming steps,
  logical-property connectors (RTL free), `data-size="sm"`, and quiet
  link styling when the server makes completed steps revisitable. No
  behavior, no installer — the indicator displays; navigation belongs
  to the step's form (the multi-step-form recipe follows). Tokens
  `--hc-stepper-*`; docs page + VRT core-sheet coverage.

### Added

- **file-upload recipe: the dropzone variant** (#301). Swap the plain
  field for an `hc-dropzone` — nothing else changes: drops assign the
  same native input and fire a normal `change`, so serialization, the
  progress bridge, the OOB fresh-form reset (now returning the pristine
  dropzone markup) and the `422` path are identical. Contract, expanded
  scaffold and docs page gain the variant; a real-drop browser E2E
  (page-constructed `DataTransfer` + `File`) runs the whole pipeline
  end-to-end, including the reset restoring an empty zone.

- **`hc-dropzone` — drag-and-drop upload surface** (#300). A
  `<label class="hc-dropzone">` decorating a native file input:
  click-to-browse and keyboard stay 100 % native (the hidden-in-place
  input keeps focus, constraint validation and field-errors wiring);
  `installDropzone()` adds only the drag path — `data-dragover` while a
  file drags over (accent follows `data-color`), drop assigns
  `dataTransfer.files` to the input (single-file inputs take the first)
  and fires a bubbling `change`, so the file-upload recipe's whole
  pipeline (serialization, progress, OOB reset, 422) works unchanged.
  Selected names render as visible label text
  (`.hc-dropzone__files`, no i18n keys). States:
  `[data-dragover]` / `:focus-within` / `:has(:disabled)` /
  `:has([aria-invalid])`; tokens `--hc-dropzone-*`; `data-size="sm"`.
  New component stylesheet + auto-installed behavior + docs page + VRT
  coverage (core-sheet baselines regenerated).

## [0.1.7] - 2026-07-03

- **CLI `@hypermedia-components/cli@0.2.0`** — the `hc validate` release
  (new command + `checks.json` in every recipe + linkedom as the CLI's
  first, lazy-loaded runtime dependency) and the five new recipe
  scaffolds bundled. (Independent `cli-v0.2.0` tag.)

### Added

- **`file-upload` recipe — multipart upload with a live progress bar**
  (#297). The form carries **both encodings** —
  `enctype="multipart/form-data"` for the native no-JS submit and
  `data-hx-encoding` for the htmx request (shipping only one is the
  classic mistake; `hc validate` errors on it) — plus the
  `data-hc-upload-progress` bar (#296) whose visibility stays
  htmx-native (`data-hx-indicator`). Success is `200` with the new
  item fragment (`afterbegin` into the list) **plus the pristine form
  as an out-of-band swap** — the blessed reset, since file inputs
  cannot be cleared from markup — and an escaped `HX-Trigger` toast.
  Validation failures are the server's job (client `accept` hints are
  UX only): `422` + `HX-Retarget`/`HX-Reswap` steer the field-errors
  fragment into the in-form container, keeping the primary path
  attribute-declared. Proxy-level `413` and the no-JS `303` path are
  documented. Ships as `recipes/file-upload/`
  (recipe/expanded/contract/checks — 19th recipe) plus a docs page,
  pinned by a real-multipart browser test: the bar reaches 100 while
  the request is in flight, the OOB reset empties the file input, and
  the retargeted `422` distributes inline.

- **`installUploadProgress()` — drive a native `<progress>` from htmx
  upload progress** (#296). A
  `<progress class="hc-progress htmx-indicator" data-hc-upload-progress>`
  inside a requesting form tracks the upload: reset to 0 on
  `htmx:beforeRequest`, `loaded/total` mapped onto 0–100 on
  `htmx:xhr:progress` — **monotonic within a request**, because htmx
  fires that event for both the upload and the response-download phase
  and the download's small `total` would otherwise rewind the bar at
  the end — and settled at 100 on `htmx:afterRequest`. Visibility stays
  htmx-native (`data-hx-indicator` + `htmx-indicator`); the behavior
  only sets `value` and never touches the network. Auto-installed via
  `@hypermedia-components/core/behaviors`; the `file-upload` recipe
  follows in the next PR (see `plans/hc-file-upload-plan-en.md`).

- **`undo-delete` recipe — undo instead of confirm** (#294). Frequent
  destructive actions execute immediately (no dialog): the server
  soft-deletes with a grace period and answers `200` with a
  **tombstone** — a hidden element in the row's slot carrying the
  restore wiring (`data-hx-post=…/restore`,
  `data-hx-trigger="item-42:restore from:body"`) — plus an undo toast
  whose Undo button dispatches that same server-generated pairing
  event; restore swaps the original row back **in place**. Toast `id`
  reuse turns the undo toast into "restored"; restore-after-expiry is
  `200` + the tombstone + an error toast (the 200-with-truth doctrine).
  **Zero new JavaScript / zero new public API** — a pure composition of
  the shipped toast action button, update-by-id, and htmx event
  triggers. Ships as `recipes/undo-delete/`
  (recipe/expanded/contract/checks — CLI + `hc validate` pick it up)
  plus a docs page with the undo-vs-confirm decision table, pinned by a
  real-htmx browser test incl. position-preserving restore and
  pairing-key isolation across two pending undos. The contract also
  blesses **`\uXXXX`-escaping non-ASCII in `HX-Trigger` headers**
  (header values are latin-1 — localized toast messages crash naive
  serializers; the test server crashed on an em dash before adopting
  it).

- **Visual regression testing** (#288, dev-facing). Playwright
  `toHaveScreenshot()` suites over three dense fixture sheets
  (`vrt-core` / `vrt-data` / `vrt-overlays`) under light/dark × ltr/rtl
  plus compact-density and accent slices — 14 committed linux
  baselines, running in the existing CI browser job. Purely visual
  regressions (the `.hc-toolbar[hidden]` class of bug) now fail CI with
  a pixel diff. Determinism via DejaVu-pinned font tokens in the
  sheets, reduced motion, and settled behaviors; baseline updates are
  explicit (`--update-snapshots`) and reviewed as image diffs — see
  CONTRIBUTING §Visual regressions. Closes the v0.5 plan §5.2 leftover.

- **`hc validate` — machine-checked recipe contracts**
  (`@hypermedia-components/cli`, #286).
  `npx @hypermedia-components/cli validate <file|dir>… [--recipe]
  [--strict]` parses local HTML (rendered pages, fixtures, server
  responses), detects recipe instances automatically, and checks them
  against declarative rules that now ship **inside every recipe**
  (`recipes/<name>/checks.json`, next to `contract.md`; `add` copies
  it, the tarball bundles it): required/forbidden attributes,
  structure, and reference integrity, each finding naming its rule and
  contract. Signature traps covered include the bulk-actions named
  select-all, the pager/tbody `outerHTML` mistake, an unconfirmed
  `data-hc-confirm` + htmx-verb pairing, and an unhidden SSE bridge.
  The blessed `data-hx-*`/`data-sse-*` spelling is checked, with a
  warning on short forms. A **self-validation keystone test** pins
  every recipe's own scaffolds against its own rules in CI — and
  already caught a real scaffold bug (below). Exit codes are
  CI-friendly (`1` on errors; `--strict` promotes warnings).
  [linkedom](https://github.com/WebReflection/linkedom) becomes the
  CLI's first runtime dependency, lazy-loaded by `validate` only —
  `add`/`list` are unaffected. The CI unit job now also runs the CLI
  test suite (it previously didn't run at all in CI).

- **`sse-updates` + `sse-toast` recipes — the blessed server-push
  patterns** (#284). Server-Sent Events over the official htmx SSE
  extension (vendored pinned, `examples/htmx/vendor/sse.min.js`,
  htmx-ext-sse 2.2.3): `sse-updates` blesses named-event fragment
  pushes (`data-sse-connect` scope + `data-sse-swap` targets honouring
  `data-hx-swap`), **out-of-band fragments inside SSE data** for
  multi-target pushes, the datagrid-tbody composition (keep-the-tbody,
  selection re-derives), deliberate stream ends (`data-sse-close`) and
  the complete-initial-render degradation stance; `sse-toast` blesses
  server-pushed notifications and domain events through the
  `installSseDispatch()` bridge — `hc:toast` payloads reuse the toast
  detail shape unchanged, `items:changed`-style events refetch
  listening data-regions, and the strict payload rules (object-or-drop,
  markup-declared allowlist) are contract. Ships as
  `recipes/sse-updates/` + `recipes/sse-toast/` (the CLI picks both up
  automatically) plus two docs pages, pinned by a real-EventSource
  browser test (`test-browser/sse.spec.mjs`) against a scripted
  streaming mock — including the OOB-inside-SSE claim and the
  no-replay-after-close lifecycle.

- **`installSseDispatch()` — bridge SSE events into DOM CustomEvents**
  (#283). Inside an htmx SSE-extension scope (`data-sse-connect`), an
  element with `data-hc-sse-dispatch` re-dispatches the SSE events
  named in its `data-sse-swap` as bubbling `CustomEvent`s instead of
  swapping them: the SSE event name becomes the DOM event name, the
  JSON payload becomes `detail` (empty data → `{}`; non-object or
  malformed payloads are dropped, the swap always cancelled). The
  markup is the allowlist — only page-declared event names can be
  dispatched. `event: hc:toast` shows a server-pushed toast unchanged;
  `event: items:changed` refetches any listening data-region. The
  behavior never touches the network — the extension owns the
  `EventSource`. Auto-installed via
  `@hypermedia-components/core/behaviors`; SSE recipes follow in the
  next PR (see `plans/hc-sse-recipes-plan-en.md`).

- **`datagrid-bulk-actions` recipe — the blessed bulk-operations
  composition** (#281). Select rows with the grid's checkboxes, act
  from the selection bar, POST over htmx: the ids travel by **native
  form serialization** (row checkboxes `name="ids"` inside the wrapping
  `<form>`; the select-all checkbox carries no `name`), each action is
  a `type="submit" name="action"` button with `data-hx-post`, and the
  server always answers htmx with **200 + the re-rendered rows** (tbody
  `innerHTML`, datagrid-pager shape) + OOB fragments + an `HX-Trigger`
  toast — partial failures and empty selections included; no-JS posts
  get a `303` (post/redirect/get, branch on `HX-Request`). The
  destructive variant composes confirm-action unchanged. Ships as
  `recipes/datagrid-bulk-actions/` (recipe/expanded/contract — the CLI
  picks it up automatically) plus a docs page, pinned by a real-htmx
  browser test (`test-browser/datagrid-bulk-actions.spec.mjs`)
  including the enclosing-form serialization semantics the contract
  stands on. The `recipes/README.md` index also gains its missing
  `datagrid-pager` and `field-errors` rows.

### Fixed

- **`installUploadProgress()` only acts when the bar's own form is the
  requesting element** (#297). htmx re-dispatches lifecycle events on a
  surviving ancestor (the old form's parent, or `<body>`) when the
  requester has left the DOM — exactly what the file-upload recipe's
  out-of-band fresh-form reset produces — and the ancestor-level event
  was setting the pristine replacement bar (and would touch other
  forms' bars) to 100. Caught by the recipe's browser test.

- **`inline-edit` recipe scaffold: the display fragment now declares
  `data-hx-swap="outerHTML"`** (#286). Without it htmx's default
  `innerHTML` swap nests the edit form *inside* the display node
  (duplicating the id) instead of replacing it, contradicting the
  contract and `expanded.html`. Caught by the new self-validation
  keystone test on its first run.
- **`.hc-toolbar[hidden]` now actually hides.** The toolbar's
  `display: flex` defeated the UA's `[hidden]` rule, so a state-toggled
  toolbar (the selection actions bar) stayed visible. Restored with an
  explicit `[hidden] { display: none }` — the same pattern hc-tabs and
  hc-command already use. Caught by the new recipe's browser test
  (#281).
- **`installDatagridActions()` — the datagrid selection actions bar**
  (#280). A bar (typically an `hc-toolbar`) declares its grid with
  `data-hc-datagrid-actions="<selector>"`; its `[data-hc-datagrid-count]`
  child shows the translated selection count (new i18n key
  `datagrid.selected`, `{selected}` / `{total}` params, default
  `role="status"`), and the bar is `hidden` while nothing is selected.
  Driven entirely by the grid's public `hc:datagridselectionchange`
  events — the behavior never touches the network; ids travel by native
  form serialization (bulk-actions recipe follows). Auto-installed via
  `@hypermedia-components/core/behaviors`.
- **Datagrid selection now survives htmx row swaps truthfully.** After a
  swap inside `.hc-datagrid__body`, the grid re-derives each unit's
  selection from its checkbox (adopting server-rendered `checked` rows),
  re-syncs the header select-all `checked`/`indeterminate` state, and
  re-emits `hc:datagridselectionchange` — previously both went stale
  after pagination or a bulk-action re-render.

## [0.1.6] - 2026-06-19

### Fixed

- **Anchor-positioning JS fallback now decisively overrides native CSS
  anchor positioning.** When `installPopover` / `installMenu` /
  `installTooltip` / `installHovercard` / `installNavmenu` (etc.) take the
  JS fallback path, `positionFloating` now clears `position-area`,
  `position-try-fallbacks`, and `position-anchor` and resets insets via the
  physical `inset: auto` shorthand before writing `top`/`left`. Previously
  it set the logical `inset-block-start` / `inset-inline-start` to `auto`
  *after* `top`/`left`; those are aliases, and Chrome 149 resolves the
  logical longhand last, clobbering the computed `top`/`left` so a forced
  fallback placed the popover in the viewport corner. Surfaced by the
  Playwright 1.61 Chromium bump (`test-browser/anchor-fallback.spec.mjs`).
  Real browsers never hit this in production — the fallback only runs where
  anchor positioning is unsupported, so these resets are inert there — but
  the hardening keeps the fallback authoritative whenever it runs.

### Added

- **`installCopy()` — declarative copy-to-clipboard** (#270). A new
  behavior in the auto-init `@hypermedia-components/core/behaviors`
  bundle (also a named export of the main entry) that copies a value to
  the clipboard from declarative markup, so it works under a strict
  `Content-Security-Policy: default-src 'self'` with no inline JS. A
  `data-hc-copy="<css-selector>"` button copies the referenced element's
  `value` (form controls) or `textContent` (anything else);
  `data-hc-copy-text="<literal>"` copies a literal instead. On success it
  sets `data-hc-copied` on the button for ~1.5 s (CSS can reflect it),
  announces the label through a behavior-owned visually-hidden
  `role="status"` region (`data-hc-copy-ok`, default from the i18n key
  `copy.ok`), and fires a bubbling `hc:copied` event (`detail: { text }`)
  you can chain to `hc-toast`. The button keeps its own accessible name
  throughout; copy never touches the network. The Clipboard API needs a
  secure context — where unavailable the click is a graceful no-op (a
  form-control target is best-effort selected for manual copy). Ships as
  `recipes/copy/` (recipe/expanded/contract — the CLI picks it up) plus a
  docs page, a unit suite (`test/copy.test.mjs`) and a real-Clipboard
  browser test (`test-browser/copy.spec.mjs`).
- **`hc-toc` component + `installSpy()` scrollspy** (#271). A pure-CSS
  "On this page" jump list (`hc-toc` / `hc-toc__list` / `hc-toc__item` /
  `hc-toc__link`) over a labeled `<nav>` of in-page anchor links — usable
  with no JavaScript. Add `data-hc-spy` to the nav and the new
  `installSpy()` behavior (in the auto-init
  `@hypermedia-components/core/behaviors` bundle, also a named export of
  the main entry) marks the link of the section currently at the top of
  the viewport with `aria-current="location"` plus a `data-active` CSS
  hook. Selection uses the standard top-band `IntersectionObserver`
  trick (`rootMargin: 0px 0px -70% 0px`), picks the top-most section in
  document order, and keeps the most recently passed heading active
  through gaps — not "largest intersection ratio" (which lets a tall
  section win). It only tracks sections that exist, forces no smooth
  scroll (native anchor jump; nothing for `prefers-reduced-motion` to
  gate), and is a no-op where `IntersectionObserver` is unavailable
  (the nav stays a working anchor list). CSP-safe (declarative markup,
  no inline JS). New `toc.*` component tokens (`--hc-toc-*`); the CSS
  ships in the bundle and as `@hypermedia-components/core/css/toc`.
  Covered by a unit suite (`test/spy.test.mjs`, IntersectionObserver
  stubbed) and a real-scroll browser test (`test-browser/spy.spec.mjs`,
  incl. axe), with a docs component page.
- **`installNavCurrent()` — mark the active nav item by URL** (#272). A
  new behavior in the auto-init `@hypermedia-components/core/behaviors`
  bundle (also a named export of the main entry) that sets
  `aria-current="page"` on the navigation link matching the current URL,
  from declarative markup — so it works under a strict
  `Content-Security-Policy: default-src 'self'` with no inline JS. Opt in
  per container with `data-hc-nav-current` (any nav, not only the shell
  sidebar). Among the container's same-origin `a[href]`, the link whose
  pathname equals `location.pathname` wins; failing an exact match, the
  longest link pathname that is a path-segment prefix of it (a section
  link stays current on its subpages). Root `/` matches only exactly
  (never as a prefix), trailing slashes are normalized, and the
  `/users` vs `/users-archive` substring trap is avoided via a
  path-segment boundary. It re-marks after htmx history navigation
  (`htmx:pushedIntoHistory`) and back/forward (`popstate`), wires
  containers added later via a MutationObserver, and clears the link it
  previously set so exactly one is current (an author's own
  `aria-current` is left alone). No new CSS — the kit already styles
  `.hc-item[aria-current]`. The matching is a pure, exported
  `pickCurrent()` helper covered by a table-driven unit suite
  (`test/nav-current.test.mjs`) alongside a real history-navigation
  browser test (`test-browser/nav-current.spec.mjs`, incl. axe); the
  shell and item docs pages document it.

## [0.1.5] - 2026-06-17

### Added

- **`hc-code` live syntax highlighting for the editable field** (#264).
  `installCodeEditor()` now honours an opt-in `data-lang`: when the value
  resolves to a registered grammar it overlays a decorative, `aria-hidden`
  `hc-code__highlight` layer behind the textarea, re-tokenizes on input
  (throttled to one render per animation frame), and matches the textarea's
  `scrollTop`/`scrollLeft`. The textarea glyphs are hidden (the caret stays
  visible) so the coloured overlay shows through, reusing the very same
  `hc-code__tok` spans and `--hc-code-tok-*` palette as the read-only
  server-tokenized path (#261) — the editor matches the read-only / diff
  surfaces. CSP-safe (self-hosted, no `eval`/`new Function`) and **purely
  additive**: with no JS, an unknown `data-lang`, or no registered grammar the
  field stays a plain monospace textarea whose value still submits (no
  regression to #255).
- **`registerCodeLanguage(name, tokenizer)` — pluggable code grammars**
  (#264). A new named export (from the main entry and the `./behaviors`
  bundle) that plugs a tokenizer into the live overlay, keyed by `data-lang`.
  Built-in grammars cover `sql`, `json`, `yaml`, and `html` (`yml` / `xml`
  aliases); a registration overrides a built-in of the same name and returns
  an uninstaller. A tokenizer maps text to `{ tok, text }` tokens that must
  reconstruct the source — a dialect tokenizer can classify constructs a
  generic grammar can't (e.g. TesseraQL's 2-way SQL directives as `meta`). If
  a tokenizer throws or its tokens don't reconstruct the source, the overlay
  declines to highlight that buffer rather than desync. Register before the
  field is enhanced (same ordering rule as `setMessages()`).
- **Structured-markup syntax tokens** (#264). Three additive `data-tok`
  values — `property` (object / mapping keys), `tag`, and `attribute` — with
  matching `--hc-code-tok-property` / `-tag` / `-attribute` custom properties
  and `--hc-color-syntax-*` semantic tokens (themed light + dark, WCAG AA
  verified). They benefit the read-only server-tokenized path (#261) as well
  as the live overlay, so YAML / JSON keys and HTML tags / attributes read
  correctly. Pinned by `test-browser/code-highlight.spec.mjs` and
  `code-syntax.spec.mjs` (incl. axe in light and dark) and unit-tested in
  `test/code-syntax.test.mjs`.

## [0.1.4] - 2026-06-17

### Added

- **`hc-code` syntax highlighting — server-tokenized, read-only** (#261).
  An opt-in token markup contract: the server wraps tokens in
  `<span class="hc-code__tok" data-tok="…">` and the kit colours them from a
  new `--hc-code-tok-*` palette (themed light + dark, WCAG AA verified). The
  `data-tok` vocabulary is generic and language-agnostic — `keyword`,
  `string`, `number`, `comment`, `operator`, `identifier`, and `meta` (a
  catch-all for language-specific constructs such as 2-way SQL directives);
  an unknown or absent `data-tok` renders as plain code. Tokens nest inside
  `<pre><code>` and `hc-code__line`, composing with `data-state` tints and
  the diff gutter. No client tokenizer — like the diff hunks, the server
  emits the spans (CSP-safe). New `--hc-code-tok-*` (and underlying
  `--hc-color-syntax-*`) custom properties; docs section; pinned by
  `test-browser/code-syntax.spec.mjs` (incl. axe in light and dark). A live
  highlight overlay for the editable field is tracked as a follow-on.

## [0.1.3] - 2026-06-17

### Added

- **`hc-code` — read-only code surface** (#253, #256). A monospace block
  styled from the kit's tokens, in three script-free (CSP-safe) modes that
  share one decoration mechanism: a plain `<pre class="hc-code">` block
  (horizontal scroll, or `data-wrap="on"` to soft-wrap); a line-numbered
  `<ol class="hc-code" data-gutter="line-numbers">` whose
  `<li class="hc-code__line">` rows take a per-line `data-state`
  (`covered` / `missed`, tinted from the semantic status palette) with a
  matching `hc-code__swatch` legend chip; and a unified diff
  (`data-mode="diff"`) where each line carries `data-state`
  (`added` / `removed` / `context`) plus `data-old` / `data-new` line
  numbers and a `+` / `-` sign so the change is not conveyed by colour
  alone. The server emits the markup — there is no client-side diffing or
  highlighting. New `--hc-code-*` custom properties and a component docs
  page; pinned by `test-browser/code.spec.mjs` (incl. axe in light and
  dark). A side-by-side diff layout and syntax highlighting are out of
  scope for this release.
- **`hc-sparkline` — inline trend sparkline** (#254). A word-sized line
  chart for a metric's recent direction next to the number. CSP-safe with
  **no charting dependency**: `installSparkline()` draws the inline `<svg>`
  from a `data-values` series with the DOM API (no `innerHTML`), and a
  server can emit the same SVG directly (the markup convention — it must
  supply its own `role="img"`/`aria-label`). `data-area` fills under the
  line; `data-variant` (`success` / `warning` / `error`) recolours it
  through the semantic status palette (so it re-resolves in dark mode);
  `data-min` / `data-max` pin the domain. A labelled host is exposed as
  `role="img"`, an unlabelled one as decorative (`aria-hidden`). Auto-init
  via the `behaviors` bundle; new `--hc-sparkline-*` tokens; component docs
  page; unit tests (`test/sparkline.test.mjs`) + browser tests
  (`test-browser/sparkline.spec.mjs`, incl. axe in light and dark).
- **`hc-code` editable field + `installCodeEditor()`** (#255). An editable
  counterpart to the read-only block, on the same surface: a
  `<div class="hc-code" data-editable>` wrapping a real
  `<textarea class="hc-code__input" name>`. The value is a native form
  control (submits in forms and with htmx) and degrades to a plain monospace
  textarea with no JavaScript. With `data-gutter="line-numbers"`,
  `installCodeEditor()` (auto-init `behaviors` bundle) overlays a synced
  line-number gutter — re-numbering on input, matching the textarea's scroll,
  and pinning `wrap="off"` so the numbers stay aligned. New
  `--hc-code-focus-border` / `--hc-code-input-min-height` tokens and
  `hc-code__input` / `hc-code__gutter` classes; unit tests
  (`test/code-editor.test.mjs`) + browser tests
  (`test-browser/code-editable.spec.mjs`, incl. axe). Syntax highlighting
  remains out of scope.

## [0.1.2] - 2026-06-13

### Added

- **`mutating-form` recipe — the blessed htmx form composition** (#244).
  A copy-pasteable form that mutates server state: htmx POST with inline
  4xx field errors (the [field-errors] fragment swapped into an in-form
  container), a success **redirect** (branch on `HX-Request` — `204` +
  `HX-Redirect` for htmx, plain `303 Location` for no-JS), a
  double-submit guard + busy spinner (`data-hx-disabled-elt` /
  `data-hx-indicator`), a confirmed destructive variant
  (`data-hc-confirm` + `data-hx-trigger="hc:confirmed"`), and a no-JS
  degradation path (keep `method`/`action` alongside `data-hx-post`).
  Ships as `recipes/mutating-form/` (recipe/expanded/contract — the CLI
  picks it up automatically) plus a docs page, pinned by a real-htmx
  browser test (`test-browser/mutating-form.spec.mjs`). `HX-Redirect` is
  blessed over `HX-Location` (the latter is not post/redirect/get); no
  new glue behavior — the success redirect is htmx-native.
- **CLI `@hypermedia-components/cli@0.1.1`** — re-bundles the recipe set
  so `npx @hypermedia-components/cli add mutating-form` works; no command
  or flag changes. (Independent `cli-v0.1.1` tag.)
- **`installCsrfHeader()` — blessed CSRF token delivery for htmx** (#246).
  A new behavior in the auto-init
  `@hypermedia-components/core/behaviors` bundle (also a named export
  of the main entry). It reads `<meta name="csrf-token" content="…">`
  on every `htmx:configRequest` and attaches the token as a request
  header — read at request time (token rotation is automatic), on every
  htmx verb, never overwriting an explicit per-request
  `data-hx-headers` value, and inert when the meta tag is absent. The
  header name defaults to `X-CSRF-Token` and is overridable per page
  via `data-header` on the carrier (e.g. `data-header="X-CSRFToken"`
  for Django). This gives server frameworks and code generators a
  stable markup target so CSRF enforcement can be on by default; plain
  `<form method="post">` degradation still needs the framework's hidden
  CSRF field. Header injection is covered by a unit suite
  (`test/csrf-header.test.mjs`) and a real-htmx browser test
  (`test-browser/csrf-header.spec.mjs`); the htmx integration guide
  documents the convention.
- **Docs: blessed boolean form-field pattern** (#245) — "As a boolean
  form field" on the checkbox page: an `hc-field` stanza pairing a
  hidden `false` input with the same-name checkbox `true`, so a form
  post always carries a value (unchecked → `false`; checked → both,
  server binds the last). Covers the label-pattern rule
  (`hc-field__label` + `for` inside a stanza vs the
  `.hc-checkbox-label` cluster outside) and the `hc-switch` variant,
  which transfers verbatim. Pinned by a browser test against the exact
  markup (`test-browser/booleanfield.spec.mjs`) so code generators can
  emit it as a stable contract.

### Fixed

- **field-errors: same-name groups now resolve to the first visible
  control** (#245). A `data-field` naming a group that mixes hidden and
  visible inputs (the boolean-field idiom) used to wire `aria-invalid`,
  `aria-describedby`, focus, and edit-to-clear to the hidden input —
  the message rendered, but toggling the checkbox never cleared it and
  assistive tech heard nothing. Hidden members are now skipped when the
  group has a visible control (a lone hidden control still resolves as
  before).

- **`hc-datagrid`: column-aligned keyboard navigation in multi-row
  records.** The navigation matrix now resolves `rowspan`/`colspan` into
  a visual grid: ↑/↓ keep the visual column across sub-rows (previously
  the cursor drifted sideways on rows with fewer cells and ↓ then ↑ did
  not return to the starting cell), and a spanning cell — e.g. the lead
  `rowspan` cell of a record — is one stop, reachable with ←/→ from any
  sub-row it spans. Single-row grids are unaffected.

## [0.1.1] - 2026-06-12

### Added

- **`@hypermedia-components/cli` workspace package** — `npx
  @hypermedia-components/cli add <recipe>` copies a recipe's source
  files (`recipe.html` / `expanded.html` / `contract.md`) into your
  project; `list` shows the twelve recipes with their purpose lines.
  Zero runtime dependencies; the recipes ship inside the tarball
  (offline-friendly); existing files are never overwritten without
  `--force`. Published as `@hypermedia-components/cli@0.1.0`
  (2026-06-12); subsequent releases go through `cli-v*` tags
  (`release.yml`, npm trusted publishing).
- **Japanese locale pack `@hypermedia-components/core/locales/ja`** (#217):
  a flat, frozen map translating every `DEFAULT_MESSAGES` key, ready for
  `setMessages(ja)` — consumers no longer hand-maintain translations of
  the built-in strings. The `DEFAULT_MESSAGES` key inventory is documented
  as part of the public contract (enumerate it to diff your own catalog
  for completeness in CI), and the kit's own CI now fails when a behavior
  adds a key a shipped locale pack does not cover
  (`test/locales.test.mjs`, including `{name}` placeholder parity).
- **Elevation token scale `--hc-shadow-sm` / `-md` / `-lg` / `-overlay`**
  (`semantic.shadow.*`, with `[data-theme="dark"]` overrides at stronger
  alphas). Dropdown surfaces (menu, combobox, multicombobox, command,
  navmenu, popover, hovercard), dialog, drawer, toast, the switch thumb,
  and the datagrid drag ghost now read their `box-shadow` from the scale
  instead of hard-coded `rgb()` literals — elevation stays legible on
  dark surfaces and full themes can override it like any other token.
- **`--hc-shadow-edge` scroll-edge shadow color** (`semantic.shadow.edge`,
  dark override at 0.5 alpha). The tabs scroll fades and the datagrid
  frozen-column shadows keep their directional geometry in CSS but read
  their color from the token (datagrid alpha 0.25 → 0.2 normalization).
  No literal-color `box-shadow` remains in the component stylesheets.
- **Docs: Fundamentals → Anchored positioning.** The shared placement
  infrastructure (`hc-anchored.css` + the behaviors' JS fallback) now has
  its own page: `data-side` / `data-align` / `data-arrow`, the
  `--hc-anchored-offset` / `--hc-anchored-arrow-*` knobs, how the CSS and
  JS paths cooperate, and the granular `./css/hc-anchored` import.
  Tooltip / popover / hovercard pages cross-link it.
- **`data-message-params` on field-errors items** (#218): an optional
  JSON object of server-provided interpolation values merged into the
  params `installFieldErrors` passes to the i18n catalog, so client
  catalog overrides may use placeholders beyond `{field}`/`{code}`
  (e.g. `data-message-params='{"stock": 5}'` with a translation using
  `{stock}`). Item params win over the implicit `field`/`code`;
  malformed or non-object JSON is ignored and the existing fallback
  chain (catalog → item text → `fieldErrors.unknown`) is unchanged.
- **Docs: blessed date-field pattern** (#219). The calendar page's
  "As a custom date field" section is now the canonical, copy-pasteable
  composition for date form fields (`hc-field` + readonly named
  `hc-input` + `popovertarget` trigger + `hc-calendar[data-target]`),
  documenting who carries the form `name`, the readonly-vs-free-typed
  trade-off, keyboard / focus expectations, and the `<html lang>` locale
  fallback. A new browser suite (`test-browser/datefield.spec.mjs`,
  incl. axe) pins the documented behavior against that exact markup so
  code generators can emit it as a stable contract.

### Changed

- Component shadows normalized onto the elevation scale (CSS declaration
  values are not public API, see `VERSIONING.md`): toast alpha
  0.08 → 0.1, hovercard 0.14 → 0.12, popover geometry
  6px/20px → 8px/24px, drawer `0 0 30px` ambient → `0 10px 30px`
  directional, datagrid drag-ghost alpha 0.25 → 0.12. Light-mode
  rendering is near-identical; dark mode now gets purpose-tuned shadows
  instead of the light alphas.

### Fixed

- **`setMessages()` now reaches behaviors no matter which dist entry it
  is imported from** (#216). The minified bundles (`hc.min.js`,
  `hc.behaviors.min.js`) each inline a copy of the i18n module, so the
  message catalog was per-bundle state: overrides set through the main
  entry never reached the auto-init behaviors, which kept rendering the
  English defaults. The catalog now lives on a `globalThis`-keyed
  singleton (`Symbol.for('hypermedia-components.i18n')`) shared by every
  copy of the module; the bundles stay self-contained single files.

### Security

- **Docs site: Astro 5.18 → 6.4, Starlight 0.32 → 0.40.** Clears the
  Dependabot alerts against Astro (`define:vars` XSS, server-island
  parameter replay — docs site only; the published package has no
  runtime dependencies). Migrations: Starlight ≥0.39 sidebar
  `autogenerate` groups now use the `items` array form, and ≥0.33
  `social` takes an array of link items. No content changes; the
  Demo component, table rehype plugin, and theme-restore script are
  unaffected (verified in the built output).

## [0.1.0] - 2026-06-12

Graduates from alpha — the first release published under the npm
`latest` dist-tag. The release answers the TesseraQL improvement brief
(checked in as
[`plans/tesseraql-2026-06-brief.md`](plans/tesseraql-2026-06-brief.md),
with the per-theme response in
[`plans/tesseraql-2026-06-response-en.md`](plans/tesseraql-2026-06-response-en.md)).

**Markup compatibility with `0.0.1-alpha.0`: fully additive.** No
documented class name, data attribute, `--hc-*` custom property, JS
export, or `hc:*` event was renamed or removed — template and codegen
consumers upgrade without markup changes. The versioning rules these
guarantees follow are now written down in
[`VERSIONING.md`](VERSIONING.md).

**Migration (opt-in) — server validation errors.** Consumers that
invented their own error-fragment markup can adopt the kit's canonical
contract (`recipes/field-errors/contract.md`) and delete their custom
error plumbing: `hc-alert hc-alert-error` → `hc-alert` +
`data-variant="error"` + `data-hc-field-errors`; `hc-alert-message` →
`hc-alert__title`; `hc-field-errors` / `hc-field-error` →
`hc-alert__errors` / `hc-alert__error`; `hc-alert-hint` →
`hc-alert__body`; `data-message` → `data-message-key`. The
`installFieldErrors()` behavior then distributes errors to fields with
no custom JS.

### Added

- **`installThemeToggle()` — light/dark switching with persistence
  (TesseraQL brief Theme 6).** A `[data-hc-theme-toggle]` button flips
  `data-theme` on `<html>`; the effective theme defaults to the OS
  preference (`prefers-color-scheme`) until an explicit choice is made.
  Optional `data-persist="<key>"` mirrors the choice to `localStorage`
  and restores it at install, with a documented inline `<head>` snippet
  for a flash-free restore. Toggles reflect `aria-pressed`, icon-only
  toggles get a default `aria-label` from the i18n catalog (new
  `themeToggle.label` key), and each change dispatches
  `hc:themechange`. In the auto-init `/behaviors` bundle. New
  Themes → "Light / dark toggle" docs; 7 Vitest + 5 Playwright tests
  (incl. OS-preference emulation, reload persistence, and axe with
  colour-contrast in both themes).
- **i18n docs completeness, guarded.** The Fundamentals → i18n catalog
  table now lists every `DEFAULT_MESSAGES` key (added the missing
  `shell.collapseNav`) and gains a complete worked **Japanese
  catalog** example — set once, the kit renders no English. A unit
  test fails whenever a behavior string key is added without
  documenting it (or a documented key goes stale).
- **Blessed htmx patterns + a tested confirm-gating specification
  (TesseraQL brief Theme 5).** The htmx integration guide gains a
  "Common patterns" map (auto-refresh → `data-region`, busy indicator →
  `request-action`, confirm → `confirm-action`, validation errors →
  `field-errors`, notify → `toast`, dialog → `remote-dialog`), an
  explicit **confirm gating specification** (capture-phase interception;
  `data-hx-trigger="hc:confirmed"` is required; Cancel fires nothing;
  `hx-confirm` must not be combined; delegated, so swapped-in triggers
  work), and a **non-2xx swap** section (`htmx:beforeSwap` 422 snippet /
  `HX-Retarget` alternative). `data-region` documents whole-region
  self-replacement via `data-hx-select` for full-page endpoints. The
  specification is enforced by 4 new browser tests running against
  **real htmx 2.0.4** (the examples/htmx vendored copy, served offline
  to the fixtures).
- **Generic patterns the first downstream consumer had to hand-write
  (TesseraQL brief Theme 4).**
  - **`hc-chip` + `.hc-chips`** — a quiet, pill-shaped token for facts
    and attributes (capabilities, tags, applied filters) with a
    list-resetting wrap container. Deliberately variant-free: status
    pills stay `hc-badge`'s job. New `chip.*` tokens and a Chip docs
    page (incl. a chip / badge / `.hc-status` decision table).
  - **`hc-table` key-value variant (`data-variant="kv"`)** — a
    two-column definition table for detail views: `<th scope="row">`
    keys on a fixed inline size (`--hc-table-kv-key-width`, default
    `10rem`) with muted text, row hover off. New `table.kv-*` tokens.
  - **`hc-item` now styles `aria-current`** — the current page's link
    in a nav list gets the selected treatment, completing the
    sidebar-nav story (Shell → Sidebar navigation items docs show an
    `hc-item` sidebar with hover + `aria-current="page"`, so consumers
    stop styling `hc-shell__sidebar a` internals).
  - **`.hc-spacer` utility** — a flexible spacer for any flex row;
    documents the shell-header pattern (title · badge · spacer · back /
    action links) that previously needed `margin-inline-start: auto`
    app CSS.

  Already covered without new code (docs cross-links only): empty
  state → `hc-empty`, hint text → `hc-field__message`, inline status
  banner → `hc-alert`. 9 new Playwright tests (incl. axe).
- **`.hc-status` utility — semantic status colors on arbitrary
  elements.** Applies the theme-aware status palette
  (`--hc-color-status-{neutral,info,success,warning,error}-*`, the same
  tokens behind alert/badge/toast variants) to a table cell, a whole
  row, or plain text: `.hc-status` + `data-variant` colours the text,
  `data-fill` adds the paired tinted background (on a `<tr>` it tints
  the row and wins over `hc-table`'s hover background — utilities layer
  ordering). Values re-resolve under `[data-theme="dark"]`, so
  server-computed status classes need no raw hex or hand-written dark
  overrides downstream (TesseraQL brief Theme 3). New Tokens → Status
  colors docs page; 4 Playwright tests (incl. axe colour-contrast in
  both themes).
- **Field → Composing a form docs.** A complete worked form — label
  association (`for`/`id`), the automatic required asterisk, help text,
  the error slot, a `fieldset.hc-field` radio group, and a
  `.hc-cluster` actions row — built from kit classes only, with notes
  on what app CSS this makes unnecessary (label layout, `width: 100%`
  on controls, required markers, toolbar rows). Prompted by the
  TesseraQL improvement brief (Theme 2), whose consumer hand-wrote all
  of this; the pattern itself already shipped in `0.0.1-alpha.0`.
  Adds a browser test asserting the native label→focus association.
- **`field-errors` recipe + `installFieldErrors()` behavior — a wire
  contract for server-side validation errors.** The server answers a
  failed submission (e.g. a 422) with a documented `hc-alert` fragment
  (`data-hc-field-errors`, `.hc-alert__errors` >
  `.hc-alert__error[data-field][data-code][data-message-key]`); the new
  behavior (in the auto-init `/behaviors` bundle) distributes each item
  to the field its `data-field` names — message into the field's
  `.hc-field__error` (created next to a bare control when there is no
  `hc-field`), `aria-invalid` + `aria-describedby` on the control,
  `data-invalid` on the field, first invalid control focused — and
  clears it on edit / resubmit / the next fragment. Items naming no
  known control stay visible in the summary
  (`data-distributed="all|partial|none"` on the alert). Message keys
  resolve through the existing i18n catalog (`setMessages()`), with the
  item text as fallback — new `hasMessage()` export and
  `fieldErrors.unknown` default. Native constraint validation
  (`installValidation()`) outranks a server error on the same control;
  the shared ARIA plumbing moved to an internal `field-error-core.js`.
  Designed for (and with) TesseraQL — improvement-brief Theme 1.
  New Recipes → Field errors docs page (live demo), Field / Alert /
  i18n docs sections, `recipes/field-errors/` contract scaffold,
  16 Vitest + 5 Playwright tests (incl. axe).
- **Versioning policy ([`VERSIONING.md`](VERSIONING.md) + Reference →
  Versioning & stability docs page).** Defines the public API surface
  the way template/codegen consumers experience it — CSS class names,
  data attributes, `--hc-*` custom properties, JS exports, `hc:*`
  events, i18n message keys, package export paths, and recipe server
  contracts — plus the 0.x semver rules (patch = additive only;
  breaking changes only in minors, flagged in this file) and the
  deprecation-alias rule (renames keep the old name working for ≥1
  minor; the pre-alpha "no aliases" rule ended with `0.0.1-alpha.0`).
  Prompted by the TesseraQL improvement brief
  ([`plans/tesseraql-2026-06-brief.md`](plans/tesseraql-2026-06-brief.md),
  Theme 7); the response document
  ([`plans/tesseraql-2026-06-response-en.md`](plans/tesseraql-2026-06-response-en.md))
  maps each requested theme to existing alpha.0 features or a planned
  PR.

### Fixed

- **Error text failed WCAG AA contrast in dark mode.** Error / help text in
  an invalid field used `semantic.color.error` (red-600 `#dc2626`), which
  renders at only 3.67:1 on the dark surface (`#111827`) — below the 4.5:1
  minimum for normal text. The dark theme now lightens `color.error` to
  red-400 (`#f87171`, ≥4.5:1), so the field error message and every error
  border/fill that resolves through it inherits a readable red under
  `[data-theme="dark"]`. Light mode is unchanged. (`hc-field`, `hc-input`,
  `hc-select`, `hc-datepicker`, and other components that surface error
  state.)

## [0.0.1-alpha.0] - 2026-06-09

First published release — the full MVP surface (components, behaviors,
recipes, tokens, macros, docs) goes out under a single alpha tag.

### Fixed

- **Theme builder Accent mode hid no extra controls.** The Full-theme-only
  controls (neutral ramp, radius) stayed visible in Accent mode: an
  `#id` selector (`display: grid`) outranked the UA `[hidden]` rule, so
  `hidden` had no effect. Re-asserted `#tb-full-controls[hidden] { display:
  none }`. (Output was already correct — Accent mode never read those
  values — but the UI was misleading.)
- **`data-neutral` dark mode with `data-theme` on an ancestor.** The dark
  neutral block only matched when `data-theme="dark"` and `data-neutral`
  were on the **same** element, so the common setup (`data-theme` on
  `<html>`, `data-neutral` on a subtree) fell through to the *light* ramp —
  a light panel with an unreadable dark card in dark mode. The dark block
  now also matches the descendant form
  (`[data-theme="dark"] [data-neutral="X"]`). Added a regression test for
  the ancestor-theme / descendant-neutral case.

### Added

- **`hc-calendar` `data-target`.** Point a calendar at a field with
  `data-target="#selector"` and `installCalendar` writes the picked value
  into it (firing `input` / `change`) and closes the enclosing popover —
  a custom date field (input + popover + calendar) built from **markup
  only**, with no per-field JavaScript even across many fields. The
  calendar also **seeds its initial selection from the linked field**, so
  the date is set once (on the input) with no duplicated `data-value`.
  Works in single and range mode.
- **`chart` recipe + `installChart` behavior.** Upgrades a server-sent
  semantic `<table class="hc-table">` (wrapped in
  `<figure class="hc-chart" data-hc-chart="bar|line|area|combo">`) into an
  [Observable Plot](https://observablehq.com/plot/) SVG chart. The table is
  the data source, the no-JavaScript fallback, and the screen-reader data
  (kept via `.hc-sr-only`; the SVG is `aria-hidden`). Chart type and
  per-series marks are declared in markup (`data-mark` on `<th>` enables
  combo charts) — no per-chart JavaScript; swapped-in charts render on
  `htmx:load`. New `--hc-chart-*` tokens (`series-1..6` palette, `grid`,
  `axis`, `label`, `height`) and `hc-chart.css`. Observable Plot is an
  **optional peer dependency** — load it yourself (CDN UMD global or a
  bundled import); without it the behavior is a no-op. `installChart` is an
  opt-in named export, not part of the auto-init `behaviors` entry.
- **Icons guide (docs).** A new
  [`fundamentals/icons`](apps/docs/src/content/docs/fundamentals/icons.mdx)
  page: HC ships no icons by design; the guide recommends sets that pair
  cleanly (Iconify `<iconify-icon>`, Lucide, SVG sprite), explains the
  `currentColor` + `.hc-icon` wiring, the htmx re-init caveat, and a11y for
  icon-only controls, with live inline-SVG examples.
- **`.hc-icon` utility + `--hc-icon-size` token.** A bring-your-own-icon
  sizing helper (HC ships no icons). `.hc-icon` sizes to the surrounding
  text by default (`--hc-icon-size: 1em`) and sets `flex: none` +
  baseline alignment; color comes from the icon's own `currentColor`, so it
  inherits the button / text / accent color automatically. Pairs with
  Lucide, Tabler, Phosphor, an Iconify `<iconify-icon>`, or an SVG sprite.
- **Theme builder — presets, share links, shuffle, richer preview.**
  - **Start from a preset**: the built-in five (seed Accent mode) plus curated
    full-theme combos (Slate · Indigo, Stone · Amber, Zinc · Emerald,
    Neutral · Rose) that seed accent + neutral + radius.
  - **Copy share link**: encodes the full config into a `#tb=…` URL hash,
    restored on load — shareable / bookmarkable.
  - **Shuffle**: generates a random full theme (random accent with auto
    contrast, neutral, radius, fonts).
  - **Richer preview**: now exercises select / switch / badge / alert
    alongside the existing controls, so accent, neutral, radius, and fonts
    are all visible at once.
- **Typography tokens — `--hc-font-family-heading` / `--hc-font-family-mono`.**
  Added a `mono` primitive font stack and `font.family-heading` (defaults to
  sans) / `font.family-mono` semantic tokens. `kbd` now references
  `--hc-font-family-mono` (value unchanged). The theme builder's Full theme
  mode gains body / heading / mono font pickers. (HC ships no webfonts — the
  builder sets the `font-family` var; load the face yourself.)
- **`data-neutral` axis — swap the neutral ramp.** A new runtime axis,
  orthogonal to `data-color` / `data-theme` / `data-density`, swaps the
  surface / text / border / muted / secondary greys between **gray**
  (default), **slate**, **zinc**, **neutral**, and **stone** — tuned for
  both light and dark. This makes the built-in themes meaningfully
  distinct beyond the accent (e.g. an indigo accent on a cool slate UI).
  Ships in `hc.tokens.css` (and per-ramp `hc.tokens.neutral-*.css` axis
  files); new [`tokens/neutral`](apps/docs/src/content/docs/tokens/neutral.mdx)
  docs page + a navbar picker. Implemented as an override layer with a
  compound `[data-theme="dark"][data-neutral="X"]` block; the
  transformer's overlay now composes multiple layers (dark + neutral).
- **Color theme palette swatches (docs).** `tokens/themes` now shows each
  built-in theme's resolved accent palette (primary / hover / soft / text /
  ring) as swatches, generated from the token sources.

- **Colour palette reference (docs).** A new
  [`tokens/palette`](apps/docs/src/content/docs/tokens/palette.mdx) page
  renders every primitive ramp as swatches, straight from
  `primitive.tokens.json`, with the `{primitive.color.*}` path on hover.
  Clarifies that primitives are `emit: false` (reference values, not a
  CSS API).
- **Completed primitive colour ramps.** `indigo` and `rose` now run the
  full 50–950 scale (were 6 shades), and `violet` / `slate` / `zinc` /
  `neutral` / `stone` ramps are added. Primitives are `emit: false`, so
  the generated `hc.tokens.css` is unchanged — these only become
  available to `{ref}` (and fix the `violet` example in `tokens/themes`).

### Fixed

- **Nested `data-density` / `data-theme` no longer freeze a few controls.**
  `select` height/padding, `multicombobox` control min-height, and
  `skeleton` bg/highlight used literal `var(--hc-control-*)` /
  `var(--hc-color-*)` indirection, which CSS resolves on the declaring
  element (`:root`) and then inherits frozen — so a nested
  `[data-density]` / `[data-theme="dark"]` wrapper couldn't re-resolve
  them. Switched these leaves to `{ref}` form so the build re-emits a
  concrete value in each themed block, matching every other control.
- **Theme builder now actually recolours components.** The first cut
  overrode only the seven `--hc-color-action-primary-*` semantic
  variables, which components don't read directly (each reads a
  build-baked `--hc-{component}-*` value), so the primary button /
  checkbox / radio never changed. The builder now reuses the real
  `buildTokensCss` transformer (via the new
  `@hypermedia-components/core/token-transform` export) on the real
  DTCG sources to generate a complete, correct `[data-color]` block —
  the same output the library build produces. `tokens/themes` Path A is
  corrected accordingly, with a new section explaining the cascade.

### Changed

- **Theme builder exports three artifacts.** The DTCG token source
  (Path B), an additive theme CSS block (Path A), and a full token CSS
  (drop-in replacement) — all generated from `buildTokensCss`.
- **Theme builder gains a Full theme mode.** Beyond the accent, it now
  customises the default look: a **neutral ramp** (gray / slate / zinc /
  neutral / stone, driving surface / text / border / secondary across
  light and dark) and the **control radius**. Full-theme output is the
  diff of the themed build vs the stock build, so it's exactly the
  variables that changed. Live preview follows the site's light/dark.

### Added

- **Theme builder (docs).** A new interactive
  [`tokens/theme-builder`](apps/docs/src/content/docs/tokens/theme-builder.mdx)
  page derives a full `data-color` accent set from one brand colour
  (hover / soft-tint / text-on-primary), checks WCAG contrast live, and
  exports both the `[data-color="…"]` CSS override and the
  `color.*.tokens.json` DTCG source. Backed by
  `apps/docs/src/components/ThemeBuilder.astro`.
- **Custom-theme authoring guide.** `tokens/themes` now documents both
  paths for adding your own accent palette — runtime CSS-variable
  override (no rebuild) and a shipped `color.*.tokens.json` token
  source — with the exact `build-tokens.mjs` registration steps.
- **`hc-shell` directional collapse icon (`.hc-shell__collapse-icon`).** A
  chevron on the collapse control should point the way it will move — `«`
  (collapse) while expanded, `»` (expand) once collapsed. Wrap the glyph in
  `.hc-shell__collapse-icon` and it mirrors automatically when the rail
  collapses (`transform: scaleX(-1)` keyed on `data-sidebar-collapsed`, no
  extra script); a non-directional glyph (e.g. `⇔`) just omits the class.
  Fixes the Blocks app-shell, whose static `«` pointed the wrong way when
  collapsed. Pure CSS + 1 Playwright test; Shell → Collapsible sidebar docs
  updated.

- **Docs: a Blocks showcase page.** A new top-level docs page
  (`/blocks/`, in the sidebar after Components) that shows components
  *composed* into realistic UI sections — an account-settings card, a data
  table with a search/action bar and pager, a sign-in card, an activity
  feed, and a full admin-dashboard shell (an `hc-item` sidebar nav with
  icons + an active row that **collapses to a live icon rail** via
  `installShell()`, a search header, stat cards with delta badges, and a
  recent-orders table; narrow the window below 60rem and the sidebar folds
  into a **mobile hamburger** that opens it as an off-canvas drawer, kept
  inside the demo box). The Components pages and the
  Kitchen sink show each part in isolation; this fills the gap of showing
  how they go together (the thing shadcn-style "blocks" pages do). Each
  block is a `Demo` with a **Code** tab, so the whole composed section is
  copy-pasteable; built from the documented classes, no new component code.

- **`hc-item` — generic list / option row primitive.** A shared row layout —
  `__media` (icon / avatar) + `__content` (`__title` / `__description`) +
  `__actions` — for plain lists, option rows, and as the building block that
  command / menu items can later adopt for a consistent look. Render it as a
  `<div>`, `<li>`, `<a>`, or `<button>`; interactive elements get the hover
  highlight and focus ring. States: `[aria-selected]` / `[data-selected]`,
  disabled, and `data-variant="error"`. **Pure CSS, no behavior.** New
  `item.*` tokens, Item docs page, and 5 Playwright tests (incl. axe). The
  PR notes `hc-menu` / `hc-command` as possible future adopters (separate
  follow-ups, not in this change).

- **`hc-navmenu` — site navigation with content panels (`installNavmenu()`).**
  A top-level mega-menu built as a disclosure set: each trigger is a
  `button[aria-expanded]` controlling a `popover` panel anchored beneath it
  with CSS Anchor Positioning (JS fallback via `anchor-fallback.js`). Panels
  open on hover / focus with a short intent + close delay, **one at a time**;
  `↓` / `↑` open and move focus into the panel; `Esc` closes and returns
  focus to the trigger. Plain links inside panels stay real `<a>` (the
  behavior never intercepts them) — MPA / htmx friendly. New `navmenu.*`
  tokens, Navigation menu docs page (incl. a responsive / mobile note), 10
  Vitest tests, and 7 Playwright tests (incl. hover, keyboard, click-through,
  axe).

- **`hc-menubar` — application menu bar (`installMenubar()`).** The desktop
  File / Edit / View menu bar pattern: a horizontal `role="menubar"` of menu
  buttons, each opening an `hc-menu` dropdown. A thin layer over the existing
  menu machinery — `installMenu()` owns the dropdown internals (ARIA, in-menu
  keyboard, B1 submenus); `installMenubar()` adds roving-tabindex across the
  top items (←/→ + Home/End, one Tab stop), ↓/↑/Enter/Space to open, and
  cross-menu ←/→ switching while a menu is open (a submenu parent still opens
  its submenu on →). Escape closes via the native popover. New `menubar.*`
  tokens, Menubar docs page, 8 Vitest tests, and 7 Playwright tests (incl.
  axe, open + closed).

- **`hc-carousel` — scroll-snap carousel (`installCarousel()`).** A carousel
  whose source of truth is the native scroll position: slides live in a CSS
  scroll-snap rail and the behavior only tracks the in-view slide (an
  `IntersectionObserver` sets `data-active`), syncs prev/next + auto-generated
  dot controls (`aria-current`), scrolls on click and ←/→ on the focused rail,
  and emits `hc:carouselchange`. **No animation library, no JS transform** —
  native smooth scrolling does the motion. Optional `data-autoplay="<ms>"` is
  opt-in only: it pauses on hover / focus and is disabled under
  `prefers-reduced-motion`. Slides are plain HTML (htmx can lazy-load them).
  New `carousel.*` tokens, Carousel docs page, 9 Vitest tests, and 6
  Playwright tests (incl. real scroll + axe).

- **`hc-input-group` — input with leading/trailing addons.** Composes an
  `hc-input` with text, icon, or real `hc-button` addons on **one** bordered
  surface with a single shared focus ring (`:focus-within`); the inner
  `<input>` drops its own border so the group owns it. Distinct from
  `hc-field` (label + help text) — this is the control's inner composition,
  and htmx wiring stays on the inner `<input>` / `<button>`. New
  `input-group.*` tokens. Also adds an opt-in **`installPasswordToggle()`**
  behavior (`data-hc-password-toggle`): a trailing button toggles a password
  field's visibility, reflecting `aria-pressed` + `aria-label`
  (`data-hc-label-show` / `-hide`), no value access or network. New Input
  group docs page, 8 Vitest tests, and 5 Playwright tests (incl. axe).

- **`hc-collapsible` — standalone disclosure.** A single show/hide "show
  more" toggle built purely on native `<details>` / `<summary>` (the browser
  owns the keyboard handling and `open` state; no JavaScript). A lighter,
  link-styled alternative to `hc-accordion` for one region. Reuses the
  accordion height-animation technique (`::details-content` +
  `interpolate-size`) behind the same `@supports` gate — Chromium-only as of
  2026, fully progressive (native instant toggle elsewhere); honors
  `prefers-reduced-motion`. New `collapsible.*` tokens, Collapsible docs page
  (with a baseline note), and 5 Playwright tests (incl. axe).

- **`hc-empty` — empty-state block.** A centered block for "no results" /
  "nothing here yet" states: an optional `__media` (icon / illustration)
  slot, a `__title`, an optional `__description` (width-capped for
  readability), and an optional `__actions` row. Token-driven spacing, no
  JavaScript; pairs with htmx "no results" partial swaps (wrap the target in
  `aria-live` to announce it). The role is left to the author so it fits the
  context. New `empty.*` tokens, Empty state docs page (incl. an htmx
  no-results example), and 5 Playwright tests (incl. axe).

- **`hc-spinner` — documented component + variants/sizes.** The existing
  CSS-only loading ring is now a first-class component with a docs page.
  Adds `data-size` (`sm` / default / `lg`) and `data-variant`
  (`primary` / `success` / `warning` / `error`, default `currentColor`); the
  spin duration and reduced-motion duration are now tokens, and the track
  uses the theme `border` colour so it adapts to dark mode. Documents the
  `role="status"` + accessible-name a11y pattern (the spin slows but never
  stops under `prefers-reduced-motion`, and the status name — not the
  animation — conveys "busy"). New `spinner.{sm-size,lg-size,duration,
  reduced-duration,primary-color,success-color,warning-color,error-color}`
  tokens; 6 Playwright tests (incl. reduced-motion + axe).

- **`hc-button-group` — connected button cluster.** Visually joins adjacent
  `.hc-button` elements into one segmented cluster (split buttons,
  icon-button rows, pagination-like groups): collapses the shared inner
  border-radii, overlaps neighbours by 1px so the touching borders read as a
  single hairline, and rounds only the outer corners. `data-orientation="vertical"`
  stacks the buttons. **Purely presentational** — no selected state, no
  JavaScript (for a two-state segmented control use `hc-toggle-group`).
  Reuses `--hc-button-radius`; no new tokens. New Button group docs page
  (incl. icon-button row and split-button-with-menu) and 4 Playwright tests
  (incl. axe).

- **`hc-aspect` — fixed aspect-ratio box.** Reserves a box of a fixed
  proportion (no layout shift while media loads) via the native
  `aspect-ratio` property; a direct media child (`img` / `video` / `iframe` /
  `picture`) fills it with `object-fit: cover`. Common ratios ship as
  `data-ratio` presets (`16/9`, `4/3`, `3/2`, `2/1`, `21/9`, `9/16`, default
  `1/1`) that set `--hc-aspect-ratio`; any other ratio is an inline
  `style="--hc-aspect-ratio: 3 / 4"`. `data-fit="contain"` letterboxes
  instead of cropping. Pure CSS, no JavaScript. `aspect-ratio` / `object-fit`
  are Baseline 2021, so no `@supports` gate (the padding-top fallback is
  documented as a note). New Aspect ratio docs page and 5 Playwright tests
  (incl. axe).

- **`hc-kbd` — keyboard keys & shortcuts.** A token-driven skin for the native
  `<kbd>` element: single caps (`Esc`, `⌘`) plus an `hc-kbd-group` wrapper for
  multi-key shortcuts (`⌘ + K`) where literal separators read muted. `data-size`
  (`sm` / default / `lg`) scales a key — or a whole group — via `em`-based
  padding and min-width. Colors reference the semantic `muted-bg` / `text` /
  `border` tokens so caps follow the light / dark theme. Pure CSS, no
  JavaScript. New `kbd.*` tokens, Kbd docs page, and 5 Playwright tests
  (incl. axe).

- **`hc-accordion` height animation (progressive enhancement).** The panel now
  animates its height open / closed — pure CSS, no JavaScript — via
  `::details-content` + `interpolate-size: allow-keywords` (so the height can
  transition to / from `auto`), with a `content-visibility` discrete transition
  so the body stays rendered while it collapses. `interpolate-size` /
  `calc-size()` are Chromium-only as of 2026, so it's gated behind
  `@supports (interpolate-size: allow-keywords)` and is **fully progressive** —
  every other engine keeps the native instant open / close, and starts
  animating automatically once it ships. New
  `accordion.content.transition-duration` token (default `200ms`); honors
  `prefers-reduced-motion`. New Accordion → Height animation docs with a
  baseline note. 2 Playwright tests.

- **`hc-scroll-area` edge shadows (`data-shadows`).** Opt in for a subtle
  shadow at each scrollable edge that shows **only when there is more content**
  to scroll in that direction (fading in as you scroll away from an edge).
  Pure CSS — the classic scrolling-shadows gradient where solid cover layers
  scroll with the content (`background-attachment: local`) and hide fixed
  shadow layers at the flush edge. Deliberately **no scroll-driven animations**
  (`animation-timeline: scroll()` is not Baseline as of 2026), so it works
  everywhere `background-attachment: local` does, and it honors
  `data-orientation` (vertical / horizontal). New theme-adaptive
  `scroll-area.shadow` token and `--hc-scroll-area-bg` cover knob. New
  Scroll area → Edge shadows docs. 3 Playwright tests.

- **`hc-shell` collapsible sidebar (`data-collapsible` / `data-persist`).** On
  desktop the sidebar can collapse to a narrow icon rail: add `data-collapsible`
  to the `.hc-shell__sidebar` and a `[data-hc-shell-collapse]` button, and
  `installShell()` toggles `data-sidebar-collapsed` on the shell (the CSS
  narrows the grid column from `--hc-shell-sidebar-width` to a new
  `--hc-shell-sidebar-collapsed-width`, default `4rem`) with `aria-expanded`
  kept in sync. Wrap nav text in `.hc-shell__label` and it is visually hidden
  in the rail but kept in the a11y tree, so links keep their accessible names.
  `data-persist="<key>"` mirrors the state to `localStorage` and restores it
  before first paint (failures degrade silently). Desktop-only — the mobile
  overlay is unchanged and the collapse button is hidden there. New Shell →
  Collapsible sidebar docs. 3 Vitest + 3 Playwright tests (incl. axe + reload
  restores).

- **`hc-drawer` drag to dismiss.** Drag the panel toward its anchored edge to
  close it — the axis follows `data-side` (right/left horizontal, top/bottom
  vertical); past ~40% of the panel size or with a quick flick it slides out
  and closes, a shorter drag snaps back. Only the outward direction moves
  (inward is clamped — no rubber-banding, so `prefers-reduced-motion` needs no
  special case). The gesture is grabbed from the `__header` / `__footer`
  chrome, never the scrollable `__body` or a control, and the trailing click
  no longer trips backdrop-close. Pointer-Events based (mouse / touch / pen);
  the threshold is exposed as `dragShouldDismiss` for tests. New Drawer → Drag
  to dismiss docs. 6 Vitest + 2 Playwright tests.

- **`hc-toast` actions + update-by-id (`action` / `id`).** A toast can now
  carry an **action button** — `action: { label, event }` renders a button
  that, on click, dispatches a bubbling `CustomEvent` (catchable by htmx
  `hx-trigger` or a plain listener, e.g. Undo) and dismisses the toast. A
  toast can also carry an **`id`**: a later `hc:toast` with the same id
  **updates it in place** (re-rendering message / variant and resetting the
  auto-dismiss timer) instead of stacking a duplicate — modelling a
  loading → success / error promise without client state (the network stays
  with htmx via `HX-Trigger`). The swipe gesture yields to the action button.
  New Toast → Actions & updates docs. 6 Vitest + 3 Playwright tests (incl.
  axe).

- **`hc-inputotp` per-slot click caret placement.** Clicking a slot now moves
  the caret into it so you can edit that position — clamped to the typed
  length, so clicking past the end just parks the caret at the end (no gap).
  The active slot (`data-active`, with its blinking, `prefers-reduced-motion`-
  aware caret) follows the caret as it advances on typing, moves with the
  arrow keys, or jumps to a clicked slot. New Input OTP → Active slot & caret
  docs; the feature leaves the Out-of-scope list. 3 Vitest + 3 Playwright
  tests.

- **`hc-command` fuzzy / scored filtering.** Typing now fuzzy-matches and
  re-ranks the palette instead of a plain substring filter: query characters
  must appear in order (subsequence), and matches score higher when they are
  contiguous or land on a word / camelCase boundary. Items reorder by score —
  the best match floats to the top, even across groups (groups float by their
  best item; headings stay) — with ties keeping the authored order, restored
  when the query clears. Dependency-free and client-side only. Set
  `data-filter="substring"` to keep the previous plain substring filter (no
  reordering). New Command → Filtering & ranking docs. 9 Vitest (incl. the
  exported `commandScore` scorer) + 2 Playwright tests.

- **`hc-calendar` range selection (`data-mode="range"`).** The calendar can now
  pick a start / end pair: the first click or <kbd>Enter</kbd> sets the start,
  the next the end (auto-swapped so start ≤ end), a third begins a new range,
  and the tentative band previews under the pointer / keyboard focus while the
  second end is chosen. Days carry `data-in-range` between the ends
  (`data-range-start` / `data-range-end` markers, `data-range-preview*` during
  selection) for theming — two new themed tokens paint the band. Each change
  dispatches `hc:calendarrangechange` with `{ start, end, startDate, endDate }`;
  `data-value` becomes `"START/END"` and `data-name` writes **two** hidden
  inputs (`name-start` / `name-end`) so a range serialises for htmx without
  client-side state. Single-date mode stays the default. New Calendar → Range
  selection docs. 8 Vitest + 5 Playwright tests.

- **`hc-breadcrumb` collapsible ellipsis.** The middle-truncation marker can
  now be a `<button class="hc-breadcrumb__ellipsis" popovertarget="…">` that
  opens a `hc-menu` popover listing the hidden steps. No new JavaScript —
  `installMenu()` wires the trigger (`aria-haspopup` / `aria-expanded`,
  anchored placement, arrow-key roving, Escape). Progressive: `popovertarget`
  opens the menu natively without JS, and on engines without the `popover`
  attribute the hidden steps render inline so the full trail stays in the DOM.
  New Breadcrumb → Collapsed steps docs (with a responsive-collapse note); the
  button variant gets hover / focus-visible styling. 5 Playwright tests (incl.
  axe with the popover open).

- **Directional placement for tooltip / popover / hovercard (`data-side` /
  `data-align` / `data-arrow`).** All three anchored popovers now take a
  `data-side` (top / right / bottom / left) and optional `data-align` (start /
  center / end) to place them around their trigger, plus an opt-in
  `data-arrow` pointer. A new shared stylesheet maps the attributes to a CSS
  `position-area` (with `position-try-fallbacks` to flip at the viewport
  edge); the shared `anchor-fallback` JS mirrors the same attributes (via a
  new `readSideAlign` helper and `inline`-axis alignment) so both paths place
  the element identically. `hc-popover` gains a small opt-in **`installPopover`**
  behavior: a bare popover stays browser-centred, but a `.hc-popover[data-side]`
  is anchored to its `popovertarget` trigger and gets `aria-expanded` /
  `aria-controls`. Exported from `@hypermedia-components/core` and
  `/behaviors`. New Placement docs on all three components with a Baseline
  note (CSS Anchor Positioning is Baseline 2026; JS fallback for older
  engines). 8 Vitest + 6 Playwright tests (incl. axe).

- **`hc-menu` / `hc-context-menu` submenus (`data-hc-submenu`).** A menu item
  can now open a nested submenu following the WAI-ARIA APG submenu pattern.
  Point a `menuitem` at a nested `.hc-menu` with `data-hc-submenu="<id>"`;
  `installMenu()` / `installContextMenu()` wire `aria-haspopup="menu"`,
  `aria-expanded`, and `aria-controls`, add `popover="auto"`, and manage open
  / close: hover or click the parent, or press <kbd>→</kbd> / <kbd>Enter</kbd>
  / <kbd>Space</kbd> to open (focusing the first item), <kbd>←</kbd> /
  <kbd>Esc</kbd> to close (focus returns to the parent), and selecting any
  leaf closes the whole tree. Roving focus / type-ahead are scoped per menu,
  the arrows mirror under RTL, and the parent shows a chevron. Placement uses
  CSS Anchor Positioning to the inline-end (flipping at the edge) with the
  shared JS fallback — now extended with an `inline-end` / `inline-start`
  side. The same wiring is shared by `hc-context-menu`. New Menu → Submenus
  docs. 9 Vitest + 7 Playwright tests (incl. axe).

- **`hc-slider` vertical orientation (`data-orientation="vertical"`).** Stands
  the range up with the modern, native `writing-mode` approach (Baseline
  2024) — the control stays a real `<input type="range">`, so the OS thumb,
  full keyboard (<kbd>↑</kbd> / <kbd>↓</kbd>, Home / End, PageUp / PageDown),
  form participation, and SR value announcement all keep working. The maximum
  sits at the top (`direction: rtl`) and the WebKit fill grows upward; height
  is set with `--hc-slider-length` (default `12rem`). Older engines degrade to
  the horizontal layout (no transform / non-standard fallback). The WebKit
  fill gradient was refactored to a `--hc-slider-fill-current` /
  `--hc-slider-fill-dir` pair (variants now just recolour the former),
  collapsing the per-variant duplication. New Slider → Vertical orientation
  docs with a baseline note. 4 Playwright tests.

- **`hc-tabs` vertical orientation (`data-orientation="vertical"`).** Setting
  `data-orientation="vertical"` on the `.hc-tabs` root stands the tab list up
  as a column beside its panels; `installTabs()` reflects it onto the
  tablist's `aria-orientation="vertical"` and the arrow-key axis follows —
  <kbd>↑</kbd> / <kbd>↓</kbd> move between tabs when vertical, <kbd>←</kbd> /
  <kbd>→</kbd> when horizontal (per the APG; the cross-axis arrows are now
  left alone). The active indicator moves from the underline to an
  inline-start bar (logical, RTL-aware). CSS-only layout — no new behavior
  surface and no baseline risk. New Tabs → Vertical orientation docs. 5
  Vitest + 4 Playwright tests.

- **`hc-avatar` image fallback (`installAvatar`).** A composite avatar — an
  `.hc-avatar` wrapper holding an `.hc-avatar__image` and an
  `.hc-avatar__fallback` — now swaps a missing or broken image for its
  initials automatically. The new behavior tracks the image's native
  `load`/`error` events and writes `data-state` (`loading` → `loaded` /
  `error`, plus `pending`) on the wrapper; an optional `data-delay="<ms>"`
  holds the fallback hidden on fast connections so it never flashes. No
  network of its own. Progressive: the image still covers the fallback
  without JavaScript (a broken image shows the fallback behind it). Plain
  `<img class="hc-avatar">` / `<span class="hc-avatar">` avatars are
  untouched. Exported from both `@hypermedia-components/core` and
  `/behaviors`. New Avatar → Image fallback docs. 13 Vitest + 2 Playwright
  tests.

- **`hc-toolbar` keyboard navigation (`installToolbar`).** A new behavior
  upgrades every `.hc-toolbar[role="toolbar"]` into the WAI-ARIA APG Toolbar
  pattern: the toolbar becomes a **single Tab stop** with roving-tabindex
  arrow-key navigation — <kbd>←</kbd>/<kbd>→</kbd> (horizontal, mirrored in
  RTL) or <kbd>↑</kbd>/<kbd>↓</kbd> when `aria-orientation="vertical"`, plus
  <kbd>Home</kbd>/<kbd>End</kbd>. Disabled controls are skipped, the last
  focused control stays the Tab stop, and a text field keeps the on-axis
  arrow for its own caret. The plain `.hc-toolbar` layout class (no
  `role="toolbar"`) is left untouched and degrades to the native focus order
  without JavaScript. Exported from both `@hypermedia-components/core` and
  `/behaviors`. New Toolbar → Keyboard navigation docs. 13 Vitest + 7
  Playwright tests (incl. axe).

- **`hc-splitter` collapse & persistence (`data-collapsible` / `data-persist`).**
  `data-collapsible` lets the handle fold the primary pane away and bring it
  back — **double-click** the handle or focus it and press <kbd>Enter</kbd> to
  toggle between collapsed (0%) and the last open size. A collapsed splitter
  carries `data-collapsed` on the container and `hc:splitterchange` now reports
  `detail.collapsed` (the handle's `aria-valuenow` stays within `[min, max]`).
  `data-persist="<key>"` mirrors the position into `localStorage` and restores
  it on the next visit (a persisted `0` restores the collapsed state); storage
  failures degrade silently to the `data-value` default. New Splitter →
  Collapse / Persistence docs. 9 Vitest + 4 Playwright tests.

- **Rich combobox / multi-combobox options (`data-search` / `data-label`).**
  Options can now hold arbitrary HTML (icon, two-line label, description)
  without breaking filtering or selection. `data-search` is the text the
  filter matches (so aliases / keywords that aren't shown still match);
  `data-label` is the clean value written into the input (combobox) or used as
  the tag label (multi-combobox) — instead of the rich markup's text content.
  Both fall back to the previous behaviour when absent. Updated Combobox /
  Multi-combobox → Rich options docs (incl. the `:not([hidden])` layout note).
  5 Vitest + 3 Playwright tests.

- **`hc-calendar` month / year quick navigation (`data-nav="select"`).** Swaps
  the header title for month and year **dropdowns**, so users jump to a far
  month/year in one step instead of clicking the arrows repeatedly. The year
  range spans `data-min`…`data-max` (or the focused year ±10); the arrows still
  work alongside the dropdowns. New `calendar.month` / `calendar.year` i18n keys
  and a Calendar → Month / year navigation docs section. 5 Vitest + 3 Playwright
  tests.

- **`hc-inputotp` group separators (`data-groups`).** Visually split the OTP
  slots into groups — `data-groups="3-3"` (also `"3 3"` / `"2,2,2"`) renders a
  decorative, `aria-hidden` separator between each group, for formatted codes
  like `123-456`. The spec is ignored unless the group sizes sum to
  `data-length`. Restyle the glyph with `--hc-inputotp-separator` (default
  `"–"`; `""` gives a plain wider gap). New Input OTP → Group separators docs.
  5 Vitest + 3 Playwright tests.

- **Creatable combobox & multi-combobox (`data-allow-create`).** Let users pick
  a value that isn't in the list. When the typed text has no exact match, a
  synthetic, selectable option appears at the end — **"Create …"** for
  `hc-combobox` (commits the raw text, fires `hc:comboboxselect` with
  `created: true`) and **"Add …"** for `hc-multicombobox` (creates a tag from
  the raw text + a hidden `name` input, fires `hc:multicomboboxchange` with it
  in `added`). New `combobox.create` / `multicombobox.create` i18n keys
  (interpolating `{value}`) and Combobox / Multi-combobox → Creatable docs.
  7 Vitest + 3 Playwright tests.

- **Lazy-loaded datagrid row detail.** Add `data-lazy` to a
  `.hc-datagrid__detail` cell and `installDatagrid()` defers its content to the
  **first expand**: it fires **`hc:datagriddetailload`** on the cell (wire htmx
  to it via `hx-trigger`) and shows a reduced-motion-aware busy spinner
  (`aria-busy="true"`) that clears as soon as the content swaps in. The detail
  loads once — re-expanding doesn't refetch. New Datagrid → Expandable detail
  lazy-load docs. 4 Vitest + 2 Playwright tests.

- **Sortable datagrid columns.** Mark a header `data-sortable` (with a
  `data-col` key) and `installDatagrid()` makes it focusable, toggles
  `aria-sort` on click / Enter / Space through none → ascending → descending →
  none (one column at a time, with a `↕` / `↑` / `↓` indicator), and dispatches
  **`hc:datagridsort`** (`detail: { col, direction }`, where `direction` is
  `'asc'` / `'desc'` / `null`). The grid is server-paged, so the server sorts
  and returns the page — wire the event to htmx. Header keyboard events no
  longer leak into cell navigation. New Datagrid → Sortable columns docs.
  6 Vitest + 5 Playwright tests.

- **Remote (async) combobox options.** Add `data-remote` to an `hc-combobox`
  to let the server filter: the behavior turns off its client-side filter and
  surfaces the request lifecycle as in-listbox states — a spinner row +
  `aria-busy` while loading (from `htmx:beforeRequest`), the existing "No
  matches" marker on an empty result, and an error row on failure
  (`htmx:responseError` / a failed `htmx:afterRequest`). It re-evaluates and
  highlights the first option after each options swap (htmx event or a plain
  DOM swap, via a `MutationObserver`). New `combobox.loading` / `combobox.error`
  i18n keys (overridable per-listbox with `data-hc-loading` / `data-hc-error`),
  CSS `.hc-combobox__loading` (with a reduced-motion-aware spinner) /
  `.hc-combobox__error`, and a Combobox → Remote (async) options docs section.
  The behavior still never makes the request — htmx owns fetching, debounce,
  and cancel-in-flight. 5 Vitest + 5 Playwright tests.

- **Toast options — position, stacking limit, swipe-to-dismiss.** The toast
  region accepts `data-position="{top,bottom}-{left,center,right}"` (default
  `bottom-right`; top positions stack downward, `*-center` centres) and
  `data-limit="N"` to cap the visible stack (the oldest is evicted). Each toast
  can be **dragged horizontally to dismiss** — past ~40% of its width it flies
  out, otherwise it snaps back (pointer / touch; motion removed under
  `prefers-reduced-motion`). New **Toast** component docs page. 3 Vitest + 3
  Playwright tests.

- **Scrollable tab overflow (`hc-tabs`).** Add `data-overflow="scroll"` to keep
  a long tab list on one horizontally-scrollable row instead of wrapping.
  `installTabs()` injects edge scroll buttons that appear only when there is
  more to scroll (a mouse affordance, kept out of the tab order), keeps the
  active / focused / initially-selected tab in view (arrow keys, activation,
  and load), hides the scrollbar, and is direction-aware (the buttons flip and
  the chevrons mirror under RTL). New Tabs → Overflow (scrollable) docs and
  `--hc-tabs-scroll-size` token; 4 Playwright tests.

### Changed

- **`hc-shell` now defaults to a full-width global header and footer** that
  bound the sidebar between them (the SAP Fiori / Google / Salesforce
  arrangement), instead of a full-height sidebar with the header/footer inset
  over `main`. This better fits the
  CRM / admin framing the shell targets, and makes the mobile hamburger sit in
  the header as expected. Opt back into the previous layout — a full-height
  sidebar on the left, Slack / Notion / VS Code style — with
  **`data-layout="sidebar-first"`** on the `.hc-shell`. Pure CSS (grid areas);
  the collapsible rail, optional aside, and mobile off-canvas overlay are
  unchanged and work in both modes. New Shell → Layout modes docs + 1
  Playwright test per layout. (Pre-alpha: no back-compat shim — set
  `data-layout="sidebar-first"` to keep the old look.)
- **`hc-tabs` arrow keys are now orientation-specific.** A horizontal tablist
  no longer also navigates on <kbd>↑</kbd> / <kbd>↓</kbd> (and a vertical one
  ignores <kbd>←</kbd> / <kbd>→</kbd>), matching the WAI-ARIA APG. Home / End,
  Enter / Space, and click activation are unchanged.
- **`hc-select` documents the customizable-`<select>` roadmap.** A new
  Select → Native-forward section tracks `appearance: base-select` +
  `::picker(select)` (styling the *open* native picker): current status
  (Chrome 135+ stable; Safari Technology Preview / Firefox Nightly; **not
  Baseline** as of 2026), the progressive per-instance opt-in, and a pointer
  to `hc-combobox` as the JS escape hatch to style the open dropdown today. No
  code change — `hc-select` still keeps the native picker by default. Docs
  only.
- **Anchor-positioning fallback consolidated and hardened.** The popovers
  (menu, tooltip, hovercard, combobox, multi-combobox) position with CSS
  Anchor Positioning where available and fall back to JS where it isn't (e.g.
  current Firefox). That fallback now lives in one shared module
  (`anchor-fallback.js`) instead of five near-duplicates, and gains three
  fixes: it **tracks the trigger on scroll / resize** while open (was
  positioned once on open and drifted); the combobox / multi-combobox
  fallbacks now **flip** on viewport overflow like the others (they only
  dropped straight down before); and it positions with physical `top` / `left`
  so it is **correct under RTL** (the previous logical-inset values mis-placed
  it). Listeners are cleaned up on close. Default (Chromium) rendering is
  unchanged. New browser tests run with anchor positioning stubbed off.
- **Docs home page dogfoods `hc-card` + `hc-grid`.** The landing page's
  feature cards are now built from HC's own `hc-grid` + `hc-card` (with
  `not-content` to bypass Starlight's prose styles) instead of Starlight's
  `<CardGrid>` / `<Card>`. Docs only.
- **Docs navbar pickers dogfood `hc-select`.** The colour / density
  pickers in the navbar are now styled by HC's own `.hc-select`
  (`data-size="sm"`) instead of ~30 lines of bespoke `<select>` CSS — the
  chrome itself now uses a real HC form control. Docs only.
- **Docs reference tables dogfood `hc-table`.** A small rehype plugin
  (`apps/docs/rehype-hc-tables.mjs`) wraps every Markdown table in
  `<div class="hc-table-scroll not-content">` and adds the `hc-table`
  class, so the docs' reference tables render as HC's own component (the
  `.not-content` wrapper is required because Starlight styles tables with
  unlayered rules that would otherwise beat the `hc-table` layer; it also
  doubles as the responsive scroll strip). Authored `<table class="hc-table">`
  demos in MDX are JSX nodes and are left untouched. Docs only.
- **Responsive audit of existing components** (no breaking changes):
  - **`hc-pagination`** now wraps onto multiple rows when its container is
    narrow (`flex-wrap: wrap`) instead of overflowing horizontally.
  - **`hc-table`** gains a `.hc-table-scroll` wrapper that confines a wide
    table to a horizontal scroll strip on small screens rather than
    pushing the page sideways. (Make the wrapper a focusable, labelled
    region — `role="region"` / `aria-label` / `tabindex="0"` — so it stays
    keyboard-reachable.)
  - **`hc-dialog` / `hc-drawer` footers** wrap their action buttons
    (`flex-wrap: wrap`) instead of overflowing on very narrow screens.

  Audit confirmed the already-responsive components need no change:
  `hc-dialog` / `hc-drawer` / `hc-command` cap their width to the viewport,
  and `hc-toolbar` / `hc-tabs` / `hc-breadcrumb` already wrap.
- Consistency renames (pre-alpha, no back-compat aliases). A library
  audit turned up three naming drifts:
  - **`confirmed` event → `hc:confirmed`.** `installConfirm` was the
    only behavior dispatching an un-namespaced event; every other one
    uses `hc:*`. Update `data-hx-trigger="confirmed"` →
    `data-hx-trigger="hc:confirmed"` (and `send confirmed` →
    `send hc:confirmed` in _hyperscript). Touches the behavior, the
    `<hc-confirm-action>` macro, all integration / recipe / component
    docs and examples.
  - **`data-hc-command-hotkey` → `data-hotkey`.** Every other
    component reads its own config from a plain `data-*`
    (`data-value`, `data-length`, `data-orientation`, …); the
    `data-hc-*` prefix is reserved for cross-component glue
    (`data-hc-confirm`, `data-hc-context-menu`,
    `data-hc-close-dialog-on-success`, …). The command hotkey is the
    component's own config, so it drops the prefix.
  - **`*-invalid-border` token → `*-error-border`.** The error-state
    border token for value-entry fields (input / select / datepicker /
    input-OTP, and checkbox / radio) was named `invalid-border` while
    the `data-variant="error"` attribute and every other component use
    `error-*`. Renamed for attribute↔token symmetry
    (`--hc-input-invalid-border` → `--hc-input-error-border`, etc.);
    `aria-invalid` still maps to the same border.
- **Docs site dogfoods HC tokens.** The Starlight chrome (header,
  sidebar, links, inline code, hairlines, accents) is now skinned with
  the generated `--hc-*` tokens via a `--sl-*` → `--hc-*` bridge in
  `apps/docs/src/styles/custom.css`. Because both Starlight and HC key
  their light/dark values on `[data-theme]`, the bridge is a single set
  of `var(--hc-*)` references; and because the navbar `data-color`
  picker re-tints `--hc-color-action-primary-*`, switching the colour
  theme now re-tints the whole docs chrome, not just the live previews.
  No library or API change.
- **Responsive design documentation.** New Fundamentals → Responsive
  design page laying out the container-first strategy (intrinsic layout
  utilities, the single viewport breakpoint in `hc-shell`, the density
  axis, and a decision table for which tool responds to container vs
  viewport width). The Kitchen sink gains a Layout & responsiveness
  section (live `hc-grid` / `hc-cluster` / `hc-sidebar`, a scaled
  `hc-shell`, and the `.hc-table-scroll` pattern), and the Fundamentals
  index links the new pages. Docs only.

### Fixed

- **`hc-field` zeroes native `<fieldset>` chrome.** When applied to a
  `<fieldset>` (the semantic grouping primitive for related radios), the
  class now resets `border` / `padding` / `margin` and sets
  `min-inline-size: 0`, so grouped radio fields no longer need a
  copy-paste `style="border:0;padding:0;margin:0;"` to suppress the default
  fieldset border, padding, and min-width.

- **Slider / progress / switch tracks and the avatar fallback darken in
  dark mode.** These last neutral surfaces hardcoded
  `primitive.color.gray.200` (and the avatar initials `gray.700`), so they
  stayed light under `[data-theme="dark"]`. The control tracks now use
  `semantic.color.border` (gray.300 in light — a touch more visible than
  before, improving the track-vs-surface non-text contrast — and gray.700
  in dark), and the avatar fallback uses `muted-bg` + `text` (initials keep
  8–15:1 contrast in both modes).

- **Status surfaces (`hc-alert` / `hc-toast` / `hc-badge`) get proper dark
  variants.** They referenced light primitive tints (`blue.50`, `green.50`,
  …) directly, so in dark mode they stayed light chips floating on the
  dark page. New `semantic.color.status.{neutral,info,success,warning,error}`
  tokens carry the light values, and the dark theme overrides them to a
  dark tint (`colour.950` background, `colour.900` border) with light text
  (`colour.200`). Backed by **completed 50–950 colour ramps** for blue /
  green / amber / red (the palette only had `50,100,500–800`). Light mode
  is unchanged.

- **Disabled form controls now darken in dark mode.** The `disabled-bg`
  of `hc-input`, `hc-select`, `hc-datepicker`, `hc-checkbox`, and
  `hc-radio` referenced `primitive.color.gray.100` directly, so a disabled
  control stayed a light box under `[data-theme="dark"]`. Routed through
  `semantic.color.muted-bg` (unchanged in light; gray.700 in dark).

- **Dark-mode hover / header surfaces no longer hide their text.** A few
  neutral backgrounds — the default button's hover, pagination's hover,
  and the table header / row-hover — referenced `primitive.color.gray.*`
  directly instead of the theme-aware `muted-bg`, so they stayed light
  under `[data-theme="dark"]` and the (light) text on top vanished (most
  visibly: hovering a default button hid its label). They now route
  through `semantic.color.muted-bg` — unchanged in light (gray.100),
  gray.700 in dark. Regression test in `nested-theme.spec.mjs`.

- **`hc-select` chevron no longer overlaps the text under RTL.** The
  chevron is painted with `background-position`, which has no logical
  (inline-start/end) keyword, so it stayed pinned to the physical right
  while `padding-inline-end` correctly reserved space on the (physical)
  left — the arrow landed on top of the right-aligned text. A
  `.hc-select:dir(rtl)` rule now flips it to the inline-end.

- **Dark mode now recolours component surfaces, not just the page chrome.**
  Component tokens that resolve through a semantic colour the dark theme
  overrides (`surface`, `text`, `border`, `muted-bg`, `action.secondary`)
  were baked once as their light value on `:root` and never re-emitted for
  `[data-theme="dark"]`, so buttons, cards, menus, the command palette,
  inputs, and item rows stayed light under dark mode while only the page
  background flipped. The token build (`build-tokens.mjs`) now treats
  `theme.dark` like the colour / density axes and re-emits every affected
  `--hc-*` component variable inside the `[data-theme="dark"]` block — the
  light value stays the `:root` default and dark overrides on top. A
  regression test in `tokens.test.mjs` locks the behaviour.

### Added

- **Form-validation depth for `hc-field`.** Native HTML constraint validation
  (`required`, `type`, `pattern`, `min`/`max`, `minlength`…) now drives the
  field UI with no per-field wiring. New CSS `:user-invalid` hooks on input /
  select / datepicker / checkbox / radio style the control invalid **only after
  the user interacts** (no JS), the field's help message follows via
  `:has(:user-invalid)`, and a required control adds an asterisk to its label
  (`--hc-field-required-color`, overridable). A new `installValidation()`
  behavior (in the auto-init `/behaviors` bundle, and exported from the main
  entry) surfaces the control's localized `validationMessage` into a
  `.hc-field__error` element, wires `aria-invalid` / `data-invalid` /
  `aria-describedby`, clears live as the user fixes the field, and replaces the
  browser's default bubble with the inline message on submit. New Field →
  Client-side validation docs; 8 Vitest + 4 Playwright tests.
- **Right-to-left (RTL) support.** The kit is built on CSS logical properties,
  so `dir="rtl"` mostly "just works"; this fills the gaps that needed genuine
  direction-awareness. The datagrid frozen column now sticks to the
  inline-start via `inset-inline-start` (was a physical `left`) with the
  freeze-line shadow flipped in RTL; the calendar prev/next chevrons mirror;
  and horizontal arrow-key navigation is mirrored in RTL for tabs, toggle
  group, datagrid cell grid, calendar, and splitter (vertical arrows
  unchanged). Docs gain a **Dir** picker in the top bar to preview the whole
  site in RTL, plus an Accessibility → Right-to-left section. 6 Playwright
  tests under `dir="rtl"`.
- **Reduced-motion coverage completed.** The controls whose only animation is
  a `transition` and that weren't already gated in their own stylesheet
  (button, checkbox, radio, input, select, datepicker, tabs, pagination,
  toggle group) now zero their `transition-duration` under
  `prefers-reduced-motion: reduce` — handled centrally in `hc.a11y.css`; the
  htmx indicator fade is gated in `hc.htmx.css`. Combined with the components
  that already self-gated, nothing in the kit animates under reduced-motion.
  New Accessibility → Reduced motion section; 2 Playwright tests under
  emulated `reducedMotion`.
- **Forced Colors / Windows High Contrast support.** A cross-component
  forced-colors stylesheet (`hc.a11y.css`, bundled into `hc.css`) re-expresses
  the patterns that break under a high-contrast theme — where the UA drops
  `box-shadow` and forces the system palette — using CSS system colours.
  Focus rings that used `box-shadow` are restored as an `outline`; selection /
  active state (combobox & command options, tabs, toggle group, pagination,
  calendar, datagrid selected rows / current cell) is marked with an inset
  `outline`; custom toggles (checkbox / radio / switch / slider thumb) opt out
  with `forced-color-adjust: none` and paint with `Highlight` / `Canvas` /
  `CanvasText`. Shipped in the components layer (last source file, no extra
  cascade layer) and exposed granularly at `@hypermedia-components/core/a11y.css`.
  New Fundamentals → Accessibility page. 6 Playwright tests under emulated
  forced-colors.
- **i18n message catalog for behaviors.** The strings behaviors inject —
  created nodes (combobox "No matches", multi-select tag remove labels) and
  default ARIA labels (shell nav toggle, splitter handle, toast region,
  calendar prev/next/grid, confirm dialog) — now route through a single
  catalog. Call `setMessages({ … })` once to translate the whole kit;
  `{name}` placeholders interpolate (e.g. `multicombobox.remove`). Per-element
  attributes still win (`data-hc-confirm-*`, `data-hc-empty`, an
  author-provided `aria-label`), so the server can localize per region.
  Exported from the main entry and a side-effect-free `./i18n` submodule
  (`setMessages` / `resetMessages` / `getMessages` / `DEFAULT_MESSAGES`).
  New Fundamentals → Internationalization (i18n) page.
- **`datagrid-pager` recipe** — server pagination for `hc-datagrid` with
  htmx: swap one page of rows into the `<tbody>` (`innerHTML`, so the
  behavior's observer re-runs and re-applies roles / sticky offsets /
  resized widths) and update the `hc-pagination` pager + status line
  out-of-band. New Recipes → Datagrid pager page plus the
  `recipes/datagrid-pager/` scaffold (recipe / expanded / contract).
- **`hc-datagrid`** — an interactive, Excel-like data grid for business
  screens, built on a semantic `<table>` and `position: sticky`.
  - **CSS layer:** multi-level sticky group/sub/leaf headers, frozen
    (sticky-left) columns with a freeze-line affordance, and styling for
    row selection (`aria-selected`), active cell (`data-active`), column
    highlight (`data-highlight`), and the inline-editing cell slot
    (`data-editing`, padding drops so an HC form control fills the cell).
    Built for **paged** data (htmx loads a page) — explicitly not a
    client-side virtual-scroll / sort / filter engine.
  - **Column resize:** mark a column with `data-resizable` + `data-col` on
    its header (and the matching `data-col` on body cells);
    `installDatagrid()` adds a draggable / keyboard-operable grip
    (`role="separator"` + `aria-valuenow`) that sets that column's width and
    clips it, leaving other columns content-sized. Emits
    `hc:datagridcolumnresize` (`{ col, width }`) for the app to persist.
  - **Vertical headers:** `data-orientation="vertical"` on a header cell
    rotates its label (`writing-mode: vertical-rl`) so a long name reads
    top-to-bottom in a narrow column instead of widening it;
    `data-orientation="sideways"` uses `sideways-lr` (whole line rotated,
    bottom-to-top — axis-label style). Override
    `--hc-datagrid-head-writing-mode` for full control. Pure CSS.
  - **`installDatagrid()` behavior:** measures the rendered header heights
    and frozen-column widths and writes the sticky offset variables
    (`--hc-datagrid-head-1-h`, per-cell `--hc-datagrid-left`),
    re-measuring on resize; applies the WAI-ARIA *grid* roles and a
    roving-tabindex keyboard model (arrows / Home / End / Ctrl+Home·End /
    Page Up·Down move the active cell; the grid is one tab stop); and
    wires row selection (Space + per-row checkbox + select-all with an
    indeterminate state), emitting `hc:datagridselectionchange`. Idempotent,
    returns an uninstaller, and picks up htmx-swapped grids/rows via
    `MutationObserver`.

  - **Expandable row detail (master/detail):** put a
    `[data-hc-datagrid-toggle]` button in a record's lead cell and a
    `.hc-datagrid__detail-row` (a `<tr>` with one `colspan` cell) holding
    **arbitrary HTML** — a nested grid, a form, a chart. `installDatagrid()`
    toggles `data-expanded` / row visibility / `aria-expanded` /
    `aria-controls` (click the +/− or `Enter`), dispatches
    `hc:datagridexpand` / `hc:datagridcollapse`, and (htmx) lazy-loads via
    `data-hx-*` on the toggle. A nested `hc-datagrid` in a detail panel is
    upgraded and operated independently (events from a nested grid are
    ignored by the outer one).
  - **Multi-row records:** render one record across several rows by
    making each record a `<tbody class="hc-datagrid__record">` of sub-rows
    (span the lead column with `rowspan`). `installDatagrid()` treats each
    record `<tbody>` as one selectable unit — its checkbox / `Space`
    selects every sub-row (`aria-selected` per row + `data-selected` on the
    tbody), select-all and `hc:datagridselectionchange` count by record,
    and the active cell's record gets `data-current` (accented lead cell).
    A thicker border separates records, a lighter one divides sub-rows;
    keyboard nav moves by sub-row (↑/↓) and cell (←/→) across both.
    Single-row grids are unchanged. New tokens
    `--hc-datagrid-subrow-border` / `-current-bg` / `-current-fg`.
  - **Overflow truncation + tooltip:** wrap a value in
    `.hc-datagrid__truncate` (with a fixed `max-inline-size` /
    `--hc-datagrid-truncate-max`) to clip it to one ellipsised line;
    `installDatagrid()` shows the full text in a single shared, styled
    tooltip on hover/focus, but only when the value is actually clipped
    (`scrollWidth > clientWidth`) — so it scales without a per-cell
    tooltip. Reuses the `--hc-tooltip-*` tokens.
  - **Inline editing:** editable cells (`data-editable` + `data-col`)
    activate on Enter / F2 / double-click / type-to-edit; the column's
    `<template data-datagrid-editor>` is cloned into the cell, reusing
    existing HC controls (text → `hc-input`, date → `hc-input[type=date]`,
    select → `hc-select`, searchable → `hc-combobox`, whose `popover`
    listbox escapes the scroll clip). Commit on Enter / blur / combobox
    pick writes the value back and dispatches `hc:datagridedit`
    (`{ cell, col, value, label, oldValue }`) for htmx to persist; Escape
    cancels. No bespoke editor engine.

    Colours come from the shared tokens. New Components → Datagrid docs
    page; Vitest unit + Playwright coverage (sticky header / frozen
    columns / corner pinning via the behavior's auto-measurement, header
    stacking, keyboard navigation, selection, select-all, text/select/
    combobox editing, and axe).
- **`hc-shell`** — a full-viewport application shell for business apps:
  a persistent sidebar, header, scrolling main region, and optional aside
  (third column, added via `:has()`) and footer, on a CSS Grid with
  `grid-template-areas` and `100dvh`. The layout is pure CSS. The one
  behavior, `installShell()`, powers only the **mobile** navigation
  overlay (below a `60rem` breakpoint the sidebar becomes a fixed
  off-canvas panel): it toggles `data-sidebar` from a
  `[data-hc-shell-toggle]` button, keeps `aria-expanded` / `aria-controls`
  in sync, moves focus into the sidebar and traps `Tab`, and closes on
  `Escape` / scrim click / nav-link activation while restoring focus —
  force-closing when the viewport returns to desktop. Idempotent, returns
  an uninstaller, and picks up htmx-swapped shells via `MutationObserver`.
  Layout knobs: `--hc-shell-sidebar-width` / `--hc-shell-aside-width` /
  `--hc-shell-pad`. New Components → Shell docs page; Vitest unit coverage
  for the behavior and Playwright coverage for the desktop grid, the
  mobile overlay (open / focus move / Tab trap / Escape / scrim), and axe
  scans in both states.
- **Layout utilities** (`hc.utilities` cascade layer, plan §10.4). The
  previously reserved layer is now populated with a small, semantic set
  of *intrinsically responsive* layout primitives — no breakpoints, no
  media queries: `.hc-stack` (vertical rhythm), `.hc-cluster` (wrapping
  row), `.hc-grid` (auto-fill responsive grid), `.hc-container` (centred
  well), `.hc-sidebar` (sidebar + main that wraps by container width),
  plus the `.hc-sr-only` and `.hc-hidden` helpers. Each exposes
  token-based tuning knobs (`--hc-stack-gap`, `--hc-grid-min`, …). They
  are bundled into `hc.css` / `hc.min.css` and available granularly via
  the new `@hypermedia-components/core/css/utilities` export. These are
  the responsive foundation the forthcoming `hc-shell` builds on. New
  Fundamentals → Layout utilities docs page; Playwright coverage for
  display modes, responsive wrap/collapse, sr-only, and an axe scan.
- Unified the `data-variant` vocabulary across form controls so every
  field speaks the same `success` / `warning` / `error` language
  (closing inconsistencies that had crept in as controls were added
  piecemeal):
  - **`hc-input` / `<textarea>`** gain `data-variant="success" |
    "warning" | "error"` border-colour cues (previously error-only via
    `aria-invalid`), matching `hc-select` / `hc-datepicker`. New
    `input.success-border` / `input.warning-border` tokens.
  - **`hc-switch`** gains the missing `data-variant="warning"` (it had
    only `success` / `error`), so it matches checkbox / radio. New
    `switch.warning-checked-bg` token.
  - **`hc-inputotp`** gains `data-variant="success" | "warning"` slot-
    border cues alongside its existing error / `aria-invalid` state.
    New `inputotp.success-border` / `inputotp.warning-border` tokens.
  - **Combobox / multicombobox** inherit the trio through their inner
    `.hc-input` (set `data-variant` on the input / control) — no new
    code.

  For value-entry fields, `error` remains best expressed with the
  native `aria-invalid="true"` (the accessible hook); `data-variant`
  is the visual-only shorthand and the only way to express
  `success` / `warning`. `tokens/variants.mdx` is rewritten as a
  complete matrix covering every form control with the two rationales
  (validation cue for value-entry fields, semantic intent for choice
  controls), and the input / switch / input-OTP component pages document
  the variants. New Playwright `input.spec.mjs` (5 cases) plus
  `warning` / variant-border cases added to the switch and input-OTP
  specs.

- Docs: _hyperscript "receiving" guidance. The interactive components
  keep their internals in the vanilla behaviors (one tested, accessible
  WAI-ARIA implementation) but expose bubbling `hc:*` events; the
  `integrations/hyperscript.mdx` page gains a **Reacting to component
  events** section tabulating every event (`hc:menuselect`,
  `hc:comboboxselect`, `hc:multicomboboxchange`, `hc:commandselect`,
  `hc:calendarchange`, `hc:otpchange` / `hc:otpcomplete`,
  `hc:splitterchange`, `hc:togglegroupchange`, `hc:tabactivated`) with
  inline `_="on hc:…"` handlers, and notes the same events drive htmx
  via `data-hx-trigger`. Each of the event-emitting components added
  this cycle (calendar, command, input OTP, toggle group, splitter,
  context menu) gains a short **Hyperscript** snippet linking to it.

- Build optimization & granular imports (plan §5.4). Three consumption
  shapes so consumers pay only for what they use:
  - **Per-component CSS**: new `./css/*` exports (e.g. `./css/button` →
    `dist/hc-button.css`) plus a shared `./css/core` (`hc.core.css` =
    layer declaration + core tokens + base). Load `css/core` once, then
    only the component CSS you use. A ~6-component app drops from the
    ~26–62 KB-gzip full payload to roughly ~20 KB.
  - **Per-theme-axis token files**: `build-tokens.mjs` now also emits
    `hc.tokens.core.css` (semantic + default colour/density + dark) and
    one file per non-default axis (`hc.tokens.color-indigo.css`,
    `…-emerald/-rose/-amber`, `…density-compact/-dense`), exposed via
    `./tokens.*.css`. Apps load only the runtime axes they switch, and
    authors get a template for custom axes. `hc.tokens.css` (full)
    stays a concatenation of these.
  - **Minified single-file bundles** via a new `esbuild` devDependency +
    `scripts/minify.mjs` (`build:min` step): `hc.min.css`
    (30.6 → **14.1 KB gzip**), `hc.core.min.css` (**4.0 KB**),
    `hc.behaviors.min.js` (31.5 → **12.1 KB gzip**, bundled so the
    relative-import graph is no longer exposed to consumers),
    `hc.min.js`, and `macros/index.min.js`. The script prints a
    raw/min/gzip size report. (Minification helps unusually much here
    because it strips the source's doc comments, which gzip only
    partially compresses.)

  All new `exports` are additive — `.`, `./css`, `./behaviors`,
  `./macros` are unchanged — adding `./min`, `./css/min`, `./css/core`,
  `./css/core/min`, `./css/*`, `./tokens.*.css`, `./behaviors/min`,
  `./macros/min`; `sideEffects` lists the minified behaviors bundle. The
  per-file ESM + per-component CSS stay the primary tree-shakeable
  surface; the bundles are for CDN / import-map / no-bundler use. New
  docs page `reference/size.mdx` documents the size baseline and the
  full / granular / native-ESM-import-map shapes (including an
  `importmap-rails` recipe and a caching-tradeoff note). Two new Vitest
  cases cover the per-axis vs core token emission.

- Docs **Kitchen sink** page (`apps/docs/src/content/docs/kitchen-sink.mdx`)
  — every component rendered live on one page, grouped (Actions, Form
  controls, Navigation, Overlays, Feedback & status, Layout & data),
  with each heading linking to the component's full docs. Interactive
  components run their real behaviors (the docs site loads the behaviors
  bundle), so menus, the command palette, the splitter, the OTP field,
  etc. are all operable. Added a top-level "Kitchen sink" sidebar entry
  and a link from the Components index.

- `hc-scroll-area` component — pure CSS scrollable region with thin,
  themed scrollbars (shadcn `ScrollArea` equivalent), no JavaScript.
  Uses the **standard** CSS Scrollbars module (`scrollbar-width: thin`
  + `scrollbar-color`, Baseline 2025) rather than the non-standard
  `::-webkit-scrollbar` pseudo-elements (Firefox never supported them,
  and a set `scrollbar-color` overrides them anyway). The thumb darkens
  to `scroll-area.thumb-hover` on hover (the property cascades live, no
  JS). `data-orientation` selects the scroll axis — `vertical`
  (default), `horizontal`, or `both` — and `overscroll-behavior:
  contain` stops scroll chaining to the page. New
  `scroll-area.{thumb, thumb-hover, track}` tokens. Documented markup
  contract: a scrollable region must be keyboard-focusable, so add
  `tabindex="0"` (plus `role="region"` + `aria-label` when it's a
  meaningful landmark) — CSS can't add it, and axe's
  `scrollable-region-focusable` rule requires it. Playwright spec (5
  cases): the thin themed scrollbar (computed `scrollbar-width` /
  `scrollbar-color`), vertical block-axis overflow, horizontal
  inline-axis overflow, programmatic scrolling, and an axe-core scan.

  Out of scope (deferred): fully custom JS overlay scrollbars,
  scroll-edge fade / shadow, scroll-to buttons, and `::-webkit-scrollbar`
  rounded-thumb styling.

- `hc-splitter` component + `installSplitter` behavior. Resizable panels
  with a draggable handle (shadcn `Resizable` equivalent), following the
  WAI-ARIA **Window Splitter** pattern — closes the focusable-splitter
  deferral noted when `hc-separator` shipped. Two `.hc-splitter__panel`
  panes are split by a `.hc-splitter__handle` that becomes a focusable
  `role="separator"` with `aria-valuenow` / `aria-valuemin` /
  `aria-valuemax` tracking the primary pane's size (percent),
  `aria-controls` pointing at it, and `aria-orientation` set
  automatically (a side-by-side split uses a `vertical` separator line,
  and vice-versa). Layout is plain flexbox driven by a single
  `--hc-splitter-pos` custom property. Pointer drag (handled at the
  document level so a fast drag still tracks) and keyboard resize
  (`←`/`→` or `↑`/`↓` by `data-step`, `Home`/`End` to min/max) both
  clamp to `data-min` / `data-max`. Config: `data-orientation`
  (`horizontal` default / `vertical`), `data-value` (initial %, default
  50), `data-min` / `data-max` (default 10 / 90), `data-step` (default
  5). Each change dispatches a bubbling `hc:splitterchange`
  (`detail { value, orientation }`). New `splitter.*` tokens (handle
  size / bg / hover, grip bar incl. themed active colour). Vitest spec
  (10 cases) covers ARIA wiring, `data-value`/`min`/`max`, arrow-step
  resize + custom-property sync, min/max clamp + Home/End, the change
  event, vertical-orientation key mapping, a mocked-rect pointer drag,
  uninstall, and MutationObserver. Playwright spec (5 cases incl.
  axe-core scan) covers the separator semantics, keyboard resize (with
  pane-width assertion), Home/End, a real handle drag, and a11y.

  Out of scope (deferred): three-or-more panes, collapse / expand
  toggling, persistence (`localStorage`), nested splitters, and
  pixel-based minimums.

- `hc-inputotp` component + `installInputOtp` behavior. A segmented
  one-time-code field (shadcn `InputOTP` equivalent) built on the
  accessible **single-input** approach: one real
  `<input autocomplete="one-time-code">` captures all typing, paste,
  SMS autofill, and selection, and the behavior overlays it
  transparently (transparent text + caret) and renders N decorative
  `aria-hidden` slots that mirror the value — avoiding the
  screen-reader and paste problems of the "one input per digit"
  pattern. Config via `data-length` (slot count, default 6; also sets
  `maxlength`) and `data-pattern` (allowed-character class, default
  `[0-9]`; non-matching characters are stripped on input). The behavior
  also fills in `inputmode="numeric"`, `autocomplete="one-time-code"`,
  and `type="text"` when omitted. The active slot's border (shown only
  while focused) doubles as the focus indicator and carries a blinking
  caret that respects `prefers-reduced-motion`. `aria-invalid` (on the
  input) / `data-invalid` (on the container) draws the error border;
  `disabled` mutes the slots. Events bubble from the container:
  `hc:otpchange` (`detail { value, input }`) on every edit and
  `hc:otpcomplete` when every slot is filled — pair with
  `data-hx-trigger="hc:otpcomplete"` to auto-submit. The value lives in
  a single named `<input>`, so it serialises in a form with no hidden
  fields. New `inputotp.*` tokens (gap, slot size, chrome, themed
  active-border / caret-color, invalid / disabled). Vitest spec (12
  cases) covers slot rendering + maxlength, custom length, autofill
  attribute defaults, character mirroring, numeric + custom pattern
  filtering, the focused-only active slot, change / complete events,
  pre-filled seeding, uninstall, MutationObserver. Playwright spec (6
  cases incl. axe-core scan) covers rendering, typing + active caret,
  pattern stripping, the complete event, the invalid border, and a11y.

  Out of scope (deferred): group separators (e.g. `3-3`), per-slot
  click caret placement, and RTL fine-tuning.

- `hc-calendar` component + `installCalendar` behavior. A styled,
  inline month-grid date picker (shadcn `Calendar` equivalent) —
  closes the `hc-calendar` deferral noted when `hc-datepicker` shipped.
  `installCalendar()` renders the grid into a `.hc-calendar` container
  (you author only the container + `data-*` config) following the
  WAI-ARIA APG date-picker pattern: a `role="grid"` `<table>` with
  `<td role="gridcell">` day cells managed by a roving tabindex, an
  `aria-live` month title, `aria-selected` on the chosen day, and
  `aria-disabled` for out-of-range days. Keyboard: `←`/`→` ±1 day,
  `↑`/`↓` ±1 week, `Home`/`End` week edges, `PageUp`/`PageDown` ±1
  month, `Shift`+`PageUp`/`PageDown` ±1 year, `Enter`/`Space` select;
  crossing a month edge re-renders the adjacent month with the target
  day focused. Config via `data-value` (ISO, also sets the displayed
  month), `data-min`/`data-max`, `data-first-day` (`0`=Sunday default …
  `6`), `data-locale`, and `data-name` (maintains a hidden `<input>` so
  it serialises in a form). Month / weekday names come from
  `Intl.DateTimeFormat`; the first day of the week is `data-first-day`
  rather than `Intl.Locale`'s `getWeekInfo()` (not yet Baseline).
  Selecting dispatches a bubbling `hc:calendarchange`
  (`detail { value: 'YYYY-MM-DD', date: Date }`) and syncs `data-value`.
  New `calendar.*` tokens (surface, title, nav buttons, weekday header,
  day cells incl. the themed `day-selected-bg`, today ring, outside /
  disabled). Vitest spec (15 cases) covers grid render, weekday order
  per `data-first-day`, selection (aria-selected / data-value / hidden
  input / event), prev/next buttons, arrow nav + month crossing,
  PageDown / Shift+PageDown, Home/End, min/max disable + refusal,
  today / outside markers, uninstall, MutationObserver. Playwright
  spec (7 cases incl. axe-core scan) covers render, click select +
  event, keyboard month crossing, PageDown, the next button, min/max
  disabled, and a11y.

  hc-datepicker (the native `<input type="date">` skin) remains the
  no-JS baseline; hc-calendar is the opt-in styled grid. Out of scope
  (deferred): range selection, multiple months side by side, month /
  year dropdown pickers, week numbers, time, non-Gregorian calendars,
  and an input-attached combobox variant.

- `hc-command` component + `installCommand` behavior. A command palette
  (shadcn `Command` / `cmdk` equivalent): the WAI-ARIA combobox pattern
  used as an action launcher. An `<input role="combobox">` filters a
  `role="listbox"` of `role="option"` items grouped under `role="group"`
  headings (the cmdk / Radix `<div>` structure — not `<ul>/<li>`, which
  axe rejects `role="group"` on). `installCommand()` wires the
  case-insensitive substring filter (matching each item's label, with
  the `.hc-command__shortcut` text excluded), hides groups whose items
  all filter out, toggles a `.hc-command__empty` state, and drives
  `aria-activedescendant` keyboard navigation (`↓`/`↑` wrap and skip
  disabled, `Home`/`End`, `Enter` runs the active item) with DOM focus
  staying on the input. Selecting dispatches a bubbling
  `hc:commandselect` (`detail { item, value, command }`, `value` from
  `data-value`) and, inside a `<dialog>`, closes it. Optional ⌘K opener:
  `data-hotkey="k"` (any key, default `k`) on the dialog
  toggles it with Cmd/Ctrl + key (`preventDefault` so the browser's own
  shortcut doesn't also fire), focusing the input and resetting the
  filter on open; the filter also resets on dialog `close`. Used inside
  a native `<dialog class="hc-command-dialog">` it inherits focus
  trapping, Escape-to-close, and a backdrop; works inline too. New
  `command.*` tokens (surface, input, list, group heading, item +
  `item-active-bg` highlight that tracks `data-color`, shortcut chip,
  empty state, dialog width / offset / backdrop). Vitest spec (13
  cases) covers initial highlight, label filter + group hide + empty
  state, shortcut excluded from match, arrow wrap + disabled-skip,
  Home/End, Enter select + event detail + dialog close, click select +
  disabled no-op, ⌘K toggle + input focus, filter reset on close,
  uninstall cleanup, MutationObserver pickup. Playwright spec (8 cases
  incl. axe-core scan in the open state) covers ⌘K open + focus,
  filtering + group hiding, empty state, Arrow+Enter and click select,
  the shortcut chip, and Escape close.

  Out of scope (deferred): async / server-supplied commands, nested
  "pages", fuzzy ranking, recent / frequency ordering, multi-key
  chords.

- `hc-context-menu` — right-click / keyboard context menu built on the
  existing `hc-menu` surface (shadcn `ContextMenu` equivalent), via the
  new `installContextMenu` behavior. **No new CSS**: it reuses
  `.hc-menu` and all its items / separators / labels / `menuitemcheckbox`
  / `menuitemradio`, opening at the pointer instead of anchored to a
  trigger. A region carries `data-hc-context-menu="<menu-id>"` pointing
  at a `.hc-menu` popover. On `contextmenu` (right-click, long-press, or
  the keyboard Menu key) the native menu is suppressed
  (`preventDefault`) and the popover opens at the pointer, clamped to
  the viewport. `Shift`+`F10` is handled separately via `keydown`
  because — unlike the Menu key — it does not fire a `contextmenu`
  event; it opens the menu at the focused element. Once open, navigation
  (Arrow / Home / End / type-ahead / Tab) and selection
  (`menuitemcheckbox` / `menuitemradio` toggling, the bubbling
  `hc:menuselect` event) are shared with the dropdown menu; the event
  detail adds `contextTarget` (the right-clicked element). Escape /
  outside-click dismissal and focus restoration are the native
  `popover` behaviour. Documented caveat: Firefox's Shift+right-click
  bypasses the `contextmenu` event and shows the browser's own menu.

  The shared menu interaction logic (item queries, roving-focus
  movement, type-ahead, the keyboard handler, and the
  checkbox / radio + `hc:menuselect` selection) was extracted from
  `menu.js` into a new internal `menu-core.js` module that both
  `installMenu` and `installContextMenu` consume, so the two surfaces
  stay in lockstep. `installMenu`'s public behaviour is unchanged
  (all 23 existing menu Vitest + 10 Playwright cases still pass).
  Vitest spec (11 cases): idempotency, open + `preventDefault`, pointer
  positioning, first-item focus, `Shift`+`F10` (and plain `F10` no-op),
  arrow / End navigation with disabled-skip, menuitem select +
  `contextTarget` detail + close, checkbox toggle keeps open, missing-id
  no-op, uninstall cleanup, MutationObserver pickup. Playwright spec
  (7 cases incl. axe-core scan in the open state) covers real
  right-click, pointer coordinates, `Shift`+`F10` + Escape focus
  restoration, keyboard nav, and selection.

  Out of scope (deferred): nested submenus, stacked context menus,
  touch long-press tuning.

- `hc-separator` component — pure CSS divider line, no JavaScript.
  Apply `.hc-separator` to a native `<hr>`: the element already carries
  the implicit `role="separator"` + `aria-orientation="horizontal"`
  semantics, so the component only replaces the UA chrome with a single
  hairline drawn from a token. `data-orientation="horizontal"`
  (default) is a full-width line with block margin;
  `data-orientation="vertical"` is an inline line that stretches to its
  flex row's height (via `align-self: stretch`, with a `min-block-size`
  fallback) and takes inline margin — for toolbars and link rows. Since
  there is no HTML element for a vertical separator, the docs flag that
  `aria-orientation="vertical"` must be added by hand to keep the
  semantics right. New tokens `separator.{color, size, spacing}`
  (`color` defaults to the border token). Playwright spec (5 cases):
  the implicit separator role, the thin full-width horizontal line, the
  taller-than-wide vertical line, the border-token colour, and an
  axe-core scan.

  Out of scope (deferred): a focusable resize splitter
  (`aria-valuenow`), labelled separators, and a decorative
  `role="none"` toggle.

- `hc-toggle-group` component + `installToggleGroup` behavior. A
  connected row of two-state toggle buttons (shadcn `ToggleGroup`
  equivalent) with two selection modes selected by `data-type` on the
  group and reflected by the ARIA roles on the buttons:
  - `data-type="single"` (default) — exclusive. Per the WAI-ARIA APG,
    an exclusive set of toggles is a **radio group**, so the markup is
    `role="radiogroup"` + `role="radio"` / `aria-checked`. Selection
    follows focus (arrow keys move and select) and a click can never
    empty the group (radio semantics).
  - `data-type="multiple"` — independent toggles: `role="group"` +
    `aria-pressed`. Arrow keys move focus only; Space / Enter / click
    toggle the focused button on and off.

  Both modes use a roving tabindex so the group is a single `Tab`
  stop, wrap at the ends, and skip disabled buttons (`disabled` or
  `aria-disabled="true"`). Space / Enter are left to the native
  `<button>` (which synthesise a click), so the behavior only binds
  Arrow / Home / End — no double-firing. Each change dispatches a
  bubbling `hc:togglegroupchange` (`detail` carries `value` for single
  or `values` + `pressed` for multiple, read from each button's
  `data-value`). Optional form integration: `data-name="X"` makes the
  behavior maintain hidden inputs (one for single, one per pressed
  value for multiple) so the group serialises like a native control.

  CSS is a connected segmented-control skin — shared inner borders
  collapse to a hairline, outer corners round via `:first/:last-of-type`
  (so the injected hidden-input `<span>` does not steal the last
  toggle's radius), and the selected / pressed state lifts above its
  neighbours with an accent background + border that track the active
  `data-color` theme through `{semantic.color.action.primary-soft.bg}`
  / `{...primary.border}`. Sizes `data-size="sm" | "md" | "lg"` draw
  from the shared `--hc-control-*` scale (density-aware). New tokens
  `toggle.{height, padding-x, radius, font-size, font-weight, fg, bg,
  border, hover-bg, hover-fg, on-bg, on-fg, on-border, disabled-fg,
  disabled-bg, sm.*, lg.*}`, all `{ref}` so the overlay machinery
  handles theming. Vitest spec (14 cases) covers idempotency, single
  roving-tabindex / exclusive select / no-op on already-checked /
  arrow select+skip-disabled / Home / End, multiple toggle + arrow
  moves focus only, the event detail shape, the `data-name` hidden
  inputs for both modes, the `:last-of-type` invariant with the hidden
  container present, uninstall cleanup, and MutationObserver pickup.
  Playwright spec (9 cases incl. axe-core scan) exercises the roles,
  keyboard, accent border, and sizing in a real browser.

  Out of scope (deferred): vertical orientation (`data-orientation`),
  a default/outline variant axis, and free deselect in single mode
  (radio semantics intentionally keep the group non-empty).

- `hc-skeleton` component — pure CSS loading placeholder, no
  JavaScript. Apply `.hc-skeleton` to any element and size it from the
  consumer side; the component supplies the surface colour, corner
  radius, and animation. The base surface is `var(--hc-color-muted-bg)`
  so it adapts to light / dark mode through the existing `data-theme`
  cascade with no per-mode overrides. Two axes:
  `data-animation="pulse" (default) | "wave" | "none"` — pulse fades
  the block (shadcn's `animate-pulse`), wave sweeps a lighter highlight
  band whose colour is derived from the base via `color-mix()` (so it
  tracks the active theme), none is static; and
  `data-shape="rect" (default) | "text" | "circle"` — rect uses the
  medium radius, text is a `1em` line with a tighter radius, circle is
  fully rounded with `aspect-ratio: 1` for avatar / icon slots. Both
  animations collapse to a flat static block under
  `prefers-reduced-motion: reduce`. New tokens
  `skeleton.{bg, highlight, radius, text-radius, text-height,
  pulse-duration, wave-duration}`. Recommended a11y pattern documented:
  mark the loading region with `role="status"` + `aria-busy="true"` +
  an accessible name rather than annotating each decorative block.
  Playwright spec (8 cases) covers the muted base colour, the pulse /
  wave / none animation-name swap, the circle / text shape radii, the
  `prefers-reduced-motion` suppression (via `emulateMedia`), and an
  axe-core scan.

  Out of scope (deferred): row-count auto-generation helper,
  image / table-specific presets, and a skeleton→content swap behavior
  (the consumer drives the swap via htmx or a re-render).

- `hc-datepicker` component — pure CSS skin over a native `<input>`
  whose `type` is `date`, `datetime-local`, `month`, or `time`. The
  native input keeps every accessible behaviour (keyboard
  navigation across year / month / day spinners, the OS-native
  calendar / time picker on mobile, form submission, `min` / `max`
  / `step` validation, locale-aware rendering); only the closed-
  state chrome is replaced via `appearance: none` and an embedded
  SVG icon (calendar for date / datetime / month, clock for time).
  The WebKit native indicator is hidden so a single visible icon
  reads consistently across engines; clicks anywhere on the input
  still open the picker. Same axes as the other form controls —
  `data-variant="success" | "warning" | "error"` for border-colour
  cues, `data-size="sm" | "md" | "lg"` driven from the shared
  `--hc-control-*` scale (so `data-density="compact"` shrinks
  consistently), `:disabled` / `aria-invalid` states. New
  `datepicker.{height, padding-x, radius, font-size, bg, fg,
  border, focus-border, error-border, success-border,
  warning-border, disabled-bg, icon-size, sm.*, lg.*}` tokens, all
  `{ref}` so the overlay machinery handles theming. Playwright
  spec (10 cases) covers the native `type` attribute and form
  value, both calendar and clock SVG icons, focus ring, error /
  success variant borders, disabled state, sm / lg sizing, native
  `change` event firing, and an axe-core scan.

  Out of scope (deferred): fully-styled calendar grid (a future
  `hc-calendar` component for cases that need design-system-
  consistent month UI), preset shortcuts ("Last 7 days"), Japanese
  imperial-era / Buddhist calendar (browser handles via locale),
  multi-thumb date range (use two adjacent inputs with linked
  `min` / `max` per the documented pattern).

- `hc-hovercard` component + `installHovercard` behavior. Richer-
  content sibling of `hc-tooltip` for previews that need an avatar,
  title and subtitle, paragraph description, or interactive links
  (GitHub-style `@user` mention previews, issue ID previews, page
  link previews). Trigger references the card via
  `aria-describedby`, same as tooltip. Built on the same
  primitives — HTML `popover` (still `manual` because Safari has
  no `popover="hint"` support as of 2026-05), CSS Anchor
  Positioning, JS positioning fallback. Three behavioural
  differences from tooltip:
  - the card receives pointer events so users can move the cursor
    in and click links inside;
  - the behavior tracks hover state on **both the trigger and the
    card** — the card stays open while either is hovered, so the
    short cursor traversal between them does not dismiss it;
  - show / hide delays are longer (500 ms / 200 ms) for the
    reading-card UX.

  Focus on the trigger shows the card immediately (a11y); Escape
  on either trigger or card hides it. CSS layout is
  `.hc-hovercard__header` (with `.hc-hovercard__title` /
  `.hc-hovercard__subtitle`), `.hc-hovercard__body`, optional
  `.hc-hovercard__footer`. New tokens
  `hovercard.{bg, fg, border, radius, max-width, padding, gap,
  offset, title-weight, subtitle-fg, subtitle-size}`, all `{ref}`.

  Vitest spec (12 cases) covers idempotency, auto-attribution,
  show delay, immediate focus open, hide grace period, hover-into-
  card cancellation of the hide timer, hover-out-of-card schedules
  hide, Escape closes, mouseleave during show delay cancels,
  no-id no-op, uninstall cleanup, MutationObserver pickup.
  Playwright spec (6 cases incl. axe-core scan) exercises the
  real popover algorithm and the cursor-into-card path.

- `hc-drawer` component + `installDrawer` behavior. Slide-in side
  panel styled over the native `<dialog>` element. The native
  dialog gives us focus trapping, `Escape`-to-close, and the
  `::backdrop` layer; HC adds edge positioning (`data-side="right"`
  default, plus `"left"`, `"top"`, `"bottom"`) and CSS-only slide
  animation via `@starting-style` + `transition-behavior:
  allow-discrete` on `display` + `overlay`. The slide animation
  respects `prefers-reduced-motion: reduce`. `installDrawer()`
  adds exactly one thing the platform does not give us: clicking
  the backdrop (outside the drawer panel) closes it — detected via
  `event.target === dialog`. Everything else stays native, so
  `<form method="dialog">` close buttons need zero JS. Vitest spec
  (5 cases) covers idempotency, backdrop-click closes, inside-body
  click does NOT close, uninstall cleanup, and MutationObserver
  pickup. Playwright spec (8 cases incl. axe-core scan in the
  open state) checks both right and bottom anchors via bounding
  boxes, the native dialog close affordances (Escape and the form
  submit), and the backdrop-click behavior.

  Out of scope (deferred): swipe-to-close gesture, resizable
  drawers, stacked drawers, non-modal `show()` mode.

- `hc-multicombobox` component + `installMulticombobox` behavior.
  Multi-select combobox with a tag-input control: selected values
  render as inline chips inside a single visual surface, the
  filter input sits next to them, the listbox carries
  `aria-multiselectable="true"` and stays open after each pick.
  Architectural primitives are the same as `hc-combobox` (WAI-ARIA
  1.2 combobox, HTML `popover`, CSS Anchor Positioning,
  `aria-activedescendant` highlight with DOM focus on the input)
  plus tag chip + Backspace-removes-last-tag semantics.
  `installMulticombobox()` seeds tags from any
  `aria-selected="true"` options at install time (SSR-friendly),
  wires the full keyboard contract (↓/↑/Home/End/Enter/Backspace/
  Escape/Tab), runs the case-insensitive substring filter with a
  `.hc-multicombobox__empty` placeholder, and toggles selection on
  click + Enter without closing the listbox. Each tag is a focusable
  `<button>` with `aria-label="Remove …"` so screen-reader users can
  land on it and trigger removal. Optional form integration: setting
  `data-name="X"` on the wrapper makes the behavior write one
  `<input type="hidden" name="X" value="…">` per selected value, so
  the form serialises like a native `<select multiple name="X">`.
  Every state change dispatches `hc:multicomboboxchange` with
  `detail.{values, added, removed, input}`. New
  `multicombobox.{control, input, tag, listbox, option, empty-fg}`
  tokens, all `{ref}`. Vitest spec (14 cases) covers idempotency,
  SSR seeding, toggle semantics, Backspace-removes-tag (and the
  with-text negative case), disabled-skip, filter, the change
  event detail shape, Escape preserves selections, uninstall
  cleanup, opt-in hidden-input creation only when `data-name` is
  set, and MutationObserver pickup. Playwright spec (8 cases incl.
  axe-core scan in the open state).

  Out of scope (deferred): free-input create-on-Enter, drag
  reorder, async loading helper, rich option rendering with
  icons / descriptions.

- `hc-combobox` component + `installCombobox` behavior. Accessible
  single-select with type-to-filter, following the WAI-ARIA 1.2
  combobox pattern: the `<input>` carries `role="combobox"` and the
  dropdown is a `<ul role="listbox" popover>`. Keyboard navigation
  uses `aria-activedescendant` so the visible highlight moves with
  the user's selection while DOM focus stays on the input (the
  type-ahead anchor). Same architectural primitives as `hc-menu` and
  `hc-tooltip` — HTML `popover` attribute for show / hide + Escape +
  outside dismiss, CSS Anchor Positioning for placement under the
  input, JS positioning fallback for browsers without anchor support.
  `installCombobox()` wires ARIA (`aria-haspopup`, `aria-autocomplete`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`),
  auto-sets `popover="manual"` and the anchor name pair, runs the
  case-insensitive substring filter on every input keystroke,
  manages `↓ / ↑ / Home / End / Enter / Escape / Tab`, dispatches
  `hc:comboboxselect` with `{ value, label, option, input }`, and
  inserts a `.hc-combobox__empty` `<li role="presentation">` placeholder
  when the filter yields nothing. `aria-disabled="true"` options are
  skipped by both keyboard nav and click selection. New tokens
  `combobox.{listbox.{bg, fg, border, radius, max-height,
  padding-block, min-width, offset}, option.{padding-x, padding-y,
  font-size, fg, hover-bg, active-bg, selected-bg, selected-fg,
  disabled-fg}, empty-fg}`, all `{ref}` so the overlay machinery
  handles theming. Vitest spec (12 cases): idempotency, ARIA wiring,
  focus opens, substring filter, arrow keys + disabled skip, Home /
  End, Enter select + event detail + input update, click select,
  Escape no-op on value, empty-marker insertion, uninstall cleanup,
  MutationObserver pickup. Playwright spec (9 cases incl. axe-core
  scan in the open state).

  Out of scope (deferred): multi-select (will ship as
  `hc-multicombobox`), built-in async loading helper (htmx pattern
  documented), strict / free-input mode toggle, rich option
  rendering with icons or descriptions.

- `hc-slider` component + `installSlider` behavior. Pure CSS skin
  over a native `<input type="range">` with a tiny JS shim. The
  native input retains every accessible behaviour (←/→/Home/End/
  PageUp/PageDown, form participation, screen-reader role + value);
  only the visual chrome is replaced via `appearance: none` plus
  per-vendor pseudo-elements (`::-webkit-slider-runnable-track`,
  `::-webkit-slider-thumb`, `::-moz-range-track`,
  `::-moz-range-thumb`, `::-moz-range-progress`).

  The 0→value portion of the track is filled differently per
  engine: Firefox uses the native `::-moz-range-progress` pseudo;
  WebKit / Chromium have no equivalent so the same effect is
  painted by a `linear-gradient` that reads a `--hc-slider-value`
  custom property (0-100 percentage). `installSlider()` keeps
  `--hc-slider-value` synchronised with each slider's current
  value via the `input` event — call it once and forget. Server-
  rendered pages can set the property directly via
  `style="--hc-slider-value: N"` so the fill renders correctly on
  first paint before JS loads.

  Variants: `data-variant="success" | "warning" | "error"`
  recolour the fill (both engines) and the thumb border. Sizes:
  `data-size="sm" | "md" | "lg"` scale track-height and thumb-size
  together. Disabled state lowers opacity and recolours the thumb
  border. Focus ring on the thumb via `--hc-color-focus-ring`.

  Vitest spec (8 cases): idempotency, initial value sync,
  `input`-event sync, non-zero min/max percent mapping,
  out-of-range clamping, degenerate min===max fallback, uninstall
  cleanup, MutationObserver pickup. Playwright spec (8 cases):
  native role + attributes, initial `--hc-slider-value`, keyboard
  + JS-driven updates, Home/End full-native traversal, sm vs lg
  sizing, disabled state, axe-core scan over six labelled
  instances.

  Multi-thumb range pickers (price-range, brightness-span) are out
  of scope — a native `<input type="range">` is single-thumb and
  that pattern requires a custom DOM shell. Two adjacent sliders
  with linked validation is the documented workaround.

- `hc-progress` component — pure CSS skin over a native
  `<progress>` element. The native element retains its
  `role="progressbar"` semantics and `value` / `max` attribute
  pair; only the visual chrome is replaced via `appearance: none`
  and per-vendor pseudo-elements (`::-webkit-progress-bar`,
  `::-webkit-progress-value`, `::-moz-progress-bar`). Determinate
  mode (with `value`) shows a smooth fill transition between
  states; indeterminate mode (no `value`) renders a CSS-only
  sliding gradient via a keyframe animation that respects
  `prefers-reduced-motion: reduce`. Variants:
  `data-variant="success" | "warning" | "error"` recolour every
  vendor pseudo. Sizes: `data-size="sm" | "md" | "lg"`. New
  tokens `progress.{height, radius, bg, fill, success-fill,
  warning-fill, error-fill, transition-duration,
  indeterminate-duration, sm.height, lg.height}`, all `{ref}` so
  theming flows through. Playwright spec (7 cases): native
  progressbar semantics + value attributes, default fill colour
  via `currentColor`, success / error variant fills, sm vs lg
  heights, indeterminate animation-name assertion, and an
  axe-core scan over seven labelled instances.
- `hc-avatar` component — pure CSS, no JavaScript. Apply
  `.hc-avatar` to an `<img>` for a photo avatar or to a `<span>`
  for an initials fallback when no image is available; both share
  the same circular surface, sizes, and shape variants. Image
  paths use `object-fit: cover` + `overflow: hidden` so any
  aspect ratio renders as a centred square crop. Sizes:
  `data-size="xs" | "sm" | "md" | "lg" | "xl"`. Shape:
  `data-shape="circle"` (default) / `"square"`. New
  `.hc-avatar-group` wrapper overlaps a row of avatars with a
  negative margin pull-back and a ring matching the page
  background, so trail-of-N patterns read cleanly. Tokens
  `avatar.{size, radius, square-radius, bg, fg, border, font-size,
  font-weight, xs.*, sm.*, lg.*, xl.*}`, all `{ref}`. Playwright
  spec (5 cases): circle vs square radius, distinct sizes,
  overlapping group margins, axe-core scan over seven labelled
  instances.
- `hc-switch` component — pure CSS over a native
  `<input type="checkbox" role="switch">`. The native input keeps
  every accessible behaviour (Space toggles, form serialisation,
  screen-reader announces "switch on/off" via the role override);
  only the visual chrome is replaced via `appearance: none`. iOS-
  style track with a `::before` thumb that slides on `:checked`
  via CSS `translate`. Same axes as the other form controls —
  `data-variant="success" | "error"` for checked-state tint,
  `data-size="sm" | "md" | "lg"`, disabled state, focus-visible
  ring driven by `--hc-color-focus-ring`. Thumb-slide transition
  respects `prefers-reduced-motion: reduce`. New
  `.hc-switch-label` cluster mirrors the
  `.hc-checkbox-label` / `.hc-radio-label` pattern. Tokens
  `switch.{width, height, thumb-size, padding, border-width,
  border, bg, thumb-bg, checked-bg, checked-border,
  success-checked-bg, error-checked-bg, disabled-bg, label-gap,
  sm.*, lg.*}`, all `{ref}` so theming carries through the
  overlay machinery. Playwright spec (9 cases) covers Space
  toggle, label click, checked tint, disabled state, success /
  error variant tints, sm vs lg sizing, native `change` event
  firing, and an axe-core scan.
- `hc-select` component — pure CSS skin over a native `<select>`,
  no JavaScript behavior. The underlying element keeps every
  native behaviour (keyboard, form submission, the OS picker on
  mobile, screen-reader semantics); only the closed state is
  restyled via `appearance: none` and an embedded SVG chevron so
  it matches `hc-button` / `hc-input`. Same axes as the other form
  controls: `data-variant="success" | "warning" | "error"` for
  border-colour cues, `data-size="sm" | "md" | "lg"` driven from the
  shared `--hc-control-*` scale, and `:disabled` / `aria-invalid`
  states. The dropdown picker itself stays browser-native — modern
  `appearance: base-select` (Chromium 135+) is left as an opt-in
  per-instance override so behaviour stays consistent in every
  browser. The chevron uses a hardcoded neutral stroke colour
  matching the SVG convention `hc-checkbox` / `hc-radio` already
  use. New `select.{height, padding-x, radius, font-size, bg, fg,
  border, focus-border, error-border, success-border,
  warning-border, disabled-bg, chevron-size, sm.*, lg.*}` tokens,
  all `{ref}` so the overlay machinery handles theming. The
  `hc-input` docstring was scoped to `<input>` / `<textarea>` only
  to remove the misleading note about applying it to `<select>` —
  pre-alpha and no consumers yet, so the API correction lands here
  rather than as a follow-up. Playwright spec (8 cases) covers
  chevron SVG render, focus ring, error / success variant
  borders, disabled state, sm / lg sizing, native `change` event
  firing (form integration), and an axe-core scan.
- `hc-breadcrumb` component — pure CSS, no JavaScript behavior.
  Semantic skeleton is `<nav aria-label="...">` → `<ol>` → `<li>`
  with `<a class="hc-breadcrumb__link">` for steps and
  `<span class="hc-breadcrumb__current" aria-current="page">` for
  the active page (deliberately not a link). Separators are
  injected via CSS `::before` on every item except the first,
  with `--hc-breadcrumb-separator` as the per-instance override
  hook — set any `content` value (a quoted string, escaped Unicode,
  or an `url()` SVG) in an `style="..."` or scoped stylesheet.
  Default glyph is `/`. Modern browsers exclude pseudo-content
  from the accessibility tree by default, so no extra
  `aria-hidden` work is needed for the separator. Optional
  `.hc-breadcrumb__ellipsis` styles a middle-truncation marker;
  an interactive "expand to dropdown" variant is deferred (a
  separate `installBreadcrumbExpand` behavior was sketched in the
  roadmap). New tokens
  `breadcrumb.{gap, font-size, separator-fg, link.fg, link.hover-fg,
  current.fg, current.font-weight}`, all `{ref}` so theming
  carries through. Playwright spec (6 cases) covers landmark
  semantics, the `aria-current` contract, default vs override
  separator glyph via `::before` computed-style, the ellipsis
  `aria-hidden` marker, and an axe-core scan.

- `hc-accordion` component — pure CSS, no JavaScript behavior.
  Skins the native `<details>` / `<summary>` elements: keyboard
  handling, the `open` attribute, and the `toggle` event all come
  for free from the browser. The single-open ("exclusive") variant
  is expressed declaratively via the
  [`<details name="...">` attribute](https://developer.mozilla.org/docs/Web/HTML/Element/details#name)
  — same `name` value on every item makes the browser enforce
  single-open semantics with zero JS (Chrome 120+, Firefox 130+,
  Safari 17.2+). Omit `name` for the independent multi-open variant.
  Components in scope: `.hc-accordion` (vertical container),
  `.hc-accordion__item` (the `<details>`), `.hc-accordion__trigger`
  (the `<summary>` with the default disclosure marker hidden),
  `.hc-accordion__icon` (chevron rotated 180° when `[open]`, with
  `prefers-reduced-motion` respect), `.hc-accordion__content`.
  Lazy htmx pattern documented:
  `data-hx-trigger="toggle once[target.open]"` fires exactly once,
  the first time an item opens. New tokens
  `accordion.{item.border-color, trigger.*, icon.*, content.*}`,
  all `{ref}` so the overlay machinery carries `data-color`
  through. Playwright spec (7 cases) covers click + keyboard
  toggling, exclusive vs independent variants, chevron rotation,
  and an axe-core a11y scan.
- `hc-tooltip` component + `installTooltip` behavior. Short, transient
  text label bound to a trigger via `aria-describedby`. Built on the
  HTML `popover` attribute and CSS Anchor Positioning, same baseline
  as `hc-menu`. `installTooltip()` auto-sets `popover="manual"` and
  `role="tooltip"` on every `.hc-tooltip`, wires every trigger
  referenced via `aria-describedby` (one tooltip can serve multiple
  triggers), and toggles the popover from:
  - `mouseenter` → show after 300 ms (industry-standard intent-to-
    hover threshold);
  - `mouseleave` → hide after 100 ms grace period (cancels a pending
    show if the cursor leaves during the delay);
  - `focus` → show immediately (no delay for keyboard users, per
    APG);
  - `blur` → hide immediately;
  - `Escape` while focused → hide without moving focus.

  We chose `popover="manual"` over the newer `popover="hint"` because
  Safari had no `hint` support as of 2026-05; `manual` + JS toggling
  achieves the same coexistence semantics (separate tooltips don't
  dismiss each other) everywhere `popover` is supported. CSS Anchor
  Positioning anchors the tooltip above the trigger by default with
  a `flip-block` fallback; browsers without anchor support get a JS
  `getBoundingClientRect` positioning hook that mirrors the same
  placement. The tooltip surface is `pointer-events: none` so it can
  never intercept clicks. New tokens `tooltip.{bg,fg,radius,padding-x,
  padding-y,font-size,max-width,offset}`, all `{ref}` so theming flows
  through the overlay machinery. Vitest spec (13 cases) covers
  idempotency, ARIA auto-attribution, all show / hide routes, delay
  semantics with fake timers, Escape, shared-tooltip across multiple
  triggers, and uninstall cleanup. Playwright spec (8 cases incl.
  axe-core a11y scan) exercises the real popover algorithm and
  asserts the anchored placement bounding box.
- `hc-menu` stateful items — `role="menuitemcheckbox"` and
  `role="menuitemradio"`. Mirrors shadcn's `DropdownMenuCheckboxItem`
  / `DropdownMenuRadioItem`:
  - **Checkbox**: click toggles `aria-checked` between `true` and
    `false`; multiple may be checked at once. Menu stays open so
    users can toggle several without reopening.
  - **Radio**: click sets this item's `aria-checked="true"` and
    every sibling within the same `[role="group"]` to `"false"`.
    Falls back to the menu container as the group when no explicit
    `<div role="group">` wrapper is present. Menu also stays open.
  - **`hc:menuselect.detail.checked`** carries the new boolean
    state for checkbox / radio clicks (undefined for plain
    `menuitem`).
  - New `<span class="hc-menu__label">` element styles a small
    muted heading above a group, pairable with `aria-labelledby` on
    the surrounding `<div role="group">`.
  - When the menu contains any checkable item, every item in it
    gets a reserved indicator column on the left via CSS `:has()`,
    so plain `menuitem`s align with the check / dot marker — no
    markup changes needed. Indicators are inline SVG via
    `background-image`, same pattern as `hc-checkbox` / `hc-radio`.

  Vitest spec adds 6 cases (checkbox toggle stays open, radio
  mutual-exclusion within group, plain `menuitem` still closes,
  `detail.checked` semantics, arrow nav across all three roles).
  Playwright spec adds 3 cases incl. the `::before` SVG indicator
  computed-style assertion. New tokens
  `menu.item.indicator-size` and the `menu.label.*` block, both
  written as `{primitive.*}` / `{semantic.*}` refs so the existing
  overlay machinery handles theming.

- `hc-menu` edge-aware collision flipping. Menus opened near a
  viewport edge now flip to stay inside it instead of getting
  clipped — the missing piece that kept the MVP menu out of
  production use. Two coordinated paths:
  - **CSS Anchor Positioning** (Chromium 128+, Firefox 147+, Safari
    26+): adds `position-try-fallbacks: flip-block, flip-inline,
    flip-block flip-inline;` to `hc-menu.css`. The browser tries the
    primary `block-end span-inline-end` placement first, then flips
    block / inline / both when overflow would occur. Zero JS, same
    behaviour shadcn ships via Radix's `collisionPadding`.
  - **JS positioning fallback** (Chromium 114-127, Safari 17-25,
    Firefox 125-146): extends `positionViaFallback` in `menu.js`
    with the equivalent measurement-based flip logic. Each branch
    mirrors the CSS path 1:1 so the user-visible behaviour stays
    consistent across modern and older browsers.
  Four new Vitest cases drive the JS path through all four flip
  combinations (no-flip, flip-block, flip-inline, flip-both) by
  stubbing the viewport and trigger / menu bounding rects. Two new
  Playwright cases mount edge-positioned triggers and assert the
  resulting menu bbox stays inside the viewport (the live test
  runs in Chromium ≥ 125 which exercises the CSS path).
- `hc-menu` component + `installMenu` behavior. WAI-ARIA APG action
  menu pattern built on three modern web standards: the HTML
  `popover` attribute (show/hide, light dismiss, native Escape), the
  `popovertarget` button attribute (declarative trigger ⇄ menu
  binding), and CSS Anchor Positioning (`anchor-name` /
  `position-anchor` / `position-area` — menu lands directly under
  the trigger). `installMenu()` wires the ARIA layer
  (`aria-haspopup`, `aria-expanded` synchronised with the popover
  `toggle` event, `aria-controls`), auto-assigns a unique anchor
  name per `[popovertarget=<id>]` pair, and adds the APG keyboard
  pattern: arrow keys / Home / End / type-ahead / Tab. Disabled
  items (`disabled` or `aria-disabled="true"`) are skipped. The
  first enabled menu item gets an `autofocus` attribute so the
  browser's popover algorithm — not racing JS — focuses it on open.
  On click, a bubbling `hc:menuselect` event carries
  `{ item, menu, trigger }` and the menu closes via
  `hidePopover()`. For browsers that lack CSS Anchor Positioning
  (Chromium < 125, Safari < 26, Firefox < 147), the behavior
  registers a `beforetoggle` handler that positions the menu via
  `getBoundingClientRect`; the menu remains functional everywhere
  `popover` is supported (Chromium 114+, Firefox 125+, Safari 17+).
  `data-variant="error"` recolours destructive items via
  `--hc-menu-item-error-fg`, mirroring shadcn's destructive
  variant. Vitest spec (13 cases) covers idempotency, ARIA wiring,
  anchor-name injection + JS positioning fallback, all keyboard
  routes, `hc:menuselect` dispatch, and uninstall cleanup; Playwright
  spec (10 cases incl. axe-core a11y scan) exercises the real
  popover algorithm.

### Changed

- Density tokens now use the same shadcn-style leaf emission as the
  colour themes (see next entry). `component.tokens.json` swaps
  `var(--hc-control-height)` / `var(--hc-control-padding-x)`
  literals for `{semantic.control.height}` /
  `{semantic.control.padding-x}` references, so each
  `[data-density]` block redeclares `--hc-button-height`,
  `--hc-button-padding-x`, `--hc-input-height`,
  `--hc-input-padding-x`, and `--hc-pagination-item-size` as resolved
  leaf values. A nested `<div data-density="compact">` now actually
  shrinks every control descendant; previously the var() chain was
  frozen at `:root` (40 px) and the nested attribute had no effect.
  Zero build-script changes — the overlay machinery added with the
  colour-theme fix already classified `density.*` sources the same
  way. Six new Playwright cases (`nested-density.spec.mjs`) cover
  button + input across all three density tiers.
- **Component-layer color tokens now emit as resolved leaf values per
  theme, mirroring shadcn / Radix Themes.** The old encoding placed
  `var(--hc-color-action-primary-bg)` literals inside the static
  `:root { component }` block. CSS custom properties resolve `var()`
  at the *declaring* element's computed-value time, so a nested
  `<div data-color="indigo">` could recolour `--hc-color-action-primary-bg`
  but every consumer (`--hc-button-primary-bg`, `--hc-checkbox-checked-bg`,
  `--hc-tabs-tab-indicator`, `--hc-input-focus-border`, …) had already
  baked the `:root`-level value and stayed blue. The same issue
  affected the v0.4 themes-page preview.

  Two coordinated changes:

  - `packages/core/src/tokens/component.tokens.json` — every
    `"$value": "var(--hc-color-action-*)"` and `"var(--hc-color-focus-ring)"`
    now uses the canonical `{semantic.color.action.*}` /
    `{semantic.color.focus-ring}` reference syntax. Also adds
    `semantic.color.action.primary-soft.bg` to `semantic.tokens.json`
    so the reference resolves at the semantic layer (previously it
    only existed under `color.*` files).
  - `packages/core/scripts/build-tokens.mjs` — new theme-overlay
    emission. Detects every semantic key that any runtime-themed
    source (`color.*`, `density.*`) redefines, classifies component
    leaves as theme-independent vs theme-dependent based on whether
    their resolution touches those keys, and emits theme-dependent
    leaves *inside each themed block* with that theme's resolved
    value. The `:root { component }` block only carries
    theme-independent leaves.

  Result: each `[data-color]` block now redeclares
  `--hc-button-primary-bg`, `--hc-checkbox-checked-bg`,
  `--hc-tabs-tab-indicator`, etc. as leaf colours — the shadcn
  pattern. Nested wrappers therefore cascade correctly and consumers
  can still override an individual `--hc-button-primary-bg` in any
  scope without touching the semantic layer.

  Token count climbed from 416 to 489 (~+18 KB raw on the unminified
  bundle). Three new Vitest cases cover the new emission rule, and a
  new Playwright `nested-theme.spec.mjs` (15 cases) probes computed
  styles across all five themes × three primitives.

### Fixed

- Docs site previews now actually behave on click and keyboard. The
  Starlight site loaded `@hypermedia-components/core/css` but never
  loaded the behaviors bundle, so interactive previews
  (`installTabs`, `installConfirm`, …) silently did nothing. Two
  changes:
  - `packages/core/package.json` `sideEffects` now lists
    `dist/hc.behaviors.js` and `src/js/behaviors.js`. The previous
    declaration only covered CSS files, so bundlers tree-shook the
    `import '@hypermedia-components/core/behaviors'` side-effect
    import — including the auto-init `DOMContentLoaded` listener.
    Every consumer that imports the auto-init entry benefits from
    this fix, not just our docs site.
  - `apps/docs/src/components/Head.astro` is a Starlight Head
    override that imports `@hypermedia-components/core/behaviors`.
    Resolved through the pnpm workspace, so no npm publish is
    required.

### Added

- `hc-tabs` component + `installTabs` behavior. Two markup patterns
  share the same classnames and visual style: an **app-state** variant
  (`<div role="tablist">` + `<button role="tab">` + `<div role="tabpanel">`)
  following the WAI-ARIA APG tabs pattern, and a **URL-routed** variant
  (`<nav>` + `<a href>` with `aria-current="page"`) that needs no JS.
  Variants: `default` (underline) / `pill`. Sizes: `sm` / `md` / `lg`,
  inheriting `--hc-control-*` from `data-density`. Active indicator
  references `--hc-color-action-primary-bg` so the colour theme cascades
  through `data-color`. `installTabs()` defaults to **manual activation**
  (APG-recommended when panels are htmx-loaded), with
  `data-activation="automatic"` to opt into focus-driven activation.
  Inactive panels carry `hidden="until-found"` so the browser's
  find-in-page can reveal them; the behavior listens for `beforematch`
  and auto-switches to the owning tab. When a panel becomes active, an
  `hc:tabactivated` event is dispatched on the panel (bubbles) so htmx
  can wire `hx-trigger="hc:tabactivated once"` for lazy loading. New
  Vitest spec (12 cases) and Playwright spec (6 cases incl. an axe-core
  a11y scan) cover keyboard navigation, manual vs automatic activation,
  disabled-tab skipping, `beforematch`, and the URL-routed variant being
  ignored by the behavior.
- `plans/hc-next-phase-plan-v0.5-en.md` — next-phase plan covering
  release readiness for `0.0.1-alpha.0`, MVP polish (form controls,
  density modes, hyperscript story), quality work (visual regression,
  build optimization), and a P3 backlog.
- TypeScript declarations (`.d.ts`) generated from JSDoc and shipped
  alongside the runtime modules. `packages/core/tsconfig.json` drives
  `tsc --emitDeclarationOnly --allowJs` into a staging directory; the
  existing `bundle-js.mjs` flattens the result so each entry in the
  `exports` map (`.`, `./behaviors`, `./macros`) has a sibling
  `.d.ts`. The `exports` map now declares `types` for `./behaviors`
  and `./macros` as well.
- `packages/core/test/types.smoke.ts` + `tsconfig.smoke.json` — a
  TypeScript smoke test that imports every public entry and is
  checked via `pnpm --filter @hypermedia-components/core typecheck`.
  The new `unit` CI job step runs it after the build so a regression
  in the public type surface fails CI.
- Density modes — closes v0.5 plan §4.2. New `data-density`
  attribute (`comfortable` / `compact` / `dense`) on `<html>` or any
  ancestor swaps `--hc-control-height` and `--hc-control-padding-x`
  to the values laid out in plan §9.3 (40/16 px → 32/12 px → 28/8 px).
  Three new token files under `packages/core/src/tokens/`
  (`density.{comfortable,compact,dense}.tokens.json`); a new
  `primitive.size.control.xs = 28px` entry; `build-tokens.mjs`
  registers the three sources with their own selector blocks. Button
  and input tokens now resolve their `height` / `padding-x` through
  `var(--hc-control-*)` indirection so a single attribute change
  cascades to every default-size control. Size variants
  (`data-size="sm"|"lg"`) keep their own dedicated vars and are
  unaffected. New docs page `tokens/density.mdx` with live preview;
  two new Vitest assertions cover the density block emission and the
  `var()` literal passthrough.
- Docs site theme + density sync — visitors can now toggle the
  Hypermedia Components density (`comfortable` / `compact` / `dense`)
  from a `<select>` next to Starlight's existing theme switcher, and
  the dark / light toggle now propagates to every component preview
  on the docs site automatically.
  - Theme: Starlight already writes `data-theme` to `<html>` and HC
    tokens listen for that exact attribute (`:root, [data-theme="light"]`
    / `[data-theme="dark"]` selectors). No code change — the cascade
    works because both sides use the same hook.
  - Density: new `apps/docs/src/components/SocialIcons.astro`
    overrides Starlight's `SocialIcons` slot to render the original
    GitHub link plus a styled density `<select>`. The choice persists
    to `localStorage['hc-density']` and is applied to `<html>` via
    an inline FOUC-prevention script declared through Starlight's
    `head` config in `apps/docs/astro.config.mjs`.
- Meta-integration pages — closes v0.5 plan §4.5. Two new docs pages
  round out the integrations section so the framework guides have a
  shared ground truth to link back to:
  - `apps/docs/src/content/docs/integrations/plain-html.mdx` — the
    simplest possible setup (copy dist files into a static folder,
    no template engine, no bundler), including a runnable minimal
    layout, theme / density toggles, and the "without htmx" CSS-only
    use case.
  - `apps/docs/src/content/docs/integrations/htmx.mdx` — the
    htmx-side conventions every framework guide currently repeats
    (htmx version, `data-hx-*` vs `hx-*`, `htmx:configRequest`
    hook for CSRF and arbitrary headers, `HX-Trigger` / `HX-Reswap`
    / `HX-Retarget` responses, the events the HC behaviors listen
    for, indicators, disabling controls during requests).
  - `integrations/index.mdx` now groups guides into "Foundations",
    "Server-side template engines", and "Client-side companions" so
    these foundational pages are the first thing a new reader sees.
- Hyperscript story — closes v0.5 plan §4.3. New
  `apps/docs/src/content/docs/integrations/hyperscript.mdx` page
  explains how to mount `_hyperscript` alongside Hypermedia
  Components and gives side-by-side equivalents for each behavior
  (`installConfirm`, `installToast`, `installCloseDialog`,
  `installClosePopover`, `installRemoteDialog`) so consumers can
  pick the form that fits the surface — vanilla helper, _hyperscript
  inline, or a mix. `recipes/confirm-action.mdx` gains a
  "Hyperscript alternative" section that links to the integration
  page and shows the same flow without `data-hc-confirm`. The
  integrations index now groups guides into "server-side template
  engines" and "client-side companions" so the new page slots in
  cleanly.
- Recipe source format — closes v0.5 plan §4.4. Every recipe under
  `recipes/<name>/` now ships the canonical three-file set:
  `recipe.html` (the short recommended snippet), `expanded.html`
  (the fully copy-pasteable HTML with every htmx attribute spelled
  out), and `contract.md` (server response shape — required
  endpoints, response headers, failure handling). Filled in the
  missing `recipes/request-action/recipe.html` and created the three
  scaffolds that did not exist yet — `recipes/toast/`,
  `recipes/inline-edit/`, `recipes/lazy-panel/`. `recipes/README.md`
  now indexes all nine recipes.
- `hc-checkbox` and `hc-radio` — closes v0.5 plan §4.1. Applied to a
  native `<input type="checkbox">` / `<input type="radio">`, the
  components keep every native behaviour (Space toggles, arrow-key
  navigation within a same-name radio group, form participation,
  assistive-tech announcements) and replace only the rendering via
  `appearance: none`. `data-variant` accepts `success` / `danger`.
  Checked state renders a white SVG glyph (check mark / inner dot)
  via `background-image`. Pair with `.hc-checkbox-label` /
  `.hc-radio-label` inline-flex wrappers, or with `hc-field` for
  fieldset-style groups. Two new docs pages and 10 new Playwright
  specs cover keyboard activation, label clicks, variants, invalid,
  disabled.
- Cloudflare Workers (Static Assets) deployment prep for the docs
  site:
  - [`wrangler.jsonc`](wrangler.jsonc) — Worker config, points the
    `ASSETS` binding at `apps/docs/dist`, `not_found_handling=404-page`,
    `run_worker_first=true`.
  - [`worker.mjs`](worker.mjs) — strips the
    `/hypermedia-components` base path from incoming URLs before
    forwarding to `env.ASSETS.fetch()`; redirects bare `/` to the
    base path. The base-path handling has to live in JS because
    Workers Static Assets `_redirects` does not honour `200`
    (rewrite) status codes.
  - [`apps/docs/public/_headers`](apps/docs/public/_headers) —
    long-cache for fingerprinted `_astro/*` assets, revalidate for
    HTML, baseline security headers (`X-Content-Type-Options`,
    `Referrer-Policy`, `Permissions-Policy`).
  - [`DEPLOYMENT.md`](DEPLOYMENT.md) — runbook for the unified
    Cloudflare Workers + Static Assets dashboard flow (project
    create, build / deploy commands, custom domain attach, Worker
    Route, rollback).

### Added

- `data-size="sm|md|lg"` on `hc-checkbox` and `hc-radio` — same
  vocabulary the button / input already speak, so every form
  control now sizes consistently. `sm = 0.875rem` (14 px), `md =
  1.125rem` (18 px, default), `lg = 1.375rem` (22 px). Independent
  of `data-density`: density only adjusts the `md` default; an
  explicit `sm` or `lg` stays fixed across density tiers so a
  deliberately-larger CTA-style checkbox doesn't shrink with a
  dense form around it.
- `data-variant="warning"` on `hc-checkbox` and `hc-radio` —
  completes the semantic intent trio `success / warning / danger`
  that the badge / alert / toast components already speak. Useful
  for forms where a checkbox represents a risky-but-allowed option
  ("Enable destructive backups"). Uses `semantic.color.warning`
  (amber.600) as the checked fill.
- New docs page `tokens/variants.mdx` — canonical cross-component
  matrix of every `data-variant` and `data-size` HC understands,
  with a written rationale for the deliberate asymmetries (e.g.
  buttons have no `success` variant, checkboxes have no `ghost`
  variant) so the matrix's gaps read as design choices rather than
  oversights.

### Changed

- **Breaking**: renamed the red severity variant from `danger` to
  `error` across the whole design system. Aligns with Material UI /
  Ant Design / Chakra / Carbon — the prevailing convention in
  modern enterprise design systems where the severity ladder reads
  `info → success → warning → error`. The previous `danger`
  naming was Bootstrap-era and clashed with the surrounding
  `warning` semantic. Touchpoints:
  - All `data-variant="danger"` attribute values across button /
    checkbox / radio / alert / badge / toast are now
    `data-variant="error"`.
  - All token paths `semantic.color.danger`,
    `semantic.color.action.danger.*`,
    `semantic.color.action.danger-hover.*`, plus component-layer
    `button.danger.*`, `button.danger-hover.*`,
    `checkbox.danger-checked-*`, `radio.danger-checked-*`,
    `alert.danger.*`, `badge.danger.*`, `toast.danger.*` are
    renamed by `danger → error`.
  - All CSS custom properties `--hc-color-danger`,
    `--hc-color-action-danger-*`, `--hc-{component}-danger-*` are
    renamed accordingly.
  - `installToast` checks `variant === 'error'` for
    `role="alert"` / `aria-live="assertive"` (was `'danger'`).
  - Docs (button / checkbox / radio / alert / badge / themes /
    variants), recipes (`confirm-action`), examples, fixtures,
    and Playwright specs are all updated.

  Emitted CSS *values* (red.600 / red.700 / etc.) are unchanged —
  every visual remains identical. This is a pure rename. Per the
  project's pre-alpha "no back-compat constraints" directive we
  did not ship a `danger` → `error` alias.
- `hc-checkbox` and `hc-radio` variant fills now reference the
  semantic colour tokens (`semantic.color.{success,warning,danger}`)
  directly rather than mixing primitive references and
  `semantic.color.action.danger.*`. Same emitted values; the
  refactor harmonises the token-graph shape so future colour
  customisation is uniform across the three variants.
- Density coverage extended to **table cells** and **checkbox /
  radio glyphs**. Previously a `data-density="compact"` or `"dense"`
  shrank buttons / inputs / container paddings but tables stayed
  roomy and checkbox / radio glyphs stayed at 18 px regardless —
  the layout felt half-tightened. Now:
  - `--hc-table-cell-padding-y` scales 8 → 6 → 4 px and
    `--hc-table-cell-padding-x` scales 12 → 8 → 6 px across the
    three tiers. Data tables, where density helps most, finally
    pick it up.
  - `--hc-checkbox-size` / `--hc-radio-size` step 18 → 16 → 14 px
    so the glyphs shrink in lockstep with the surrounding form
    controls.
  - Same direct-override pattern density already uses for control
    sizes — no component CSS changes; the density token files emit
    the same variable names at higher-specificity selectors and the
    cascade does the rest.
  - `tokens/density.mdx` gains a "Live preview — table and form
    controls" group rendering a 3-row table + checkbox + radio at
    each density tier, plus the new values in the variable table.
- `data-variant="secondary"` on `hc-button` — a filled neutral CTA
  that ranks under `primary` but above the outlined `default`. Closes
  a shadcn-style theme-token gap: a primary fill plus a neutral
  filled secondary is the standard SaaS / business-app two-tier
  action pattern, and HC was previously missing the second tier.
  - New semantic tokens `color.action.secondary.{bg,fg,border}` plus
    `secondary-hover.{bg,border}` in `semantic.tokens.json`. Light
    mode uses `gray.100` / `gray.900`; `theme.dark.tokens.json`
    overrides to `gray.700` / `gray.100` so contrast stays clean on
    dark surfaces.
  - New semantic `color.muted-bg` token (aliased to the same neutral
    grey) for subtle non-primary surfaces. Pairs with the existing
    `--hc-color-text-muted` foreground.
  - Component-level `button.secondary.*` / `button.secondary-hover.*`
    tokens resolve via `var(--hc-color-action-secondary-*)` so the
    light / dark cascade reaches the button automatically (same
    indirection pattern density and the colour themes already use).
  - Secondary is intentionally **not** theme-tinted — it stays a
    neutral grey in every `data-color` so primary remains visually
    distinct as the themed action. Documented in
    `tokens/themes.mdx`.
  - `hc-button.mdx` now shows the variant in the basic-HTML row and
    the variants table, with a written hierarchy
    (`primary > secondary > default > ghost`).

### Changed

- Color themes now reach further than just the primary action — the
  same `data-color` attribute also drives the **input focus border**,
  the **ghost button hover background**, and the **text ::selection
  highlight**. Three high-traffic interaction surfaces that used to
  stay a neutral grey / hard-coded blue regardless of theme now
  follow the active palette.
  - Added `--hc-color-action-primary-soft-bg` to every
    `color.{theme}.tokens.json` — a 12 % (18 % for amber) tint of
    the theme primary produced via `color-mix(... transparent)`. The
    transparency means the same value blends naturally on both light
    and dark surfaces; no per-mode variant required.
  - `component.tokens.json` swaps two more values to `var()`
    indirection:
    - `input.focus-border` → `var(--hc-color-focus-ring)` (previous
      build baked semantic.color.focus-ring as `#3b82f6`, so the
      input focus outline stayed blue even on indigo / emerald /
      rose / amber).
    - `button.ghost-hover.bg` → `var(--hc-color-action-primary-soft-bg)`
      (was a hard-coded `gray.100`).
  - `hc.base.css` adds a global `::selection { background-color:
    var(--hc-color-action-primary-soft-bg) }` rule so text-selection
    on any HC page becomes a low-key brand cue.
  - The themes docs page (`tokens/themes.mdx`) now exercises the
    full set in every per-theme preview row — primary button + ghost
    button + input + checkbox + radio + a snippet of selectable text
    — so you can see all five touchpoints at a glance.
- Color themes — five accent palettes (default / indigo / emerald /
  rose / amber) selectable via a `data-color` attribute on `<html>`
  or any subtree. Each theme overrides only the accent variables
  (`--hc-color-focus-ring`, `--hc-color-action-primary-*`,
  `--hc-color-action-primary-hover-*`); surface / background / text
  colours stay under the existing `data-theme` (light / dark) axis,
  and container spacing stays under `data-density`. The three axes
  cascade independently. The button / checkbox / radio / pagination
  component tokens now resolve their primary-action vars through
  `var(--hc-color-action-primary-*)` (the same indirection pattern
  density uses) so the swap propagates without component-CSS edits.
  - Five new files under `packages/core/src/tokens/`
    (`color.{default,indigo,emerald,rose,amber}.tokens.json`).
  - `primitive.tokens.json` gains `indigo` and `rose` scales plus
    the missing `green.500` and `amber.500` shades.
  - Each theme's primary shade is verified to clear WCAG AA
    contrast (≥ 4.5:1) for text-on-primary in both light and dark
    mode — emerald and rose use the `.700` shade, amber pairs the
    bright `.500` with dark text.
  - New docs page `tokens/themes.mdx` with a live preview row per
    theme and the full contrast table.
  - Starlight docs site picker — second `<select>` next to the
    existing density picker, persists to `localStorage['hc-color']`,
    pre-applied by the FOUC head script.
- Density now scales container paddings and gaps in addition to
  control sizes, so the whole layout tightens or relaxes evenly
  instead of leaving the buttons compact while cards and dialogs
  around them stayed roomy. The three density token files
  (`density.{comfortable,compact,dense}.tokens.json`) now also
  override `--hc-field-gap`, `--hc-toolbar-{gap,padding-y,padding-x}`,
  `--hc-card-padding`, `--hc-dialog-{padding,gap}`,
  `--hc-popover-padding`, `--hc-alert-{padding-block,padding-inline,gap}`,
  and `--hc-toast-{padding-y,padding-x,gap}`. Cascade flows the same
  way as the existing control vars — density files emit the same
  variable names at higher-specificity selectors so the override
  picks up automatically with no component-CSS changes. Total tokens
  emitted grew from 242 to 284 vars across the six selector blocks.
  `tokens/density.mdx` gains a container-tier preview (card +
  alert) at all three densities and a value table for the new vars.

### Fixed

- Density inverted the `sm / md / lg` button + input ordering at the
  `dense` tier. Earlier PRs scaled `md` (the default) with density
  but kept `sm` and `lg` at fixed primitive values, on the theory
  that "explicit `data-size` should be absolute, not relative."
  Under `data-density="dense"` that produced `md = 28 px` while
  `sm` stayed at `32 px` — the default ended up *smaller* than
  `sm`, which is obviously wrong. The whole size scale now shifts
  together so `sm < md < lg` holds at every density tier. New
  density-tier values:
  - **Button / input height** (`sm` / `md` / `lg`):
    32/40/48 (comfortable) → 28/32/40 (compact) → 24/28/32 (dense).
  - **Button / input padding-x**:
    12/16/20 (comfortable) → 8/12/16 (compact) → 6/8/12 (dense).
  - **Checkbox / radio size**:
    14/18/22 (comfortable) → 12/16/20 (compact) → 12/14/18 (dense).
  - `tokens/density.mdx` and `tokens/variants.mdx` updated to
    explain the relative-emphasis interpretation.


- Docs preview alignment — every `<div class="hc-preview">` wrapper
  in the component / token / recipe docs now also carries Starlight's
  `not-content` class so its descendants are excluded from the prose
  layer. Without that opt-out, Starlight applied `margin-top: 1rem`
  to every consecutive non-inline child of `.sl-markdown-content`,
  which gave each button / input after the first one a taller outer
  box and broke `align-items: center` inside the preview flex row
  (visible on the Button page as Save / Delete / Ghost sitting ~8 px
  below Default). `not-content` is Starlight's intended escape hatch
  for non-prose regions, so this also keeps prose rules for link
  colour, inline code background, heading colour, etc., from
  bleeding into future previews. Updated 25 preview wrappers across
  13 mdx files and documented the convention in
  `apps/docs/src/styles/preview.css`.

### Changed

- `CLAUDE.md` refreshed for the post-v0.4 state — references both
  plans, lists the implemented surface, documents the lint / test /
  test:browser / examples commands, and points at Track 1 as the
  next concrete move.
- `packages/core` `build` script now runs `build:types` (tsc) before
  `build:js` so the bundler can copy the freshly emitted declarations
  into `dist/`. `typescript` is a new `devDependency`.

### Fixed

- **Docs: live previews now render in their intended state.** The `Demo`
  preview slots used React-style attributes (`defaultChecked`,
  `defaultValue`, `htmlFor`) that Astro's MDX renderer emitted verbatim
  instead of as `checked` / `value` / `for`. As a result every checkbox,
  radio, and switch preview rendered *unchecked*, text/slider inputs
  rendered *empty*, and `hc-field` labels were not associated with their
  inputs. Replaced with the real HTML attributes across the checkbox,
  radio, switch, input, field, and slider component pages plus the density
  and themes token pages. Code samples were already correct.

- **Docs: removed stale "not yet shipped / planned" notes and fixed the
  kitchen-sink gallery.** Several pages claimed shipped features were
  unbuilt: the Menu page said `menuitemcheckbox` / `menuitemradio` /
  submenus were "not in the MVP" (the same page documents them), Popover
  labelled `installClosePopover` and the Dialog/filter-popover links as
  "(planned)", Datepicker pointed at an `hc-calendar` "follow-up", and the
  Fundamentals · Tokens page said density modes were "not yet shipped".
  The Tokens · Variants size table claimed `sm` / `lg` "stay fixed" across
  density, contradicting the prose directly below it. The kitchen-sink
  page used a non-existent `hc-pagination__link` class and dropped the
  `hc-breadcrumb__list` / `__item` wrappers (so both rendered broken), and
  was missing nine components it claims to show — button-group, kbd,
  menubar, navmenu, empty, item, aspect, carousel, and datagrid are now
  included. The recipes index now lists all ten recipes with links.

- **Docs: integration guides now load the self-contained behavior /
  macro bundles.** The no-bundler guides (Plain HTML, Django, Rails, Go,
  Razor, Thymeleaf, Hyperscript) and the install / quick-start snippets
  copied `hc.behaviors.js` into a static folder and loaded it with a
  `<script type="module">`. That file is the *un-bundled* entry — it
  imports ~30 sibling modules plus a bare `@hypermedia-components/core`
  specifier, so without a bundler or import map the browser cannot resolve
  it and no behavior installs. Switched these references to the
  esbuild-bundled, self-contained `hc.behaviors.min.js` /
  `macros/index.min.js` (the Rails importmap pin too), dropped the
  now-unnecessary `macros/` sibling files from the file-layout examples,
  corrected the "installs the five default behaviors" wording (it installs
  every default behavior — ~29 of them), fixed the Hyperscript guide's
  `/assets/hc/…` asset path, and updated the stale asset sizes. The
  bundler-based `import '@hypermedia-components/core/behaviors'` snippets
  were already correct and are unchanged.

- **Docs: fixed code samples that did not work as written.** The
  live-search recipe referenced a non-existent `data-hx-busy` attribute
  (htmx signals in-flight requests with the `.htmx-request` class); the
  remote-dialog recipe's progressive-enhancement fallback called an
  undefined `showThis.showModal()`; the datagrid-pager recipe and the Go
  guide used the bare `hx-swap-oob` form instead of the project's
  `data-hx-swap-oob` convention; the Thymeleaf guide put a `@{/users}`
  expression in a plain `data-hx-post` attribute (Thymeleaf only
  evaluates it through `th:attr`); the Razor guide wrote
  `data-hx-post asp-page="Create"` (a valueless `data-hx-post` — the
  `asp-page` tag helper does not populate it), now `asp-page` plus an
  explicit `data-hx-post="@Url.Page("Create")"`; and the htmx and Django
  guides used bare `hx-headers` against their own `data-hx-*` convention.

- **Docs: closed component-reference completeness gaps.** The Input page
  omitted the `success-border` / `warning-border` tokens its Variants
  section relies on (only `error-border` was listed); the Button theming
  table left `secondary` out of the per-variant token pattern; the Shell
  page never documented `--hc-shell-sidebar-collapsed-width` (the
  collapsed-rail width); and the Slider page had no disabled example
  despite shipping disabled styles. Added all of these. Also gave the
  Variants / Sizes / Disabled demos on the Select, Progress, Slider, and
  Date picker pages a real Code tab (they were preview-only `<div>`s, so
  the markup wasn't copyable) by moving them onto the `Demo` component.

- **Docs: behavior-dependent pages now show how to install the behavior.**
  Several pages described a JS behavior by name but never showed the
  `import { installX } from '@hypermedia-components/core'; installX();`
  step, so a reader who copied the markup got a dead component with no
  hint why. Added a setup snippet to the Toast (a `## Setup` section —
  nothing renders without it), Toolbar, Popover, and Avatar component
  pages, and a `:::note[Setup]` to the behavior-dependent recipes
  (confirm-action, filter-popover, remote-dialog, toast, datagrid-pager),
  each pointing at the auto-init `/behaviors` bundle and the install page.

- **Docs: clearer, copy-pasteable component samples.** The Avatar
  "Image avatars" demo previewed initials while its code showed `<img>`
  (now a real image preview), and its Sizes/Shape code used a literal
  `aria-label="…"` (now real names; Shape gained a Code tab). The Switch
  Variants/Sizes/States demos were preview-only `<div>`s with no copyable
  code (now on `Demo`, matching checkbox/radio). Radio samples used
  meaningless `name="x"`/`"y"` (now meaningful names with a note on why
  they differ). The Input States/Variants, Menu (the `aria-disabled`
  item), Tooltip, Popover (placement `data-side` + body), and Item
  (interactive rows) code blocks now mirror their previews instead of
  omitting examples or collapsing markup to `…`. Alert's basic code shows
  all four variants and keeps the `<kbd>` markup.

- **Docs: fleshed out the onboarding path.** The Installation page was a
  six-line stub; it now covers the npm/bundler path, the no-bundler
  static-file path (with the `node_modules/.../dist/` source), and a new
  **Behaviors** section explaining the auto-init bundle vs individual
  `installX()` (idempotent, returns an uninstaller). Quick start is now a
  three-layer walkthrough — styles only → add behaviors → add htmx — with
  a working appended-list example instead of a snippet that targeted a
  non-existent element. Introduction, Fundamentals index, Reference index,
  and the Recipes index gained next-steps / child-page links; the Recipes
  index groups its ten recipes by purpose and tags which need a behavior.

- **Docs: consistent component-page structure.** The "how to use this with
  htmx" section had seven different headings across the component pages
  (`With htmx`, `htmx integration`, `htmx lazy loading`, …); all 31 are now
  `## htmx usage`, so the section is always in the same place under the
  same name. Renamed `Variant` → `Variants` (Item) and `Related recipes` →
  `Related` (Button) to match every other page, moved Alert's htmx section
  above Accessibility (the standard order), and added the missing Disabled
  section to the Date picker (its siblings all have one).

- **Docs: standard end-block order on Datagrid and Shell.** Both pages
  placed their `CSS variables` section out of order — Datagrid had it
  before Accessibility, and Shell had it in the middle of the page (right
  after the layout sections). Both now follow the standard
  `… → Accessibility → CSS variables → Related` order. (Neither gains a
  `Theming tokens` section: their `--hc-*` knobs are defined directly in
  CSS — layout dimensions for Shell, and Datagrid's are tracked separately
  for tokenization — so there are no DTCG token paths to list.)

- **Datagrid colours now flow through the DTCG token pipeline.** Datagrid
  defined its themeable colours (surface, header, selection, hover,
  current-cell accent, frozen-column background, sub-row border) directly
  in `hc-datagrid.css` with `var(--hc-color-*)` references — bypassing the
  `component.tokens.json` source of truth that every other component uses.
  Added a `datagrid` token group so those colours, plus the cell padding
  and header-level heights, are generated like the rest, with automatic
  light/dark and colour-theme overrides. The resulting `--hc-datagrid-*`
  values are identical to before in all seven theme scopes (verified
  default / dark / indigo / emerald / rose / amber), so there is **no
  visual change**; the Datagrid docs gain a Theming tokens section and
  match the standard structure. The contextual frozen-edge shadow and the
  `max-height` / `truncate-max` override knobs stay CSS-only.

- **Docs: the kitchen sink now mirrors the Components sidebar.** Its
  section grouping had drifted from the canonical categorization in
  `astro.config.mjs` — different names (`Form controls`,
  `Feedback & status`, `Layout & data`) and wrong placements (Toolbar /
  Command under Navigation instead of Actions, Badge under Feedback
  instead of Data display, the data-display and layout components lumped
  together). It now uses the exact seven sidebar categories (Actions,
  Forms, Navigation, Overlays, Data display, Feedback, Layout) with the
  same component in each, adds the three that were missing (Accordion,
  Collapsible, Input group), points the Toast tile at the component page
  rather than the recipe, and moves the non-component layout demos
  (layout utilities, table-scroll) into a separate "Layout patterns"
  section. Verified: all 51 components present and categorised exactly as
  the sidebar.

- **Docs: denser kitchen-sink canvas.** The page opts into tighter preview
  chrome via a hidden marker (scoped in `preview.css`), dropping the forced
  7 rem min-height and trimming preview padding and the heading-to-preview
  rhythm so more demos fit on screen. Component-doc Demos are untouched.

- **`hc-shell`: a sidebar can collapse without a mobile toggle.**
  `installShell()` early-returned unless the shell had a
  `[data-hc-shell-toggle]` hamburger, so a desktop-only admin shell that
  only wanted the collapse-to-rail control never wired up. It now attaches
  whenever a `.hc-shell__sidebar` is present and treats the mobile overlay
  (toggle, focus trap, scrim) as opt-in. Also **gated the collapsed-rail
  label-hiding to desktop** (`@media (width >= 60rem)`) so a lingering
  `data-sidebar-collapsed` no longer hides the labels in the mobile
  off-canvas sidebar. The Blocks app-shell drops its (previously required)
  mobile hamburger — which had let the `position: fixed` overlay escape
  the scaled-down demo box — and now collapses cleanly to an icon rail.

---

## [Unreleased — v0.4 implementation]

Merged in PR #1 (squash commit `be72271`, 2026-05-28). The list below
is preserved verbatim for the eventual `0.0.1-alpha.0` release notes.

### Added

#### Tokens

- DTCG-shaped JSON sources under `packages/core/src/tokens/`:
  `primitive`, `semantic`, `component`, `theme.dark`.
- `scripts/build-tokens.mjs` resolves `{ref}` syntax across the four
  layers and emits `dist/hc.tokens.css` (209 custom properties across
  three selector blocks) wrapped in `@layer hc.tokens`. The transform
  is exported as `buildTokensCss({ sources, trees })` for testing.

#### CSS components

- `hc-button` — variants (`default`, `primary`, `danger`, `ghost`),
  sizes (`sm`, `md`, `lg`), focus ring, disabled, `[data-loading]`.
- `hc-input` — applies to `<input>`, `<select>`, `<textarea>`; sizes;
  `aria-invalid` styling.
- `hc-field` — composes label + control + message; `[data-invalid]`
  propagates the danger state.
- `hc-spinner` — CSS-only loading indicator; respects
  `prefers-reduced-motion`.
- `hc-dialog` — minimal styling for the native `<dialog>` element
  including `::backdrop`.
- `hc-popover` — minimal styling for the native `popover` attribute.
- `hc-card` — generic container with optional header / body / footer
  parts.
- `hc-table` — header band, hoverable rows, optional
  `data-density="compact"`.
- `hc-badge` — inline status pill with info / success / warning /
  danger variants.
- `hc-alert` — block-level notice with info / success / warning /
  danger variants and optional title.
- `hc-toast` + `hc-toast-region` — corner-pinned stack.
- `hc-toolbar` — horizontal cluster with separators and spacer.
- `hc-pagination` — page-link nav using `aria-current="page"`.

#### CSS infrastructure

- `hc.layers.css` declares the layer order
  `hc.tokens, hc.base, hc.components, hc.recipes, hc.utilities`.
- `hc.base.css` provides minimal normalization (box-sizing, body
  defaults).
- `hc.htmx.css` styles `.htmx-indicator`, `.htmx-request`, and the
  `.hc-action` wrapper.
- `scripts/bundle-css.mjs` concatenates the layers and per-component
  files into `dist/hc.css` and copies individual files for
  per-layer imports via the package `exports` map.

#### Behaviors

All behaviors are vanilla ESM, listen at the document level via event
delegation, and return an `uninstall` function. Calls are idempotent.

- `installConfirm` — intercepts clicks on `[data-hc-confirm]`, shows
  a shared `<dialog>`, and re-emits a bubbling `confirmed` event so
  htmx can listen via `data-hx-trigger="confirmed"`.
- `installToast` — renders `hc:toast` event payloads into the first
  `[data-hc-toast-region]`, mapping `variant="danger"` to
  `role="alert"` / `aria-live="assertive"`. Lazy-creates the region
  if absent.
- `installCloseDialog` — listens for `htmx:afterRequest`; on success
  closes the closest `<dialog>` of any element marked with
  `data-hc-close-dialog-on-success`.
- `installClosePopover` — same shape against `[popover]` and the
  `data-hc-close-popover-on-success` attribute.
- `installRemoteDialog` — listens for `htmx:afterSwap` on
  `[data-hc-remote-dialog-root]`; on swap finds the first `<dialog>`
  and calls `showModal()`.
- `@hypermedia-components/core/behaviors` auto-init entry installs
  all five on `DOMContentLoaded`.
- `scripts/bundle-js.mjs` copies ES modules to `dist/` for the
  package `exports` map.

#### Macros (optional Light DOM custom elements)

- `<hc-confirm-action>` — expands to the `.hc-action` + `.hc-button` +
  `.hc-spinner` markup of the confirm-action recipe with full
  `data-hx-*` / `data-hc-*` wiring. Attribute-driven; idempotent.
- `<hc-live-search>` — expands to the live-search form (label, input,
  optional submit) per §15.4 of the plan.
- Both build their expanded DOM via `createElement` + `setAttribute`
  (no string interpolation), and call `htmx.process(this)` when htmx
  is loaded.
- Registration entry at `@hypermedia-components/core/macros`.

#### Documentation (Astro Starlight)

40 pages generated, including:

- **Start** — introduction, installation, quick-start, philosophy.
- **Fundamentals** — naming, tokens.
- **Components** — `button`, `input`, `field`, `card`, `table`,
  `badge`, `alert`, `dialog`, `popover`, `toolbar`, `pagination`.
- **Recipes** — `request-action`, `confirm-action`, `live-search`,
  `toast`, `remote-dialog`, `filter-popover`, `data-region`,
  `inline-edit`, `lazy-panel`.
- **Integrations** — Thymeleaf (Spring Boot), Django, Rails, Go,
  Razor (ASP.NET Core). Each guide covers asset loading, fragment
  rendering, `HX-Trigger` toasts, and CSRF integration.
- **Reference** — `custom-elements` (macro contract).
- The docs site consumes `@hypermedia-components/core/css` as a
  workspace dependency so live previews render against the same CSS
  the package publishes.

#### Examples (runnable)

- `examples/plain-html/` — static gallery of every CSS component plus
  a toast trigger. Self-contained `serve.mjs` aliases
  `/hc.css`, `/hc.behaviors.js`, and `/macros/*.js` to the workspace
  dist.
- `examples/htmx/` — `index.html` demonstrating request-action,
  confirm-action, live-search, and HX-Trigger toasts against a
  zero-dep Node `server.mjs` with hardcoded items, `GET/POST/DELETE`
  on `/items`, and `GET /search`.

#### Tests

- **Vitest + jsdom** (`packages/core/test/`) — 73 unit / DOM tests
  across 7 files:
  - `tokens.test.mjs` — variable name derivation, transitive
    references, circular-reference detection, light/dark overrides.
  - `confirm.test.mjs` — dialog reuse, accept/cancel branching,
    variant fall-through, idempotent install, uninstall.
  - `toast.test.mjs` — region creation, role/aria-live mapping,
    auto-dismiss with `vi.useFakeTimers`, sticky toasts, preset
    region preservation.
  - `close-dialog.test.mjs`, `close-popover.test.mjs`,
    `remote-dialog.test.mjs` — htmx event flow + uninstall.
  - `macros.test.mjs` — upgrade idempotency, attribute mapping,
    `htmx.process` call.
  - `dom-setup.mjs` polyfills `HTMLDialogElement.showModal/close` and
    popover APIs for jsdom.
- **Playwright + Chromium** (`packages/core/test-browser/`) — 25
  end-to-end specs against a real browser, served by
  `test-browser/serve.mjs`:
  - `dialog.spec.mjs` — `showModal()`, Escape, focus, `:modal`.
  - `popover.spec.mjs` — native popover open/close, light-dismiss.
  - `confirm.spec.mjs` — focus-on-cancel default, `confirmed` event,
    Escape cancellation, dialog reuse.
  - `toast.spec.mjs` — region creation, role mapping, real timer
    auto-dismiss, stacking.
  - `macros.spec.mjs` — `<hc-confirm-action>` and `<hc-live-search>`
    upgrade timing and attribute output.

#### Governance and tooling

- `CONTRIBUTING.md` per plan §21.2 — project goals, design rules,
  tokens, testing matrix (unit + browser), docs style, a11y, commit
  conventions, release process.
- `CHANGELOG.md` (this file) per plan §20.3.
- `.github/PULL_REQUEST_TEMPLATE.md` with the §21.4 checklist.
- `.github/workflows/ci.yml` rewritten as three parallel jobs:
  - **unit** — `pnpm --filter @hypermedia-components/core build && test`.
  - **docs** — `pnpm -w run docs:build`, uploads `apps/docs/dist`.
  - **browser** — `playwright install --with-deps chromium` (cached)
    + `test:browser`, uploads report / traces on failure.
  - Concurrency cancels superseded runs on the same ref.

### Changed

- `packages/core` `exports` map now points `./macros` at
  `dist/macros/index.js` (was `dist/hc.macros.js`); per-macro files
  live next to the entry so relative imports resolve.

[Unreleased]: https://github.com/ingcreators/hypermedia-components/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ingcreators/hypermedia-components/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/ingcreators/hypermedia-components/compare/v0.2.0...v0.2.1
[editor-kit-0.2.0]: https://github.com/ingcreators/hypermedia-components/compare/editor-kit-v0.1.0...editor-kit-v0.2.0
[0.2.0]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.15...v0.2.0
[0.1.15]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ingcreators/hypermedia-components/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ingcreators/hypermedia-components/compare/v0.0.1-alpha.0...v0.1.0
[0.0.1-alpha.0]: https://github.com/ingcreators/hypermedia-components/releases/tag/v0.0.1-alpha.0
