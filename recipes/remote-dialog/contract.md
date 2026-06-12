# remote-dialog — server response contract

Purpose: open a dialog whose contents are fetched from the server.

## Required client markup

- Trigger element with `data-hx-get`, `data-hx-target="#dialog-root"`, `data-hx-swap="innerHTML"`.
- Mount point `<div id="dialog-root" data-hc-remote-dialog-root></div>` somewhere on the page.

## Server response

Return a complete `<dialog class="hc-dialog">` element with the dialog content (title, body, footer, form). The dialog should not already be `open`.

Status: `200 OK` with the fragment. A non-2xx response is not swapped
(htmx ≥ 2 default), so no dialog opens — surface the failure via an
`HX-Trigger` toast (see the toast recipe) if the user needs feedback.

## Client behavior

After the swap into `#dialog-root`, `hc.behaviors.js` finds the first `<dialog>` and calls `showModal()`. Forms inside the dialog can use `data-hc-close-dialog-on-success` to close after a successful submission.
