// @hypermedia-components/editor-kit — editor engine for visual
// builders over Hypermedia Components. Experimental; see README.
//
// The engine edits real hc markup in place: the canvas DOM is the
// document model, commands are the only way to change it, and the
// serializers turn it into artifact HTML or the JSON projection.

export {
  setAttribute,
  removeAttribute,
  setText,
  insertNode,
  removeNode,
  moveNode,
  indexBefore,
  CommandStack,
} from './commands.js';
export { Selection, pickBlock } from './selection.js';
export { createDragController, CONTAINER_ATTR } from './dnd.js';
export { Overlay } from './overlay.js';
export {
  serialize,
  toJson,
  fromJson,
  EDITOR_ATTR_PREFIX,
  EDITOR_ONLY_ATTR,
} from './serializer.js';

import { CommandStack } from './commands.js';
import { Selection } from './selection.js';
import { serialize, toJson } from './serializer.js';

/**
 * Wire the pieces together over a canvas mount element. The manifest
 * (core's `manifest.json`, injected — never bundled) enables
 * `component` annotation in the JSON projection; everything works
 * without it.
 *
 * Returns `{ root, manifest, stack, selection, serialize(), toJson(),
 * dispose() }`. The selection is pruned automatically after undo/redo
 * removes nodes from the canvas.
 */
export function createEditor({ root, manifest = null } = {}) {
  if (!root) throw new Error('createEditor: a root element is required');
  const stack = new CommandStack();
  const selection = new Selection();
  const onStackChange = () => selection.prune();
  stack.addEventListener('change', onStackChange);
  return {
    root,
    manifest,
    stack,
    selection,
    serialize: () => serialize(root),
    toJson: () => toJson(root, { manifest }),
    dispose() {
      stack.removeEventListener('change', onStackChange);
      stack.clear();
      selection.clear();
    },
  };
}
