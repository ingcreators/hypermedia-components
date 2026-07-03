# hc-stepper + multi-step-form — component + recipe plan

Status: **shipped — PR 1 (component, #303) and PR 2 (recipe + E2E, #304).**
The wizard pattern, hypermedia-style: a **zero-JavaScript step
indicator** (server-rendered, state in attributes) plus a recipe where
**the server owns the wizard** — each step is a form fragment, "next"
validates and advances, "back" saves a draft without validating, and
completion is a mutating-form redirect. Baseline: post-#301.

## 1. hc-stepper — a CSS-only component

The indicator renders progress; it does not navigate (navigation is the
form's job, and the server may render completed steps as links if it
wants them clickable). **No behavior, no installer** — the first
JS-zero interactive-looking component in the kit, and deliberately so:
every state change arrives as server-rendered markup.

```html
<ol class="hc-stepper">
  <li class="hc-stepper__step" data-state="complete">
    <span class="hc-stepper__marker" aria-hidden="true">✓</span>
    <span class="hc-stepper__label">Account
      <span class="hc-sr-only">(completed)</span></span>
  </li>
  <li class="hc-stepper__step" aria-current="step">
    <span class="hc-stepper__marker" aria-hidden="true">2</span>
    <span class="hc-stepper__label">Profile</span>
  </li>
  <li class="hc-stepper__step">
    <span class="hc-stepper__marker" aria-hidden="true">3</span>
    <span class="hc-stepper__label">Review</span>
  </li>
</ol>
```

- **The server renders the marker content** (a number, or `✓` when
  complete) — hypermedia over CSS content tricks; the docs bless the
  convention and the sr-only "(completed)" suffix.
- States: `[aria-current="step"]` (accent marker, emphasized label —
  the standard ARIA current-step idiom) and `[data-state="complete"]`
  (filled marker); everything else renders as upcoming (muted).
- Layout: horizontal `<ol>` with connector lines between steps
  (flex + a border pseudo-element on the step, logical properties for
  RTL). `data-size="sm"` variant. Vertical orientation is a v1
  non-goal (noted in the docs).
- Tokens `component.stepper.*`: `marker-size`, `marker-bg/-fg`,
  `current-bg/-fg` (references `semantic.color.action.*` /
  `focus-ring` accents), `complete-bg/-fg`, `connector`, `label`,
  `gap` — all semantic references.
- VRT: core-sheet section (complete/current/upcoming ×2 sizes);
  baselines regenerated.

## 2. multi-step-form — the wizard recipe

The server owns the state (current step + a draft of everything
entered). The client is one region and one form per step:

```html
<section id="wizard">
  <ol class="hc-stepper">…step 2 current…</ol>

  <form method="post" action="/signup/2"
        data-hx-post="/signup/2"
        data-hx-target="#wizard" data-hx-swap="outerHTML"
        data-hx-disabled-elt="find button[type=submit]">
    <div id="wizard-errors"></div>
    …step 2 fields…
    <button class="hc-button" type="submit" name="nav" value="back"
            formnovalidate>Back</button>
    <button class="hc-button" data-variant="primary" type="submit"
            name="nav" value="next">Next</button>
  </form>
</section>
```

### Contract decisions

- **One region, whole-step swaps.** Every response is the complete
  `#wizard` fragment (stepper + that step's form, pre-filled from the
  draft) swapped `outerHTML` — idempotent, same as data-region.
- **Both nav directions are submits of the same form**
  (`name="nav" value="next|back"`); htmx and the native no-JS path
  send identical bodies. **Back carries `formnovalidate`** so the
  browser's constraint validation cannot trap the user on an
  incomplete step; the server saves whatever arrived as a **draft**
  (drafts are never validated — only "next" validates the current
  step's fields).
- **Validation failure on next**: `422` + the field-errors fragment
  steered into `#wizard-errors` (`HX-Retarget`/`HX-Reswap`, the
  file-upload shape — the form's declared target is the wizard region,
  the exception steers). The step is NOT re-rendered; the user's
  in-progress values stay untouched in the DOM.
- **Completion** (final step's next): the mutating-form branching —
  `204` + `HX-Redirect` (htmx) / `303 Location` (no-JS).
- **Step URLs are real** (`/signup/1`, `/signup/2`, …): a no-JS post
  returns the full page at the right step; deep-linking/refresh lands
  on the server's idea of the current step (the server may redirect a
  too-far URL back). CSRF and draft storage (session vs. draft row)
  are the framework's concern — noted, not prescribed.
- **The stepper is display**: clicking it is not the navigation
  mechanism; the server may render completed steps as links to their
  step URL (plain GET → full page or fragment) — documented option.

### checks.json (signature rules)

Detect `form[name] …`? No — detect
`section:has(> .hc-stepper):has(form[data-hx-post])` (the wizard
region). Rules: the form's swap, when declared, is `outerHTML` (E,
only-if-present pattern); both nav submits exist
(`button[name="nav"][value="next"]`, `…[value="back"]`, E);
**back carries `formnovalidate`** (E — the trap: without it, required
fields on the current step block going back); region has an id (E);
`method`+`action` kept (E, no-JS).

## 3. Why this shape

| Principle | How |
| --- | --- |
| Server owns state | Draft + current step live server-side; the client never accumulates hidden-field state across steps. |
| Zero glue JS | Stepper is CSS; the wizard is htmx-native form submits (guard/indicator per request-action). |
| PE | Real URLs + `method`/`action` + `formnovalidate` → the whole wizard works without JS as classic pages. |
| Composition | field-errors (422), mutating-form (completion), request-action (buttons), data-region idiom (idempotent region swap). |

## 4. Tests

- **Component**: stylelint + VRT states (no JS to unit-test).
- **Recipe browser E2E** (mock wizard with 3 steps + module-level
  draft, reset route for isolation): next advances and re-renders the
  stepper (`aria-current` moves, step 1 shows `✓`); **back with
  `formnovalidate` leaves an invalid step** and the draft round-trips
  (step 1's field comes back pre-filled); `422` on next keeps the DOM
  values and shows inline errors; completion redirects
  (`HX-Redirect`); axe on each visited step.
- CLI keystone covers the new checks.json (20th recipe).

## 5. Public API surface

Additive → patch: `hc-stepper` class vocabulary + `data-state`
values + `--hc-stepper-*` tokens; the `multi-step-form` recipe
contract. **No new JS exports, events, attributes, or i18n keys.**

## 6. PR split

### PR 1 — `feat(stepper): zero-JS step indicator`
- [ ] `component.tokens.json` `stepper.*` + `hc-stepper.css` +
      bundle-css registration.
- [ ] Docs `components/stepper.mdx` (Demo, states, tokens, a11y —
      incl. the server-renders-the-marker convention).
- [ ] VRT core-sheet section + regenerated baselines.
- [ ] CHANGELOG; plan Status update.

### PR 2 — `docs(recipes): bless multi-step-form (the hypermedia wizard)`
- [ ] `recipes/multi-step-form/{recipe,expanded,contract,checks}` +
      README row + docs page.
- [ ] serve.mjs 3-step wizard mock (draft state + reset route);
      fixture + `test-browser/multi-step-form.spec.mjs` (§4).
- [ ] CHANGELOG; plan Status → shipped.

## 7. Risks / notes

- `formnovalidate` is the load-bearing native detail — E2E pins that
  back escapes an invalid step, and the checks rule makes omitting it
  a validation error.
- Draft semantics (what back saves) are contract prose; storage is
  framework territory.
- Steps with file inputs interact with draft round-trips awkwardly
  (files don't re-fill) — documented limitation pointing at the
  file-upload recipe's separate-upload pattern.
