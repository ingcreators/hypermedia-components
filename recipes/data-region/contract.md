# data-region — server response contract

Purpose: a named region the server can re-render on demand. Other parts of the page invalidate it by dispatching a domain event.

## Required client markup

- `<section id="..." class="hc-data-region">` with `data-hx-get` and `data-hx-swap="outerHTML"`.
- `data-hx-trigger="load, <event>:<name> from:body"` — load on first render, refresh when an event fires anywhere on the body.

## Invalidation pattern

Other recipes (confirm-action, remote-dialog, …) can invalidate the region by returning an `HX-Trigger` header:

```http
HX-Trigger: {"items:changed":{}}
```

…or by dispatching the event from client behaviors after a local update.

## Server response

Return the complete `<section>` element (same id, same class, same attributes) so the swap is idempotent. Include an empty state when there are no rows.

Status: `200 OK` with the fragment. A non-2xx response is not swapped
(htmx ≥ 2 default), so the region keeps its previous rendering.
