import { beforeEach, describe, expect, it } from 'vitest';
import {
  fromJson,
  serialize,
  serializeNode,
  serializePatch,
  toJson,
} from '../src/serializer.js';
import {
  CommandStack,
  insertNode,
  moveNode,
  removeNode,
  setAttribute,
} from '../src/commands.js';

const MANIFEST = {
  components: [{ block: 'hc-button' }, { block: 'hc-card' }, { block: 'hc-field' }],
};

let root;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById('root');
});

describe('serialize', () => {
  it('returns the canvas children as-is when there is no editor scaffolding', () => {
    root.innerHTML = '<button class="hc-button" data-variant="primary">Save</button>';
    expect(serialize(root)).toBe(
      '<button class="hc-button" data-variant="primary">Save</button>',
    );
  });

  it('strips data-hc-editor-* attributes everywhere', () => {
    root.innerHTML =
      '<div class="hc-card" data-hc-editor-id="n1"><button data-hc-editor-selected="true">x</button></div>';
    expect(serialize(root)).toBe('<div class="hc-card"><button>x</button></div>');
  });

  it('removes data-hc-editor-only elements entirely', () => {
    root.innerHTML =
      '<div class="hc-card"><span data-hc-editor-only>drop here</span><p>body</p></div>';
    expect(serialize(root)).toBe('<div class="hc-card"><p>body</p></div>');
  });

  it('does not mutate the canvas', () => {
    root.innerHTML = '<button data-hc-editor-id="n1">x</button>';
    serialize(root);
    expect(root.firstElementChild.getAttribute('data-hc-editor-id')).toBe('n1');
  });
});

describe('toJson', () => {
  it('encodes tag, sorted attrs, and children (text preserved)', () => {
    root.innerHTML = '<button data-variant="primary" class="hc-button">Save</button>';
    const json = toJson(root.firstElementChild);
    expect(json).toEqual({
      tag: 'button',
      attrs: { class: 'hc-button', 'data-variant': 'primary' },
      children: [{ text: 'Save' }],
    });
    expect(Object.keys(json.attrs)).toEqual(['class', 'data-variant']);
  });

  it('annotates manifest blocks with component (derived, not authoritative)', () => {
    root.innerHTML =
      '<div class="hc-card"><button class="hc-button" data-variant="primary">Go</button><em>plain</em></div>';
    const json = toJson(root.firstElementChild, { manifest: MANIFEST });
    expect(json.component).toBe('hc-card');
    expect(json.children[0].component).toBe('hc-button');
    expect(json.children[1].component).toBeUndefined();
  });

  it('normalizes whitespace-only text, comments, and editor scaffolding away', () => {
    root.innerHTML =
      '<div class="hc-card" data-hc-editor-id="n1">\n  <!-- note -->\n  <p>a</p>\n  <span data-hc-editor-only>ghost</span>\n</div>';
    const json = toJson(root.firstElementChild);
    expect(json.attrs).toEqual({ class: 'hc-card' });
    expect(json.children).toEqual([
      { tag: 'p', attrs: {}, children: [{ text: 'a' }] },
    ]);
  });
});

describe('fromJson ⇄ toJson bijection', () => {
  it('round-trips a realistic hc fragment', () => {
    root.innerHTML = [
      '<form class="hc-card">',
      '<div class="hc-field">',
      '<label class="hc-field__label" for="n">Name</label>',
      '<input class="hc-input" id="n" data-size="lg">',
      '</div>',
      '<button class="hc-button" data-variant="primary" type="submit">Save</button>',
      '</form>',
    ].join('');
    const el = root.firstElementChild;
    const rebuilt = fromJson(toJson(el, { manifest: MANIFEST }));
    // Attribute *order* is normalized (sorted) by the projection, so
    // compare semantically and at the projection level, not by string.
    expect(rebuilt.isEqualNode(el)).toBe(true);
    expect(toJson(rebuilt, { manifest: MANIFEST })).toEqual(
      toJson(el, { manifest: MANIFEST }),
    );
  });

  it('round-trips JSON → DOM → JSON exactly', () => {
    const json = {
      tag: 'button',
      attrs: { class: 'hc-button', 'data-variant': 'ghost' },
      children: [{ text: 'Undo' }],
    };
    expect(toJson(fromJson(json))).toEqual(json);
  });

  it('the component annotation is ignored on decode', () => {
    const el = fromJson({
      tag: 'button',
      component: 'hc-button',
      attrs: { class: 'hc-button' },
      children: [],
    });
    expect(el.hasAttribute('component')).toBe(false);
    expect(el.className).toBe('hc-button');
  });
});

describe('serializeNode', () => {
  it('returns one element cleaned of scaffolding', () => {
    root.innerHTML =
      '<div class="hc-card" data-hc-editor-selected="1">' +
      '<span data-hc-editor-only>handle</span><p>Body</p></div>';
    expect(serializeNode(root.firstElementChild)).toBe(
      '<div class="hc-card"><p>Body</p></div>',
    );
  });
});

describe('serializePatch', () => {
  it('is clean with no dirt', () => {
    const stack = new CommandStack();
    expect(serializePatch(root, stack.dirtyNodes())).toEqual({
      clean: true,
      patches: [],
    });
  });

  it('a single attribute edit patches that element only', () => {
    root.innerHTML =
      '<section><button class="hc-button">Go</button><p>sibling</p></section>';
    const btn = root.querySelector('button');
    const stack = new CommandStack();
    stack.apply(setAttribute(btn, 'data-variant', 'primary'));

    const { clean, patches } = serializePatch(root, stack.dirtyNodes());
    expect(clean).toBe(false);
    expect(patches).toHaveLength(1);
    expect(patches[0].node).toBe(btn);
    expect(patches[0].kinds).toEqual(new Set(['attr:data-variant']));
    expect(patches[0].html).toBe(
      '<button class="hc-button" data-variant="primary">Go</button>',
    );
  });

  it('keeps only the minimal cover when parent and child are both dirty', () => {
    root.innerHTML = '<section><p>x</p></section>';
    const section = root.firstElementChild;
    const p = section.firstElementChild;
    const stack = new CommandStack();
    stack.apply(setAttribute(p, 'data-variant', 'muted'));
    stack.apply(insertNode(section, document.createElement('div'), 99));

    const { patches } = serializePatch(root, stack.dirtyNodes());
    expect(patches).toHaveLength(1);
    expect(patches[0].node).toBe(section);
  });

  it('a cross-parent move patches both parents', () => {
    root.innerHTML = '<div id="a"><span>x</span></div><div id="b"></div>';
    const [a, b] = root.children;
    const stack = new CommandStack();
    stack.apply(moveNode(a.firstElementChild, b, 0));

    const { patches } = serializePatch(root, stack.dirtyNodes());
    expect(patches.map((p) => p.node).sort()).toEqual([a, b].sort());
    expect(patches.find((p) => p.node === b).html).toBe(
      '<div id="b"><span>x</span></div>',
    );
  });

  it('a top-level structural edit patches the root as innerHTML', () => {
    root.innerHTML = '<p>one</p>';
    const stack = new CommandStack();
    const div = document.createElement('div');
    div.textContent = 'two';
    stack.apply(insertNode(root, div, 99));

    const { patches } = serializePatch(root, stack.dirtyNodes());
    expect(patches).toHaveLength(1);
    expect(patches[0].node).toBe(root);
    expect(patches[0].html).toBe('<p>one</p><div>two</div>');
  });

  it('dirt inside a removed subtree is subsumed by the old parent patch', () => {
    root.innerHTML = '<section><article><em>x</em></article></section>';
    const section = root.firstElementChild;
    const article = section.firstElementChild;
    const em = article.firstElementChild;
    const stack = new CommandStack();
    stack.apply(setAttribute(em, 'data-variant', 'hot'));
    stack.apply(removeNode(article));

    const { patches } = serializePatch(root, stack.dirtyNodes());
    expect(patches).toHaveLength(1);
    expect(patches[0].node).toBe(section);
    expect(patches[0].html).toBe('<section></section>');
  });

  it('strips scaffolding from patch HTML', () => {
    root.innerHTML = '<div class="hc-card"><span data-hc-editor-only>h</span></div>';
    const card = root.firstElementChild;
    const stack = new CommandStack();
    stack.apply(setAttribute(card, 'data-hc-editor-selected', '1'));
    stack.apply(setAttribute(card, 'data-variant', 'muted'));

    const { patches } = serializePatch(root, stack.dirtyNodes());
    expect(patches[0].html).toBe('<div class="hc-card" data-variant="muted"></div>');
  });
});
