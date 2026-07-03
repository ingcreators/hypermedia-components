// upload-progress behavior — drive a native <progress> from htmx's
// upload progress events.
//
//   <form data-hx-post="/files" data-hx-encoding="multipart/form-data"
//         enctype="multipart/form-data" method="post" action="/files"
//         data-hx-indicator="find progress">
//     <input class="hc-input" type="file" name="doc">
//     <progress class="hc-progress htmx-indicator" data-hc-upload-progress
//               value="0" max="100" aria-label="Upload progress"></progress>
//     …
//   </form>
//
// The bar lives inside the requesting form. Visibility is htmx-native
// (`data-hx-indicator` + the `htmx-indicator` class); this behavior only
// sets `value`:
//
//   - `htmx:beforeRequest` resets the bar to 0.
//   - `htmx:xhr:progress` maps `loaded/total` onto 0–100 — but
//     monotonically within one request: htmx fires the event for BOTH
//     the upload and the response-download phase, and the download's
//     small `total` would otherwise rewind the bar at the end.
//   - `htmx:afterRequest` settles the bar at 100.
//
// The behavior never touches the network — htmx owns the transport.
// installUploadProgress() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcUploadProgressUninstall';
const BAR = '[data-hc-upload-progress]';

function barsOf(event) {
  const elt = event.target;
  return elt?.querySelectorAll ? elt.querySelectorAll(BAR) : [];
}

/**
 * Install the upload progress bridge: `<progress data-hc-upload-progress>`
 * elements inside a requesting form track the request's upload progress
 * (0–100, monotonic within a request, settled at 100). Pair with
 * `data-hx-indicator` / the `htmx-indicator` class for visibility.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installUploadProgress } from '@hypermedia-components/core';
 * installUploadProgress();
 */
export function installUploadProgress(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onBeforeRequest(event) {
    for (const bar of barsOf(event)) bar.value = 0;
  }

  function onProgress(event) {
    const { lengthComputable, loaded, total } = event.detail ?? {};
    if (!lengthComputable || !(total > 0)) return;
    const pct = Math.min(100, Math.round((100 * loaded) / total));
    for (const bar of barsOf(event)) {
      // Monotonic within the request — the response-download phase
      // re-fires this event with a new, small total (see header comment).
      if (pct > bar.value) bar.value = pct;
    }
  }

  function onAfterRequest(event) {
    for (const bar of barsOf(event)) bar.value = 100;
  }

  root.addEventListener('htmx:beforeRequest', onBeforeRequest);
  root.addEventListener('htmx:xhr:progress', onProgress);
  root.addEventListener('htmx:afterRequest', onAfterRequest);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('htmx:beforeRequest', onBeforeRequest);
    root.removeEventListener('htmx:xhr:progress', onProgress);
    root.removeEventListener('htmx:afterRequest', onAfterRequest);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
