// copy behavior — declarative copy-to-clipboard (#270).
//
// A read-only value that exists to be copied (a share URL, an API token,
// a generated SQL / config snippet) should not force a manual select-all +
// Ctrl/Cmd-C. This behavior wires a `<button>` to copy a named element's
// value — or a literal string — to the clipboard, with no inline JS, so it
// works under a strict `Content-Security-Policy: default-src 'self'`.
//
//   <div class="hc-cluster">
//     <input id="share-url" class="hc-input" type="text" readonly value="https://…">
//     <button class="hc-button" data-variant="ghost"
//             data-hc-copy="#share-url" data-hc-copy-ok="Copied">Copy</button>
//   </div>
//
// Attribute contract (on the trigger, all optional except one source):
//   data-hc-copy="<css-selector>"  copy the referenced element's `.value`
//                                  (input/textarea/select) or `.textContent`.
//   data-hc-copy-text="<literal>"  copy a literal string instead (no target).
//   data-hc-copy-ok="<label>"      transient success label announced to AT;
//                                  defaults to the i18n catalog (`copy.ok`).
//
// On a successful copy the behavior:
//   - sets `data-hc-copied` on the button for ~1.5 s (CSS can reflect it /
//     swap a child label) — the button's own accessible name is never
//     touched, so AT users keep a stable control name;
//   - announces the success label through a behavior-owned, visually-hidden
//     `role="status"` live region;
//   - dispatches a bubbling `hc:copied` CustomEvent (`detail: { text }`) so an
//     app can chain it — e.g. `data-hx-trigger="hc:copied"`, or a listener
//     that fires `hc:toast`. Copy never opens a toast itself.
//
// The Clipboard API needs a secure context (https / localhost). Where it is
// unavailable the click is a graceful no-op — for a form-control target the
// behavior best-effort selects its text so the user can copy manually.
//
// installCopy() returns an idempotent uninstaller. It removes the delegated
// listener and the live region it created. The network is never touched.

import { t } from './i18n.js';

const INSTALL_KEY = '__hcCopyUninstall';
const COPIED_ATTR = 'data-hc-copied';
const COPIED_DURATION_MS = 1500;

function resolveText(btn, doc) {
  if (btn.hasAttribute('data-hc-copy-text')) {
    return btn.getAttribute('data-hc-copy-text') ?? '';
  }
  const selector = btn.getAttribute('data-hc-copy');
  if (!selector) return null;
  let target;
  try {
    target = doc.querySelector(selector);
  } catch {
    return null; // malformed selector from server templating → no-op
  }
  if (!target) return null;
  const isFormControl = target.matches?.('input, textarea, select');
  return String((isFormControl ? target.value : target.textContent) ?? '');
}

/**
 * Install the copy-to-clipboard behavior: a delegated click handler that
 * copies the value named by `data-hc-copy` (a CSS selector) or the literal
 * in `data-hc-copy-text`, reflects success on the button via
 * `data-hc-copied`, announces it through a `role="status"` live region, and
 * fires a bubbling `hc:copied` event.
 *
 * @param {Document} [root]
 *   The document whose clicks are delegated. Defaults to the global
 *   document when available.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installCopy } from '@hypermedia-components/core';
 * installCopy();
 */
export function installCopy(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
  let liveRegion = null;

  function announce(message) {
    if (!liveRegion || !liveRegion.isConnected) {
      liveRegion = doc.createElement('div');
      liveRegion.className = 'hc-sr-only';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      doc.body.appendChild(liveRegion);
    }
    // Clear first so an identical consecutive message still re-announces.
    liveRegion.textContent = '';
    liveRegion.textContent = message;
  }

  function flagCopied(btn) {
    btn.setAttribute(COPIED_ATTR, '');
    if (btn._hcCopyTimer) clearTimeout(btn._hcCopyTimer);
    btn._hcCopyTimer = setTimeout(() => {
      btn._hcCopyTimer = null;
      if (btn.isConnected) btn.removeAttribute(COPIED_ATTR);
    }, COPIED_DURATION_MS);
  }

  function onClick(event) {
    const btn = event.target.closest('[data-hc-copy], [data-hc-copy-text]');
    if (!btn) return;

    const text = resolveText(btn, doc);
    if (text == null) return; // no resolvable source → no-op

    // Only a link would navigate; a real <button type="button"> needs no
    // preventDefault and must not block other handlers.
    if (btn.tagName === 'A') event.preventDefault();

    const okLabel = btn.getAttribute('data-hc-copy-ok') || t('copy.ok');
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;

    const secure = typeof window === 'undefined' || window.isSecureContext !== false;
    if (!secure || !clipboard || typeof clipboard.writeText !== 'function') {
      // No Clipboard API here. Best-effort: select a form control's text so
      // the user can copy manually. Otherwise a silent no-op.
      const selector = btn.getAttribute('data-hc-copy');
      if (selector) {
        let target;
        try {
          target = doc.querySelector(selector);
        } catch {
          target = null;
        }
        target?.select?.();
      }
      return;
    }

    clipboard.writeText(text).then(
      () => {
        // Bail if the behavior was uninstalled or the button removed while
        // the write was in flight.
        if (root[INSTALL_KEY] !== uninstall || !btn.isConnected) return;
        flagCopied(btn);
        announce(okLabel);
        btn.dispatchEvent(new CustomEvent('hc:copied', { bubbles: true, detail: { text } }));
      },
      () => {
        /* clipboard write rejected (permission / focus) → graceful no-op */
      },
    );
  }

  root.addEventListener('click', onClick);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('click', onClick);
    if (liveRegion && liveRegion.isConnected) liveRegion.remove();
    liveRegion = null;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
