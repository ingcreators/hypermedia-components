# editor-kit: dirty-region serialization plan (#452)

Design for format-stable serialization of partially edited canvases —
issue [#452](https://github.com/ingcreators/hypermedia-components/issues/452),
split out of #449 (item 4).

**Problem.** `serialize()` re-serializes the whole canvas, so opening a
hand-formatted template and moving one node rewrites the formatting of
everything (quote/entity/whitespace normalization) — noisy diffs that
make "review before apply" workflows harder than they should be.

**Direction.** A dirty-region serializer: only re-serialize the
subtrees the `CommandStack` actually touched, and splice the results
into the original source text. Shipped in three strictly additive
stages so the cheap, independently useful parts land before the hard
one, and so the constraint is encoded in the API before it freezes.

| Stage | Adds | Depends on | Files |
| --- | --- | --- | --- |
| 1 | Dirty tracking on `CommandStack` (`dirty`, `dirtyNodes()`, `markClean()`) + a `dirt()` method on the command protocol | — | `src/commands.js` |
| 2 | `serializeNode(node)` / `serializePatch(root, dirtyMap)` | 1 | `src/serializer.js` |
| 3 | Source-position tracking + splice: `src/source.js`, `createEditor({ source })`, `editor.serializeStable()` | 1 (+ `serializeNode` from 2) | new `src/source.js`, `src/index.js` |

Two existing contracts (README, Design section) do the heavy lifting:

- **Every canvas mutation flows through the six primitives** — this is
  what makes "the stack knows exactly which nodes changed" true.
  DOM mutation outside the stack was already undefined behavior.
- **Editor scaffolding is namespaced** (`data-hc-editor-*`,
  `data-hc-editor-only`) — the one legitimate out-of-stack mutation is
  mechanically excludable.

---

## Stage 1 — dirty tracking on `CommandStack`

### Dirt vocabulary

Three kinds. Attribute dirt is recorded **per attribute name** — Stage
3's attribute-level splice needs the name, so the granularity is never
thrown away:

```text
'attr:<name>'   setAttribute / removeAttribute → node's start tag is dirty
'text'          setText                        → node's content is dirty
'children'      insertNode / removeNode / moveNode → the PARENT's child list is dirty
```

| Primitive | Dirt records |
| --- | --- |
| `setAttribute(node, name, v)` | `[[node, 'attr:' + name]]` |
| `removeAttribute` | same (it is a `setAttribute`) |
| `setText(node, t)` | `[[node, 'text']]` |
| `insertNode(parent, node, i)` | `[[parent, 'children']]` |
| `removeNode(node)` | `[[this.parent, 'children']]` (parent captured on first apply) |
| `moveNode(node, parent, i)` | `[[this.prevParent, 'children'], [parent, 'children']]` |

Note that a *moved* node is itself **not** dirty — only its old and new
parents' child lists are. Stage 3 exploits this: a clean node's source
slice travels verbatim.

### Command protocol: `dirt()`

Each primitive gains a `dirt()` method returning its records —
symmetric with how each primitive already captures its own inverse.
The stack calls it **after first apply** (so `removeNode.parent` /
`moveNode.prevParent` are captured) and stays ignorant of command
types. Custom commands without `dirt()` simply don't participate
(documented; the six primitives close the edit vocabulary, so in
practice everything is tracked).

### Counting semantics

The stack keeps `#dirt: Map<Node, Map<kind, count>>` with **signed**
counts:

- `apply(cmd)` → +1 per record; `undo` → −1; `redo` → +1
- **Coalesced merges do not count** — the stack entry doesn't grow, so
  one undo restores `prev`; ±1 stays balanced.
- `transact()` batches count per inner command (undo reverts each).
- **Dirty ⇔ count ≠ 0** (not > 0). This makes undoing *past* a
  `markClean()` watermark correctly dirty: apply A → markClean → undo A
  gives count −1 ≠ 0.
- Entries that reach 0 are pruned immediately.

Counting proves "same command applied and reverted equally often", not
byte-equality; since every primitive is a structural inverse
(captures `prev`, restores it), the documented claim is "undo back to
the last clean point ⇒ clean", and that is the guarantee level.

### API

```js
stack.dirty        // getter: any nonzero count?
stack.dirtyNodes() // defensive copy: Map<Node, Set<string>>
                   //   e.g. div → Set { 'attr:data-variant', 'children' }
stack.markClean()  // reset all counts, emit change {action:'clean'}
```

- `change` gains `detail.action: 'clean'` (existing: apply | undo |
  redo | clear). Dirt is updated **before** the emit so listeners can
  read `stack.dirty` — an "unsaved changes" indicator is one listener.
- **`clear()` does not touch dirt.** Forgetting history and "the DOM
  differs from baseline" are different facts (`dispose()` calls
  `clear()`; that must not fake a clean state).
- `dirtyNodes()` does not filter detached nodes (the stack has no root
  by design); containment is Stage 2's job.

### Tests (`commands.test.mjs`)

Each primitive → expected records (both `moveNode` parents,
`removeAttribute`'s `attr:` name); apply→undo→clean and redo→dirty;
coalesced typing undone in one step → clean; `transact` → one undo →
clean; undo past `markClean` → dirty (negative-count path); `clear()`
keeps dirt; `'clean'` event fires.

---

## Stage 2 — `serializePatch()`

### Contract

Added to `serializer.js` (which keeps zero imports from
`commands.js` — the dirty map is passed by value):

```js
/** One element's clean outerHTML (scaffolding stripped). */
export function serializeNode(node)

/** Clean HTML for the minimal dirty subtrees. No splicing. */
export function serializePatch(root, dirtyMap)
// → { clean: boolean, patches: [{ node, kinds: Set<string>, html: string }] }
```

`createEditor()` wires `serializePatch: () => serializePatch(root,
stack.dirtyNodes())`.

### Algorithm

1. **Containment filter**: keep entries with `node === root ||
   root.contains(node)`. Dirty nodes inside removed subtrees drop out
   here — no information is lost, because the removal itself marked
   the in-root parent `children`.
2. **Minimal cover**: drop any dirty node with a dirty ancestor (the
   ancestor's `outerHTML` subsumes it). O(n·depth) parent walk.
3. **HTML**: per cover root, `cloneNode(true)` →
   `stripEditorArtifacts()` → `outerHTML`. When **root itself** is a
   cover root (top-level insert/remove/move), `html` is `serialize(root)`
   — innerHTML, per the existing "root is the mount, not part of the
   artifact" contract; distinguishable via `node === root`.

### Scope honesty

Good for partial re-render, smaller save payloads, and "these N
regions changed" review UI. It **cannot** splice text — there are no
source positions. That line is what keeps Stage 2 small; text splicing
is Stage 3.

### Tests (`serializer.test.mjs`)

Single attr edit → one patch, siblings excluded; parent+child dirty →
cover keeps parent only; `moveNode` → two patches (collapsing to one
under a dirty common ancestor); top-level insert → `node === root` +
innerHTML; attr-dirty node inside a removed subtree → filtered,
subsumed by old parent's patch; no scaffolding leaks; clean →
`{ clean: true, patches: [] }`.

---

## Stage 3 — source positions + splice (`src/source.js`)

### Core decision: browser parse + token alignment, not a hand-built tree

Building the DOM ourselves (createElement from a hand parser) would
give exact positions but re-implements tree construction and executes
inserted `<script>`s. Instead:

1. **The browser parses**: `template.innerHTML = source` (`<template>`
   accepts table fragments, scripts stay inert); adopt its content
   into the canvas root.
2. **Our tokenizer builds no tree** — it emits a flat token stream
   with offsets: start tags (with per-attribute spans), end tags,
   text, comments, raw-text elements (`script`/`style`/`textarea`/
   `title`), void elements. Entities are **never decoded** (only
   positions matter). ~150–200 lines, zero deps.
3. **Alignment walk**: traverse the browser tree in document order
   while consuming tokens, producing `WeakMap<Node, Span>`:

```js
Span = {
  start,        // offset of the start tag's '<'
  contentStart, // just past the start tag's '>'
  contentEnd,   // start of the end tag ('<'), or of the token that implied closure
  end,          // just past the end tag's '>', or contentEnd when omitted
  attrs,        // Map<name, {start, end}> — full span incl. quotes
  synthetic,    // browser-synthesized (e.g. <tbody>): zero-width span
}
```

- **Implied end tags** (omitted `</li>`, auto-closed `<p>`): structure
  comes from the browser tree, offsets from tokens — `contentEnd` is
  the start of the first non-descendant token.
- **Synthesized nodes** (`<tbody>`…): no matching token → zero-width
  `synthetic` span; edits touching one degrade that region to the
  parent's re-serialize.
- **Alignment failure** (token/tree divergence): never throw — mark
  the map invalid; `serializeStable()` falls back to full
  `serialize()` and reports `{ stable: false }`. A normalized full
  document beats a corrupt splice.

### API

```js
// src/source.js
export function attachSource(root, source) // parse → populate root → SourceMap
export class SourceMap                     // { valid, spanOf(node), source }

// index.js
createEditor({ root, manifest, source })   // source is opt-in
editor.serializeStable()
// → { text, stable, regions: [{ node, kinds }] }
//    stable:false ⇒ text is the plain serialize() output
```

`package.json` exports gain `"./source": "./src/source.js"`. Existing
callers (no `source`) are untouched.

### The splice emitter (recursive, format-preserving)

Re-emitting a whole dirty cover root would still normalize *moved but
untouched* nodes — the exact complaint in #452. So the emitter
recurses and keeps source slices wherever possible:

```text
emit(node):
  editor-only element            → ''                    (scaffolding)
  unmapped (newly inserted) or synthetic
                                 → serializeNode(node)   (fresh, normalized)
  node and whole subtree clean   → slice(start, end)     (verbatim — ★ moves land here)
  # partial re-emit:
  startTag = 'attr:*' dirty ? spliceAttrs(node) : slice(start, contentStart)
  inner    = 'text' dirty   ? escapeText(node.textContent)
                            : concat(emit(child) for child of childNodes)
  endTag   = slice(contentEnd, end)
  return startTag + inner + endTag
```

- **Moves preserve bytes**: a moved node is not dirty (only the two
  parents are), so ★ emits its original slice — quotes, entities,
  inner line breaks intact. This is the issue's headline requirement.
- **Text nodes are mapped children too**, so inter-child whitespace
  and indentation inside a children-dirty parent stay verbatim.
- The root acts as a virtual mapped node (span = whole source, no
  tags): `emit(root)` concatenates its children.
- Scaffolding: clean nodes come from source slices (nothing to strip);
  regenerated start tags filter `data-hc-editor-*` /
  `data-hc-editor-only`, same rule as the serializers.

Known cosmetic limits (documented, not correctness issues): whitespace
text nodes around a removed/moved node remain (possible extra blank
line); moved nodes are not re-indented (the diff shows lines moving
verbatim — arguably the reviewable behavior); inserted nodes are
serializer-normalized (necessarily).

### Attribute-level splice (`spliceAttrs`)

Attribute spans make even start-tag regeneration avoidable. The dirty
record `attr:<name>` names the attribute:

- **Change**: replace the attribute's span with `name="newValue"`
  (double quotes; only *this* attribute normalizes — the siblings'
  quote styles survive).
- **Remove**: drop the span plus preceding whitespace.
- **Add**: insert ` name="value"` just before the closing `>` / `/>`.
- **Fallback**: anything odd in the source tag (e.g. duplicate
  attribute) → regenerate the whole start tag.

### Rebaselining after save (`commit`)

The emitter tracks its running output offset, so it can record every
node's **new** span while producing the text.
`editor.serializeStable({ commit: true })` returns the text and
atomically swaps the SourceMap's baseline to it (newly inserted nodes
become mapped); the caller then calls `stack.markClean()`. The
edit → save → edit → save loop closes without ever re-parsing or
re-aligning — alignment risk exists only at the initial
`attachSource`.

### Tests (`source.test.mjs`, new)

Tokenizer offsets (attributes, three quoting styles, void, raw text,
comments, undecoded entities); alignment (implied `</li>` / `</p>`,
`<tbody>` synthesis, comment nodes); **byte preservation** — one attr
change ⇒ output differs from input only inside that attr's span; move
⇒ the moved block appears as its original slice (fixture with `&amp;`
and single-quoted attrs); setText / insert (fresh-region escaping);
undo to clean ⇒ output byte-identical to input; two full
commit cycles stay stable; degradation fixture ⇒ `{ stable: false }` +
full-serialize equality; no scaffolding leaks (editor-only elements
and editor attrs); and for every scenario, structural equivalence:
re-parsing the spliced text ≡ re-parsing `serialize(root)`.

---

## Rollout

- **One concern per PR**: ① this plan; ② Stage 1; ③ Stage 2;
  ④ Stage 3. Sequential — each branches from the merged main.
- **Versions**: Stages 1+2 ship as editor-kit `0.2.0` (new feature on
  the experimental 0.x line; and `dirt()` is a new command-protocol
  contract — minor is more honest than patch). Stage 3 ships as
  `0.3.0`. Independent `editor-kit-v*` tags as usual.
- **Docs**: editor-kit README Design section gains dirty tracking and
  stable serialize; `CHANGELOG.md` under Unreleased per PR.
- **#452** is closed by Stage 3; the issue gets a comment linking this
  plan when it lands.
