// csrf-header behavior — the blessed CSRF token delivery convention for
// htmx requests (#246).
//
// Contract:
//   - The server's layout renders the token into the page head:
//
//       <meta name="csrf-token" content="…">
//
//     The header name defaults to `X-CSRF-Token` and is configurable on
//     the carrier for stacks that expect a different one:
//
//       <meta name="csrf-token" content="…" data-header="X-CSRFToken">
//
//   - On every `htmx:configRequest` the behavior reads the meta tag —
//     at request time, so server-side token rotation needs no
//     re-install — and adds the header to the outgoing request.
//   - A header already present in `event.detail.headers` is never
//     overwritten: a per-request `data-hx-headers` (or an earlier
//     listener) wins over the page-level convention.
//   - No meta tag, or an empty `content` → strict no-op.
//
// The behavior never makes a request — htmx owns the network. Plain
// `<form method="post">` submissions never fire `htmx:configRequest`;
// no-JS degradation needs the framework's hidden-field mechanism.
//
// installCsrfHeader() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcCsrfHeaderUninstall';

const DEFAULT_HEADER = 'X-CSRF-Token';

/**
 * Install the csrf-header behavior: attach the page's CSRF token
 * (`<meta name="csrf-token" content="…">`, header name from the meta's
 * `data-header` attribute, default `X-CSRF-Token`) to every htmx
 * request via `htmx:configRequest`.
 *
 * The meta tag is read at request time, so a rotated token is picked
 * up automatically. A header already set on the request (e.g. via
 * `data-hx-headers`) is left untouched. Without the meta tag the
 * behavior is inert.
 *
 * @param {Document} [root]
 *   The root to listen on. Defaults to the global document when
 *   available.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * // <head>
 * //   <meta name="csrf-token" content="3x4mpl3…">
 * // </head>
 *
 * import { installCsrfHeader } from '@hypermedia-components/core';
 * installCsrfHeader();
 */
export function installCsrfHeader(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onConfigRequest(event) {
    const headers = event?.detail?.headers;
    if (!headers || typeof headers !== 'object') return;

    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const meta = doc.querySelector('meta[name="csrf-token"]');
    const token = meta?.getAttribute('content');
    if (!token) return;

    const header = meta.getAttribute('data-header') || DEFAULT_HEADER;
    if (header in headers) return; // an explicit per-request header wins
    headers[header] = token;
  }

  root.addEventListener('htmx:configRequest', onConfigRequest);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('htmx:configRequest', onConfigRequest);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
