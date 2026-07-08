// lazy-tree — recipes/lazy-tree/contract.md
//
//   GET /nodes/<id>/children  → 200, the group's innerHTML: a sequence
//                               of <li class="hc-tree__item"> fragments
//                               (lazy branches carry the four htmx
//                               attributes + an empty group; leaves are
//                               label-only)
//   GET /nodes/restricted/children
//                             → 200, EMPTY body + `HX-Trigger:
//                               {"hc:toast": …}` error toast — the
//                               contract's blessed mitigation: the
//                               empty 2xx swap clears aria-busy on the
//                               group, the toast says why it is empty,
//                               and the `once` trigger is spent.
//   GET /nodes/<unknown>/children
//                             → 200, a single "Nothing here." leaf.
//
// htmx-only endpoint on purpose: the recipe's no-JS story is to render
// the tree fully expanded server-side (contract.md § progressive
// enhancement), so there is no page fallback to degrade to here.
// Leaves are plain labels, not links — dead links in a demo are worse
// than text. Stateless.

import { DOCS_BASE, escapeHtml, html, hxTrigger } from '../html.mjs';

/** Static node map: branch children reference other node ids. */
const NODES = {
  reports: [
    { branch: 'q1', label: 'Q1' },
    { branch: 'q2', label: 'Q2' },
    { leaf: 'annual-2025.pdf' },
  ],
  q1: [{ leaf: '2026-01.pdf' }, { leaf: '2026-02.pdf' }, { leaf: '2026-03.pdf' }],
  q2: [{ leaf: '2026-04.pdf' }, { branch: 'archive', label: 'Archive' }],
  archive: [{ leaf: 'q2-2019.pdf' }, { leaf: 'q2-2020.pdf' }],
  assets: [
    { branch: 'logos', label: 'Logos' },
    { branch: 'icons', label: 'Icons' },
  ],
  logos: [{ leaf: 'wordmark.svg' }, { leaf: 'mark.svg' }],
  icons: [{ leaf: 'check.svg' }, { leaf: 'chevron.svg' }, { leaf: 'close.svg' }],
};

function leafHtml(label) {
  return `<li class="hc-tree__item"><span class="hc-tree__row"><span class="hc-tree__label">${escapeHtml(label)}</span></span></li>`;
}

/** A lazy branch: the contract's four htmx attributes + empty group. */
function branchHtml(id, label) {
  const url = `${DOCS_BASE}/api/recipes/lazy-tree/nodes/${id}/children`;
  return `<li class="hc-tree__item" aria-expanded="false" data-hx-get="${url}" data-hx-target="find .hc-tree__group" data-hx-swap="innerHTML" data-hx-trigger="hc:treeexpand once"><span class="hc-tree__row"><span class="hc-tree__toggle" aria-hidden="true"></span><span class="hc-tree__label">${escapeHtml(label)}</span></span><ul class="hc-tree__group"></ul></li>`;
}

function childrenFragment(id) {
  const children = NODES[id];
  if (!children) return leafHtml('Nothing here.');
  return children
    .map((child) =>
      child.branch ? branchHtml(child.branch, child.label) : leafHtml(child.leaf),
    )
    .join('\n');
}

export function handle({ method, path }) {
  const match = method === 'GET' && path.match(/^\/nodes\/([^/]+)\/children$/);
  if (!match) return null;

  if (match[1] === 'restricted') {
    return html('', {
      headers: {
        'HX-Trigger': hxTrigger({
          'hc:toast': {
            message: 'You do not have access to this folder',
            variant: 'error',
          },
        }),
      },
    });
  }

  return html(childrenFragment(match[1]));
}
