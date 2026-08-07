import { beforeEach, describe, expect, it } from 'vitest';
import { fromJson, serialize, toJson } from '../src/serializer.js';

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
