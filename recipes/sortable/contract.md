# sortable — server response contract

Purpose: reorder a server-owned list with pointer or keyboard, persisting the new order in one htmx request — the behavior only moves DOM nodes.

## Request

The container's htmx attributes fire on the committed reorder:

```text
POST /items/order
Content-Type: application/x-www-form-urlencoded

order[]=b&order[]=a&order[]=c
```

- `data-hx-trigger="hc:sortchange"` — the behavior dispatches this
  bubbling event from the container only when a drag/keyboard drop
  actually changed the order (a cancelled or unmoved drag stays
  silent).
- `data-hx-include="this"` — serializes every hidden input inside the
  container. Each item carries its own
  `<input type="hidden" name="order[]" value="<id>">`, so moving the
  item moves the input and the request body lists ids in the new
  order. No per-item bookkeeping, no JS serialization.
- A `<form>` around the container plus a submit works identically for
  the no-htmx path.

## Response

- **`204 No Content`** (with `data-hx-swap="none"`) — the client-side
  order is already correct; nothing to swap. Optionally add an
  [`HX-Trigger: {"hc:toast": …}`](../toast/contract.md) header to
  confirm ("Order saved").
- **`200` with a fragment** — when the server re-renders the list
  (e.g. order affects computed rank labels), return the full container
  and swap it (`data-hx-swap="outerHTML"`). The behavior keeps working
  after the swap (delegated listeners).
- **`4xx/5xx`** — htmx leaves the DOM as-is by default; pair with the
  [undo-delete](../undo-delete/contract.md)-style error toast or
  re-render the authoritative order in an error swap so the UI does
  not drift from the server.

## Event detail

`hc:sortchange` (bubbles, from the container):

```js
{
  item,        // the moved element
  from, to,    // old and new index among the container's children
  order,       // every item's data-hc-sortable-id (fallback: id, else null)
}
```

## Behavior flow

1. `hc.behaviors.js` prepares every `[data-hc-sortable-handle]`
   (touch-action, `aria-pressed="false"`, default `aria-label` from the
   i18n key `sortable.handle`) — also for containers swapped in later.
2. **Pointer**: drag starts on the handle after a 4px threshold; the
   item reorders live under the pointer (row and column layouts are
   detected from geometry); Escape cancels and restores; release
   commits.
3. **Keyboard**: Space/Enter on the handle grabs
   (`data-grabbed="true"`, `aria-pressed="true"`, announced);
   ArrowUp/Left and ArrowDown/Right move the item (announced);
   Space/Enter drops and commits; Escape cancels and restores; blur
   commits.
4. A committed change announces through the shared `role="status"` live
   region and dispatches `hc:sortchange`; htmx posts the new order.

## Progressive enhancement

Without the behavior the list renders in server order and the handles
are inert buttons — content stays readable and complete. Reordering is
an enhancement; there is no functionality cliff. For a no-JS ordering
fallback, add per-item "move up / move down" submit buttons the server
handles (the classic pattern) — they compose with this recipe
untouched.

## Accessibility

- The handle is a real `<button>`: focusable, `aria-pressed` reflects
  the grab, and every grab/move/drop/cancel is announced via a
  visually-hidden `role="status"` region (i18n keys `sortable.*` —
  translated via `setMessages()`, ja shipped in `locales/ja`).
- Items keep their natural reading order in the DOM at all times — the
  visual order IS the DOM order, so screen-reader order never drifts.
- `touch-action: none` is applied to handles only — the list itself
  scrolls normally on touch; dragging starts only from the handle.
