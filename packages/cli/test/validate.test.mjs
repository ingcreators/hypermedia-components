import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { listRecipes, recipesRoot } from '../lib/recipes.mjs';
import { parseChecks, loadChecks, validateDocument } from '../lib/validate.mjs';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'hc-cli.mjs');

function run(...args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return { code: error.status, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

function check(html, checks, opts) {
  const { document } = parseHTML(html);
  return validateDocument(document, checks, opts);
}

const TOY = new Map([
  ['toy', parseChecks('toy', JSON.stringify({
    detect: 'form.toy',
    rules: [
      { id: 'needs-button', level: 'error', message: 'button required', exists: { selector: 'button' } },
      { id: 'no-name-on-all', level: 'error', message: 'select-all must be unnamed', attr: { on: 'input.all', name: 'name', assert: 'absent' } },
      { id: 'swap-inner', level: 'error', message: 'swap must be innerHTML', attr: { on: 'button', name: 'data-hx-swap', assert: 'present', value: 'innerHTML' } },
      { id: 'target-resolves', level: 'error', message: 'target must resolve', resolves: { on: 'button', name: 'data-hx-target' } },
      { id: 'inside-scope', level: 'error', message: 'must sit in a scope', closest: { on: 'button', selector: '[data-scope]' } },
      { id: 'nice-label', level: 'warn', message: 'label recommended', exists: { selector: 'label' } },
    ],
  }))],
]);

const GOOD_TOY = `
  <div data-scope>
    <form class="toy">
      <label>x</label>
      <input class="all">
      <button data-hx-swap="innerHTML" data-hx-target="#out">Go</button>
    </form>
  </div>
  <p id="out"></p>`;

describe('parseChecks (schema strictness)', () => {
  it('rejects unknown keys, bad levels, missing messages, duplicate ids, multi-kind rules', () => {
    const base = { detect: 'a', rules: [{ id: 'x', level: 'error', message: 'm', exists: { selector: 'b' } }] };
    expect(() => parseChecks('r', JSON.stringify({ ...base, nope: 1 }))).toThrow(/unknown key "nope"/);
    expect(() => parseChecks('r', JSON.stringify({ detect: 'a', rules: [{ id: 'x', level: 'fatal', message: 'm', exists: { selector: 'b' } }] }))).toThrow(/level/);
    expect(() => parseChecks('r', JSON.stringify({ detect: 'a', rules: [{ id: 'x', level: 'warn', exists: { selector: 'b' } }] }))).toThrow(/message/);
    expect(() => parseChecks('r', JSON.stringify({ detect: 'a', rules: [base.rules[0], base.rules[0]] }))).toThrow(/duplicate/);
    expect(() => parseChecks('r', JSON.stringify({ detect: 'a', rules: [{ id: 'x', level: 'warn', message: 'm', exists: { selector: 'b' }, attr: { on: 'a', name: 'n', assert: 'present' } }] }))).toThrow(/exactly one/);
    expect(() => parseChecks('r', '{oops')).toThrow(/invalid JSON/);
  });
});

describe('validateDocument (engine semantics)', () => {
  it('a conforming instance yields no findings', () => {
    const { findings, detected } = check(GOOD_TOY, TOY);
    expect(detected).toEqual(['toy']);
    expect(findings).toEqual([]);
  });

  it('each rule kind fails as specified', () => {
    const bad = `
      <form class="toy">
        <input class="all" name="ids">
        <button data-hx-swap="outerHTML" data-hx-target="#missing">Go</button>
      </form>`;
    const { findings } = check(bad, TOY);
    const ids = findings.map((f) => f.ruleId).sort();
    expect(ids).toEqual([
      'inside-scope',      // no [data-scope] ancestor
      'nice-label',        // warn: no label
      'no-name-on-all',    // named select-all
      'swap-inner',        // outerHTML
      'target-resolves',   // #missing
    ]);
    expect(findings.find((f) => f.ruleId === 'nice-label').level).toBe('warn');
  });

  it('resolves: htmx extended selectors pass without lookup; missing attribute is skipped', () => {
    const html = `
      <div data-scope><form class="toy"><label>x</label><input class="all">
        <button data-hx-swap="innerHTML" data-hx-target="closest form">Go</button>
        <button data-hx-swap="innerHTML">NoTarget</button>
      </form></div>`;
    const { findings } = check(html, TOY);
    expect(findings.filter((f) => f.ruleId === 'target-resolves')).toEqual([]);
  });

  it('two instances are validated independently', () => {
    const html = `${GOOD_TOY}
      <form class="toy"><input class="all" name="x"><button data-hx-swap="innerHTML" data-hx-target="#out">Go</button></form>`;
    const { findings } = check(html, TOY);
    // The second instance fails no-name-on-all, inside-scope and nice-label.
    expect(findings.map((f) => f.ruleId).sort()).toEqual(['inside-scope', 'nice-label', 'no-name-on-all']);
  });

  it('warns once about short-form hx-*/sse-* spellings', () => {
    const { findings } = check('<button hx-post="/x" sse-swap="e">Go</button>', TOY);
    const warned = findings.filter((f) => f.ruleId === 'blessed-spelling');
    expect(warned).toHaveLength(1);
    expect(warned[0].message).toContain('hx-post');
    expect(warned[0].message).toContain('sse-swap');
  });

  it('--recipe narrowing only runs the named recipe', () => {
    const { findings, detected } = check(GOOD_TOY, TOY, { recipe: 'other' });
    expect(detected).toEqual([]);
    expect(findings).toEqual([]);
  });
});

describe('self-validation — every recipe passes its own checks (the keystone)', () => {
  it('every shipped recipe has a parseable checks.json', async () => {
    const recipes = await listRecipes();
    expect(recipes.length).toBeGreaterThan(0);
    for (const { name } of recipes) {
      expect(existsSync(join(recipesRoot(), name, 'checks.json')), `${name} has no checks.json`).toBe(true);
    }
    await loadChecks(); // throws on any schema violation
  });

  it('every recipe is detected in its own scaffolds, and the scaffolds are error-free under ALL checks', async () => {
    const checks = await loadChecks();
    for (const { name } of await listRecipes()) {
      if (!checks.has(name)) continue;
      const detectedAnywhere = new Set();
      for (const file of ['recipe.html', 'expanded.html']) {
        const path = join(recipesRoot(), name, file);
        if (!existsSync(path)) continue;
        const html = await readFile(path, 'utf8');
        const { document } = parseHTML(html);
        const { findings, detected } = validateDocument(document, checks);
        for (const d of detected) detectedAnywhere.add(d);
        const errors = findings.filter((f) => f.level === 'error');
        expect(errors, `${name}/${file}: ${errors.map((f) => `${f.recipe}:${f.ruleId}`).join(', ')}`).toEqual([]);
      }
      // Some expanded.html files are the SERVER's fragment (remote-dialog)
      // — the client markup then lives in recipe.html. At least one of the
      // pair must contain the recipe instance.
      expect([...detectedAnywhere], `${name}: not detected in either scaffold`).toContain(name);
    }
  });
});

describe('validate (bin)', () => {
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hc-validate-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const CONFIRM_OK = '<button data-hc-confirm="Sure?" data-hx-delete="/x" data-hx-trigger="hc:confirmed">Del</button>';
  const CONFIRM_BAD = '<button data-hc-confirm="Sure?" data-hx-delete="/x">Del</button>';

  it('exit 0 on a clean file, 1 on a contract error, and names the rule', async () => {
    await writeFile(join(dir, 'ok.html'), CONFIRM_OK);
    const ok = run('validate', join(dir, 'ok.html'));
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain('confirm-action');

    await writeFile(join(dir, 'bad.html'), CONFIRM_BAD);
    const bad = run('validate', join(dir, 'bad.html'));
    expect(bad.code).toBe(1);
    expect(bad.stdout).toContain('gated-trigger');
    expect(bad.stdout).toContain('contract: recipes/confirm-action/contract.md');
  });

  it('scans directories recursively', async () => {
    await mkdir(join(dir, 'nested'), { recursive: true });
    await writeFile(join(dir, 'nested', 'bad.html'), CONFIRM_BAD);
    const res = run('validate', dir);
    expect(res.code).toBe(1);
    expect(res.stdout).toContain('gated-trigger');
  });

  it('--strict promotes warnings to a failing exit', async () => {
    await writeFile(join(dir, 'short.html'), '<button hx-post="/x">Go</button>');
    expect(run('validate', join(dir, 'short.html')).code).toBe(0);
    expect(run('validate', '--strict', join(dir, 'short.html')).code).toBe(1);
  });

  it('--recipe: not detected is an error; unknown recipe is usage (2)', async () => {
    await writeFile(join(dir, 'empty.html'), '<p>nothing here</p>');
    const miss = run('validate', '--recipe', 'confirm-action', join(dir, 'empty.html'));
    expect(miss.code).toBe(1);
    expect(miss.stderr).toContain('no "confirm-action" instance');

    const unknown = run('validate', '--recipe', 'no-such', join(dir, 'empty.html'));
    expect(unknown.code).toBe(2);
  });

  it('no paths, or no HTML under the paths, is usage (2)', async () => {
    expect(run('validate').code).toBe(2);
    await mkdir(join(dir, 'no-html'));
    expect(run('validate', join(dir, 'no-html')).code).toBe(2);
  });

  it('add copies checks.json alongside the other recipe files', async () => {
    const res = run('add', 'confirm-action', '--dir', dir);
    expect(res.code).toBe(0);
    expect(existsSync(join(dir, 'confirm-action', 'checks.json'))).toBe(true);
  });
});
