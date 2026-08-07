// dnd.js — the pointer-events drag controller for the canvas.
//
// Deliberately NOT the HTML5 drag-and-drop API: pointer events give
// full control over thresholds, previews, and cancellation. The
// controller only computes *where* a drop would land and reports it —
// committing the mutation (insertNode/moveNode through the
// CommandStack) is the builder's job, so every drop stays undoable.
//
// Droppable regions are marked with `data-hc-editor-container` — an
// editor-scaffolding attribute the serializers already strip, so the
// marking can never leak into the artifact.
//
// Reported indices are `childNodes` positions measured with the
// dragged node absent, which is exactly what `insertNode`/`moveNode`
// consume — no off-by-one adjustment needed downstream.

import { EDITOR_ONLY_ATTR } from './serializer.js';

export const CONTAINER_ATTR = 'data-hc-editor-container';

/** The container's flow axis, detected from the first two children:
 * vertical rect overlap means they sit on one row. Single-child (and
 * empty) containers default to column — the dominant hc layout.
 * Wrapping grids are approximated by their first row's axis. */
function detectAxis(children, rectOf) {
  if (children.length < 2) return 'column';
  const a = rectOf(children[0]);
  const b = rectOf(children[1]);
  return Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom) ? 'row' : 'column';
}

/** Geometry-only insertion point among element children: the first
 * index whose element the pointer sits before, splitting each child
 * at its midpoint on the container's flow axis. */
function elementIndex(children, x, y, rectOf) {
  const axis = detectAxis(children, rectOf);
  for (let i = 0; i < children.length; i++) {
    const r = rectOf(children[i]);
    const before =
      axis === 'row' ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
    if (before) return i;
  }
  return children.length;
}

/** Convert "before element `ref`" into a childNodes index counted with
 * `exclude` (the dragged node) absent. `ref === null` appends. */
function childNodesIndex(container, ref, exclude) {
  let i = 0;
  for (const n of container.childNodes) {
    if (n === ref) break;
    if (n !== exclude) i++;
  }
  return i;
}

function droppableChildren(container, exclude) {
  return [...container.children].filter(
    (c) => c !== exclude && !c.hasAttribute(EDITOR_ONLY_ATTR),
  );
}

/**
 * Create the controller. Options:
 * - `root` (required): the canvas element drops happen inside.
 * - `canAccept(container, payload)`: veto hook — a manifest-driven
 *   builder decides which components a container takes; on veto the
 *   search walks up to the next marked container.
 * - `onPreview({ container, index } | null)`: drop-indicator feed
 *   (an Overlay's `showDropIndicator` slots in directly).
 * - `onDrop({ container, index, payload })`: commit hook.
 * - `onCancel()`: Escape or drop outside any container.
 * - `threshold`: pixels of movement before a `startMove` becomes a
 *   drag (clicks below it still select).
 * - `hitTest(x, y)` / `rectOf(el)`: geometry, injectable for tests.
 *
 * Returns `{ startInsert, startMove, dragging, dispose }`. Wire
 * `startMove` to `pointerdown` on canvas nodes and `startInsert` to
 * `pointerdown` on palette entries.
 */
export function createDragController({
  root,
  canAccept = () => true,
  onPreview = () => {},
  onDrop = () => {},
  onCancel = () => {},
  threshold = 4,
  hitTest,
  rectOf = (el) => el.getBoundingClientRect(),
} = {}) {
  if (!root) throw new Error('createDragController: a root element is required');
  const doc = root.ownerDocument;
  hitTest ??= (x, y) => doc.elementFromPoint(x, y);

  let drag = null; // { payload, active, startX, startY, target }

  function findTarget(x, y) {
    const el = hitTest(x, y);
    if (!el || !root.contains(el)) return null;
    let container = el.closest(`[${CONTAINER_ATTR}]`);
    const node = drag.payload.node ?? null;
    while (container) {
      const insideDragged = node && (container === node || node.contains(container));
      if (!insideDragged && root.contains(container) && canAccept(container, drag.payload)) {
        break;
      }
      container = container.parentElement?.closest(`[${CONTAINER_ATTR}]`) ?? null;
    }
    if (!container) return null;
    const children = droppableChildren(container, node);
    const i = elementIndex(children, x, y, rectOf);
    const ref = children[i] ?? null;
    return { container, index: childNodesIndex(container, ref, node) };
  }

  function preview(target) {
    const prev = drag.target;
    const same =
      prev === target ||
      (prev && target && prev.container === target.container && prev.index === target.index);
    drag.target = target;
    if (!same) onPreview(target);
  }

  function onPointerMove(e) {
    if (!drag.active) {
      if (
        Math.abs(e.clientX - drag.startX) < threshold &&
        Math.abs(e.clientY - drag.startY) < threshold
      ) {
        return;
      }
      drag.active = true;
    }
    preview(findTarget(e.clientX, e.clientY));
  }

  function onPointerUp() {
    const { active, target, payload } = drag;
    teardown();
    if (active && target) onDrop({ ...target, payload });
    else if (active) onCancel();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') cancel();
  }

  function cancel() {
    if (!drag) return;
    teardown();
    onCancel();
  }

  function teardown() {
    doc.removeEventListener('pointermove', onPointerMove);
    doc.removeEventListener('pointerup', onPointerUp);
    doc.removeEventListener('keydown', onKeyDown, true);
    drag = null;
    onPreview(null);
  }

  function begin(payload, e, active) {
    if (drag) teardown();
    drag = { payload, active, startX: e.clientX, startY: e.clientY, target: null };
    doc.addEventListener('pointermove', onPointerMove);
    doc.addEventListener('pointerup', onPointerUp);
    doc.addEventListener('keydown', onKeyDown, true);
  }

  return {
    /** Drag a new item in from a palette; `data` is passed through to
     * `canAccept`/`onDrop` as `payload.data`. Active immediately. */
    startInsert(data, e) {
      begin({ type: 'insert', data, node: null }, e, true);
    },
    /** Drag an existing canvas node to a new position. Becomes active
     * once the pointer moves `threshold` px, so plain clicks still
     * reach the selection. */
    startMove(node, e) {
      begin({ type: 'move', node }, e, false);
    },
    get dragging() {
      return drag?.active ?? false;
    },
    dispose() {
      if (drag) teardown();
    },
  };
}
