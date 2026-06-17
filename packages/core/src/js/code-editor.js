// installCodeEditor — upgrade an editable `hc-code` field with a synced
// line-number gutter (issue #255).
//
//   <div class="hc-code" data-editable data-gutter="line-numbers">
//     <textarea class="hc-code__input" name="content" spellcheck="false">SELECT 1</textarea>
//   </div>
//
// The value lives in a real <textarea name>, so it submits in forms, works
// with htmx (hx-post / hx-include / hx-vals), and degrades to a plain
// monospace textarea when this script is absent. When `data-gutter="line-numbers"`
// is set, the behavior inserts a `.hc-code__gutter` element before the
// textarea and keeps it in sync: it re-numbers on input and matches the
// textarea's vertical scroll. To keep the numbers aligned with the lines it
// sets the textarea to not soft-wrap (`wrap="off"`), so long lines scroll
// horizontally rather than pushing the numbers out of step.
//
// Syntax highlighting is out of scope (a CSP-safe overlay is a possible
// follow-up). installCodeEditor(root = document) is idempotent and returns an
// uninstaller; fields swapped in by htmx are enhanced on `htmx:load`.

const INSTALL_KEY = '__hcCodeEditorUninstall';

function lineNumbers(count) {
  let out = '1';
  for (let i = 2; i <= count; i += 1) out += '\n' + i;
  return out;
}

function enhance(container) {
  const textarea = container.querySelector('.hc-code__input');
  if (!textarea) return null;
  if (container.dataset.gutter !== 'line-numbers') return () => {};
  if (container.querySelector('.hc-code__gutter')) return () => {};

  // Keep line numbers aligned: a soft-wrapped line would span several rows
  // while the gutter counts one. Horizontal scroll instead.
  const prevWrap = textarea.getAttribute('wrap');
  textarea.setAttribute('wrap', 'off');

  const gutter = container.ownerDocument.createElement('div');
  gutter.className = 'hc-code__gutter';
  gutter.setAttribute('aria-hidden', 'true');
  container.insertBefore(gutter, textarea);

  let lastCount = 0;
  const renumber = () => {
    const count = Math.max(1, textarea.value.split('\n').length);
    if (count !== lastCount) {
      gutter.textContent = lineNumbers(count);
      lastCount = count;
    }
  };
  const syncScroll = () => {
    gutter.scrollTop = textarea.scrollTop;
  };
  const onInput = () => {
    renumber();
    syncScroll();
  };

  textarea.addEventListener('input', onInput);
  textarea.addEventListener('scroll', syncScroll);
  renumber();
  syncScroll();

  return () => {
    textarea.removeEventListener('input', onInput);
    textarea.removeEventListener('scroll', syncScroll);
    gutter.remove();
    if (prevWrap == null) textarea.removeAttribute('wrap');
    else textarea.setAttribute('wrap', prevWrap);
  };
}

/**
 * Install the editable-code behavior on the given root.
 *
 * Enhances every `.hc-code[data-editable]` once and re-scans subtrees
 * delivered by htmx (`htmx:load`). Repeated calls on the same root return the
 * same uninstaller.
 *
 * @param {Document|Element} [root=document]
 *   The scope to scan. Defaults to the global document when available.
 * @returns {() => void} an idempotent uninstaller that removes the synced
 *   gutters and listeners it added.
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
