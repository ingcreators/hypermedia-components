# confirm-action — server response contract

Purpose: confirm with the user before sending an htmx request or
submitting a plain form.

## Required client markup

htmx variant:

- `data-hx-{post|put|patch|delete}` — destructive method and URL.
- `data-hx-trigger="hc:confirmed"` — wait for the confirm behavior to dispatch.
- `data-hc-confirm` — confirm message shown in the shared dialog.
- Optional `data-hx-target`, `data-hx-swap`.

Plain-form variant:

- A submit button (`<button>` / `<input type="submit">`) inside — or
  `form=""`-associated with — an ordinary `<form>`.
- `data-hc-confirm` on the button.
- No htmx verb attribute on the button or the form.

## Behavior flow

1. User clicks the element.
2. `hc.behaviors.js` intercepts the click and opens the shared confirm dialog.
3. User confirms.
4. Behavior dispatches `hc:confirmed` on the original element.
5. htmx sends the request. If instead the element is a submit button of
   a plain form (no htmx verb on button or form), the behavior calls
   `form.requestSubmit(button)` — the button is the submitter
   (`formaction`/`formmethod` honored) and constraint validation runs.
   Cancel submits nothing.

## Server response

- Return HTML for the target area; or
- Return `HX-Trigger` with events such as `hc:toast`; or
- Both.

Status: any `2xx` for the swap and/or header. A non-2xx response is not
swapped (htmx ≥ 2 default); note that `hc:confirmed` has already fired
by then — the confirmation gates the *request*, not its outcome.
