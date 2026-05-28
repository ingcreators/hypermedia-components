# confirm-action — server response contract

Purpose: confirm with the user before sending an htmx request.

## Required client markup

- `data-hx-{post|put|patch|delete}` — destructive method and URL.
- `data-hx-trigger="confirmed"` — wait for the confirm behavior to dispatch.
- `data-hc-confirm` — confirm message shown in the shared dialog.
- Optional `data-hx-target`, `data-hx-swap`.

## Behavior flow

1. User clicks the element.
2. `hc.behaviors.js` intercepts the click and opens the shared confirm dialog.
3. User confirms.
4. Behavior dispatches `confirmed` on the original element.
5. htmx sends the request.

## Server response

- Return HTML for the target area; or
- Return `HX-Trigger` with events such as `hc:toast`; or
- Both.
