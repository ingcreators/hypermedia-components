import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommandStack,
  insertNode,
  moveNode,
  removeAttribute,
  removeNode,
  setAttribute,
  setText,
} from '../src/commands.js';

let root;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById('root');
});

describe('attribute commands', () => {
  it('sets, undoes to the previous value, redoes', () => {
    root.innerHTML = '<button class="hc-button" data-variant="ghost">Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setAttribute(btn, 'data-variant', 'primary'));
    expect(btn.dataset.variant).toBe('primary');
    stack.undo();
    expect(btn.dataset.variant).toBe('ghost');
    stack.redo();
    expect(btn.dataset.variant).toBe('primary');
  });

  it('undoing a set on a previously absent attribute removes it', () => {
    root.innerHTML = '<button class="hc-button">Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setAttribute(btn, 'data-size', 'lg'));
    stack.undo();
    expect(btn.hasAttribute('data-size')).toBe(false);
  });

  it('removeAttribute round-trips', () => {
    root.innerHTML = '<button data-variant="primary">Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(removeAttribute(btn, 'data-variant'));
    expect(btn.hasAttribute('data-variant')).toBe(false);
    stack.undo();
    expect(btn.getAttribute('data-variant')).toBe('primary');
  });

  it('coalesces consecutive edits of the same attribute into one undo step', () => {
    root.innerHTML = '<input class="hc-input" placeholder="a">';
    const input = root.firstElementChild;
    const stack = new CommandStack();

    for (const v of ['ab', 'abc', 'abcd']) {
      stack.apply(setAttribute(input, 'placeholder', v), { coalesce: true });
    }
    expect(input.getAttribute('placeholder')).toBe('abcd');
    stack.undo();
    expect(input.getAttribute('placeholder')).toBe('a');
    expect(stack.canUndo).toBe(false);
    stack.redo();
    expect(input.getAttribute('placeholder')).toBe('abcd');
  });

  it('does not coalesce across different attributes or nodes', () => {
    root.innerHTML = '<button>a</button><button>b</button>';
    const [a, b] = root.children;
    const stack = new CommandStack();

    stack.apply(setAttribute(a, 'data-variant', 'primary'), { coalesce: true });
    stack.apply(setAttribute(b, 'data-variant', 'ghost'), { coalesce: true });
    stack.apply(setAttribute(a, 'data-size', 'lg'), { coalesce: true });
    stack.undo();
    stack.undo();
    stack.undo();
    expect(a.hasAttribute('data-variant')).toBe(false);
    expect(a.hasAttribute('data-size')).toBe(false);
    expect(b.hasAttribute('data-variant')).toBe(false);
  });
});

describe('setText', () => {
  it('round-trips and coalesces', () => {
    root.innerHTML = '<button>Old</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setText(btn, 'N'), { coalesce: true });
    stack.apply(setText(btn, 'New'), { coalesce: true });
    expect(btn.textContent).toBe('New');
    stack.undo();
    expect(btn.textContent).toBe('Old');
    expect(stack.canUndo).toBe(false);
  });
});

describe('structural commands', () => {
  it('insertNode places at the index and undo removes it', () => {
    root.innerHTML = '<p>a</p><p>c</p>';
    const b = document.createElement('p');
    b.textContent = 'b';
    const stack = new CommandStack();

    stack.apply(insertNode(root, b, 1));
    expect(root.textContent).toBe('abc');
    stack.undo();
    expect(root.textContent).toBe('ac');
    stack.redo();
    expect(root.textContent).toBe('abc');
  });

  it('removeNode restores the exact position on undo', () => {
    root.innerHTML = '<p>a</p><p>b</p><p>c</p>';
    const b = root.children[1];
    const stack = new CommandStack();

    stack.apply(removeNode(b));
    expect(root.textContent).toBe('ac');
    stack.undo();
    expect(root.textContent).toBe('abc');
    expect(root.children[1]).toBe(b);
  });

  it('moveNode forward within the same parent round-trips', () => {
    root.innerHTML = '<p>a</p><p>b</p><p>c</p>';
    const a = root.children[0];
    const stack = new CommandStack();

    stack.apply(moveNode(a, root, 2)); // a to the end
    expect(root.textContent).toBe('bca');
    stack.undo();
    expect(root.textContent).toBe('abc');
    stack.redo();
    expect(root.textContent).toBe('bca');
  });

  it('moveNode backward within the same parent round-trips', () => {
    root.innerHTML = '<p>a</p><p>b</p><p>c</p>';
    const c = root.children[2];
    const stack = new CommandStack();

    stack.apply(moveNode(c, root, 0));
    expect(root.textContent).toBe('cab');
    stack.undo();
    expect(root.textContent).toBe('abc');
  });

  it('moveNode across parents round-trips', () => {
    root.innerHTML = '<ul><li>a</li><li>b</li></ul><ul></ul>';
    const [from, to] = root.children;
    const a = from.children[0];
    const stack = new CommandStack();

    stack.apply(moveNode(a, to, 0));
    expect(from.children.length).toBe(1);
    expect(to.children[0]).toBe(a);
    stack.undo();
    expect(from.children[0]).toBe(a);
    expect(to.children.length).toBe(0);
  });
});

describe('CommandStack', () => {
  it('applying after undo clears the redo history', () => {
    root.innerHTML = '<button>x</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setAttribute(btn, 'data-a', '1'));
    stack.apply(setAttribute(btn, 'data-b', '2'));
    stack.undo();
    stack.apply(setAttribute(btn, 'data-c', '3'));
    expect(stack.canRedo).toBe(false);
    stack.undo();
    stack.undo();
    expect(stack.canUndo).toBe(false);
    expect(btn.hasAttribute('data-a')).toBe(false);
  });

  it('transact() groups commands into one undo entry, reverted in reverse order', () => {
    root.innerHTML = '<p>a</p>';
    const stack = new CommandStack();
    const b = document.createElement('p');
    b.textContent = 'b';

    stack.transact(() => {
      stack.apply(insertNode(root, b, 1));
      stack.apply(setAttribute(b, 'data-variant', 'primary'));
      stack.apply(setText(b, 'B'));
    });
    expect(root.textContent).toBe('aB');
    stack.undo();
    expect(root.textContent).toBe('a');
    expect(stack.canUndo).toBe(false);
    stack.redo();
    expect(root.textContent).toBe('aB');
    expect(b.dataset.variant).toBe('primary');
  });

  it('an empty transaction records nothing', () => {
    const stack = new CommandStack();
    stack.transact(() => {});
    expect(stack.canUndo).toBe(false);
  });

  it('transact() cannot nest', () => {
    const stack = new CommandStack();
    expect(() => stack.transact(() => stack.transact(() => {}))).toThrow(/nest/);
  });

  it('emits change events with the action', () => {
    root.innerHTML = '<button>x</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();
    const seen = [];
    stack.addEventListener('change', (e) => seen.push(e.detail.action));

    stack.apply(setAttribute(btn, 'data-a', '1'));
    stack.undo();
    stack.redo();
    stack.clear();
    expect(seen).toEqual(['apply', 'undo', 'redo', 'clear']);
  });

  it('undo/redo on an empty stack are no-ops returning false', () => {
    const stack = new CommandStack();
    const spy = vi.fn();
    stack.addEventListener('change', spy);
    expect(stack.undo()).toBe(false);
    expect(stack.redo()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('dirty tracking', () => {
  it('starts clean and reports attribute dirt per name', () => {
    root.innerHTML = '<button data-variant="ghost">Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    expect(stack.dirty).toBe(false);
    expect(stack.dirtyNodes().size).toBe(0);

    stack.apply(setAttribute(btn, 'data-variant', 'primary'));
    expect(stack.dirty).toBe(true);
    expect(stack.dirtyNodes().get(btn)).toEqual(new Set(['attr:data-variant']));

    stack.apply(removeAttribute(btn, 'data-size'));
    expect(stack.dirtyNodes().get(btn)).toEqual(
      new Set(['attr:data-variant', 'attr:data-size']),
    );
  });

  it('marks text dirt on the node and children dirt on the parent', () => {
    root.innerHTML = '<section><p>hi</p></section>';
    const section = root.firstElementChild;
    const p = section.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setText(p, 'bye'));
    expect(stack.dirtyNodes().get(p)).toEqual(new Set(['text']));

    stack.apply(insertNode(section, document.createElement('div'), 99));
    expect(stack.dirtyNodes().get(section)).toEqual(new Set(['children']));
  });

  it('removeNode dirties the captured parent, not the removed node', () => {
    root.innerHTML = '<ul><li>a</li><li>b</li></ul>';
    const ul = root.firstElementChild;
    const li = ul.firstElementChild;
    const stack = new CommandStack();

    stack.apply(removeNode(li));
    const dirty = stack.dirtyNodes();
    expect(dirty.get(ul)).toEqual(new Set(['children']));
    expect(dirty.has(li)).toBe(false);
  });

  it('moveNode dirties both parents but not the moved node', () => {
    root.innerHTML = '<div id="a"><span>x</span></div><div id="b"></div>';
    const [a, b] = root.children;
    const span = a.firstElementChild;
    const stack = new CommandStack();

    stack.apply(moveNode(span, b, 0));
    const dirty = stack.dirtyNodes();
    expect(dirty.get(a)).toEqual(new Set(['children']));
    expect(dirty.get(b)).toEqual(new Set(['children']));
    expect(dirty.has(span)).toBe(false);
  });

  it('same-parent moves record the parent once and undo back to clean', () => {
    root.innerHTML = '<ul><li>a</li><li>b</li></ul>';
    const ul = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(moveNode(ul.children[1], ul, 0));
    expect(stack.dirtyNodes().get(ul)).toEqual(new Set(['children']));
    stack.undo();
    expect(stack.dirty).toBe(false);
  });

  it('undo returns to clean, redo re-dirties', () => {
    root.innerHTML = '<button>Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setAttribute(btn, 'data-size', 'lg'));
    stack.undo();
    expect(stack.dirty).toBe(false);
    stack.redo();
    expect(stack.dirty).toBe(true);
  });

  it('coalesced typing undone in one step returns to clean', () => {
    root.innerHTML = '<input placeholder="a">';
    const input = root.firstElementChild;
    const stack = new CommandStack();

    for (const v of ['ab', 'abc', 'abcd']) {
      stack.apply(setAttribute(input, 'placeholder', v), { coalesce: true });
    }
    expect(stack.dirty).toBe(true);
    stack.undo();
    expect(stack.dirty).toBe(false);
  });

  it('a transaction counts per command and one undo cleans it', () => {
    root.innerHTML = '<div><span>x</span></div><aside></aside>';
    const [div, aside] = root.children;
    const span = div.firstElementChild;
    const stack = new CommandStack();

    stack.transact(() => {
      stack.apply(setAttribute(span, 'data-variant', 'primary'));
      stack.apply(moveNode(span, aside, 0));
    });
    expect(stack.dirtyNodes().get(span)).toEqual(new Set(['attr:data-variant']));
    expect(stack.dirtyNodes().get(div)).toEqual(new Set(['children']));
    expect(stack.dirtyNodes().get(aside)).toEqual(new Set(['children']));

    stack.undo();
    expect(stack.dirty).toBe(false);
  });

  it('markClean resets, and undoing past the watermark is dirty again', () => {
    root.innerHTML = '<button>Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setAttribute(btn, 'data-size', 'lg'));
    stack.markClean();
    expect(stack.dirty).toBe(false);

    stack.undo(); // DOM now differs from the saved baseline (count −1)
    expect(stack.dirty).toBe(true);
    expect(stack.dirtyNodes().get(btn)).toEqual(new Set(['attr:data-size']));

    stack.redo(); // back at the baseline
    expect(stack.dirty).toBe(false);
  });

  it('markClean emits change {action: "clean"}', () => {
    const stack = new CommandStack();
    const seen = vi.fn();
    stack.addEventListener('change', (e) => seen(e.detail.action));
    stack.markClean();
    expect(seen).toHaveBeenCalledWith('clean');
  });

  it('clear() forgets history but keeps dirt', () => {
    root.innerHTML = '<button>Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setAttribute(btn, 'data-size', 'lg'));
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.dirty).toBe(true);
  });

  it('dirtyNodes() is a defensive copy', () => {
    root.innerHTML = '<button>Go</button>';
    const btn = root.firstElementChild;
    const stack = new CommandStack();

    stack.apply(setAttribute(btn, 'data-size', 'lg'));
    const copy = stack.dirtyNodes();
    copy.delete(btn);
    expect(stack.dirtyNodes().has(btn)).toBe(true);
  });

  it('commands without dirt() are tolerated', () => {
    const stack = new CommandStack();
    let on = false;
    stack.apply({
      type: 'custom',
      apply() {
        on = true;
      },
      revert() {
        on = false;
      },
    });
    expect(on).toBe(true);
    expect(stack.dirty).toBe(false);
    stack.undo();
    expect(on).toBe(false);
  });
});
