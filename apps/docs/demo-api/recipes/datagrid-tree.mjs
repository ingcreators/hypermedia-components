// datagrid-tree — recipes/datagrid-tree/contract.md
//
//   GET /items/:id/children
//     → 200: the child <tr> batch, each one level deeper (aria-level =
//       parent + 1); sub-directories carry their own toggle + lazy
//       wiring; leaf rows carry aria-level only
//     empty → one empty-state row (single colspan cell, polite text) —
//       the arriving row also clears the parent's aria-busy
//     unknown id → 404
//
// Stateless: the id fully determines the answer; collapse/re-expand of
// loaded subtrees never comes back here.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-tree`;

/** id → { level-relative children }. Sizes are display strings. */
const CHILDREN = {
  docs: [
    { id: 'docs-guide', name: 'guide', dir: true },
    { id: 'docs-api', name: 'api.md', size: '12 KB' },
    { id: 'docs-notes', name: 'notes.md', size: '3 KB' },
  ],
  'docs-guide': [
    { id: 'docs-guide-intro', name: 'intro.md', size: '6 KB' },
    { id: 'docs-guide-setup', name: 'setup.md', size: '9 KB' },
  ],
  src: [],
};

const LEVEL = { docs: 1, 'docs-guide': 2, src: 1 };

function rowHtml(node, level) {
  const lead = node.dir
    ? `<button class="hc-datagrid__toggle" type="button" data-hc-datagrid-tree aria-hidden="true" tabindex="-1"></button> ${escapeHtml(node.name)}`
    : escapeHtml(node.name);
  const treeAttrs = node.dir
    ? ` aria-expanded="false" data-lazy data-hx-get="${API}/items/${node.id}/children" data-hx-trigger="hc:datagridtreeload" data-hx-swap="afterend"`
    : '';
  return `<tr class="hc-datagrid__row" id="tree-demo-${node.id}" aria-level="${level}"${treeAttrs}>
  <td class="hc-datagrid__cell">${lead}</td>
  <td class="hc-datagrid__cell" data-numeric>${node.dir ? '—' : escapeHtml(node.size)}</td>
</tr>`;
}

export function handle({ method, path }) {
  const m = path.match(/^\/items\/([a-z-]+)\/children$/);
  if (method !== 'GET' || !m) return null;
  const id = m[1];
  const kids = CHILDREN[id];
  if (kids === undefined) return new Response('Not found', { status: 404 });

  const level = (LEVEL[id] ?? 1) + 1;
  if (kids.length === 0) {
    return html(
      `<tr class="hc-datagrid__row" aria-level="${level}"><td class="hc-datagrid__cell" colspan="2">No entries</td></tr>`,
    );
  }
  return html(kids.map((node) => rowHtml(node, level)).join('\n'));
}
