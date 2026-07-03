// hc validate — check local HTML against the recipes' machine-readable
// contracts.
//
// Each recipe may ship a `checks.json` next to its `contract.md`:
//
//   {
//     "detect": "<css selector locating recipe instances>",
//     "contract": "contract.md",
//     "rules": [ { "id", "level": "error"|"warn", "message", <kind> } ]
//   }
//
// Rule kinds (exactly one per rule; selectors are instance-scoped and
// include the instance root itself):
//
//   "exists":   { "selector", "min" = 1, "max"? }
//   "attr":     { "on", "name", "assert": "present"|"absent",
//                 "value"? | "oneOf"? | "matches"? }   (per matched element)
//   "resolves": { "on", "name" }   value is a CSS selector that must match
//                 in the DOCUMENT; htmx extended forms (this, closest …,
//                 find …, next …, previous …) pass without lookup; a
//                 missing attribute is skipped (pair with an `attr` rule).
//   "closest":  { "on", "selector" }   every matched element must be
//                 inside (or be) an element matching `selector`.
//
// The engine checks the blessed `data-hx-*` / `data-sse-*` spelling and
// emits one warning per document when short-form `hx-*` / `sse-*`
// attributes are present. Unknown schema keys are errors — the schema
// stays honest instead of silently ignoring typos.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { recipesRoot } from './recipes.mjs';

const LEVELS = new Set(['error', 'warn']);
const KINDS = ['exists', 'attr', 'resolves', 'closest'];
const HTMX_EXTENDED = /^(this$|closest\s|find\s|next(\s|$)|previous(\s|$))/;
const SHORT_FORM = /^(hx|sse)-/;

function fail(recipe, detail) {
  throw new Error(`recipes/${recipe}/checks.json: ${detail}`);
}

function assertKeys(recipe, obj, allowed, where) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) fail(recipe, `unknown key "${key}" in ${where}`);
  }
}

/** Parse and strictly validate one checks.json document. */
export function parseChecks(recipe, raw) {
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (error) {
    fail(recipe, `invalid JSON (${error.message})`);
  }
  assertKeys(recipe, doc, ['detect', 'contract', 'rules'], 'the top level');
  if (typeof doc.detect !== 'string' || !doc.detect) fail(recipe, '"detect" must be a selector string');
  if (!Array.isArray(doc.rules) || doc.rules.length === 0) fail(recipe, '"rules" must be a non-empty array');

  const ids = new Set();
  for (const rule of doc.rules) {
    assertKeys(recipe, rule, ['id', 'level', 'message', ...KINDS], `rule "${rule.id ?? '?'}"`);
    if (typeof rule.id !== 'string' || !rule.id) fail(recipe, 'every rule needs an "id"');
    if (ids.has(rule.id)) fail(recipe, `duplicate rule id "${rule.id}"`);
    ids.add(rule.id);
    if (!LEVELS.has(rule.level)) fail(recipe, `rule "${rule.id}": level must be "error" or "warn"`);
    if (typeof rule.message !== 'string' || !rule.message) fail(recipe, `rule "${rule.id}" needs a "message"`);
    const kinds = KINDS.filter((k) => k in rule);
    if (kinds.length !== 1) fail(recipe, `rule "${rule.id}" must have exactly one of ${KINDS.join('/')}`);
    const body = rule[kinds[0]];
    switch (kinds[0]) {
      case 'exists':
        assertKeys(recipe, body, ['selector', 'min', 'max'], `rule "${rule.id}".exists`);
        if (typeof body.selector !== 'string') fail(recipe, `rule "${rule.id}": exists.selector required`);
        break;
      case 'attr': {
        assertKeys(recipe, body, ['on', 'name', 'assert', 'value', 'oneOf', 'matches'], `rule "${rule.id}".attr`);
        if (typeof body.on !== 'string' || typeof body.name !== 'string') fail(recipe, `rule "${rule.id}": attr.on and attr.name required`);
        if (body.assert !== 'present' && body.assert !== 'absent') fail(recipe, `rule "${rule.id}": attr.assert must be "present" or "absent"`);
        break;
      }
      case 'resolves':
        assertKeys(recipe, body, ['on', 'name'], `rule "${rule.id}".resolves`);
        if (typeof body.on !== 'string' || typeof body.name !== 'string') fail(recipe, `rule "${rule.id}": resolves.on and resolves.name required`);
        break;
      case 'closest':
        assertKeys(recipe, body, ['on', 'selector'], `rule "${rule.id}".closest`);
        if (typeof body.on !== 'string' || typeof body.selector !== 'string') fail(recipe, `rule "${rule.id}": closest.on and closest.selector required`);
        break;
    }
  }
  return { detect: doc.detect, contract: doc.contract ?? 'contract.md', rules: doc.rules };
}

/** All shipped checks, keyed by recipe name. */
export async function loadChecks() {
  const root = recipesRoot();
  const map = new Map();
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let raw;
    try {
      raw = await readFile(join(root, entry.name, 'checks.json'), 'utf8');
    } catch {
      continue; // a recipe without checks is simply not validatable yet
    }
    map.set(entry.name, parseChecks(entry.name, raw));
  }
  return map;
}

// Elements matching `selector` within an instance — including the
// instance root, so rules can constrain the detected element itself.
function q(instance, selector) {
  const out = [];
  if (instance.matches?.(selector)) out.push(instance);
  out.push(...instance.querySelectorAll(selector));
  return out;
}

function attrOk(el, body) {
  const has = el.hasAttribute(body.name);
  if (body.assert === 'absent') return !has;
  if (!has) return false;
  const value = el.getAttribute(body.name);
  if ('value' in body && value !== body.value) return false;
  if ('oneOf' in body && !body.oneOf.includes(value)) return false;
  if ('matches' in body && !new RegExp(body.matches).test(value)) return false;
  return true;
}

function evalRule(document, instance, rule) {
  if ('exists' in rule) {
    const { selector, min = 1, max } = rule.exists;
    const n = q(instance, selector).length;
    if (n < min || (max != null && n > max)) return { failed: n };
    return null;
  }
  if ('attr' in rule) {
    const bad = q(instance, rule.attr.on).filter((el) => !attrOk(el, rule.attr));
    return bad.length ? { failed: bad.length } : null;
  }
  if ('resolves' in rule) {
    const { on, name } = rule.resolves;
    let failed = 0;
    for (const el of q(instance, on)) {
      const value = el.getAttribute(name);
      if (value == null || HTMX_EXTENDED.test(value.trim())) continue;
      let hit = null;
      try {
        hit = document.querySelector(value);
      } catch {
        hit = null; // not a CSS selector at all → unresolvable
      }
      if (!hit) failed += 1;
    }
    return failed ? { failed } : null;
  }
  // closest
  const { on, selector } = rule.closest;
  const bad = q(instance, on).filter((el) => !el.closest(selector));
  return bad.length ? { failed: bad.length } : null;
}

/**
 * Validate one parsed document against the loaded checks.
 * Returns { findings, detected } — findings carry { recipe, ruleId,
 * level, message, failed }, detected lists recipe names found.
 */
export function validateDocument(document, checksMap, { recipe } = {}) {
  const findings = [];

  const short = new Set();
  for (const el of document.querySelectorAll('*')) {
    for (const { name } of el.attributes) if (SHORT_FORM.test(name)) short.add(name);
  }
  if (short.size) {
    findings.push({
      recipe: null,
      ruleId: 'blessed-spelling',
      level: 'warn',
      message:
        `short-form attribute(s) found (${[...short].sort().join(', ')}) — this validator checks the ` +
        `data- prefixed spelling the docs bless (data-hx-*, data-sse-*)`,
      failed: short.size,
    });
  }

  const detected = [];
  const names = recipe ? [recipe] : [...checksMap.keys()].sort();
  for (const name of names) {
    const checks = checksMap.get(name);
    if (!checks) continue;
    let instances;
    try {
      instances = [...document.querySelectorAll(checks.detect)];
    } catch {
      fail(name, `"detect" is not a supported selector: ${checks.detect}`);
    }
    if (!instances.length) continue;
    detected.push(name);
    for (const instance of instances) {
      for (const rule of checks.rules) {
        const result = evalRule(document, instance, rule);
        if (result) {
          findings.push({
            recipe: name,
            ruleId: rule.id,
            level: rule.level,
            message: rule.message,
            failed: result.failed,
            contract: `recipes/${name}/${checks.contract}`,
          });
        }
      }
    }
  }
  return { findings, detected };
}

async function collectHtmlFiles(paths) {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (extname(entry.name) === '.html') files.push(full);
    }
  }
  for (const path of paths) {
    const info = await stat(path); // throws a readable ENOENT for bad paths
    if (info.isDirectory()) await walk(path);
    else files.push(path);
  }
  return files.sort();
}

/**
 * The `validate` command. Returns the process exit code:
 * 0 clean (warnings allowed unless `strict`), 1 findings, 2 usage.
 */
export async function runValidate(paths, { recipe, strict = false, stdout, stderr }) {
  const { parseHTML } = await import('linkedom');
  const checksMap = await loadChecks();

  if (recipe && !checksMap.has(recipe)) {
    stderr(`Unknown recipe "${recipe}". Recipes with checks:\n  ${[...checksMap.keys()].sort().join('\n  ')}\n`);
    return 2;
  }
  if (!paths.length) {
    stderr('Nothing to validate — pass one or more HTML files or directories.\n');
    return 2;
  }
  const files = await collectHtmlFiles(paths);
  if (!files.length) {
    stderr('No .html files found under the given paths.\n');
    return 2;
  }

  let errors = 0;
  let warns = 0;
  let recipeSeen = false;

  for (const file of files) {
    const { document } = parseHTML(await readFile(file, 'utf8'));
    const { findings, detected } = validateDocument(document, checksMap, { recipe });
    if (recipe && detected.includes(recipe)) recipeSeen = true;
    if (!findings.length) {
      if (detected.length) stdout(`✓ ${file}  (${detected.join(', ')})\n`);
      continue;
    }
    stdout(`${file}\n`);
    for (const f of findings) {
      const mark = f.level === 'error' ? '✖' : '⚠';
      const scope = f.recipe ? `${f.recipe} · ` : '';
      stdout(`  ${mark} ${scope}${f.ruleId}: ${f.message} (${f.failed} element${f.failed === 1 ? '' : 's'})\n`);
      if (f.contract) stdout(`      contract: ${f.contract}\n`);
      if (f.level === 'error') errors += 1;
      else warns += 1;
    }
  }

  if (recipe && !recipeSeen) {
    stderr(`✖ no "${recipe}" instance detected in ${files.length} file(s) — detect: ${checksMap.get(recipe).detect}\n`);
    errors += 1;
  }

  stdout(`\n${errors} error${errors === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'} across ${files.length} file${files.length === 1 ? '' : 's'}.\n`);
  return errors > 0 || (strict && warns > 0) ? 1 : 0;
}
