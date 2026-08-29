# workflow-actions — server response contract

Purpose: drive a record's lifecycle (draft → submitted → approved / returned / withdrawn) from a server-rendered actions region — the action set IS the state, transitions collide loudly, and the stepper is the same truth in picture form.

## The rule

**The server renders only the legal transitions for this user on this
version.** There is no client-side state machine, no role check in
JS, no hidden-then-shown button. Two different absences, rendered
differently:

- What the user **can never do** (wrong role) — **not rendered at
  all**.
- What the user **could do but not now** (wrong state, missing
  precondition) — rendered **`aria-disabled="true"` with the reason**
  (`title` or adjacent text). A visible refusal teaches the
  lifecycle; a missing button teaches nothing.

## Required client markup

One `<form method="post" action="…/transition" data-hc-workflow>`
region (the marker is contract-only) containing:

- the hidden **`version`** — the [edit-conflict](../edit-conflict/)
  optimistic lock applied to state,
- the **`hc-stepper`** rendering the lifecycle position
  (`aria-current="step"`, `data-state="complete"`),
- a labelled toolbar of **`type="submit"` buttons,
  `name="transition" value="<verb>"`**, each POSTing the region's
  endpoint with `data-hx-target` = the region and
  **`data-hx-swap="outerHTML"`** — state, version, stepper, and
  buttons must always change together.

A read-only viewer gets the stepper without the form (and without the
marker) — a region that offers no transitions is not a workflow
surface.

## Endpoints

| Method | URL | Returns |
| --- | --- | --- |
| POST | `/docs/42/transition` (`transition` + `version` + optional `comment`) | **200** applied · **422** comment required · **409** stale/illegal — always the re-rendered region |

## Responses

- **200 — applied.** The region re-rendered in the new state: bumped
  `version`, moved stepper, the *next* legal action set. Optionally
  an `HX-Trigger` toast ("Approved").
- **422 — comment required.** Transitions that need a reason
  (return, reject) respond with the same region plus the comment
  field **rendered only now**, `required` and marked
  (`aria-invalid`, `hc-field__message`). The user fills it and
  presses the same button; `version` is untouched.
- **409 — stale or illegal.** Someone else moved the document first
  (version mismatch), or the transition is not legal from the current
  state (a double-click racing itself). The response is the region
  re-rendered **from current truth** — their state, the new version,
  whatever actions remain legal — plus a who-won explanation
  (`hc-alert`, `role="status"`) and optionally a toast. **The stale
  action is never applied and the region never silently refreshes
  into a state the user didn't see.**

The 409/422 fragments need the standard one-line `beforeSwap`
allowance (see [mutating-form](../mutating-form/contract.md)).

## Progressive enhancement

The buttons are native submits: without htmx the form POSTs to
`action` and the server renders the full document page with the same
re-rendered region (409/422 included — they are pages too). Nothing
about the lifecycle lives in JavaScript.

## Accessibility

- The toolbar is `role="toolbar"` with an `aria-label`.
- The stepper announces position via `aria-current="step"`; completed
  steps carry visually hidden "(completed)" text (`hc-sr-only`).
- The 409 explanation is `role="status"` — a persistent state, read
  politely, exactly the [result-cap](../result-cap/contract.md)
  banner stance.
- Disabled-with-reason buttons keep the reason perceivable (adjacent
  text beats `title` alone when the reason matters).

## Notes

- **The queue side** of the same workflow is
  [datagrid-snapshot-pager](../datagrid-snapshot-pager/contract.md);
  this recipe is the document detail it opens into. The queue's bulk
  approve and this region's single approve should share the
  transition endpoint.
- **Dangerous transitions** (reject-final, withdraw) compose with
  [confirm-action](../confirm-action/contract.md).
- **Double-click safety** beyond the 409 comes from the
  idempotency-key contract (this plan's final recipe): replaying the
  same submission returns the original response instead of a
  conflict.
- **Who may transition what** is policy the server already owns; this
  contract only fixes *where it becomes markup* (the render) and
  *what a violation returns* (409, current truth).
