// installCodeEditor — upgrade an editable `hc-code` field with a synced
// line-number gutter (#255) and an optional live syntax-highlight overlay
// (#264).
//
//   <div class="hc-code" data-editable data-gutter="line-numbers" data-lang="sql">
//     <textarea class="hc-code__input" name="content" spellcheck="false">SELECT 1</textarea>
//   </div>
//
// The value lives in a real <textarea name>, so it submits in forms, works
// with htmx (hx-post / hx-include / hx-vals), and degrades to a plain
// monospace textarea when this script is absent.
//
// `data-gutter="line-numbers"` inserts a `.hc-code__gutter` element before the
// textarea and keeps it in sync: it re-numbers on input and matches the
// textarea's vertical scroll.
//
// `data-lang` opts into a live highlight overlay: when the value resolves to a
// registered grammar (see code-syntax.js — built-ins plus
// registerCodeLanguage()), the behavior inserts a decorative, aria-hidden
// `.hc-code__highlight` layer behind the textarea, re-tokenizes on input
// (throttled to one render per animation frame), and matches the textarea's
// scrollTop/scrollLeft. The textarea text is rendered transparent over the
// layer (CSS), so the coloured spans show through while the caret stays
// visible. An unknown `data-lang` (no grammar) leaves the field a plain
// textarea — no overlay, no transparent text, no regression to #255.
//
// To keep both overlays aligned with the lines the behavior sets the textarea
// to not soft-wrap (`wrap="off"`), so long lines scroll horizontally rather
// than pushing the numbers or tokens out of step.
//
// installCodeEditor(root = document) is idempotent and returns an uninstaller;
// fields swapped in by htmx are enhanced on `htmx:load`.

import { tokenizeCode, resolveCodeLanguage } from './code-syntax.js';

const INSTALL_KEY = '__hcCodeEditorUninstall';

function lineNumbers(count) {
  let out = '1';
  for (let i = 2; i <= count; i += 1) out += '\n' + i;
  return out;
}

function enhance(container) {
  const textarea = container.querySelector('.hc-code__input');
  if (!textarea) return null;

  const wantGutter = container.dataset.gutter === 'line-numbers';
  const lang = container.dataset.lang;
  const wantHighlight = !!resolveCodeLanguage(lang);

  if (!wantGutter && !wantHighlight) return () => {};
  // Already enhanced (defensive — the installer's WeakSet is the primary guard).
  if (container.querySelector('.hc-code__gutter') || container.querySelector('.hc-code__highlight')) {
    return () => {};
  }

  const doc = container.ownerDocument;
  const view = doc.defaultView;

  // Keep the gutter numbers and overlay tokens aligned: a soft-wrapped line
  // would span several rows while the gutter counts one and the overlay (pre)
  // does not wrap. Horizontal scroll instead.
  const prevWrap = textarea.getAttribute('wrap');
  textarea.setAttribute('wrap', 'off');

  // --- Line-number gutter -------------------------------------------------
  let gutter = null;
  let lastCount = 0;
  if (wantGutter) {
    gutter = doc.createElement('div');
    gutter.className = 'hc-code__gutter';
    gutter.setAttribute('aria-hidden', 'true');
    container.insertBefore(gutter, textarea);
  }
  const renumber = () => {
    if (!gutter) return;
    const count = Math.max(1, textarea.value.split('\n').length);
    if (count !== lastCount) {
      gutter.textContent = lineNumbers(count);
      lastCount = count;
    }
  };

  // --- Live highlight overlay --------------------------------------------
  let highlight = null;
  if (wantHighlight) {
    highlight = doc.createElement('div');
    highlight.className = 'hc-code__highlight';
    highlight.setAttribute('aria-hidden', 'true');
    container.insertBefore(highlight, textarea);
  }
  const renderHighlight = () => {
    if (!highlight) return;
    // Fall back to a single plain run if the grammar can't reconstruct this
    // buffer, so the (transparent) textarea text always stays backed by
    // visible overlay text.
    const tokens = tokenizeCode(lang, textarea.value) || [{ tok: '', text: textarea.value }];
    const frag = doc.createDocumentFragment();
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (t.tok) {
        const span = doc.createElement('span');
        span.className = 'hc-code__tok';
        span.setAttribute('data-tok', t.tok);
        span.textContent = t.text;
        frag.appendChild(span);
      } else {
        frag.appendChild(doc.createTextNode(t.text));
      }
    }
    highlight.textContent = '';
    highlight.appendChild(frag);
  };

  // Throttle re-tokenization to one render per frame so large buffers stay
  // responsive while typing.
  let frame = 0;
  const scheduleRender = () => {
    if (!highlight) return;
    if (!view || !view.requestAnimationFrame) {
      renderHighlight();
      return;
    }
    if (frame) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      renderHighlight();
    });
  };

  const syncScroll = () => {
    if (gutter) gutter.scrollTop = textarea.scrollTop;
    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  };

  const onInput = () => {
    renumber();
    scheduleRender();
    syncScroll();
  };

  textarea.addEventListener('input', onInput);
  textarea.addEventListener('scroll', syncScroll);
  renumber();
  renderHighlight();
  syncScroll();

  return () => {
    if (frame && view && view.cancelAnimationFrame) view.cancelAnimationFrame(frame);
    textarea.removeEventListener('input', onInput);
    textarea.removeEventListener('scroll', syncScroll);
    if (gutter) gutter.remove();
    if (highlight) highlight.remove();
    if (prevWrap == null) textarea.removeAttribute('wrap');
    else textarea.setAttribute('wrap', prevWrap);
  };
}

/**
 * Install the editable-code behavior on the given root.
 *
 * Enhances every `.hc-code[data-editable]` once and re-scans subtrees
 * delivered by htmx (`htmx:load`). A field gets a synced line-number gutter
 * when `data-gutter="line-numbers"` is set, and a live syntax-highlight overlay
 * when `data-lang` resolves to a registered grammar (built-in or via
 * `registerCodeLanguage()`). Repeated calls on the same root return the same
 * uninstaller.
 *
 * @param {Document|Element} [root=document]
 *   The scope to scan. Defaults to the global document when available.
 * @returns {() => void} an idempotent uninstaller that removes the synced
 *   gutters, overlays, and listeners it added.
 */
export function installCodeEditor(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const enhanced = new WeakSet();
  const detachers = [];

  const scan = (scope) => {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('.hc-code[data-editable]').forEach((el) => {
      if (enhanced.has(el)) return;
      const detach = enhance(el);
      if (detach) {
        enhanced.add(el);
        detachers.push(detach);
      }
    });
  };

  scan(root);

  const target = root.body || root;
  const onLoad = (event) => scan(event && event.target);
  target.addEventListener('htmx:load', onLoad);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    target.removeEventListener('htmx:load', onLoad);
    detachers.forEach((fn) => fn());
    detachers.length = 0;
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}

export { registerCodeLanguage } from './code-syntax.js';
