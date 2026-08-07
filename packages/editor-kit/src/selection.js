// selection.js — which canvas nodes the editor currently operates on.
//
// A plain ordered set of elements with a primary (first-selected)
// node. Emits a `change` CustomEvent only when the selection actually
// changes. `prune()` drops nodes that undo/redo disconnected from the
// document — the editor wires it to CommandStack `change`.

/**
 * Nearest-block selection picking — the one piece of selection UX
 * every canvas writes (#449). Walks from `target` up to `root`
 * (exclusive) and returns the first element whose classList names a
 * manifest block; when none matches, `target` itself (as long as it
 * sits inside `root`); never `root` or anything outside it — those
 * return `null` (clear the selection).
 *
 * Works across documents (iframe canvases): matching is by nodeType
 * and classList, never instanceof.
 */
export function pickBlock(target, { root, manifest = null } = {}) {
  if (!root || !target) return null;
  const blocks = new Set((manifest?.components ?? []).map((c) => c.block));
  const el = target.nodeType === 1 ? target : target.parentElement;
  if (!el || el === root || !root.contains(el)) return null;
  for (let cur = el; cur && cur !== root; cur = cur.parentElement) {
    for (const cls of cur.classList) {
      if (blocks.has(cls)) return cur;
    }
  }
  return el;
}

export class Selection extends EventTarget {
  #items = [];

  /** Selected nodes, in selection order (primary first). */
  get items() {
    return [...this.#items];
  }

  get primary() {
    return this.#items[0] ?? null;
  }

  get size() {
    return this.#items.length;
  }

  isSelected(node) {
    return this.#items.includes(node);
  }

  #emit() {
    this.dispatchEvent(new CustomEvent('change', { detail: { items: this.items } }));
  }

  /** Make `node` the selection; `additive: true` appends instead
   * (already-selected nodes are left where they are). */
  select(node, { additive = false } = {}) {
    if (additive) {
      if (this.#items.includes(node)) return;
      this.#items.push(node);
    } else {
      if (this.#items.length === 1 && this.#items[0] === node) return;
      this.#items = [node];
    }
    this.#emit();
  }

  /** Add or remove `node` from the selection (shift/ctrl-click). */
  toggle(node) {
    const i = this.#items.indexOf(node);
    if (i === -1) this.#items.push(node);
    else this.#items.splice(i, 1);
    this.#emit();
  }

  deselect(node) {
    const i = this.#items.indexOf(node);
    if (i === -1) return;
    this.#items.splice(i, 1);
    this.#emit();
  }

  clear() {
    if (this.#items.length === 0) return;
    this.#items = [];
    this.#emit();
  }

  /** Drop selected nodes no longer connected to a document. */
  prune() {
    const kept = this.#items.filter((n) => n.isConnected);
    if (kept.length === this.#items.length) return;
    this.#items = kept;
    this.#emit();
  }
}
