# inline-edit — server response contract

Purpose: toggle a cell between a display rendering and an editable
form, swapping the same DOM node each way. No client behavior beyond
htmx — the recipe is purely a server-side state machine.

## Endpoints

| Method | URL                    | Returns                                    |
| ------ | ---------------------- | ------------------------------------------ |
| GET    | `/items/:id/name`      | Display fragment (HTML)                    |
| GET    | `/items/:id/name/edit` | Edit-form fragment (HTML)                  |
| PUT    | `/items/:id/name`      | 200 + display fragment, **or** 422 + edit fragment |

All three return HTML, never JSON. The Cancel button hits
`GET /items/:id/name` to re-render the display state.

## Required client markup

- Display and edit fragments share the same `id` so the
  `data-hx-swap="outerHTML"` swap replaces the entire node each way.
- Display fragment: the value plus a real Edit `<button class="hc-button"
  data-size="sm">` — keyboard reachable, no extra ARIA — carrying
  `data-hx-get="…/edit"`, `data-hx-target="closest span"` (the display
  node), `data-hx-swap="outerHTML"`.
- Edit fragment: `<form data-hx-put="…">`,
  `data-hx-target="this"`, `data-hx-swap="outerHTML"`. The Cancel
  button targets `closest form` so it swaps the whole form back to the
  display fragment. The fragment has no visible `<label>`, so the
  input needs an accessible name (`aria-label="Item name"`).
- A clickable `<span>` display state (`data-hx-trigger="click"` +
  `data-hx-target="this"` on the span itself) is possible but not
  blessed: it needs `role="button"`, `tabindex="0"`, and an
  Enter/Space keydown listener to be keyboard accessible.

## Save flow

1. User activates the Edit button. htmx fetches
   `GET /items/42/name/edit` and swaps the whole display node in place.
2. User types and submits the form.
3. Server validates.
   - **Success** — return the updated display fragment with 200.
     `outerHTML` swap replaces the `<form>` with the new `<span>`;
     htmx re-processes the new attributes.
   - **Failure** — return the edit fragment with 422 (see htmx
     settings below for the swap allowance). Include
     `aria-invalid="true"` and an `aria-describedby` message inside an
     `.hc-field[data-invalid]` wrapper.

## htmx settings

htmx ≥ 2 does not swap non-2xx responses by default. Allow the 422
swap once, globally — the same allowance the field-errors contract
documents:

```js
document.body.addEventListener('htmx:beforeSwap', (event) => {
  if (event.detail.xhr.status === 422) {
    event.detail.shouldSwap = true;
    event.detail.isError = false;
  }
});
```

Alternatives: return `200` with the error fragment, or send
`HX-Reswap` / `HX-Retarget` headers. (`data-hx-target-422="this"` also
works, but requires the htmx response-targets extension.)

## Optimistic interactions

If you want save-on-blur instead of an explicit Save button, add
`data-hx-trigger="blur"` on the input and skip the buttons. Keep the
form wrapper for `name`-based field submission. The Cancel path is
then `Escape` plus a small listener in your bundle that calls
`GET /items/:id/name` (no inline handlers — they break under a CSP).
