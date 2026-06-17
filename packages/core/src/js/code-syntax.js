// @hypermedia-components/core — code tokenizers for the live editable
// highlight overlay (issue #264).
//
// A tokenizer is `(text) => Array<{ tok, text }>`. The `text` parts,
// concatenated in order, must reconstruct the input exactly; `tok` is one of
// the hc-code `data-tok` values
//
//   keyword | string | number | comment | operator | identifier
//   property | tag | attribute | meta
//
// or a falsy value (`''` / `null`) for plain, uncoloured text. `installCodeEditor()`
// renders each token as a `<span class="hc-code__tok" data-tok="…">` (or a bare
// text node) into the overlay, coloured from the same `--hc-code-tok-*` palette
// as the server-tokenized read-only path (#261), so the editor matches the
// read-only / diff surfaces.
//
// Built-in grammars (`sql`, `json`, `yaml`, `html`) cover common cases. Register
// your own with `registerCodeLanguage(name, tokenizer)` — a dialect tokenizer
// can classify constructs a generic grammar can't (e.g. TesseraQL's 2-way SQL
// directives `/*%if … */` as `meta`). Everything here is CSP-safe: pure JS,
// no `eval` / `new Function`, no network.

// Consumer registrations live on a globalThis-keyed singleton so every inlined
// copy of this module (hc.js, hc.behaviors.js each bundle one) reads and writes
// the same registry — the same reason the i18n catalog is a singleton (#216).
// Built-ins are resolved as a fallback below, so registering a built-in name
// overrides it without mutating shared state.
const STATE_KEY = Symbol.for('hypermedia-components.code-languages');
const registry = globalThis[STATE_KEY] || (globalThis[STATE_KEY] = new Map());

const norm = (name) => String(name).toLowerCase();

/**
 * Run an ordered list of sticky-regex rules over `text`, accumulating
 * unmatched characters as plain tokens. Each rule is `{ tok, re }` where `re`
 * carries the `y` (sticky) flag; the first rule that matches at the current
 * position wins. Reconstructs the input exactly.
 *
 * @param {string} text
 * @param {Array<{tok: string, re: RegExp}>} rules
 * @returns {Array<{tok: string, text: string}>}
 */
function scan(text, rules) {
  const out = [];
  let plain = '';
  const flush = () => {
    if (plain) {
      out.push({ tok: '', text: plain });
      plain = '';
    }
  };
  let i = 0;
  const n = text.length;
  while (i < n) {
    let matched = false;
    for (let r = 0; r < rules.length; r += 1) {
      const { tok, re } = rules[r];
      re.lastIndex = i;
      const m = re.exec(text);
      if (m && m.index === i && m[0].length > 0) {
        flush();
        out.push({ tok, text: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += text[i];
      i += 1;
    }
  }
  flush();
  return out;
}

// --- SQL ------------------------------------------------------------------
// A generic SQL grammar. 2-way-SQL block comments (`/* … */`) read as plain
// comments here; a dialect that wants its directives highlighted as `meta`
// registers its own tokenizer.
const SQL_KEYWORDS =
  /(?:select|from|where|insert|into|values|update|set|delete|create|table|alter|drop|join|inner|left|right|outer|full|cross|on|group|by|order|having|limit|offset|union|all|distinct|as|and|or|not|in|is|null|like|between|exists|case|when|then|else|end|asc|desc|primary|key|foreign|references|default|index|view|with|returning|using|cast|coalesce|count|sum|avg|min|max|true|false)\b/iy;

function tokenizeSql(text) {
  return scan(text, [
    { tok: 'comment', re: /--[^\n]*/y },
    { tok: 'comment', re: /\/\*[\s\S]*?\*\//y },
    { tok: 'string', re: /'(?:[^']|'')*'/y },
    { tok: 'number', re: /\b\d+(?:\.\d+)?\b/y },
    { tok: 'keyword', re: SQL_KEYWORDS },
    { tok: 'identifier', re: /[A-Za-z_][\w$]*/y },
    { tok: 'operator', re: /[-+*/%=<>!,;.()|&^~?@:[\]{}]+/y },
  ]);
}

// --- JSON -----------------------------------------------------------------
function tokenizeJson(text) {
  return scan(text, [
    // A string immediately before a colon is an object key → `property`.
    { tok: 'property', re: /"(?:[^"\\]|\\.)*"(?=\s*:)/y },
    { tok: 'string', re: /"(?:[^"\\]|\\.)*"/y },
    { tok: 'number', re: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y },
    { tok: 'keyword', re: /\b(?:true|false|null)\b/y },
    { tok: 'operator', re: /[{}[\]:,]/y },
  ]);
}

// --- YAML -----------------------------------------------------------------
function tokenizeYaml(text) {
  return scan(text, [
    { tok: 'comment', re: /#[^\n]*/y },
    { tok: 'string', re: /'(?:[^']|'')*'/y },
    { tok: 'string', re: /"(?:[^"\\]|\\.)*"/y },
    // Unquoted mapping key: a scalar followed by a colon + space / end-of-line.
    { tok: 'property', re: /[A-Za-z_][\w.\- ]*?(?=:(?:\s|$))/y },
    { tok: 'number', re: /\b-?\d+(?:\.\d+)?\b/y },
    { tok: 'keyword', re: /\b(?:true|false|null|yes|no|on|off)\b/iy },
    { tok: 'operator', re: /[:?,[\]{}]|(?:^|\s)-(?=\s)/y },
  ]);
}

// --- HTML -----------------------------------------------------------------
// Stateful: tag/attribute classification depends on being inside a `<…>`.
function tokenizeHtml(text) {
  const out = [];
  let plain = '';
  const flush = () => {
    if (plain) {
      out.push({ tok: '', text: plain });
      plain = '';
    }
  };
  const push = (tok, t) => {
    if (t) {
      flush();
      out.push({ tok, text: t });
    }
  };
  let i = 0;
  const n = text.length;
  const reComment = /<!--[\s\S]*?-->/y;
  const reDoctype = /<![^>]*>/y;
  const reTagOpen = /<\/?[A-Za-z][\w:-]*/y;
  const reAttrName = /[^\s=/>]+/y;
  const reValDq = /"[^"]*"/y;
  const reValSq = /'[^']*'/y;
  while (i < n) {
    if (text[i] === '<') {
      reComment.lastIndex = i;
      let m = reComment.exec(text);
      if (m && m.index === i) {
        push('comment', m[0]);
        i += m[0].length;
        continue;
      }
      reDoctype.lastIndex = i;
      m = reDoctype.exec(text);
      if (m && m.index === i) {
        push('meta', m[0]);
        i += m[0].length;
        continue;
      }
      reTagOpen.lastIndex = i;
      m = reTagOpen.exec(text);
      if (m && m.index === i) {
        push('tag', m[0]);
        i += m[0].length;
        let expectValue = false;
        while (i < n && text[i] !== '>') {
          const c = text[i];
          if (/\s/.test(c)) {
            plain += c;
            i += 1;
            continue;
          }
          if (c === '/') {
            push('tag', '/');
            i += 1;
            continue;
          }
          if (c === '=') {
            push('operator', '=');
            i += 1;
            expectValue = true;
            continue;
          }
          if (c === '"') {
            reValDq.lastIndex = i;
            const v = reValDq.exec(text);
            if (v && v.index === i) {
              push('string', v[0]);
              i += v[0].length;
              expectValue = false;
              continue;
            }
          }
          if (c === "'") {
            reValSq.lastIndex = i;
            const v = reValSq.exec(text);
            if (v && v.index === i) {
              push('string', v[0]);
              i += v[0].length;
              expectValue = false;
              continue;
            }
          }
          reAttrName.lastIndex = i;
          const a = reAttrName.exec(text);
          if (a && a.index === i && a[0].length) {
            push(expectValue ? 'string' : 'attribute', a[0]);
            i += a[0].length;
            expectValue = false;
            continue;
          }
          plain += c;
          i += 1;
        }
        if (i < n && text[i] === '>') {
          push('tag', '>');
          i += 1;
        }
        continue;
      }
    }
    plain += text[i];
    i += 1;
  }
  flush();
  return out;
}

const BUILTINS = {
  sql: tokenizeSql,
  json: tokenizeJson,
  yaml: tokenizeYaml,
  yml: tokenizeYaml,
  html: tokenizeHtml,
  xml: tokenizeHtml,
};

/**
 * Register a tokenizer for `installCodeEditor()`'s live highlight overlay,
 * keyed by the value of a field's `data-lang`. Registering a built-in name
 * (`sql`, `json`, `yaml`, `html`, …) overrides it. Names are case-insensitive.
 *
 * The tokenizer must return tokens whose `text` parts reconstruct the input
 * exactly; if they don't, the overlay safely declines to highlight that buffer
 * rather than desync from the textarea.
 *
 * @param {string} name e.g. `"tql-sql"`.
 * @param {(text: string) => Array<{tok: string, text: string}>} tokenizer
 * @returns {() => void} an uninstaller that removes this registration
 *   (restoring any built-in of the same name).
 */
export function registerCodeLanguage(name, tokenizer) {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('registerCodeLanguage(name, tokenizer): name must be a non-empty string');
  }
  if (typeof tokenizer !== 'function') {
    throw new TypeError('registerCodeLanguage(name, tokenizer): tokenizer must be a function');
  }
  const key = norm(name);
  registry.set(key, tokenizer);
  return () => {
    if (registry.get(key) === tokenizer) registry.delete(key);
  };
}

/**
 * Resolve the tokenizer for a `data-lang` value: a consumer registration wins,
 * then a built-in grammar, else `null` (no highlighting → plain textarea).
 *
 * @param {string} [name]
 * @returns {((text: string) => Array<{tok: string, text: string}>) | null}
 */
export function resolveCodeLanguage(name) {
  if (!name) return null;
  const key = norm(name);
  return registry.get(key) || BUILTINS[key] || null;
}

/**
 * Tokenize `text` as `lang`, returning `null` when there is no grammar, the
 * tokenizer throws, or its tokens fail to reconstruct the source exactly. A
 * `null` return tells the overlay to stay out of the way.
 *
 * @param {string} lang
 * @param {string} text
 * @returns {Array<{tok: string, text: string}> | null}
 */
export function tokenizeCode(lang, text) {
  const fn = resolveCodeLanguage(lang);
  if (!fn) return null;
  let tokens;
  try {
    tokens = fn(text);
  } catch {
    return null;
  }
  if (!Array.isArray(tokens)) return null;
  let rebuilt = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t || typeof t.text !== 'string') return null;
    rebuilt += t.text;
  }
  return rebuilt === text ? tokens : null;
}
