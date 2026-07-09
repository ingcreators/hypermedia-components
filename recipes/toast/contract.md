# toast — server response contract

Purpose: surface a short, time-limited notification triggered by the server
or by client code, without coupling the trigger to a specific DOM
location.

## Required client markup

- A single `<div class="hc-toast-region" data-hc-toast-region
  role="region" aria-label="Notifications">` somewhere on the page.
  `installToast` lazy-creates one if it is missing, but rendering it
  explicitly avoids a layout shift on the first toast.
- `installToast()` must be installed (the auto-init
  `@hypermedia-components/core/behaviors` entry does this on
  `DOMContentLoaded`).

## Trigger flow

Two equivalent triggers:

1. **From the server** — return an `HX-Trigger` response header. htmx
   parses it and dispatches the named event on `<body>`:

   ```text
   HX-Trigger: {"hc:toast":{"message":"Saved","variant":"success"}}
   ```

2. **From the client** — dispatch the same event directly:

   ```js
   document.body.dispatchEvent(new CustomEvent('hc:toast', {
     bubbles: true,
     detail: { message: 'Saved', variant: 'success' },
   }));
   ```

The behavior listens for `hc:toast` on `document.body`, renders a
`.hc-toast` element into the region, and removes it after
`detail.duration` ms.

## Event detail shape

| Field      | Type   | Default      | Notes                                          |
| ---------- | ------ | ------------ | ---------------------------------------------- |
| `message`  | string | _(required)_ | Body text.                                     |
| `title`    | string | _(omitted)_  | Bold one-liner above the message.              |
| `variant`  | string | `'info'`     | `info` / `success` / `warning` / `error`.     |
| `duration` | number | `4500`       | Milliseconds. `0` keeps the toast indefinitely. |
| `id`       | string | _(omitted)_  | Stable handle: a later `hc:toast` with the same `id` updates the existing toast in place (loading → success / error). |
| `action`   | object | _(omitted)_  | `{ label, event }`: renders an action button; activation dispatches a bubbling `CustomEvent(event)` with `detail: { id, action, toast }` and dismisses the toast. Escape dismisses the focused toast without firing the event. |

Every toast also renders a **close button** (`.hc-toast__close`,
`aria-label` from the `toast.dismiss` catalog message) — the visible
dismiss affordance, so sticky toasts (`duration: 0`) stay dismissable
with a pointer even without an `action`.

`variant="error"` is mapped to `role="alert"` /
`aria-live="assertive"` so screen readers interrupt to announce it.
Other variants use `role="status"` / `aria-live="polite"`.

## Server response examples

Multi-event responses combine `hc:toast` with other application
events:

```text
HX-Trigger: {"hc:toast":{"message":"Saved"}, "items:refresh":true}
```

Sticky error toasts use `duration: 0`:

```text
HX-Trigger: {"hc:toast":{"title":"Sync failed","message":"Could not reach the server","variant":"error","duration":0}}
```

Status: the toast is header-driven, not swap-driven — a `204 No Content`
plus the `HX-Trigger` header is the minimal success response when
nothing on the page changes.
