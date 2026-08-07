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
  };
}

/** Insert `node` into `parent.childNodes` at `index` (append when
 * `index` is at or past the end). */
export function insertNode(parent, node, index) {
  return {
    type: 'insertNode',
    node,
    apply() {
      parent.insertBefore(node, parent.childNodes[index] ?? null);
    },
    revert() {
      node.remove();
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
  };
}

/** Move a node to `parent.childNodes[index]` (index measured with the
 * node absent). Undo restores the original position. */
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
      parent.insertBefore(node, parent.childNodes[index] ?? null);
    },
    revert() {
      node.remove();
      this.prevParent.insertBefore(
        node,
        this.prevParent.childNodes[this.prevIndex] ?? null,
      );
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
 * apply | undo | redo | clear) after every mutation.
 */
export class CommandStack extends EventTarget {
  #undo = [];
  #redo = [];
  #batch = null;

  get canUndo() {
    return this.#undo.length > 0;
  }

  get canRedo() {
    return this.#redo.length > 0;
  }

  #emit(action) {
    this.dispatchEvent(new CustomEvent('change', { detail: { action } }));
  }

  apply(command, { coalesce = false } = {}) {
    if (this.#batch) {
      command.apply();
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
