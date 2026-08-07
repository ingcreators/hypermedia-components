import { beforeEach, describe, expect, it } from 'vitest';
import { createEditor, removeNode, setAttribute, Selection } from '../src/index.js';

let root;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById('root');
});

describe('Selection', () => {
  it('select replaces, additive appends, primary is first-selected', () => {
    root.innerHTML = '<p>a</p><p>b</p>';
    const [a, b] = root.children;
    const sel = new Selection();

    sel.select(a);
    expect(sel.primary).toBe(a);
    sel.select(b, { additive: true });
    expect(sel.items).toEqual([a, b]);
    expect(sel.primary).toBe(a);
    sel.select(b);
    expect(sel.items).toEqual([b]);
  });

  it('toggle adds and removes; clear empties', () => {
    root.innerHTML = '<p>a</p>';
    const a = root.firstElementChild;
    const sel = new Selection();

    sel.toggle(a);
    expect(sel.isSelected(a)).toBe(true);
    sel.toggle(a);
    expect(sel.size).toBe(0);
  });

  it('emits change only on actual changes', () => {
    root.innerHTML = '<p>a</p>';
    const a = root.firstElementChild;
    const sel = new Selection();
    let events = 0;
    sel.addEventListener('change', () => events++);

    sel.select(a);
    sel.select(a); // no-op
    sel.clear();
    sel.clear(); // no-op
    expect(events).toBe(2);
  });

  it('prune drops disconnected nodes', () => {
    root.innerHTML = '<p>a</p><p>b</p>';
    const [a, b] = root.children;
    const sel = new Selection();
    sel.select(a);
    sel.select(b, { additive: true });

    a.remove();
    sel.prune();
    expect(sel.items).toEqual([b]);
  });
});

describe('createEditor', () => {
  it('requires a root', () => {
    expect(() => createEditor()).toThrow(/root/);
  });

  it('wires stack, selection, and serializers over the canvas', () => {
    root.innerHTML = '<button class="hc-button">Go</button>';
    const btn = root.firstElementChild;
    const editor = createEditor({ root, manifest: { components: [{ block: 'hc-button' }] } });

    editor.selection.select(btn);
    editor.stack.apply(setAttribute(btn, 'data-variant', 'primary'));
    expect(editor.serialize()).toBe(
      '<button class="hc-button" data-variant="primary">Go</button>',
    );
    expect(editor.toJson().children[0].component).toBe('hc-button');
    editor.stack.undo();
    expect(editor.serialize()).toBe('<button class="hc-button">Go</button>');
  });

  it('prunes the selection when undo/redo disconnects nodes', () => {
    root.innerHTML = '<p>a</p>';
    const a = root.firstElementChild;
    const editor = createEditor({ root });

    editor.stack.apply(removeNode(a));
    // Removal was already applied before select — reselect then undo/redo.
    editor.stack.undo();
    editor.selection.select(a);
    editor.stack.redo();
    expect(editor.selection.size).toBe(0);
  });

  it('dispose clears state and unhooks the stack listener', () => {
    root.innerHTML = '<p>a</p>';
    const a = root.firstElementChild;
    const editor = createEditor({ root });
    editor.selection.select(a);
    editor.stack.apply(setAttribute(a, 'data-x', '1'));

    editor.dispose();
    expect(editor.stack.canUndo).toBe(false);
    expect(editor.selection.size).toBe(0);
  });
});
