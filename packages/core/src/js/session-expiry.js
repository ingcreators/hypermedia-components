// session-expiry behavior — replay the request a 401 interrupted.
//
//   <div id="error-dialog" data-hc-remote-dialog-root
//        data-hc-session-expiry></div>
//
// The server contract (recipes/session-expiry/contract.md) does the
// heavy lifting: an expired-session 401 carries HX-Retarget/HX-Reswap
// aiming a login <dialog> at the host above, the page-level allowance
// lets the error fragment swap, and installRemoteDialog (shipped) opens
// it. This behavior adds the part markup cannot: **memory**.
//
//   - `htmx:beforeSwap` with `xhr.status === 401`, while a
//     `[data-hc-session-expiry]` host exists → remember the interrupted
//     `requestConfig` (one slot — the latest wins).
//   - `hc:sessionrenewed` (the login success response's `HX-Trigger`)
//     → close the host's open dialog and replay the stored request via
//     `htmx.ajax(verb, path, { source, values })`. The replay re-runs
//     the full pipeline — fresh CSRF header (installCsrfHeader reads
//     per-request), indicators, target resolution.
//
// The behavior never sets `shouldSwap` itself (the allowance stays
// page-owned and status-based, like the 422 branch) and never touches
// the network directly — htmx owns the transport; this only drives
// htmx's public API. Multi-value form fields collapse to their last
// value on replay (Object.fromEntries) — documented in the contract.
//
// installSessionExpiry() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcSessionExpiryUninstall';
const HOST = '[data-hc-session-expiry]';

/**
 * Install the session-expiry replay bridge: remember the request a 401
 * interrupted (while a `[data-hc-session-expiry]` host exists) and
 * re-issue it through `htmx.ajax()` when the login flow dispatches
 * `hc:sessionrenewed`. Pair with a `data-hc-remote-dialog-root` host
 * and the page-level beforeSwap allowance — see the session-expiry
 * recipe contract.
 *
 * @param {Document} [root]
 *   The document to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installSessionExpiry } from '@hypermedia-components/core';
 * installSessionExpiry();
 */
export function installSessionExpiry(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  let interrupted = null;

  function onBeforeSwap(event) {
    if (event.detail?.xhr?.status !== 401) return;
    if (!root.querySelector(HOST)) return;
    const config = event.detail.requestConfig;
    if (config?.verb && config?.path) interrupted = config;
  }

  function onRenewed() {
    const host = root.querySelector(HOST);
    host?.querySelector('dialog[open]')?.close();
    const config = interrupted;
    interrupted = null;
    if (!config) return;
    const source = config.elt?.isConnected ? config.elt : null;
    if (!source) return;
    const htmx = root.defaultView?.htmx;
    if (!htmx?.ajax) return;
    const values =
      config.parameters && typeof config.parameters.entries === 'function'
        ? Object.fromEntries(config.parameters.entries())
        : config.parameters;
    htmx.ajax(config.verb, config.path, { source, values });
  }

  root.addEventListener('htmx:beforeSwap', onBeforeSwap);
  root.addEventListener('hc:sessionrenewed', onRenewed);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('htmx:beforeSwap', onBeforeSwap);
    root.removeEventListener('hc:sessionrenewed', onRenewed);
    interrupted = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
