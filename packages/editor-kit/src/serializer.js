// serializer.js — from canvas DOM to artifact HTML, and the lossless
// JSON projection.
//
// The canvas DOM *is* the document model; there is no parallel IR.
// Editor scaffolding lives under a reserved namespace so it can never
// leak into the artifact: attributes prefixed `data-hc-editor-` and
// whole elements marked `data-hc-editor-only` are stripped by both
// serializers.
//
// The JSON projection is a second *encoding* of the same model, not a
// second model: `fromJson(toJson(el))` reproduces the element exactly,
// modulo the documented normalizations (whitespace-only text nodes and
// comments are dropped, attribute order is sorted). A `component`
// field annotates nodes whose class matches a manifest block — it is
// derived metadata, ignored on decode.

export const EDITOR_ATTR_PREFIX = 'data-hc-editor-';
export const EDITOR_ONLY_ATTR = 'data-hc-editor-only';

function stripEditorArtifacts(node) {
  for (const el of [...node.querySelectorAll(`[${EDITOR_ONLY_ATTR}]`)]) el.remove();
  const targets = [node, ...node.querySelectorAll('*')];
  for (const el of targets) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith(EDITOR_ATTR_PREFIX) || attr.name === EDITOR_ONLY_ATTR) {
        el.removeAttribute(attr.name);
      }
    }
  }
  return node;
}

/** The artifact HTML: `root`'s children with all editor scaffolding
 * stripped. `root` itself is the canvas mount, not part of the page. */
export function serialize(root) {
  const clone = stripEditorArtifacts(root.cloneNode(true));
  return clone.innerHTML;
}

function blockSet(manifest) {
  if (!manifest?.components) return null;
  return new Set(manifest.components.map((c) => c.block));
}

function elementToJson(el, blocks) {
  const attrs = {};
  const names = [...el.attributes]
    .map((a) => a.name)
    .filter((n) => !n.startsWith(EDITOR_ATTR_PREFIX) && n !== EDITOR_ONLY_ATTR)
    .sort();
  for (const name of names) attrs[name] = el.getAttribute(name);

  const children = [];
  for (const child of el.childNodes) {
    if (child.nodeType === 1) {
      if (child.hasAttribute(EDITOR_ONLY_ATTR)) continue;
      children.push(elementToJson(child, blocks));
    } else if (child.nodeType === 3 && child.data.trim() !== '') {
      children.push({ text: child.data });
    }
    // Comments and whitespace-only text are normalized away.
  }

  const json = { tag: el.tagName.toLowerCase() };
  if (blocks) {
    const component = [...el.classList].find((c) => blocks.has(c));
    if (component) json.component = component;
  }
  json.attrs = attrs;
  json.children = children;
  return json;
}

/** Encode an element (and its subtree) as the JSON projection.
 * Pass the core manifest to annotate nodes with their `component`. */
export function toJson(el, { manifest = null } = {}) {
  return elementToJson(el, blockSet(manifest));
}

/** Decode a JSON projection node back into a DOM node. */
export function fromJson(json, doc = globalThis.document) {
  if ('text' in json) return doc.createTextNode(json.text);
  const el = doc.createElement(json.tag);
  for (const [name, value] of Object.entries(json.attrs ?? {})) {
    el.setAttribute(name, value);
  }
  for (const child of json.children ?? []) {
    el.appendChild(fromJson(child, doc));
  }
  return el;
}
