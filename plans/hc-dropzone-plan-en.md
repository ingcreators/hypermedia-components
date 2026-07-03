# hc-dropzone — drag-and-drop upload surface

Status: **shipped — PR 1 (component, #300) and PR 2 (file-upload variant + E2E, #301).**
The follow-up the file-upload recipe (#295–#297) names explicitly: a
drag-and-drop surface that plugs into the shipped contract **without
changing it** — the dropzone is a decorated wrapper around the native
`<input type="file">`, so form serialization, the progress bridge, the
OOB reset and the `422` path all work unchanged. First net-new
component since 0.1.6; the Component DoD (v0.4 plan §17.3) applies.
Baseline: core `0.1.7`.

## 1. The design in one sentence

A `<label class="hc-dropzone">` wraps a visually-hidden-but-focusable
file input; **click-to-browse and keyboard are 100 % native** (label
activation, focus + Enter/Space on the input), and the only JavaScript
is the drag path: drop → assign `dataTransfer.files` to the input →
dispatch a bubbling `change` — from that point the browser cannot tell
the file wasn't picked normally.

```html
<label class="hc-dropzone">
  <input class="hc-dropzone__input" type="file" name="doc" required
         accept=".pdf,.png">
  <span class="hc-dropzone__body">
    <span class="hc-dropzone__hint">Drop a file here, or click to browse</span>
    <span class="hc-dropzone__files"></span>
  </span>
</label>
```

## 2. CSS API (`hc-dropzone.css` + `component.dropzone.*` tokens)

- Block: dashed border, centered content, generous padding —
  `--hc-dropzone-{bg,border,fg,radius,padding-y,padding-x}` from
  semantic tokens (`surface`, `border`, `text-muted`,
  `control.radius`, spaces).
- **States, all attribute/pseudo-driven** (kit doctrine):
  - `[data-dragover]` (set by the behavior while a file drags over) →
    `--hc-dropzone-dragover-border/-bg` referencing
    `{semantic.color.focus-ring}` (follows `data-color` accents) + a
    `color-mix` tint.
  - `:focus-within` → the standard focus ring (keyboard focus lives on
    the hidden input).
  - `:has(> .hc-dropzone__input:disabled)` → muted, `cursor:
    not-allowed`.
  - `:has(> .hc-dropzone__input[aria-invalid="true"])` → error border
    (field-errors marks the input; the surface follows).
- `.hc-dropzone__input` is visually hidden in place (clip pattern, not
  `display:none` — it must stay focusable and participate in
  constraint validation popups).
- `.hc-dropzone__files` renders the selected names (behavior-set
  text); empty by default. `data-size="sm"` variant for compact forms.
- Registered in `bundle-css.mjs` COMPONENTS and exercised by the VRT
  core sheet (idle + a statically-set `[data-dragover]` clone) —
  baseline regeneration reviewed as image diffs per CONTRIBUTING.

## 3. Behavior (`src/js/dropzone.js`, `installDropzone()`)

Root-delegated (the established shape; idempotent, uninstaller):

- `dragover` on a `.hc-dropzone` whose `dataTransfer.types` includes
  `Files`: `preventDefault()` (required to allow the drop) + set
  `data-dragover`.
- `dragleave`: clear `data-dragover` unless `relatedTarget` is still
  inside the zone (the classic child-flicker guard); `drop` and
  `dragend` always clear.
- `drop`: `preventDefault()`; respect `multiple` — a single-file input
  receives only the first file (rebuilt via `new DataTransfer()`);
  assign `input.files`, dispatch a bubbling `change` on the input.
  Everything downstream (htmx form serialization, validation, the
  upload-progress bridge) reacts to that native event.
- `change` (any source — drop *or* native browse): render the selected
  file names into `.hc-dropzone__files` (`textContent`, joined with
  `", "`; cleared when empty). Names are data, the hint is authored
  markup — **no i18n keys needed**.
- No new public events, no network, no `fetch`.

## 4. Accessibility notes (DoD)

- The interactive element IS the native input: label click opens the
  picker, keyboard focus lands on the input (ring via
  `:focus-within`), Enter/Space open the picker natively, constraint
  validation (`required`, `accept`) and field-errors wiring
  (`aria-invalid`, `aria-describedby`) attach to the input as usual.
- Drag-and-drop is a pointer-only *enhancement*; every outcome it
  produces is reachable via browse. No ARIA is invented; the zone
  stays a `<label>`.
- Selected-file names are visible text inside the label (announced as
  part of it); apps needing an announcement on change can pair with a
  toast — noted, not built.

## 5. Public API surface

Additive → patch: component class vocabulary
(`hc-dropzone`, `__input`, `__body`, `__hint`, `__files`), state
attribute `data-dragover`, tokens `--hc-dropzone-*`, export
`installDropzone` (auto-init). No new events, no i18n keys.

## 6. PR split

### PR 1 — `feat(dropzone): drag-and-drop upload surface`
- [ ] `component.tokens.json` `dropzone.*` + `hc-dropzone.css` +
      `bundle-css.mjs` registration.
- [ ] `src/js/dropzone.js` + behaviors/index/bundle-js registration.
- [ ] `test/dropzone.test.mjs` (jsdom, synthetic drag events with
      stubbed `dataTransfer`): dragover sets / child-flicker keeps /
      leave-outside clears `data-dragover`; Files-only filtering; drop
      assigns files + fires bubbling `change`; single-file inputs take
      one file; names rendering on drop and on native change;
      idempotent; uninstall.
- [ ] Docs `components/dropzone.mdx` (Demo, states, tokens, a11y,
      recipe pointer).
- [ ] VRT: `vrt-core.html` section + regenerated core-sheet baselines.
- [ ] CHANGELOG; plan Status update.

### PR 2 — `docs(recipes): file-upload dropzone variant + E2E`
- [ ] file-upload `contract.md` + docs page: the dropzone variant
      (replaces the "follow-up" note); `expanded.html` gains the
      variant fragment.
- [ ] Browser E2E (`file-upload.spec.mjs` additions): a
      page-constructed `DataTransfer` + `File` dropped on the zone runs
      the **whole shipped pipeline** — progress to 100, item appended,
      OOB reset (also resets the dropzone's names display), and the
      dropzone-level `422` path; axe with the zone focused and
      dragover.
- [ ] CHANGELOG; plan Status → shipped.

## 7. Risks / notes

- **`input.files` assignment** is standard (settable `files` since
  Chromium 60+/FF 57+); the E2E pins it in the real browser.
- **jsdom drag events** lack `DataTransfer` — unit tests stub
  `{ types, files }` objects on synthetic events (the behavior only
  reads those two properties).
- `:has()` in the disabled/invalid state selectors matches the kit's
  existing baseline (datagrid already requires `:has`).
- The dropzone deliberately does **not** implement paste-to-upload or
  directory drops in v1 — noted in the docs as non-goals.
