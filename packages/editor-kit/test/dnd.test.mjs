import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDragController } from '../src/dnd.js';

// jsdom has no layout, so geometry is injected: `rects` maps elements
// to fake viewport rects, and `hitTest` resolves the pointer to the
// deepest fake rect that contains it.

let root, rects;

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

const rectOf = (el) => rects.get(el) ?? rect(0, 0, 0, 0);

function hitTest(x, y) {
  let best = null;
  for (const [el, r] of rects) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      if (!best || best.contains(el)) best = el;
    }
  }
  return best;
}

function pointer(type, x, y) {
  document.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
}

// A column container at (0,0)-(100,300) with three stacked children.
beforeEach(() => {
  document.body.innerHTML = `
    <div id="canvas">
      <ul data-hc-editor-container id="list">
        <li id="a">a</li>
        <li id="b">b</li>
        <li id="c">c</li>
      </ul>
    </div>`;
  root = document.getElementById('canvas');
  rects = new Map([
    [document.getElementById('list'), rect(0, 0, 100, 300)],
    [document.getElementById('a'), rect(0, 0, 100, 100)],
    [document.getElementById('b'), rect(0, 100, 100, 100)],
    [document.getElementById('c'), rect(0, 200, 100, 100)],
  ]);
});

function controller(overrides = {}) {
  const hooks = { onPreview: vi.fn(), onDrop: vi.fn(), onCancel: vi.fn() };
  const ctl = createDragController({ root, hitTest, rectOf, ...hooks, ...overrides });
  return { ctl, ...hooks };
}

describe('startInsert', () => {
  it('previews and drops at the pointed boundary (childNodes index, text nodes counted)', () => {
    const { ctl, onPreview, onDrop } = controller();
    const list = document.getElementById('list');

    ctl.startInsert({ block: 'hc-button' }, { clientX: 0, clientY: 0 });
    pointer('pointermove', 50, 130); // upper half of b → before b
    expect(onPreview).toHaveBeenLastCalledWith({
      container: list,
      index: [...list.childNodes].indexOf(document.getElementById('b')),
    });

    pointer('pointerup', 50, 130);
    expect(onDrop).toHaveBeenCalledWith({
      container: list,
      index: [...list.childNodes].indexOf(document.getElementById('b')),
      payload: { type: 'insert', data: { block: 'hc-button' }, node: null },
    });
    // The indicator is always cleared on release.
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('drops at the end when pointing past the last child', () => {
    const { ctl, onDrop } = controller();
    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    pointer('pointermove', 50, 290); // lower half of c → append
    pointer('pointerup', 50, 290);
    expect(onDrop.mock.calls[0][0].index).toBe(
      document.getElementById('list').childNodes.length,
    );
  });

  it('previews null and cancels when released outside any container', () => {
    const { ctl, onPreview, onDrop, onCancel } = controller();
    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    pointer('pointermove', 50, 130); // show a preview first…
    pointer('pointermove', 500, 500); // …then leave every container
    expect(onPreview).toHaveBeenLastCalledWith(null);
    pointer('pointerup', 500, 500);
    expect(onDrop).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('walks up past containers that veto via canAccept', () => {
    // Nest a container inside b that rejects everything.
    const b = document.getElementById('b');
    const inner = document.createElement('div');
    inner.setAttribute('data-hc-editor-container', '');
    b.appendChild(inner);
    rects.set(inner, rect(10, 110, 80, 80));

    const { ctl, onDrop } = controller({ canAccept: (c) => c.id === 'list' });
    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    pointer('pointermove', 50, 130);
    pointer('pointerup', 50, 130);
    expect(onDrop.mock.calls[0][0].container.id).toBe('list');
  });
});

describe('startMove', () => {
  it('stays inactive below the threshold so clicks still select', () => {
    const { ctl, onPreview, onDrop, onCancel } = controller();
    const a = document.getElementById('a');
    ctl.startMove(a, { clientX: 50, clientY: 50 });
    pointer('pointermove', 52, 51);
    expect(ctl.dragging).toBe(false);
    pointer('pointerup', 52, 51);
    expect(onDrop).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('reports the index with the dragged node absent (directly usable by moveNode)', () => {
    const { ctl, onDrop } = controller();
    const a = document.getElementById('a');
    const list = document.getElementById('list');

    ctl.startMove(a, { clientX: 50, clientY: 50 });
    pointer('pointermove', 50, 180); // lower half of b → after b
    expect(ctl.dragging).toBe(true);
    pointer('pointerup', 50, 180);

    const { container, index, payload } = onDrop.mock.calls[0][0];
    expect(container).toBe(list);
    expect(payload).toEqual({ type: 'move', node: a });
    // childNodes with `a` absent, before c: whitespace text nodes + b.
    let expected = 0;
    for (const n of list.childNodes) {
      if (n === document.getElementById('c')) break;
      if (n !== a) expected++;
    }
    expect(index).toBe(expected);
  });

  it('never drops a node into itself', () => {
    // Make a itself a container and point inside it.
    const a = document.getElementById('a');
    a.setAttribute('data-hc-editor-container', '');
    const { ctl, onDrop } = controller();
    ctl.startMove(a, { clientX: 50, clientY: 50 });
    pointer('pointermove', 50, 20); // inside a → falls back to the list
    pointer('pointerup', 50, 20);
    expect(onDrop.mock.calls[0][0].container.id).toBe('list');
  });
});

describe('cancellation and cleanup', () => {
  it('Escape cancels the drag and clears the preview', () => {
    const { ctl, onPreview, onDrop, onCancel } = controller();
    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    pointer('pointermove', 50, 130);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onPreview).toHaveBeenLastCalledWith(null);
    pointer('pointerup', 50, 130);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('dispose detaches all listeners', () => {
    const { ctl, onPreview } = controller();
    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    ctl.dispose();
    onPreview.mockClear();
    pointer('pointermove', 50, 130);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('deduplicates identical previews', () => {
    const { ctl, onPreview } = controller();
    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    pointer('pointermove', 50, 130);
    pointer('pointermove', 51, 131); // same boundary
    const nonNull = onPreview.mock.calls.filter(([t]) => t !== null);
    expect(nonNull.length).toBe(1);
  });
});
