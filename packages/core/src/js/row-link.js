// installRowLink — Enter opens the record the row is about.
//
//   <tr class="hc-datagrid__row" id="row-4903">
//     <td class="hc-datagrid__cell"><input type="checkbox" name="ids" value="4903"></td>
//     <th class="hc-datagrid__cell" scope="row">
//       <a href="/orders/4903" data-hc-row-link>SO-4903</a>
//     </th>
//     …
//
// The link is an ordinary `<a href>` in the row's IDENTITY cell — the
// thing the row *is*, not a verb bolted onto the end — so middle-click
// and ⌘-click open a tab, right-click copies the address, Back returns,
// and none of it needs JavaScript. This behavior adds the one thing an
// anchor cannot do by itself: **Enter anywhere on the row**, which is
// what a grid user expects after arrowing to it.
//
// WHY NOT MAKE THE WHOLE ROW A LINK. The stretched-anchor trick (an
// ::after overlay filling the row) is right for a card and wrong here:
// the datagrid ships text selection, range selection and TSV copy, and
// a transparent anchor on top of the cells eats all three. A row-sized
// click target also has nowhere to put the checkbox or the editor.
//
// Enter is shared with editing, and the sharing is decided by the
// datagrid, not here: it calls preventDefault() before opening an
// editor, so a handled Enter is skipped. The other guards are the ones
// any keyboard user would expect — a control that handles its own
// Enter (a button, a select, an input, another link) keeps it.
//
// Root-delegated, idempotent, returns an uninstaller. Never fetches:
// following a link is the browser's job.

const KEY = '__hcRowLinkUninstall';
const ROW = '.hc-datagrid__row';
const LINK = 'a[data-hc-row-link][href]';

/** Controls that own their Enter. */
const INTERACTIVE = 'a[href], button, input, select, textarea, [contenteditable=""], [contenteditable="true"]';

/**
 * The primary link of a row: the one marked `data-hc-row-link`. A row
 * with several links (an id, a customer, a document) must say which
 * one is the record — guessing "the first" turns a change of column
 * order into a change of behavior.
 *
 * @param {Element} row a `.hc-datagrid__row`.
 * @returns {HTMLAnchorElement|null}
 */
export function rowLinkOf(row) {
  if (!row) return null;
  const link = row.querySelector(LINK);
  // A nested grid's row is not this row's business.
  return link && link.closest(ROW) === row ? link : null;
}

/**
 * Install row-link activation: pressing Enter on a row follows the
 * row's `[data-hc-row-link]` anchor, unless something else has claimed
 * the key — an open editor, an editable cell (the datagrid calls
 * `preventDefault()` before it opens one), or an interactive control
 * under the cursor.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installRowLink } from '@hypermedia-components/core';
 * installRowLink();
 */
export function installRowLink(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[KEY]) return root[KEY];

  function onKeydown(event) {
    if (event.key !== 'Enter') return;
    // The datagrid gets Enter first for editing and says so by
    // cancelling the event; a modifier means the user is asking for
    // something else entirely.
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

    const target = event.target;
    if (!target?.closest) return;
    const row = target.closest(ROW);
    if (!row) return;
    // An open editor, a checkbox, a button in the row: their Enter.
    if (row.querySelector('[data-editing]')) return;
    const interactive = target.closest(INTERACTIVE);
    if (interactive && interactive.closest(ROW) === row) return;

    const link = rowLinkOf(row);
    if (!link) return;
    event.preventDefault();
    // click(), not location.assign(): the anchor keeps its target, its
    // download, its rel — and htmx or any other click handler on it
    // still gets to run, so an enhanced link behaves the same from the
    // keyboard as it does from the mouse.
    link.click();
  }

  root.addEventListener('keydown', onKeydown);

  const uninstall = () => {
    if (root[KEY] !== uninstall) return;
    root.removeEventListener('keydown', onKeydown);
    delete root[KEY];
  };
  root[KEY] = uninstall;
  return uninstall;
}
