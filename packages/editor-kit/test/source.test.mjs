import { beforeEach, describe, expect, it } from 'vitest';
import {
  CommandStack,
  insertNode,
  moveNode,
  removeAttribute,
  removeNode,
  setAttribute,
  setText,
} from '../src/commands.js';
import { createEditor } from '../src/index.js';
import { serialize } from '../src/serializer.js';
import { attachSource, serializeStable, tokenize } from '../src/source.js';

let root;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById('root');
});

/** Parse-and-normalize both texts and compare — splicing must never
 * change what the markup MEANS, only how it is formatted. */
function expectSameDom(a, b) {
  const ta = document.createElement('template');
  const tb = document.createElement('template');
  ta.innerHTML = a;
  tb.innerHTML = b;
  expect(ta.innerHTML).toBe(tb.innerHTML);
}

describe('tokenize', () => {
  it('records offsets for tags, text, and attributes', () => {
    const src = `<div class="a" data-x='1' bool>hi</div>`;
    const [start, text, end] = tokenize(src);
    expect(start.kind).toBe('start');
    expect(start.name).toBe('div');
    expect(src.slice(start.start, start.end)).toBe(
      `<div class="a" data-x='1' bool>`,
    );
    const cls = start.attrs.get('class');
    expect(src.slice(cls.start, cls.end)).toBe('class="a"');
    const dx = start.attrs.get('data-x');
    expect(src.slice(dx.start, dx.end)).toBe(`data-x='1'`);
    const bool = start.attrs.get('bool');
    expect(src.slice(bool.start, bool.end)).toBe('bool');
    expect(src.slice(text.start, text.end)).toBe('hi');
    expect(end.kind).toBe('end');
  });

  it('handles comments, void elements, and undecoded entities', () => {
    const src = `<!-- note --><br><p>a &amp; b</p>`;
    const tokens = tokenize(src);
    expect(tokens.map((t) => t.kind)).toEqual([
      'comment', 'start', 'start', 'text', 'end',
    ]);
    const text = tokens[3];
    expect(src.slice(text.start, text.end)).toBe('a &amp; b');
  });

  it('treats raw text content as one text token', () => {
    const src = `<style>.a > .b { color: red }</style>`;
    const tokens = tokenize(src);
    expect(tokens.map((t) => t.kind)).toEqual(['start', 'text', 'end']);
    expect(src.slice(tokens[1].start, tokens[1].end)).toBe(
      '.a > .b { color: red }',
    );
  });

  it('flags duplicate attributes', () => {
    const [tok] = tokenize(`<div a="1" a="2">`);
    expect(tok.dupAttrs).toBe(true);
  });
});

describe('attachSource', () => {
  it('maps every node to its span', () => {
    const src = `<section>\n  <p class="lead">Hello</p>\n</section>`;
    const map = attachSource(root, src);
    expect(map.valid).toBe(true);
    const section = root.firstElementChild;
    const p = section.firstElementChild;
    expect(src.slice(map.spanOf(section).start, map.spanOf(section).end)).toBe(src);
    expect(src.slice(map.spanOf(p).start, map.spanOf(p).end)).toBe(
      '<p class="lead">Hello</p>',
    );
    const ws = section.firstChild; // "\n  "
    expect(src.slice(map.spanOf(ws).start, map.spanOf(ws).end)).toBe('\n  ');
  });

  it('handles implied end tags via the browser tree', () => {
    const src = `<ul><li>a<li>b</ul>`;
    const map = attachSource(root, src);
    expect(map.valid).toBe(true);
    const [a, b] = root.querySelectorAll('li');
    expect(src.slice(map.spanOf(a).start, map.spanOf(a).end)).toBe('<li>a');
    expect(src.slice(map.spanOf(b).start, map.spanOf(b).end)).toBe('<li>b');
  });

  it('gives browser-synthesized elements zero-width synthetic spans', () => {
    const src = `<table><tr><td>x</td></tr></table>`;
    const map = attachSource(root, src);
    expect(map.valid).toBe(true);
    const tbody = root.querySelector('tbody');
    if (tbody) {
      const span = map.spanOf(tbody);
      expect(span.synthetic).toBe(true);
      expect(src.slice(span.start, span.contentStart)).toBe('');
      expect(src.slice(span.contentEnd, span.end)).toBe('');
      expect(src.slice(span.start, span.end)).toBe('<tr><td>x</td></tr>');
    }
  });

  it('degrades to invalid on markup it cannot align', () => {
    const map = attachSource(root, `<!doctype html><p>hi</p>`);
    expect(map.valid).toBe(false);
  });
});

// A deliberately hand-formatted fixture: single quotes, entities,
// multi-line attributes, comments.
const FIXTURE = [
  `<section class='hero'   data-x="1">`,
  `  <!-- keep me -->`,
  `  <h1 title='A &amp; B'>Hello &nbsp; world</h1>`,
  `  <ul>`,
  `    <li data-k='one'>One &lt;first&gt;</li>`,
  `    <li data-k='two'>Two</li>`,
  `  </ul>`,
  `</section>`,
].join('\n');

function editorOn(src = FIXTURE) {
  const editor = createEditor({ root, source: src });
  expect(editor.sourceMap.valid).toBe(true);
  return editor;
}

describe('serializeStable', () => {
  it('is byte-identical with no edits', () => {
    const editor = editorOn();
    const { text, stable } = editor.serializeStable();
    expect(stable).toBe(true);
    expect(text).toBe(FIXTURE);
  });

  it('an attribute edit touches only that attribute', () => {
    const editor = editorOn();
    const h1 = root.querySelector('h1');
    editor.stack.apply(setAttribute(h1, 'data-state', 'on'));
    const { text, stable } = editor.serializeStable();
    expect(stable).toBe(true);
    expect(text).toBe(
      FIXTURE.replace(
        `<h1 title='A &amp; B'>`,
        `<h1 title='A &amp; B' data-state="on">`,
      ),
    );
    expectSameDom(text, serialize(root));
  });

  it('changing an attribute keeps sibling attribute quoting', () => {
    const editor = editorOn();
    const section = root.querySelector('section');
    editor.stack.apply(setAttribute(section, 'data-x', '2'));
    const { text } = editor.serializeStable();
    expect(text).toContain(`<section class='hero'   data-x="2">`);
  });

  it('removing an attribute swallows its preceding whitespace only', () => {
    const editor = editorOn();
    const section = root.querySelector('section');
    editor.stack.apply(removeAttribute(section, 'data-x'));
    const { text } = editor.serializeStable();
    expect(text).toContain(`<section class='hero'>`);
  });

  it('a move preserves the moved block byte-for-byte', () => {
    const editor = editorOn();
    const ul = root.querySelector('ul');
    const [one] = ul.querySelectorAll('li');
    editor.stack.apply(moveNode(one, ul, { before: null })); // to the end
    const { text, stable } = editor.serializeStable();
    expect(stable).toBe(true);
    // The hand-formatted li travels verbatim: single quotes + entity.
    expect(text).toContain(`<li data-k='one'>One &lt;first&gt;</li>`);
    // Untouched parts of the document are untouched.
    expect(text).toContain(`<h1 title='A &amp; B'>Hello &nbsp; world</h1>`);
    expect(text).toContain(`<!-- keep me -->`);
    expectSameDom(text, serialize(root));
  });

  it('setText re-emits only that node content, escaped', () => {
    const editor = editorOn();
    const h1 = root.querySelector('h1');
    editor.stack.apply(setText(h1, 'a < b'));
    const { text } = editor.serializeStable();
    expect(text).toContain(`<h1 title='A &amp; B'>a &lt; b</h1>`);
    expect(text).toContain(`<li data-k='one'>One &lt;first&gt;</li>`);
  });

  it('inserted nodes serialize fresh; mapped nodes moved inside stay verbatim', () => {
    const editor = editorOn();
    const ul = root.querySelector('ul');
    const [, two] = ul.querySelectorAll('li');
    const wrap = document.createElement('div');
    wrap.setAttribute('class', 'wrap');
    editor.stack.transact(() => {
      editor.stack.apply(insertNode(root.querySelector('section'), wrap, { before: null }));
      editor.stack.apply(moveNode(two, wrap, 0));
    });
    const { text } = editor.serializeStable();
    expect(text).toContain(`<div class="wrap"><li data-k='two'>Two</li></div>`);
    expectSameDom(text, serialize(root));
  });

  it('remove leaves the rest untouched', () => {
    const editor = editorOn();
    const [one] = root.querySelectorAll('li');
    editor.stack.apply(removeNode(one));
    const { text } = editor.serializeStable();
    expect(text).not.toContain(`data-k='one'`);
    expect(text).toContain(`<li data-k='two'>Two</li>`);
    expectSameDom(text, serialize(root));
  });

  it('undo back to clean returns the input byte-for-byte', () => {
    const editor = editorOn();
    const h1 = root.querySelector('h1');
    editor.stack.apply(setAttribute(h1, 'data-state', 'on'));
    editor.stack.apply(moveNode(h1, root.querySelector('ul'), 0));
    editor.stack.undo();
    editor.stack.undo();
    const { text } = editor.serializeStable();
    expect(text).toBe(FIXTURE);
  });

  it('editor scaffolding never reaches the output', () => {
    const editor = editorOn();
    const section = root.querySelector('section');
    const h1 = root.querySelector('h1');
    // Out-of-stack scaffolding (overlay-style) + a stack-applied
    // scaffolding attribute on a dirty node.
    const ghost = document.createElement('div');
    ghost.setAttribute('data-hc-editor-only', '');
    section.append(ghost);
    h1.setAttribute('data-hc-editor-hover', '1');
    editor.stack.apply(setAttribute(h1, 'data-state', 'on'));
    editor.stack.apply(setAttribute(h1, 'data-hc-editor-marker', 'x'));
    const { text } = editor.serializeStable();
    expect(text).not.toContain('data-hc-editor');
    expectSameDom(text, serialize(root));
  });

  it('falls back (stable: false) when the map is invalid', () => {
    const src = `<!doctype html><p>hi</p>`;
    const editor = createEditor({ root, source: src });
    expect(editor.sourceMap.valid).toBe(false);
    const { text, stable } = editor.serializeStable();
    expect(stable).toBe(false);
    expect(text).toBe(serialize(root));
  });

  it('reports the minimal dirty regions', () => {
    const editor = editorOn();
    const ul = root.querySelector('ul');
    const [one] = ul.querySelectorAll('li');
    editor.stack.apply(setAttribute(one, 'data-k', 'uno'));
    editor.stack.apply(moveNode(one, ul, { before: null }));
    const { regions } = editor.serializeStable();
    // one (attr) is covered by ul (children)? No — one is ul's child,
    // and ul is dirty, so the cover keeps ul only.
    expect(regions.length).toBe(1);
    expect(regions[0].node).toBe(ul);
  });

  it('commit rebaselines: edit → save → edit → save stays spliceable', () => {
    const editor = editorOn();
    const h1 = root.querySelector('h1');

    editor.stack.apply(setAttribute(h1, 'data-state', 'on'));
    const first = editor.serializeStable({ commit: true });
    editor.stack.markClean();
    expect(first.stable).toBe(true);
    expect(editor.sourceMap.source).toBe(first.text);

    // Clean again: byte-identical against the NEW baseline.
    expect(editor.serializeStable().text).toBe(first.text);

    // Second cycle: another edit splices against the new baseline and
    // still keeps hand formatting elsewhere.
    editor.stack.apply(setAttribute(h1, 'data-state', 'off'));
    const second = editor.serializeStable({ commit: true });
    editor.stack.markClean();
    expect(second.stable).toBe(true);
    expect(second.text).toBe(first.text.replace('data-state="on"', 'data-state="off"'));
    expect(second.text).toContain(`class='hero'`);
  });

  it('commit maps newly inserted nodes, including their attributes', () => {
    const editor = editorOn();
    const section = root.querySelector('section');
    const badge = document.createElement('span');
    badge.setAttribute('class', 'badge');
    badge.textContent = 'NEW';
    editor.stack.apply(insertNode(section, badge, { before: null }));
    const saved = editor.serializeStable({ commit: true });
    editor.stack.markClean();

    const span = editor.sourceMap.spanOf(badge);
    expect(span).not.toBeNull();
    expect(saved.text.slice(span.start, span.end)).toBe(
      '<span class="badge">NEW</span>',
    );

    // And an attr edit on it now splices instead of falling back.
    editor.stack.apply(setAttribute(badge, 'class', 'badge hot'));
    const next = editor.serializeStable();
    expect(next.text).toContain('<span class="badge hot">NEW</span>');
    expect(next.text).toContain(`class='hero'`); // rest untouched
  });

  it('standalone serializeStable works without createEditor', () => {
    const src = `<p data-a='1'>x</p>`;
    const map = attachSource(root, src);
    const stack = new CommandStack();
    stack.apply(setAttribute(root.firstElementChild, 'data-a', '2'));
    const { text, stable } = serializeStable(root, map, stack.dirtyNodes());
    expect(stable).toBe(true);
    expect(text).toBe(`<p data-a="2">x</p>`);
  });
});
