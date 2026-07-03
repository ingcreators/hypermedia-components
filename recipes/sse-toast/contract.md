# sse-toast — server response contract

Purpose: server-pushed notifications (and other page events) over
Server-Sent Events — an SSE event carrying a JSON payload becomes a
DOM `CustomEvent` via the `installSseDispatch()` bridge, so the
existing [toast](../toast/) contract and the
[data-region](../data-region/) invalidation contract work unchanged
when the *server* initiates. Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

- htmx + the SSE extension (`sse.min.js`, vendored/pinned) and a
  connection scope, as in [sse-updates](../sse-updates/).
- One hidden **bridge element** inside the scope, listing the bridged
  events in `data-sse-swap`:

```html
<div data-hx-ext="sse" data-sse-connect="/events">
  <span hidden data-hc-sse-dispatch
        data-sse-swap="hc:toast, items:changed"></span>
</div>
```

- `installSseDispatch()` and `installToast()` (both in the auto-init
  `@hypermedia-components/core/behaviors` bundle).

## The stream

```text
event: hc:toast
data: {"message":"Build #42 finished","variant":"success"}

event: items:changed
data: {}
```

For each bridged event the swap is cancelled (the bridge never renders)
and a bubbling `CustomEvent` is dispatched instead — the SSE event name
becomes the DOM event name, the JSON payload becomes `detail`:

- **`hc:toast`** — the payload is the toast `detail` shape from the
  [toast contract](../toast/contract.md) (`message` required; `title`,
  `variant`, `duration`, `id`, `action` optional). Server-pushed
  progress can reuse the update-by-`id` pattern (`"id":"build-42"` —
  later events update the same toast in place).
- **Domain events** (`items:changed`, …) — usually `{}`; any
  [data-region](../data-region/contract.md) listening with
  `data-hx-trigger="items:changed from:body"` refetches. The server
  pushes the *invalidation*, the region pulls the re-render — the push
  stays tiny and idempotent, and reconnect gaps self-heal on the next
  event.

### Payload rules (strict)

| data | result |
| --- | --- |
| empty / missing | dispatched with `detail = {}` |
| a JSON **object** | dispatched with that object as `detail` |
| anything else (array, string, number, malformed) | dropped — swap still cancelled, nothing dispatched |

### The markup is the allowlist

Only event names the page lists in the bridge's `data-sse-swap` are
ever dispatched — the server cannot mint DOM event names the page did
not declare. Payloads are inert `CustomEvent.detail` data: never
markup, never evaluated.

## Progressive enhancement (no JS)

Notifications are an enhancement by nature: without JS there is no
toast region either — nothing breaks, the page just doesn't announce.
State the user must not miss belongs in the page (or in an
[sse-updates](../sse-updates/) region), not only in a toast.

## Accessibility

- The toast behavior's roles apply unchanged: `variant: "error"` →
  `role="alert"` (assertive), otherwise `role="status"` (polite).
- Server-pushed toasts arrive without user action — prefer polite
  variants; reserve `error` for things worth interrupting for.
- The bridge element is `hidden` and never receives content or focus.
