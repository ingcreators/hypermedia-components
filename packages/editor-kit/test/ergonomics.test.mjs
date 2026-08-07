// #449 — canvas ergonomics from the first consumer: element-based
// insertion points, the exported index helper, nearest-block picking,
// and cross-document (iframe) palette drags.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommandStack,
  indexBefore,
  insertNode,
  moveNode,
  pickBlock,
} from '../src/index.js';
import { createDragController } from '../src/dnd.js';

let root;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById('root');
});

describe('indexBefore', () => {
  it('counts childNodes (text nodes included) up to ref, excluding the moved node', () => {
    root.innerHTML = '<ul id="list">\n  <li id="a">a</li>\n  <li id="b">b</li>\n  <li id="c">c</li>\n</ul>';
    const list = document.getElementById('list');
    const [a, b, c] = [document.getElementById('a'), document.getElementById('b'), document.getElementById('c')];

    expect(indexBefore(list, a)).toBe(1); // leading whitespace text node counts
    expect(indexBefore(list, c, a)).toBe([...list.childNodes].indexOf(c) - 1);
    expect(indexBefore(list, null)).toBe(list.childNodes.length);
    expect(indexBefore(list, null, b)).toBe(list.childNodes.length - 1);
  });

  it('round-trips through moveNode despite whitespace skew', () => {
    root.innerHTML = '<ul id="list">\n  <li id="a">a</li>\n  <li id="b">b</li>\n</ul>';
    const list = document.getElementById('list');
    const a = document.getElementById('a');
    const stack = new CommandStack();

    // "Move a after b" element-wise: before b's next element (null → end area).
    stack.apply(moveNode(a, list, indexBefore(list, null, a)));
    expect([...list.children].map((el) => el.id)).toEqual(['b', 'a']);
    stack.undo();
    expect([...list.children].map((el) => el.id)).toEqual(['a', 'b']);
  });
});

describe('{ before } insertion points', () => {
  it('insertNode accepts { before: element } and { before: null }', () => {
    root.innerHTML = '<p id="a">a</p><p id="c">c</p>';
    const stack = new CommandStack();
    const b = document.createElement('p');
    b.textContent = 'b';
    stack.apply(insertNode(root, b, { before: document.getElementById('c') }));
    expect(root.textContent).toBe('abc');

    const d = document.createElement('p');
    d.textContent = 'd';
    stack.apply(insertNode(root, d, { before: null }));
    expect(root.textContent).toBe('abcd');

    stack.undo();
    stack.undo();
    expect(root.textContent).toBe('ac');
    stack.redo();
    expect(root.textContent).toBe('abc');
  });

  it('moveNode accepts { before } and undoes to the origin', () => {
    root.innerHTML = '<p id="a">a</p><p id="b">b</p><p id="c">c</p>';
    const [a, , c] = root.children;
    const stack = new CommandStack();

    stack.apply(moveNode(c, root, { before: a }));
    expect(root.textContent).toBe('cab');
    stack.undo();
    expect(root.textContent).toBe('abc');
    stack.redo();
    expect(root.textContent).toBe('cab');
  });
});

describe('pickBlock', () => {
  const MANIFEST = { components: [{ block: 'hc-card' }, { block: 'hc-button' }] };

  beforeEach(() => {
    root.innerHTML = `
      <div class="hc-card" id="card">
        <div class="hc-card__body" id="body">
          <button class="hc-button" id="btn"><span id="icon">x</span></button>
          <em id="plain">plain</em>
        </div>
      </div>`;
  });

  it('walks up to the nearest manifest block', () => {
    expect(pickBlock(document.getElementById('icon'), { root, manifest: MANIFEST }).id).toBe('btn');
    expect(pickBlock(document.getElementById('body'), { root, manifest: MANIFEST }).id).toBe('card');
  });

  it('falls back to the element itself when no block matches', () => {
    expect(pickBlock(document.getElementById('plain'), { root, manifest: null }).id).toBe('plain');
  });

  it('never returns the root or anything outside it', () => {
    expect(pickBlock(root, { root, manifest: MANIFEST })).toBeNull();
    expect(pickBlock(document.body, { root, manifest: MANIFEST })).toBeNull();
    expect(pickBlock(null, { root, manifest: MANIFEST })).toBeNull();
  });

  it('resolves text-node targets through their parent element', () => {
    const text = document.getElementById('plain').firstChild;
    // Without a manifest the parent element itself is picked; with one,
    // the ancestor block wins as usual.
    expect(pickBlock(text, { root, manifest: null }).id).toBe('plain');
    expect(pickBlock(text, { root, manifest: MANIFEST }).id).toBe('card');
  });
});

describe('cross-document palette drag (frame option)', () => {
  const rect = (left, top, width, height) => ({
    left, top, width, height, right: left + width, bottom: top + height,
  });

  function setup() {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const innerDoc = frame.contentDocument;
    innerDoc.body.innerHTML =
      '<div id="canvas"><ul data-hc-editor-container id="list"><li id="a">a</li><li id="b">b</li></ul></div>';
    const canvas = innerDoc.getElementById('canvas');
    const list = innerDoc.getElementById('list');
    const [a, b] = [innerDoc.getElementById('a'), innerDoc.getElementById('b')];

    // Canvas-coordinate rects for inner elements; host coords for the frame.
    const rects = new Map([
      [frame, rect(100, 50, 400, 400)],
      [list, rect(0, 0, 100, 200)],
      [a, rect(0, 0, 100, 100)],
      [b, rect(0, 100, 100, 100)],
    ]);
    const rectOf = (el) => rects.get(el) ?? rect(0, 0, 0, 0);
    const hitTest = (x, y) => {
      let best = null;
      for (const [el, r] of rects) {
        if (el === frame) continue;
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          if (!best || best.contains(el)) best = el;
        }
      }
      return best;
    };
    return { frame, innerDoc, canvas, list, rectOf, hitTest };
  }

  it('translates host-document pointer events into canvas coordinates', () => {
    const { frame, canvas, list, rectOf, hitTest } = setup();
    const onPreview = vi.fn();
    const onDrop = vi.fn();
    const ctl = createDragController({ root: canvas, frame, rectOf, hitTest, onPreview, onDrop });

    // Palette press in the HOST document at host (150, 80) → canvas (50, 30).
    const palette = document.createElement('button');
    document.body.appendChild(palette);
    ctl.startInsert({ block: 'hc-badge' }, { target: palette, clientX: 150, clientY: 80 });

    // Host pointermove at (150, 180) → canvas (50, 130): before b.
    const move = new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 180 });
    document.dispatchEvent(move);
    expect(onPreview).toHaveBeenLastCalledWith({
      container: list,
      index: [...list.childNodes].indexOf(list.querySelector('#b')),
    });

    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 150, clientY: 180 }));
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0].container).toBe(list);
  });

  it('still handles events fired inside the frame document, untranslated', () => {
    const { frame, innerDoc, canvas, rectOf, hitTest } = setup();
    const onDrop = vi.fn();
    const ctl = createDragController({ root: canvas, frame, rectOf, hitTest, onDrop });

    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    // Inner-document coordinates are already canvas coordinates.
    innerDoc.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 30 }));
    innerDoc.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 50, clientY: 30 }));
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0].index).toBe(0); // upper half of a
  });

  it('dispose detaches listeners from both documents', () => {
    const { frame, innerDoc, canvas, rectOf, hitTest } = setup();
    const onPreview = vi.fn();
    const ctl = createDragController({ root: canvas, frame, rectOf, hitTest, onPreview });
    ctl.startInsert({}, { clientX: 0, clientY: 0 });
    ctl.dispose();
    onPreview.mockClear();
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 180 }));
    innerDoc.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 130 }));
    expect(onPreview).not.toHaveBeenCalled();
  });
});
