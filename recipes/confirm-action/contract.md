# confirm-action — server response contract

Purpose: confirm with the user before sending an htmx request.

## Required client markup

- `data-hx-{post|put|patch|delete}` — destructive method and URL.
- `data-hx-trigger="hc:confirmed"` — wait for the confirm behavior to dispatch.
- `data-hc-confirm` — confirm message shown in the shared dialog.
- Optional `data-hx-target`, `data-hx-swap`.

## Behavior flow

1. User clicks the element.
2. `hc.behaviors.js` intercepts the click and opens the shared confirm dialog.
3. User confirms.
4. Behavior dispatches `hc:confirmed` on the original element.
5. htmx sends the request.

## Server response

- Return HTML for the target area; or
- Return `HX-Trigger` with events such as `hc:toast`; or
- Both.

Status: any `2xx` for the swap and/or header. A non-2xx response is not
swapped (htmx ≥ 2 default); note that `hc:confirmed` has already fired
by then — the confirmation gates the *request*, not its outcome.
