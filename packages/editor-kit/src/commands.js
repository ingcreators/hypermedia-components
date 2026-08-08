// commands.js — the editing primitives and the undo/redo stack.
//
// Hypermedia Components keep all state in HTML attributes, so the
// entire edit vocabulary closes over six primitives: set/remove an
// attribute, set text, insert/remove/move a node. Each primitive
// captures what its inverse needs on first apply, so any command can
// be undone and redone without external state.
//
// Insertion indices are positions in `parent.childNodes` measured with
// the moved/inserted node absent; `moveNode` therefore behaves the
// same for same-parent and cross-parent moves (remove first, then
// insert before `childNodes[index]`).
//
// Because every mutation flows through these primitives, the stack can
// track exactly which nodes drifted from the last clean point (#452).
// Each primitive declares what it dirties via `dirt()` — records of
// `[node, kind]` with kind `'attr:<name>'` (start tag), `'text'`
// (content), or `'children'` (the PARENT's child list; a moved node is
// itself NOT dirty). `dirt()` is called after first apply, so captured
// fields (`removeNode.parent`, `moveNode.prevParent`) are available.
// Custom commands without `dirt()` simply don't participate.

/** Set (or, with `value === null`, remove) an attribute. */
export function setAttribute(node, name, value) {
  return {
    type: 'setAttribute',
    node,
    name,
    value,
    prev: undefined,
    apply() {
      if (this.prev === undefined) {
        this.prev = node.hasAttribute(name) ? node.getAttribute(name) : null;
      }
      if (this.value === null) node.removeAttribute(name);
      else node.setAttribute(name, this.value);
    },
    revert() {
      if (this.prev === null) node.removeAttribute(name);
      else node.setAttribute(name, this.prev);
    },
    merge(next) {
      this.value = next.value;
    },
    dirt() {
      return [[node, `attr:${name}`]];
    },
  };
}

/** Remove an attribute (a `setAttribute` to null). */
export function removeAttribute(node, name) {
  return setAttribute(node, name, null);
}

/** Replace a node's text content. */
export function setText(node, text) {
  return {
    type: 'setText',
    node,
    name: null,
    value: text,
    prev: undefined,
    apply() {
      if (this.prev === undefined) this.prev = node.textContent;
      node.textContent = this.value;
    },
    revert() {
      node.textContent = this.prev;
    },
    merge(next) {
      this.value = next.value;
    },
    dirt() {
      return [[node, 'text']];
    },
  };
}

/** The childNodes index meaning "before `ref`" (`ref: null` appends),
 * counted with `exclude` absent — the coordinate system every
 * insertion index in this kit uses. Exported so element-based UI code
 * (Alt+Arrow reorder, "append to container") does not reimplement the
 * whitespace-text-node-aware counting (#449). */
export function indexBefore(parent, ref, exclude = null) {
  let i = 0;
  for (const n of parent.childNodes) {
    if (n === ref) break;
    if (n !== exclude) i++;
  }
  return i;
}

/** An insertion point is a childNodes index (measured with the
 * moved/inserted node absent) or `{ before: Node|null }` — the element
 * to insert before, `null` to append. Resolved at apply time. */
function insertionRef(parent, index) {
  if (typeof index === 'object' && index !== null) return index.before ?? null;
  return parent.childNodes[index] ?? null;
}

/** Insert `node` into `parent` at an insertion point — a childNodes
 * index (append when at or past the end) or `{ before: Node|null }`. */
export function insertNode(parent, node, index) {
  return {
    type: 'insertNode',
    node,
    apply() {
      parent.insertBefore(node, insertionRef(parent, index));
    },
    revert() {
      node.remove();
    },
    dirt() {
      return [[parent, 'children']];
    },
  };
}

/** Remove a node; undo restores it to its captured position. */
export function removeNode(node) {
  return {
    type: 'removeNode',
    node,
    parent: undefined,
    index: undefined,
    apply() {
      if (this.parent === undefined) {
        this.parent = node.parentNode;
        this.index = [...this.parent.childNodes].indexOf(node);
      }
      node.remove();
    },
    revert() {
      this.parent.insertBefore(node, this.parent.childNodes[this.index] ?? null);
    },
    dirt() {
      return [[this.parent, 'children']];
    },
  };
}

/** Move a node to an insertion point in `parent` — a childNodes index
 * (measured with the node absent) or `{ before: Node|null }`. Undo
 * restores the original position. */
export function moveNode(node, parent, index) {
  return {
    type: 'moveNode',
    node,
    prevParent: undefined,
    prevIndex: undefined,
    apply() {
      if (this.prevParent === undefined) {
        this.prevParent = node.parentNode;
        this.prevIndex = [...this.prevParent.childNodes].indexOf(node);
      }
      node.remove();
      parent.insertBefore(node, insertionRef(parent, index));
    },
    revert() {
      node.remove();
      this.prevParent.insertBefore(
        node,
        this.prevParent.childNodes[this.prevIndex] ?? null,
      );
    },
    dirt() {
      return this.prevParent === parent
        ? [[parent, 'children']]
        : [
            [this.prevParent, 'children'],
            [parent, 'children'],
          ];
    },
  };
}

const COALESCIBLE = new Set(['setAttribute', 'setText']);

/**
 * Undo/redo stack. `apply()` executes a command and records it;
 * `transact()` groups several commands into one undo entry;
 * `apply(cmd, { coalesce: true })` merges consecutive attribute/text
 * edits on the same target (inspector typing = one undo step).
 * Emits a `change` CustomEvent (`detail.action`:
 * apply | undo | redo | clear | clean) after every mutation.
 *
 * The stack also tracks which nodes are dirty relative to the last
 * clean point (construction or `markClean()`), via signed counts of
 * each command's `dirt()` records: apply/redo +1, undo −1, and a node
 * is dirty while any count is nonzero — so undoing back to the clean
 * point is clean, and undoing PAST a `markClean()` watermark is dirty
 * again. Coalesced merges don't count (the stack entry doesn't grow).
 * `clear()` forgets history but keeps dirt: forgetting how the DOM got
 * here doesn't make it match the baseline.
 */
export class CommandStack extends EventTarget {
  #undo = [];
  #redo = [];
  #batch = null;
  #dirt = new Map(); // Node → Map<kind, signed count>; pruned at zero.

  get canUndo() {
    return this.#undo.length > 0;
  }

  get canRedo() {
    return this.#redo.length > 0;
  }

  /** Whether any node drifted from the last clean point. */
  get dirty() {
    return this.#dirt.size > 0;
  }

  /** The dirty nodes and how they are dirty, as a defensive copy:
   * `Map<Node, Set<kind>>` with kinds `'attr:<name>'` | `'text'` |
   * `'children'`. Detached nodes are not filtered — the stack has no
   * root; containment is the serializer's concern. */
  dirtyNodes() {
    const out = new Map();
    for (const [node, kinds] of this.#dirt) out.set(node, new Set(kinds.keys()));
    return out;
  }

  /** Declare the current DOM the clean baseline (e.g. after saving). */
  markClean() {
    this.#dirt.clear();
    this.#emit('clean');
  }

  #markDirt(entry, delta) {
    const commands = Array.isArray(entry) ? entry : [entry];
    for (const cmd of commands) {
      if (typeof cmd.dirt !== 'function') continue;
      for (const [node, kind] of cmd.dirt()) {
        let kinds = this.#dirt.get(node);
        if (!kinds) this.#dirt.set(node, (kinds = new Map()));
        const next = (kinds.get(kind) ?? 0) + delta;
        if (next === 0) {
          kinds.delete(kind);
          if (kinds.size === 0) this.#dirt.delete(node);
        } else {
          kinds.set(kind, next);
        }
      }
    }
  }

  #emit(action) {
    this.dispatchEvent(new CustomEvent('change', { detail: { action } }));
  }

  apply(command, { coalesce = false } = {}) {
    if (this.#batch) {
      command.apply();
      this.#markDirt(command, +1);
      this.#batch.push(command);
      return;
    }
    const top = this.#undo.at(-1);
    if (
      coalesce &&
      top &&
      !Array.isArray(top) &&
      COALESCIBLE.has(top.type) &&
      top.type === command.type &&
      top.node === command.node &&
      top.name === command.name
    ) {
      top.merge(command);
      top.apply();
    } else {
      command.apply();
      this.#markDirt(command, +1);
      this.#undo.push(command);
    }
    this.#redo.length = 0;
    this.#emit('apply');
  }

  /** Run `fn`, recording every command it applies as ONE undo entry.
   * An empty transaction records nothing. */
  transact(fn) {
    if (this.#batch) throw new Error('CommandStack: transact() cannot nest');
    this.#batch = [];
    try {
      fn();
    } finally {
      const batch = this.#batch;
      this.#batch = null;
      if (batch.length > 0) {
        this.#undo.push(batch);
        this.#redo.length = 0;
        this.#emit('apply');
      }
    }
  }

  undo() {
    const entry = this.#undo.pop();
    if (!entry) return false;
    if (Array.isArray(entry)) {
      for (let i = entry.length - 1; i >= 0; i--) entry[i].revert();
    } else {
      entry.revert();
    }
    this.#markDirt(entry, -1);
    this.#redo.push(entry);
    this.#emit('undo');
    return true;
  }

  redo() {
    const entry = this.#redo.pop();
    if (!entry) return false;
    if (Array.isArray(entry)) {
      for (const cmd of entry) cmd.apply();
    } else {
      entry.apply();
    }
    this.#markDirt(entry, +1);
    this.#undo.push(entry);
    this.#emit('redo');
    return true;
  }

  clear() {
    this.#undo.length = 0;
    this.#redo.length = 0;
    this.#emit('clear');
  }
}
