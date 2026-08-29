// network-retry behavior — surface the request that got NO answer.
//
//   <div data-hc-network-retry></div>
//
// Every other error contract assumes a response arrived (the
// fundamentals/errors status-code map). This behavior owns the case
// where none did — airplane mode, a dropped socket, a declared
// timeout — which htmx surfaces as `htmx:sendError` / `htmx:timeout`
// and which the page otherwise swallows silently. "The server is the
// validator and the narrator" has exactly one exception: a network
// failure has no server response to narrate with, so the client
// speaks this once, through the i18n catalog.
//
//   - `htmx:sendError` / `htmx:timeout`, while a
//     `[data-hc-network-retry]` host exists → remember the failed
//     `requestConfig` (one slot — the latest wins, the session-expiry
//     stance) and render an `hc-alert` with a Retry button into the
//     host. Repeat failures re-render in place — one host, one alert
//     (a 2s poller that lost the network must not stack 30 banners).
//   - Retry click → re-issue through `htmx.ajax(verb, path,
//     { source })` if the source is still connected. No `values`
//     override: the request re-collects its inputs, so a retry is a
//     fresh attempt with current values (an idempotency-key hidden
//     field rides along unchanged — that pairing is the recipe's
//     point). The full pipeline re-runs: CSRF header, indicators,
//     target resolution.
//   - `htmx:afterRequest` with a real `xhr.status` on the saved
//     element → clear the alert and the slot. Any actual response —
//     success or error — means "didn't reach the server" is no
//     longer true; error responses belong to the errors map, not to
//     this banner. A status of 0 (the failure itself) never clears.
//
// The host's `data-hc-network-retry-message` /
// `data-hc-network-retry-label` attributes override the catalog
// strings (`networkRetry.failed` / `networkRetry.retry`). The
// behavior never touches the network itself — htmx owns the
// transport — and never auto-retries: retrying is the user's verb.
//
// installNetworkRetry() returns an `uninstall` function. Idempotent.

import { t } from './i18n.js';

const INSTALL_KEY = '__hcNetworkRetryUninstall';
const HOST = '[data-hc-network-retry]';
const RETRY = 'data-hc-network-retry-now';

/**
 * Install the network-failure bridge: when an htmx request gets no
 * answer at all (`htmx:sendError` / `htmx:timeout`), render a retry
 * alert into the `[data-hc-network-retry]` host; the Retry button
 * re-issues the failed request through `htmx.ajax()` with its
 * current input values. See the network-retry recipe contract.
 *
 * @param {Document} [root]
 *   The document to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installNetworkRetry } from '@hypermedia-components/core';
 * installNetworkRetry();
 */
export function installNetworkRetry(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  let failed = null;

  function render(host) {
    const doc = host.ownerDocument;
    const alert = doc.createElement('div');
    alert.className = 'hc-alert';
    alert.setAttribute('data-variant', 'error');
    alert.setAttribute('role', 'status');
    const title = doc.createElement('p');
    title.className = 'hc-alert__title';
    title.textContent =
      host.getAttribute('data-hc-network-retry-message') ||
      t('networkRetry.failed');
    const button = doc.createElement('button');
    button.className = 'hc-button';
    button.type = 'button';
    button.setAttribute(RETRY, '');
    button.textContent =
      host.getAttribute('data-hc-network-retry-label') ||
      t('networkRetry.retry');
    alert.append(title, button);
    host.replaceChildren(alert);
  }

  function clear() {
    failed = null;
    root.querySelector(HOST)?.replaceChildren();
  }

  function onFailure(event) {
    const host = root.querySelector(HOST);
    if (!host) return;
    const config = event.detail?.requestConfig;
    failed = config?.verb && config?.path ? config : null;
    render(host);
  }

  function onAfterRequest(event) {
    if (!failed) return;
    if (!event.detail?.xhr?.status) return; // 0 = the failure itself
    if (event.detail.elt !== failed.elt) return;
    clear();
  }

  function onClick(event) {
    const button = event.target?.closest?.(`[${RETRY}]`);
    if (!button || !root.contains(button)) return;
    const config = failed;
    if (!config) {
      clear();
      return;
    }
    const source = config.elt?.isConnected ? config.elt : null;
    if (!source) {
      clear();
      return;
    }
    const htmx = root.defaultView?.htmx;
    if (!htmx?.ajax) return;
    button.disabled = true;
    htmx.ajax(config.verb, config.path, { source });
  }

  root.addEventListener('htmx:sendError', onFailure);
  root.addEventListener('htmx:timeout', onFailure);
  root.addEventListener('htmx:afterRequest', onAfterRequest);
  root.addEventListener('click', onClick);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('htmx:sendError', onFailure);
    root.removeEventListener('htmx:timeout', onFailure);
    root.removeEventListener('htmx:afterRequest', onAfterRequest);
    root.removeEventListener('click', onClick);
    failed = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
