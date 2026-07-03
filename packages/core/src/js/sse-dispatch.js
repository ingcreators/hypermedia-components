// sse-dispatch behavior — bridge SSE events into DOM CustomEvents.
//
// The htmx SSE extension owns the EventSource; a bridge element inside
// its scope declares which server events become page events:
//
//   <div data-hx-ext="sse" data-sse-connect="/events">
//     <span hidden data-hc-sse-dispatch
//           data-sse-swap="hc:toast, items:changed"></span>
//   </div>
//
// For every SSE message the extension delivers to a
// `[data-hc-sse-dispatch]` element, this behavior cancels the swap
// (`htmx:sseBeforeMessage` is cancelable — the bridge never renders)
// and re-dispatches the message as a bubbling CustomEvent named after
// the SSE event, with the JSON-parsed data as `detail`:
//
//   event: hc:toast                          → the toast behavior shows it
//   data: {"message":"Build finished","variant":"success"}
//
//   event: items:changed                     → a data-region listening for
//   data: {}                                   `items:changed from:body` refetches
//
// Payload rules (strict — see the sse-toast recipe contract):
//   - empty data            → `detail` is `{}`
//   - a JSON object         → used as `detail` verbatim
//   - anything else         → dropped (swap still cancelled, no dispatch)
//
// Only event names the page itself lists in `data-sse-swap` ever reach
// the bridge, so the markup is the allowlist — the server cannot mint
// arbitrary DOM event names. The behavior never touches the network:
// no EventSource, no reconnection, no stream parsing.
//
// installSseDispatch() returns an `uninstall` function. Idempotent.

const INSTALL_KEY = '__hcSseDispatchUninstall';

function parseDetail(data) {
  if (data == null || data === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}

/**
 * Install the SSE→DOM event bridge: elements with
 * `data-hc-sse-dispatch` (inside an htmx `data-sse-connect` scope, with
 * the bridged event names in `data-sse-swap`) re-dispatch incoming SSE
 * messages as bubbling CustomEvents instead of swapping them into the
 * DOM. The SSE event name becomes the DOM event name; the JSON payload
 * becomes `detail` (empty data → `{}`; non-object or malformed JSON →
 * the message is dropped).
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installSseDispatch } from '@hypermedia-components/core';
 * installSseDispatch();
 */
export function installSseDispatch(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onBeforeMessage(event) {
    const el = event.target;
    if (!el?.matches?.('[data-hc-sse-dispatch]')) return;

    // The bridge never swaps — cancel before looking at the payload.
    event.preventDefault();

    // The extension forwards the underlying MessageEvent as `detail`:
    // `.type` is the SSE event name, `.data` the payload string.
    const name = event.detail?.type;
    if (!name || typeof name !== 'string') return;

    const detail = parseDetail(event.detail?.data);
    if (detail === null) return;

    el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }

  root.addEventListener('htmx:sseBeforeMessage', onBeforeMessage);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('htmx:sseBeforeMessage', onBeforeMessage);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
