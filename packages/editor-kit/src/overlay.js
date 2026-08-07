// overlay.js — selection outlines and the drop indicator, drawn OVER
// the canvas, never inside it.
//
// The canvas artifact must stay clean, so editor chrome lives in a
// separate mount element in the host document — typically an
// absolutely-positioned layer covering the canvas (or the iframe that
// hosts it). Geometry is translated from canvas-viewport coordinates
// into mount-local coordinates; pass `frame` when the canvas lives in
// an iframe so the frame's own offset is added.
//
// Only geometry is set inline. Appearance comes from the class names
// (`hc-editor-overlay__selection`, `hc-editor-overlay__indicator`,
// plus `data-orientation` / `data-empty` on the indicator) with
// minimal built-in fallbacks via
// `--hc-editor-selection-color` / `--hc-editor-indicator-color`.

import { EDITOR_ONLY_ATTR } from './serializer.js';

const SELECTION_CLASS = 'hc-editor-overlay__selection';
const INDICATOR_CLASS = 'hc-editor-overlay__indicator';

function overlap(a, b) {
  return Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom);
}

export class Overlay {
  #mount;
  #frame;
  #rectOf;
  #selectionNodes = [];
  #selectionEls = [];
  #indicatorEl = null;
  #drop = null;

  constructor({ mount, frame = null, rectOf = (el) => el.getBoundingClientRect() } = {}) {
    if (!mount) throw new Error('Overlay: a mount element is required');
    this.#mount = mount;
    this.#frame = frame;
    this.#rectOf = rectOf;
  }

  /** A canvas-viewport rect translated into mount-local coordinates. */
  #localRect(r) {
    const base = this.#mount.getBoundingClientRect();
    const dx = (this.#frame ? this.#frame.getBoundingClientRect().left : 0) - base.left;
    const dy = (this.#frame ? this.#frame.getBoundingClientRect().top : 0) - base.top;
    return { left: r.left + dx, top: r.top + dy, width: r.width, height: r.height };
  }

  #place(el, { left, top, width, height }) {
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  }

  /** Outline each node (the editor wires this to Selection `change`). */
  showSelection(nodes) {
    this.#selectionNodes = [...nodes];
    for (const el of this.#selectionEls) el.remove();
    this.#selectionEls = this.#selectionNodes.map((node) => {
      const box = this.#mount.ownerDocument.createElement('div');
      box.className = SELECTION_CLASS;
      box.style.border = '1px solid var(--hc-editor-selection-color, #4c8dff)';
      this.#place(box, this.#localRect(this.#rectOf(node)));
      this.#mount.appendChild(box);
      return box;
    });
  }

  clearSelection() {
    this.showSelection([]);
  }

  /** Draw the insertion mark for `{ container, index }` — a line at
   * the child boundary (vertical in row layouts, horizontal in column
   * layouts), or the container's padded box when it has no children.
   * Accepts the exact shape `createDragController`'s `onPreview`
   * emits; call with `null` to hide. */
  showDropIndicator(drop) {
    if (!drop) {
      this.hideDropIndicator();
      return;
    }
    this.#drop = drop;
    if (!this.#indicatorEl) {
      this.#indicatorEl = this.#mount.ownerDocument.createElement('div');
      this.#indicatorEl.className = INDICATOR_CLASS;
      this.#mount.appendChild(this.#indicatorEl);
    }
    const el = this.#indicatorEl;
    el.style.background = 'var(--hc-editor-indicator-color, #4c8dff)';
    el.style.border = '';

    const { container, index } = drop;
    const children = [...container.children].filter((c) => !c.hasAttribute(EDITOR_ONLY_ATTR));
    if (children.length === 0) {
      el.dataset.empty = 'true';
      el.removeAttribute('data-orientation');
      el.style.background = 'transparent';
      el.style.border = '1px dashed var(--hc-editor-indicator-color, #4c8dff)';
      this.#place(el, this.#localRect(this.#rectOf(container)));
      return;
    }
    el.removeAttribute('data-empty');

    // The childNodes index counts text nodes too — map it back to the
    // element boundary: the first element at/after that position.
    const nodes = [...container.childNodes];
    let ref = null;
    for (let i = index; i < nodes.length; i++) {
      if (nodes[i].nodeType === 1 && !nodes[i].hasAttribute(EDITOR_ONLY_ATTR)) {
        ref = nodes[i];
        break;
      }
    }
    const at = ref ? children.indexOf(ref) : children.length;
    const before = children[at - 1] ?? null;
    const after = children[at] ?? null;
    const a = before ? this.#rectOf(before) : null;
    const b = after ? this.#rectOf(after) : null;
    const row = a && b ? overlap(a, b) : false;

    if (row) {
      const x = (a.right + b.left) / 2;
      const top = Math.min(a.top, b.top);
      el.dataset.orientation = 'vertical';
      this.#place(el, this.#localRect({
        left: x - 1,
        top,
        width: 2,
        height: Math.max(a.bottom, b.bottom) - top,
      }));
    } else {
      const edge = b ? b.top : a.bottom;
      const rect = b ?? a;
      el.dataset.orientation = 'horizontal';
      this.#place(el, this.#localRect({
        left: rect.left,
        top: edge - 1,
        width: rect.width,
        height: 2,
      }));
    }
  }

  hideDropIndicator() {
    this.#drop = null;
    this.#indicatorEl?.remove();
    this.#indicatorEl = null;
  }

  /** Recompute all geometry (call on scroll/resize/undo/redo). */
  refresh() {
    if (this.#selectionNodes.length > 0) {
      this.showSelection(this.#selectionNodes.filter((n) => n.isConnected));
    }
    if (this.#drop) {
      if (this.#drop.container.isConnected) this.showDropIndicator(this.#drop);
      else this.hideDropIndicator();
    }
  }

  dispose() {
    this.clearSelection();
    this.hideDropIndicator();
  }
}
