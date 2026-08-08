// source.js — source-position tracking and the dirty-region splice
// serializer (#452 Stage 3; design in
// plans/hc-editor-kit-dirty-serialize-plan-en.md).
//
// serialize() re-serializes the whole canvas, so opening a
// hand-formatted template and moving one node rewrites everyone's
// quotes, entities, and whitespace. The fix: keep the original source
// text, know each node's source span, and re-emit only what the
// CommandStack dirtied — everything else travels as a verbatim slice.
//
// Position tracking never re-implements HTML tree construction: the
// BROWSER parses (via <template>, so scripts stay inert and table
// fragments work) while a flat tokenizer walks the same source
// emitting offsets, and an alignment walk pairs tokens with the
// browser's tree. Where the two disagree (exotic markup), the map
// degrades to invalid and serializeStable() falls back to the plain
// serializer — a normalized full document beats a corrupt splice.

import {
  EDITOR_ATTR_PREFIX,
  EDITOR_ONLY_ATTR,
  serialize,
} from './serializer.js';

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'source', 'track', 'wbr',
]);
// Raw text: emitted/consumed without entity escaping. Escapable raw
// text (RCDATA) still escapes on output.
const RAW_TEXT = new Set(['script', 'style']);
const ESCAPABLE_RAW = new Set(['textarea', 'title']);

const WS = /\s/;

function isLetter(c) {
  return c !== undefined && /[a-zA-Z]/.test(c);
}

// ---------------------------------------------------------------------------
// Tokenizer — a flat, offset-preserving scan. No tree, no entity
// decoding; only positions matter.

function readStartTag(src, lt) {
  const n = src.length;
  let j = lt + 1;
  while (j < n && !/[\s/>]/.test(src[j])) j++;
  const name = src.slice(lt + 1, j).toLowerCase();
  const attrs = new Map(); // lowercased name → {start, end} incl. quotes
  let dupAttrs = false;
  let selfClosing = false;
  while (j < n) {
    while (j < n && WS.test(src[j])) j++;
    if (src[j] === '>') {
      j++;
      break;
    }
    if (src[j] === '/') {
      if (src[j + 1] === '>') {
        selfClosing = true;
        j += 2;
        break;
      }
      j++; // stray slash between attributes
      continue;
    }
    if (j >= n) break;
    const aStart = j;
    while (j < n && !/[\s=/>]/.test(src[j])) j++;
    const aName = src.slice(aStart, j).toLowerCase();
    let k = j;
    while (k < n && WS.test(src[k])) k++;
    if (src[k] === '=') {
      k++;
      while (k < n && WS.test(src[k])) k++;
      const q = src[k];
      if (q === '"' || q === "'") {
        const close = src.indexOf(q, k + 1);
        k = close === -1 ? n : close + 1;
      } else {
        while (k < n && !/[\s>]/.test(src[k])) k++;
      }
      j = k;
    }
    if (aName) {
      if (attrs.has(aName)) dupAttrs = true;
      else attrs.set(aName, { start: aStart, end: j });
    }
  }
  return { kind: 'start', name, attrs, dupAttrs, selfClosing, start: lt, end: j };
}

export function tokenize(src) {
  const tokens = [];
  const n = src.length;
  let i = 0;
  let textStart = 0;
  const flushText = (upto) => {
    if (upto > textStart) tokens.push({ kind: 'text', start: textStart, end: upto });
  };
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break;
    const c = src[lt + 1];
    if (c === '!' || c === '?') {
      flushText(lt);
      if (src.startsWith('<!--', lt)) {
        let end = src.indexOf('-->', lt + 4);
        end = end === -1 ? n : end + 3;
        tokens.push({ kind: 'comment', start: lt, end });
        i = textStart = end;
      } else {
        // Bogus comment (the browser makes a Comment node) — except a
        // doctype, which the fragment parser drops entirely.
        let end = src.indexOf('>', lt);
        end = end === -1 ? n : end + 1;
        const doctype = /^<!doctype/i.test(src.slice(lt, lt + 9));
        tokens.push({ kind: doctype ? 'doctype' : 'comment', start: lt, end });
        i = textStart = end;
      }
    } else if (c === '/') {
      if (!isLetter(src[lt + 2])) {
        // '</' + non-letter: bogus comment
        flushText(lt);
        let end = src.indexOf('>', lt);
        end = end === -1 ? n : end + 1;
        tokens.push({ kind: 'comment', start: lt, end });
        i = textStart = end;
        continue;
      }
      flushText(lt);
      let j = lt + 2;
      while (j < n && !/[\s>]/.test(src[j])) j++;
      const name = src.slice(lt + 2, j).toLowerCase().replace(/\/+$/, '');
      let end = src.indexOf('>', j);
      end = end === -1 ? n : end + 1;
      tokens.push({ kind: 'end', name, start: lt, end });
      i = textStart = end;
    } else if (isLetter(c)) {
      flushText(lt);
      const tok = readStartTag(src, lt);
      tokens.push(tok);
      i = textStart = tok.end;
      if (RAW_TEXT.has(tok.name) || ESCAPABLE_RAW.has(tok.name)) {
        // Raw content runs to the matching end tag, unparsed.
        const idx = src.toLowerCase().indexOf(`</${tok.name}`, tok.end);
        const contentEnd = idx === -1 ? n : idx;
        if (contentEnd > tok.end) {
          tokens.push({ kind: 'text', start: tok.end, end: contentEnd });
        }
        i = textStart = contentEnd;
      }
    } else {
      i = lt + 1; // literal '<' stays inside the pending text run
    }
  }
  flushText(n);
  return tokens;
}

// ---------------------------------------------------------------------------
// Alignment — pair the browser's tree with the token stream.
//
// Structure comes from the tree, offsets from the tokens. Implied end
// tags close at the next token's start; browser-synthesized elements
// (e.g. <tbody>) get zero-width `synthetic` spans. Any divergence
// invalidates the whole map — degrade, never guess.

function alignTokens(root, tokens, source) {
  const spans = new WeakMap();
  let ti = 0;
  let ok = true;

  const boundary = () => (ti < tokens.length ? tokens[ti].start : source.length);

  function walkChildren(parent) {
    for (const child of parent.childNodes) {
      if (!ok) return;
      const t = tokens[ti];
      if (t && t.kind === 'doctype') {
        // No node to pair with, and its bytes would silently vanish
        // from verbatim output. Degrade.
        ok = false;
        return;
      }
      if (child.nodeType === 3) {
        if (t && t.kind === 'text') {
          spans.set(child, { start: t.start, end: t.end, text: true });
          ti++;
        } else {
          ok = false;
          return;
        }
      } else if (child.nodeType === 8) {
        if (t && t.kind === 'comment') {
          spans.set(child, { start: t.start, end: t.end, text: true });
          ti++;
        } else {
          ok = false;
          return;
        }
      } else if (child.nodeType === 1) {
        const name = child.localName.toLowerCase();
        if (t && t.kind === 'start' && t.name === name) {
          ti++;
          const span = {
            start: t.start,
            contentStart: t.end,
            contentEnd: -1,
            end: -1,
            attrs: t.dupAttrs ? null : t.attrs,
            synthetic: false,
          };
          spans.set(child, span);
          walkChildren(child);
          if (!ok) return;
          const e = tokens[ti];
          if (e && e.kind === 'end' && e.name === name) {
            span.contentEnd = e.start;
            span.end = e.end;
            ti++;
          } else {
            // Implied end (omitted </li>, void element, EOF).
            span.contentEnd = boundary();
            span.end = span.contentEnd;
          }
        } else {
          // Browser-synthesized element: zero-width tags, real content.
          const start = boundary();
          const span = {
            start,
            contentStart: start,
            contentEnd: -1,
            end: -1,
            attrs: null,
            synthetic: true,
          };
          spans.set(child, span);
          walkChildren(child);
          if (!ok) return;
          span.contentEnd = boundary();
          span.end = span.contentEnd;
        }
      }
      // Other node types don't occur in template-parsed HTML.
    }
  }

  walkChildren(root);
  if (ti !== tokens.length) ok = false; // stray end tags the browser dropped
  return { spans, valid: ok };
}

// ---------------------------------------------------------------------------
// SourceMap — the original text plus per-node spans. Internal state
// lives in a module WeakMap so serializeStable/attachSource (same
// module) can rebaseline it on commit.

const STATE = new WeakMap(); // SourceMap → { source, spans, valid }

export class SourceMap {
  /** Whether splicing is possible (alignment succeeded and no commit
   * has failed since). When false, serializeStable() falls back. */
  get valid() {
    return STATE.get(this).valid;
  }

  /** The current baseline text (updated on commit). */
  get source() {
    return STATE.get(this).source;
  }

  /** The node's span in `source`, or null (unmapped/new node). */
  spanOf(node) {
    return STATE.get(this).spans.get(node) ?? null;
  }
}

/**
 * Parse `source` into `root` (replacing its children) and return the
 * SourceMap tracking every node's source span. The browser parses —
 * via <template>, so scripts stay inert — while the tokenizer only
 * records offsets.
 */
export function attachSource(root, source) {
  const doc = root.ownerDocument;
  const tpl = doc.createElement('template');
  tpl.innerHTML = source;
  root.replaceChildren(tpl.content);
  const { spans, valid } = alignTokens(root, tokenize(source), source);
  const map = new SourceMap();
  STATE.set(map, { source, spans, valid });
  return map;
}

// ---------------------------------------------------------------------------
// The splice emitter.

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function isScaffolding(node) {
  return node.nodeType === 1 && node.hasAttribute(EDITOR_ONLY_ATTR);
}

function attrVisible(name) {
  return !name.startsWith(EDITOR_ATTR_PREFIX) && name !== EDITOR_ONLY_ATTR;
}

/** Minimal dirty cover: in-root dirty nodes with no dirty ancestor. */
function coverRegions(root, dirtyMap) {
  const contained = [...dirtyMap].filter(
    ([n]) => n === root || root.contains(n),
  );
  const nodes = new Set(contained.map(([n]) => n));
  const regions = [];
  for (const [node, kinds] of contained) {
    let covered = false;
    for (let p = node === root ? null : node.parentNode; p; p = p.parentNode) {
      if (nodes.has(p)) {
        covered = true;
        break;
      }
      if (p === root) break;
    }
    if (!covered) regions.push({ node, kinds: new Set(kinds) });
  }
  return regions;
}

/**
 * Splice-serialize `root` against its SourceMap: dirty regions are
 * re-emitted, everything else is a verbatim slice of the baseline
 * text. Returns `{ text, stable, regions }`; `stable: false` means the
 * output is the plain `serialize(root)` (no map, invalid map).
 *
 * `commit: true` atomically rebaselines the map to the returned text
 * (newly inserted nodes become mapped, with attribute spans) — the
 * caller should then `stack.markClean()`.
 */
export function serializeStable(root, sourceMap, dirtyMap, { commit = false } = {}) {
  const regions = coverRegions(root, dirtyMap);
  const state = sourceMap ? STATE.get(sourceMap) : null;
  if (!state || !state.valid) {
    return { text: serialize(root), stable: false, regions };
  }
  const src = state.source;
  const spans = state.spans;

  // Nodes whose subtree contains dirt (the dirty nodes and their
  // ancestor chains up to root).
  const dirtyPath = new Set();
  for (const node of dirtyMap.keys()) {
    if (node !== root && !root.contains(node)) continue;
    for (let p = node; p; p = p.parentNode) {
      dirtyPath.add(p);
      if (p === root) break;
    }
  }

  const out = [];
  let offset = 0;
  const newSpans = commit ? new WeakMap() : null;
  const push = (s) => {
    out.push(s);
    offset += s.length;
  };

  /** Shift a clean mapped subtree's spans into the new text. */
  function recordShifted(node, delta) {
    const span = spans.get(node);
    if (span) {
      const ns = { ...span, start: span.start + delta, end: span.end + delta };
      if (!span.text) {
        ns.contentStart = span.contentStart + delta;
        ns.contentEnd = span.contentEnd + delta;
        if (span.attrs) {
          ns.attrs = new Map(
            [...span.attrs].map(([k, v]) => [
              k,
              { start: v.start + delta, end: v.end + delta },
            ]),
          );
        }
      }
      newSpans.set(node, ns);
    }
    if (node.nodeType === 1) {
      for (const child of node.childNodes) recordShifted(child, delta);
    }
  }

  function rawMode(el) {
    const name = el.localName.toLowerCase();
    if (RAW_TEXT.has(name)) return 'raw';
    if (ESCAPABLE_RAW.has(name)) return 'rcdata';
    return 'text';
  }

  /** Serialize an unmapped (new) node, recording spans when committing.
   * Mapped descendants (e.g. an existing node moved into a new
   * container) still go through emit() and keep their slices. */
  function emitFresh(node) {
    if (node.nodeType === 3) {
      const parent = node.parentNode;
      const mode = parent && parent.nodeType === 1 ? rawMode(parent) : 'text';
      const s = mode === 'raw' ? node.data : escapeText(node.data);
      const start = offset;
      push(s);
      if (commit) newSpans.set(node, { start, end: offset, text: true });
      return;
    }
    if (node.nodeType === 8) {
      const start = offset;
      push(`<!--${node.data}-->`);
      if (commit) newSpans.set(node, { start, end: offset, text: true });
      return;
    }
    if (node.nodeType !== 1 || isScaffolding(node)) return;
    const tag = node.localName;
    const start = offset;
    let s = `<${tag}`;
    const attrs = new Map();
    for (const a of node.attributes) {
      if (!attrVisible(a.name)) continue;
      const aStart = start + s.length + 1; // past the separating space
      s += ` ${a.name}="${escapeAttr(a.value)}"`;
      attrs.set(a.name.toLowerCase(), { start: aStart, end: start + s.length });
    }
    s += '>';
    push(s);
    const contentStart = offset;
    if (!VOID.has(tag)) {
      for (const child of node.childNodes) emit(child);
    }
    const contentEnd = offset;
    if (!VOID.has(tag)) push(`</${tag}>`);
    if (commit) {
      newSpans.set(node, {
        start,
        contentStart,
        contentEnd,
        end: offset,
        attrs,
        synthetic: false,
      });
    }
  }

  /** Splice only the dirty attributes inside the original start tag.
   * Returns null when the source tag can't be spliced (no attr spans /
   * duplicate attrs) — caller regenerates the whole tag. Attr spans in
   * the result are relative to the tag start. */
  function spliceAttrs(node, span, kinds) {
    if (!span.attrs) return null;
    const dirtyNames = new Set(
      [...kinds]
        .filter((k) => k.startsWith('attr:'))
        .map((k) => k.slice(5).toLowerCase()),
    );
    const tagSrc = src.slice(span.start, span.contentStart);
    const closeLen = tagSrc.endsWith('/>') ? 2 : 1;
    const closeAt = span.contentStart - closeLen;
    const edits = []; // absolute {from, to, insert, name}
    for (const name of dirtyNames) {
      if (!attrVisible(name)) continue; // scaffolding never lands in source
      const rel = span.attrs.get(name);
      if (node.hasAttribute(name)) {
        const rendered = `${name}="${escapeAttr(node.getAttribute(name))}"`;
        if (rel) edits.push({ from: rel.start, to: rel.end, insert: rendered, name });
        else edits.push({ from: closeAt, to: closeAt, insert: ` ${rendered}`, name });
      } else if (rel) {
        let from = rel.start;
        const nameEnd = span.start + 1 + node.localName.length;
        while (from > nameEnd && WS.test(src[from - 1])) from--;
        edits.push({ from, to: rel.end, insert: '', name: null });
      }
    }
    edits.sort((a, b) => a.from - b.from || a.to - b.to);
    const parts = [];
    let cursor = span.start;
    let outPos = 0;
    const attrs = new Map();
    for (const e of edits) {
      parts.push(src.slice(cursor, e.from));
      outPos += e.from - cursor;
      if (e.insert) {
        const lead = e.insert.startsWith(' ') ? 1 : 0;
        if (e.name) attrs.set(e.name, { start: outPos + lead, end: outPos + e.insert.length });
        parts.push(e.insert);
        outPos += e.insert.length;
      }
      cursor = e.to;
    }
    parts.push(src.slice(cursor, span.contentStart));
    for (const [name, rel] of span.attrs) {
      if (dirtyNames.has(name)) continue;
      let delta = 0;
      for (const e of edits) {
        if (e.to <= rel.start) delta += e.insert.length - (e.to - e.from);
      }
      attrs.set(name, {
        start: rel.start - span.start + delta,
        end: rel.end - span.start + delta,
      });
    }
    return { text: parts.join(''), attrs };
  }

  function emit(node) {
    if (isScaffolding(node)) return;
    const span = spans.get(node);
    if (!span) {
      emitFresh(node);
      return;
    }
    if (!dirtyPath.has(node)) {
      // Clean subtree: the verbatim slice — quotes, entities, and
      // whitespace intact. Moved nodes land here (only their parents
      // are dirty), which is the point of the whole exercise.
      if (commit) recordShifted(node, offset - span.start);
      push(src.slice(span.start, span.end));
      return;
    }
    const kinds = dirtyMap.get(node) ?? new Set();
    const attrDirty = [...kinds].some((k) => k.startsWith('attr:'));
    if (span.synthetic && (attrDirty || kinds.has('text'))) {
      // Zero-width tags can't carry attributes; materialize the tag.
      emitFresh(node);
      return;
    }
    const start = offset;
    let attrsOut = null;
    if (attrDirty) {
      const spliced = spliceAttrs(node, span, kinds);
      if (spliced) {
        attrsOut = new Map(
          [...spliced.attrs].map(([k, v]) => [
            k,
            { start: start + v.start, end: start + v.end },
          ]),
        );
        push(spliced.text);
      } else {
        // Duplicate attrs in the source tag etc. — regenerate it.
        let s = `<${node.localName}`;
        attrsOut = new Map();
        for (const a of node.attributes) {
          if (!attrVisible(a.name)) continue;
          const aStart = start + s.length + 1;
          s += ` ${a.name}="${escapeAttr(a.value)}"`;
          attrsOut.set(a.name.toLowerCase(), { start: aStart, end: start + s.length });
        }
        s += '>';
        push(s);
      }
    } else {
      push(src.slice(span.start, span.contentStart));
      if (commit && span.attrs) {
        const delta = start - span.start;
        attrsOut = new Map(
          [...span.attrs].map(([k, v]) => [
            k,
            { start: v.start + delta, end: v.end + delta },
          ]),
        );
      }
    }
    const contentStart = offset;
    if (kinds.has('text')) {
      const mode = rawMode(node);
      const s = mode === 'raw' ? node.textContent : escapeText(node.textContent);
      const tStart = offset;
      push(s);
      if (commit && node.firstChild) {
        newSpans.set(node.firstChild, { start: tStart, end: offset, text: true });
      }
    } else {
      for (const child of node.childNodes) emit(child);
    }
    const contentEnd = offset;
    push(src.slice(span.contentEnd, span.end));
    if (commit) {
      newSpans.set(node, {
        start,
        contentStart,
        contentEnd,
        end: offset,
        attrs: attrsOut,
        synthetic: span.synthetic,
      });
    }
  }

  for (const child of root.childNodes) emit(child);
  const text = out.join('');

  if (commit) {
    state.source = text;
    state.spans = newSpans;
  }
  return { text, stable: true, regions };
}
