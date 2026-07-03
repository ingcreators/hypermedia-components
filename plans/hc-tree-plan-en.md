# hc-tree + lazy-tree — component + recipe plan

Status: **PR 1 (component) shipped; PR 2 (lazy-tree recipe) pending.**
The last big component gap: an ARIA-tree view (file browsers, category
hierarchies, admin navs) with the kit's hypermedia signature — **lazy
subtrees that arrive as server-rendered HTML on first expand**. The
largest behavior since datagrid; its keyboard machinery follows the
same shapes datagrid proved. Baseline: post-#309.

## 1. Markup — semantic lists, roles applied by the behavior

```html
<ul class="hc-tree" aria-label="Project files">
  <li class="hc-tree__item" aria-expanded="false">
    <span class="hc-tree__row">
      <span class="hc-tree__toggle" aria-hidden="true"></span>
      <span class="hc-tree__label">src</span>
    </span>
    <ul class="hc-tree__group">
      <li class="hc-tree__item">
        <span class="hc-tree__row">
          <span class="hc-tree__label"><a href="/files/src/app.js">app.js</a></span>
        </span>
      </li>
    </ul>
  </li>
</ul>
```

- Nested `<ul>/<li>` is the bone structure (no-JS renders a plain,
  fully readable list — links keep working). `installTree()` applies
  `role="tree" / treeitem / group"` and the roving tabindex, exactly
  like datagrid applies its grid roles.
- **Branch vs leaf is declared by `aria-expanded`** (present = branch;
  the server owns it, the behavior toggles it). Levels come from
  nesting — no `aria-level` bookkeeping.
- `aria-current` / `aria-selected` are **server states** (v1 manages
  focus, not selection — activation follows links, hypermedia-style).

## 2. Behavior — `installTree()` (APG tree pattern)

Root-delegated per-tree wiring (the datagrid shape: idempotent,
uninstaller, document-level observer picks up swapped-in trees):

- **Roving tabindex** over treeitems; one tab stop per tree.
- **Keyboard**: ↑/↓ previous/next *visible* item (collapsed subtrees
  are skipped); → opens a closed branch, then moves to first child;
  ← closes an open branch, else moves to the parent; Home/End
  first/last visible; **Enter/Space** activates — clicks the label's
  link when there is one, otherwise toggles the branch; **type-ahead**
  jumps to the next visible item starting with the typed character.
  ←/→ mirror in RTL (the datagrid precedent).
- Toggle-element and row clicks expand/collapse; `aria-expanded`
  flips; CSS hides collapsed groups.
- **Expand event**: every expansion dispatches a bubbling
  `hc:treeexpand` on the item (`detail: { item }`) — the lazy-tree
  recipe's htmx trigger. When an expanding item carries `data-hx-get`
  and an **empty** group, the behavior sets `aria-busy="true"` on the
  group and clears it when children arrive (MutationObserver — the
  datagrid lazy-detail shape).
- No network, no selection state, no new i18n keys.

## 3. CSS (`hc-tree.css` + `component.tree.*` tokens)

- Indentation per level via nested-group padding
  (`--hc-tree-indent`, logical so RTL flips); row hover/focus states;
  the toggle is a chevron that rotates on `[aria-expanded="true"]`
  (transition gated by reduced-motion as usual); `aria-current` row
  accent (follows `data-color`); `[aria-busy="true"]` group shows the
  loading affordance (the datagrid detail spinner shape);
  `data-size="sm"`.
- Tokens: `indent`, `row-padding-y/-x`, `row-radius`, `fg`, `hover-bg`,
  `current-bg`, `current-fg`, `toggle-size`, `guide` (subtle left
  guide line on groups) — semantic references throughout.
- VRT core-sheet section: expanded/collapsed/current/nested states.

## 4. Recipe — `lazy-tree` (PR 2)

The hypermedia lazy subtree: the branch ships EMPTY and its children
arrive as server-rendered `<li>` treeitems on first expand.

```html
<li class="hc-tree__item" aria-expanded="false"
    data-hx-get="/nodes/42/children"
    data-hx-target="find .hc-tree__group"
    data-hx-swap="innerHTML"
    data-hx-trigger="hc:treeexpand once">
  <span class="hc-tree__row">…</span>
  <ul class="hc-tree__group"></ul>
</li>
```

- `hc:treeexpand once` — htmx fetches on the FIRST expand only;
  re-collapse/re-expand shows the already-loaded children (`once` is
  the whole trick; the contract explains it).
- Server returns only `<li class="hc-tree__item">…` fragments (the
  group's innerHTML) — nested lazy branches inside the response work
  recursively (the behavior re-applies roles via its observer).
- `aria-busy` on the group during flight (behavior-set, §2).
- Errors: non-2xx doesn't swap; the branch just stays empty and
  re-expanding retriggers? No — `once` spent. Contract: surface errors
  via an `HX-Trigger` toast; recommend `data-hx-trigger="hc:treeexpand
  once"` + server-side reliability, and document the retry limitation
  honestly (a v2 could re-arm on error).
- No-JS: the server may render the tree fully expanded (plain nested
  lists, links work); lazy loading is an enhancement. Deep trees can
  also be plain pages per node — the links ARE the fallback.
- checks.json: lazy branches must pair `data-hx-trigger*="hc:treeexpand"`
  with `once` (E — without it every expand refetches and re-swaps),
  target `find .hc-tree__group` declared (E), swap innerHTML
  only-if-present (E), an `.hc-tree__group` exists in the item (E).

## 5. Accessibility notes (DoD)

- APG tree: roles + `aria-expanded` + roving tabindex + visible-item
  arrow model + type-ahead. Levels derive from proper nesting.
- Focus ring on the row (`:focus-visible`); activation follows real
  links (navigation stays hypermedia); toggles are `aria-hidden`
  affordances duplicated by the keyboard model.
- `aria-busy` groups announce loading; axe scans idle + expanded +
  lazy-loading states.

## 6. Public API surface

Additive → patch: `hc-tree` class vocabulary, `--hc-tree-*` tokens,
export `installTree` (auto-init), **one new event** `hc:treeexpand`
(`detail: { item }` — the recipe's trigger, so it is public API), the
`lazy-tree` recipe contract.

## 7. PR split

### PR 1 — `feat(tree): ARIA tree view`
- [ ] `component.tokens.json` `tree.*` + `hc-tree.css` + bundle-css.
- [ ] `src/js/tree.js` + registrations (behaviors/index/bundle-js).
- [ ] `test/tree.test.mjs` — the keyboard matrix on a 3-level fixture:
      visible-item traversal skips collapsed subtrees; →/← open/close/
      descend/ascend; Home/End; Enter activates a link, toggles a
      branch; type-ahead; RTL mirroring; roving tabindex; roles
      applied; `hc:treeexpand` dispatch + `aria-busy` set/cleared on
      lazy groups; idempotent; uninstall.
- [ ] Docs `components/tree.mdx`; VRT section + regenerated baselines.
- [ ] CHANGELOG; plan Status update.

### PR 2 — `docs(recipes): bless lazy-tree`
- [ ] `recipes/lazy-tree/{recipe,expanded,contract,checks}` + README
      row + docs page (+ links from the tree component page).
- [ ] serve.mjs mock (`GET /mock/tree/:id/children`, nested lazy
      branches in the response, a delay for the busy window), fixture,
      `test-browser/lazy-tree.spec.mjs`: first expand fetches once
      (re-collapse/expand does NOT refetch), keyboard descends into
      loaded children, `aria-busy` cycles, nested lazy branch loads
      recursively, axe.
- [ ] CHANGELOG; plan Status → shipped.

## 8. Risks / notes

- **Visible-item computation** is the correctness core (skip collapsed
  descendants); it is pure DOM traversal pinned by jsdom tests —
  the datagrid matrix work was harder.
- `hc:treeexpand` + htmx `once` is the same event-trigger mechanism
  five shipped recipes already use.
- Selection models (multi-select, checkboxes) are deliberate v2 —
  documented as non-goals; `aria-selected` is accepted as a server
  state and styled, not managed.
- Drag-to-reorder is out of scope.
