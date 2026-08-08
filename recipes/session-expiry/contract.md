# session-expiry — server response contract

Purpose: session expiry without lost work — a 401 turns any interrupted action into a login dialog, and signing in replays the interrupted request through installSessionExpiry.

## Required client markup

- One shared host at body end:
  `<div id="error-dialog" data-hc-remote-dialog-root data-hc-session-expiry></div>`.
  `data-hc-remote-dialog-root` (installRemoteDialog, shipped) opens any
  `<dialog>` swapped into it; `data-hc-session-expiry` arms the replay
  bridge (installSessionExpiry, auto-installed).
- The page-level allowance must include `401` (the same
  `htmx:beforeSwap` shape the 422 branch documents):

  ```js
  document.body.addEventListener('htmx:beforeSwap', (event) => {
    if ([401, 422].includes(event.detail.xhr.status)) {
      event.detail.shouldSwap = true;
      event.detail.isError = false;
    }
  });
  ```

## Endpoints

| Case | Response |
| --- | --- |
| any protected endpoint, session expired, htmx request | `401` + `HX-Retarget: #error-dialog` + `HX-Reswap: innerHTML` + a login `<dialog class="hc-dialog">` fragment (see `expanded.html`). The server must 401 **before acting** — replay safety depends on it |
| login success | `200` + empty body + `HX-Trigger: {"hc:sessionrenewed": {}}` (\uXXXX-escape non-ASCII if the payload ever carries text) — the bridge closes the dialog and replays the interrupted request |
| login failure | `422` + the same dialog re-rendered with [field-errors](../field-errors/) inline |
| non-htmx (no-JS) request, session expired | `303` to the login page with `?next=` — the classic full-page fallback |

## Replay semantics

- installSessionExpiry stores **the latest** interrupted
  `requestConfig` (one slot; parallel interruptions keep the last) and
  replays it via `htmx.ajax(verb, path, { source, values })` once
  `hc:sessionrenewed` arrives.
- The replay re-runs the normal pipeline: a rotated CSRF token is
  picked up fresh by [installCsrfHeader](../../packages/core/src/js/csrf-header.js),
  indicators and target resolution behave as if the user clicked again.
- Multi-value form fields collapse to their last value on replay
  (`Object.fromEntries`) — forms relying on repeated names should
  degrade to the no-JS branch instead.
- If the interrupted element left the DOM before renewal, the replay is
  skipped — the stored config never survives a full page load.

## Accessibility

- The login dialog is a real `<dialog>` opened with `showModal()`
  (focus trapping and `Escape` come native); `aria-labelledby` names
  it.
- Cancel is a `<form method="dialog">` button — declarative close, no
  inline JS (CSP-safe).
- After replay the outcome lands in the action's own `aria-live`
  status target, so the completion is announced.

## Notes

- The server decides *which* endpoints are protected; the contract only
  fixes the 401 shape. Idempotence of replayed GETs is trivial;
  replayed mutations are safe because the 401 happened before the
  handler ran.
- One host per page: parallel error dialogs are out of scope — the
  newest swap wins the slot.
