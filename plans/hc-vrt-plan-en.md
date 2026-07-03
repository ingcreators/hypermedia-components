# Visual regression testing — Playwright screenshots

Status: **shipped — sheets + spec + committed baselines (#288).**
Quality infrastructure, not a feature: the kit has no systematic guard
against purely visual regressions. `.hc-toolbar[hidden]` (caught only
incidentally, #281) is the proof of the gap: invisible to jsdom,
outside any behavioral assertion. 56+ component stylesheets ×
`data-theme` × `data-color` × `data-density` × `dir` is not a surface
humans re-review per PR. Closes the v0.5 plan §5.2 leftover.
Baseline: post-#286.

## 1. Goal

Playwright `toHaveScreenshot()` suites over dedicated, dense fixture
pages, running inside the existing CI browser job. A PR that shifts a
border, breaks dark mode, or un-hides a `[hidden]` element fails with a
pixel diff and an HTML report artifact.

Non-goals: per-component exhaustive matrices (the axes multiply into
thousands of shots — we snapshot *sheets* of many components under a
few high-value axis slices), cross-browser rendering (chromium only,
like the rest of the suite), docs-site screenshots (the docs build has
its own checks), and Percy-style external services (baselines live in
the repo; no new vendors).

## 2. Determinism strategy (the load-bearing decisions)

- **Fonts are the #1 diff source.** The devcontainer ships only
  DejaVu/Free fonts; GitHub's ubuntu runners ship DejaVu + Liberation +
  Noto. The intersection is **DejaVu** — the VRT fixtures pin
  `--hc-font-family-sans/-heading/-mono` to `"DejaVu Sans"` /
  `"DejaVu Sans Mono"` in a fixture-local style block (shipped CSS
  untouched). Both environments then rasterize identical glyphs with
  the same pinned Chromium (Playwright 1.61 on both sides).
- **Same-platform baselines.** Local dev and CI are both linux;
  Playwright's default snapshot naming carries the `-linux` suffix, so
  there is one baseline set, committed to the repo
  (`test-browser/vrt.spec.mjs-snapshots/`, a few MB of PNGs).
- **Motion off, state settled.** `page.emulateMedia({ reducedMotion:
  'reduce' })` (the kit already zeroes gated transitions under it),
  `await document.fonts.ready`, behaviors installed and settled before
  the shot; `toHaveScreenshot` already disables animations and hides
  the caret. Fixed default viewport (Desktop Chrome), `fullPage`
  shots.
- **Tolerance small but nonzero**: `expect.toHaveScreenshot.maxDiffPixels
  = 100` in `playwright.config.mjs` — absorbs single-pixel
  anti-aliasing jitter, still fails on any real visual change.
- **Bootstrap plan if CI still differs**: the browser job already
  uploads the Playwright report on failure; the actual PNGs from that
  artifact become the committed baselines (one extra CI round,
  documented in CONTRIBUTING).

## 3. What gets snapshotted

Three dense fixture pages (each a "sheet" of many components in
realistic states, loading `hc.css` + `hc.behaviors.js` so roles and
JS-applied state render):

| Fixture | Contents |
| --- | --- |
| `vrt-core.html` | Buttons (variants × sizes, disabled), inputs/select/textarea (incl. invalid), checkbox (incl. indeterminate) / radio / switch, field + input-group, badge/chip/avatar/kbd/separator, alert, progress + spinner + skeleton, breadcrumb, pagination, tabs, toolbar, card/item/empty. |
| `vrt-data.html` | Table; datagrid (frozen columns, multi-level header, selected row, multi-row record, selection actions bar visible); code (line numbers + tokens + diff); sparkline; chart table fallback; toc. |
| `vrt-overlays.html` | `<dialog open>` (plain + confirm layout), drawer open state, popover (opened via `showPopover()` in the spec), toast (dispatched via `hc:toast`, sticky so it can't expire mid-shot). |

Axis matrix — high-value slices, not the cross product:

- All three sheets × **light/ltr, dark/ltr, light/rtl, dark/rtl**
  (12 shots) — theme and direction are the axes that break most often
  and the cheapest to flip (`documentElement` attributes at runtime).
- `vrt-core.html` additionally under **`data-density="compact"`** and
  one **`data-color`** accent (2 shots).

≈ 14 baselines. Adding a sheet or an axis later is one line in the
spec's matrix.

## 4. Spec shape

`test-browser/vrt.spec.mjs` — a matrix loop, not hand-written tests:

```js
const SHEETS = ['vrt-core', 'vrt-data', 'vrt-overlays'];
const AXES = { 'light-ltr': {}, 'dark-ltr': { theme: 'dark' },
               'light-rtl': { dir: 'rtl' }, 'dark-rtl': { theme: 'dark', dir: 'rtl' } };
// goto → apply axis attributes → fonts.ready + settle → open overlays
// (vrt-overlays only) → expect(page).toHaveScreenshot(`${sheet}-${axis}.png`,
// { fullPage: true })
```

Axis application is runtime attribute writes (`data-theme`, `dir`,
`data-density`, `data-color`) — exactly the mechanism the kit blesses,
so the matrix also exercises the runtime-axes contract itself.

## 5. Workflow

- **Updating baselines is explicit and reviewed**: after an intentional
  visual change, run
  `pnpm --filter @hypermedia-components/core exec playwright test test-browser/vrt.spec.mjs --update-snapshots`
  and commit the PNG diffs — the PR review shows before/after images
  (GitHub renders image diffs). CONTRIBUTING gains a "Visual
  regressions" section documenting this plus the CI-artifact bootstrap
  path (§2).
- No ci.yml change needed: the browser job already runs every
  `test-browser/*.spec.mjs` and uploads the report on failure.
- CHANGELOG: one Added entry (dev-facing infrastructure).

## 6. PR split

### PR 1 — this plan (`chore(plans)`).

### PR 2 — `test(vrt): Playwright screenshot regression suites`

- [ ] `fixtures/vrt-core.html`, `fixtures/vrt-data.html`,
      `fixtures/vrt-overlays.html` (DejaVu-pinned, dense, static-first).
- [ ] `test-browser/vrt.spec.mjs` (matrix loop) + `toHaveScreenshot`
      expect config in `playwright.config.mjs`.
- [ ] Committed linux baselines (devcontainer-generated; CI-artifact
      bootstrap if the first CI run diffs).
- [ ] CONTRIBUTING "Visual regressions" section; CHANGELOG entry;
      plan Status → shipped.

## 7. Risks / notes

- **Cross-environment raster drift** despite pinned fonts/Chromium —
  contained by `maxDiffPixels`, and by the artifact-bootstrap path if
  containment fails. If drift proves chronic, the fallback is
  generating baselines only in CI (documented, not built, in v1).
- **fullPage height changes** legitimately when components are added to
  a sheet — that is the intended failure mode (update baselines with
  the change, reviewed as images).
- **Overlay shots** depend on behaviors (dialog/toast) — the settle
  step waits on concrete post-conditions (dialog visible, toast
  rendered sticky), not timeouts.
- VRT complements, not replaces, axe scans and behavioral specs — it
  sees only what a sheet shows. Sheets should grow with new
  components; a keystone-style completeness check (every `hc-*.css`
  referenced by some sheet) is a possible follow-up, deliberately not
  in v1.
