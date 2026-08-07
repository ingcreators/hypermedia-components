# @hypermedia-components/editor-kit

**Experimental** (`private: true` — not yet published; publishing is a
release-process decision). The editor engine for building visual
builders on top of
[Hypermedia Components](../core/README.md): a selection model,
undoable command primitives, and HTML ⇄ JSON serialization.

The kit deliberately contains **no domain logic** — no palettes, no
data binding, no persistence. Those belong to the builder application.
What it owns is *editing hc markup safely*.

## Design

- **The canvas DOM is the document model.** There is no parallel IR.
  Hypermedia Components keep all state in HTML attributes, so the
  markup being edited is the artifact being produced.
- **Six primitives close the edit vocabulary**: `setAttribute`,
  `removeAttribute` (a set-to-null), `setText`, `insertNode`,
  `removeNode`, `moveNode`. Every canvas mutation is one of these, and
  each captures its own inverse — undo/redo needs no snapshots.
- **Editor scaffolding is namespaced.** Attributes prefixed
  `data-hc-editor-` and elements marked `data-hc-editor-only` are
  editor-internal; both serializers strip them, so they can never leak
  into the artifact.
- **The JSON projection is an encoding, not a second model.**
  `fromJson(toJson(el))` reproduces the element, modulo documented
  normalizations: whitespace-only text nodes and comments are dropped,
  attribute order is sorted. The optional `component` field (derived
  from the core manifest's block classes) is annotation only and is
  ignored on decode.
- **The manifest is injected, never bundled** (the kit has zero
  runtime dependencies). Pass core's `manifest.json` — since 0.1.14 it
  carries `attributeValues{}` and `cssVars[]` per component, which is
  exactly what a property inspector needs to enumerate.

## Usage

```js
import {
  createEditor,
  setAttribute,
  insertNode,
  fromJson,
} from '@hypermedia-components/editor-kit';
import manifest from '@hypermedia-components/core/manifest.json' with { type: 'json' };

const editor = createEditor({
  root: document.querySelector('#canvas'),
  manifest,
});

// Every mutation goes through the stack…
const button = editor.root.querySelector('.hc-button');
editor.stack.apply(setAttribute(button, 'data-variant', 'primary'));

// …so undo/redo just works.
editor.stack.undo();
editor.stack.redo();

// Group multi-step edits into one undo entry:
editor.stack.transact(() => {
  const card = fromJson({
    tag: 'div',
    attrs: { class: 'hc-card' },
    children: [{ text: 'New card' }],
  });
  editor.stack.apply(insertNode(editor.root, card, 0));
  editor.stack.apply(setAttribute(card, 'data-variant', 'muted'));
});

// Inspector typing coalesces into one undo step:
editor.stack.apply(setAttribute(button, 'aria-label', 'S'), { coalesce: true });
editor.stack.apply(setAttribute(button, 'aria-label', 'Sa'), { coalesce: true });

// Selection drives whatever inspector/overlay you build:
editor.selection.select(button);
editor.selection.addEventListener('change', (e) => console.log(e.detail.items));

// Artifact HTML (editor scaffolding stripped) and the JSON projection:
const html = editor.serialize();
const json = editor.toJson();
```

## Scope and roadmap

Shipped here: commands + undo/redo stack, selection model, serializers
(HTML and the JSON projection). Planned next (in-repo plan: the UI
Builder groundwork discussion): the pointer-events drag-and-drop
controller and the selection/drop-indicator overlay layer for an
iframe-hosted canvas.

Export targets beyond plain HTML (e.g. Thymeleaf) are downstream
consumers of `serialize()`/`toJson()` — they transform neutral
`data-*` binding annotations into template-language attributes and do
not live in this package.
