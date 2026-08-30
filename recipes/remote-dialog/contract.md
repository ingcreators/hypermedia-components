# remote-dialog — server response contract

Purpose: open a dialog whose contents are fetched from the server.

## Required client markup

- Trigger element with `data-hx-get`, `data-hx-target="#dialog-root"`, `data-hx-swap="innerHTML"`.
- Mount point `<div id="dialog-root" data-hc-remote-dialog-root></div>` somewhere on the page.

## Server response

Return a complete `<dialog class="hc-dialog">` element with the dialog content (title, body, footer, form). The dialog should not already be `open`. Give the Cancel button its own `<form method="dialog">` — the native, JS-free way to close a `<dialog>` (forms cannot nest, so the footer sits outside the edit form and the Save button reaches it via the `form` attribute).

Status: `200 OK` with the fragment. If the *initial* GET fails, a
non-2xx response is not swapped (htmx ≥ 2 default), so no dialog opens
— surface the failure via an `HX-Trigger` toast (see the toast recipe)
if the user needs feedback.

A submit that fails validation answers `422` with the whole dialog
re-rendered in its error state **plus `HX-Retarget: #dialog-root` and
`HX-Reswap: innerHTML`** (and requires the one-time `htmx:beforeSwap`
allowance for 422). Retargeting the root matters: re-swapping the open
dialog with `outerHTML` would insert a fresh **closed** `<dialog>` and
fire `afterSwap` on it — not on the root the behavior watches — so the
error state would land invisible. Swapping the root re-runs
`installRemoteDialog` and the dialog re-opens showing the errors.

## Client behavior

After the swap into `#dialog-root`, `hc.behaviors.js` finds the first `<dialog>` and calls `showModal()`. Forms inside the dialog can use `data-hc-close-dialog-on-success` to close after a successful submission.
