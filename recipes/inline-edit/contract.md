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
- Display fragment: `data-hx-get="…/edit"`,
  `data-hx-trigger="click"`, `data-hx-target="this"`.
- Edit fragment: `<form data-hx-put="…">`,
  `data-hx-target="this"`, `data-hx-swap="outerHTML"`.

## Save flow

1. User clicks the display node. htmx fetches `GET /items/42/name/edit`
   and swaps the response in place.
2. User types and submits the form.
3. Server validates.
   - **Success** — return the updated display fragment with 200.
     `outerHTML` swap replaces the `<form>` with the new `<span>`;
     htmx re-processes the new attributes.
   - **Failure** — return the edit fragment with 422 (or 200 +
     `HX-Reswap: outerHTML`). Include `aria-invalid="true"` and an
     `aria-describedby` message inside an `.hc-field[data-invalid]`
     wrapper.

## htmx settings

For 4xx responses to be swapped (so validation errors appear in the
page), one of:

- Set the global `htmx.config.responseHandling` to treat 422 as
  swap-eligible; or
- Add `HX-Reswap: outerHTML` and `HX-Retarget: this` headers; or
- Use `data-hx-target-422="this"` on the form to opt the specific
  status code in.

## Optimistic interactions

If you want save-on-blur instead of an explicit Save button, add
`data-hx-trigger="blur"` on the input and skip the buttons. Keep the
form wrapper for `name`-based field submission. The Cancel path is
then `Escape` plus a small inline behavior that calls
`GET /items/:id/name`.
