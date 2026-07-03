# multi-step-form — server response contract

Purpose: the hypermedia wizard — the server owns the current step and a
draft of everything entered; the client is one region, one form per
step, and an [hc-stepper](../../packages/core/src/css/hc-stepper.css)
indicator the server re-renders with every response. Both nav
directions are named submits of the same form; **back never
validates** (`formnovalidate`, draft semantics). Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

```html
<section id="wizard">
  <ol class="hc-stepper">
    <li class="hc-stepper__step" data-state="complete">
      <span class="hc-stepper__marker" aria-hidden="true">✓</span>
      <span class="hc-stepper__label">Account <span class="hc-sr-only">(completed)</span></span>
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

  <form method="post" action="/signup/2"
        data-hx-post="/signup/2"
        data-hx-target="#wizard" data-hx-swap="outerHTML"
        data-hx-disabled-elt="find button[type=submit]">
    <div id="wizard-errors"></div>

    …this step's fields, pre-filled from the draft…

    <button class="hc-button" type="submit" name="nav" value="back"
            formnovalidate>Back</button>
    <button class="hc-button" data-variant="primary" type="submit"
            name="nav" value="next">Next</button>
  </form>
</section>
```

- **One region, whole-step swaps**: every response is the complete
  `#wizard` fragment (stepper + form), swapped `outerHTML` —
  idempotent, like a data-region.
- **Both directions are submits of the same form**
  (`name="nav" value="next|back"`): htmx and the native no-JS path
  send identical bodies, and the current step's entries always travel
  with the navigation.
- **Back carries `formnovalidate`** — the load-bearing native detail.
  Without it, the browser's constraint validation (`required` fields on
  the current step) traps the user; with it, back always works and the
  server stores whatever arrived as a draft.
- Step URLs are real (`/signup/1`, `/signup/2`, …) — a no-JS post
  returns the full page at the right step; refresh and deep links land
  on the server's idea of the current step (redirect too-far URLs
  back). CSRF: the [meta convention](../mutating-form/contract.md) on
  the htmx path, the framework's hidden field natively.

## Navigation — `200` + the next whole-step fragment

```text
POST /signup/2      body: …step 2 fields…&nav=next
HTTP/1.1 200 OK
```

Body = the complete `#wizard` fragment for step 3, with the stepper
re-rendered (step 2 now `data-state="complete"` with a `✓` marker) and
step 3's fields pre-filled from the draft.

- **next**: validate this step's fields; on success, merge into the
  draft and render the following step.
- **back**: merge into the draft **without validating** (drafts are
  never validated — only "next" validates), render the previous step
  pre-filled. Round-tripping must be lossless: whatever the user typed
  on step 2 is there again after back-then-next.

## Validation failure on next — `422`, steered into the step

```text
POST /signup/2      (invalid field, nav=next)
HTTP/1.1 422 Unprocessable Entity
HX-Retarget: #wizard-errors
HX-Reswap: innerHTML
```

Body = the canonical [field-errors](../field-errors/) fragment;
`installFieldErrors()` distributes it. **The step is not re-rendered**
— the user's in-progress DOM values stay untouched; only the error
container fills. (Requires the one-time `htmx:beforeSwap` allowance
for `422` — the [mutating-form](../mutating-form/contract.md) wiring.)

## Completion — the mutating-form branching

The final step's `nav=next` finishes the flow:

```text
POST /signup/3      (valid, nav=next)
  (no HX-Request)   → 303 See Other,  Location: /welcome
  HX-Request: true  → 204 No Content,  HX-Redirect: /welcome
```

## Progressive enhancement (no JS)

Real URLs + `method`/`action` + `formnovalidate` mean the whole wizard
works as classic pages: each post returns the full page at the next
(or same, on errors) step. The htmx layer only turns page loads into
region swaps.

## Accessibility

- The stepper is an `<ol>` with `aria-current="step"` and sr-only
  `(completed)` suffixes — state is announced, never only colored.
- `formnovalidate` on back means keyboard users are never trapped on
  an incomplete step by native validation bubbles.
- The `422` path keeps focus management from field-errors (first
  invalid focused); whole-step swaps land a fresh region — put the
  step heading first in the fragment so reading order restarts
  sensibly.

## Notes

- **Draft storage** (session, draft row, signed cookie) is the
  framework's concern; the contract only requires that back-then-next
  round-trips losslessly and that drafts skip validation.
- **File inputs don't round-trip** through drafts (browsers won't
  re-fill them) — upload files separately via the
  [file-upload](../file-upload/) recipe's pattern and reference the
  stored upload in the wizard draft.
- The stepper may render completed steps as links to their step URLs
  for direct revisiting — a plain GET returning the full page or the
  `#wizard` fragment.
