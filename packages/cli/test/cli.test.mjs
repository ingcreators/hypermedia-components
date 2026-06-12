import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { listRecipes, copyRecipe, RECIPE_FILES } from '../lib/recipes.mjs';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'hc-cli.mjs');

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hc-cli-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Run the real bin; returns { code, stdout, stderr }. */
function run(...args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return { code: error.status, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

describe('listRecipes', () => {
  it('finds the repo recipes, sorted, with their Purpose line', async () => {
    const recipes = await listRecipes();
    const names = recipes.map((r) => r.name);
    expect(names).toContain('confirm-action');
    expect(names).toContain('toast');
    expect(names).toEqual([...names].sort());
    const confirm = recipes.find((r) => r.name === 'confirm-action');
    expect(confirm.purpose.length).toBeGreaterThan(10);
  });
});

describe('copyRecipe', () => {
  it('copies the three source files into <target>/<name>/', async () => {
    const written = await copyRecipe('confirm-action', dir);
    expect(written).toHaveLength(RECIPE_FILES.length);
    for (const file of RECIPE_FILES) {
      expect(existsSync(join(dir, 'confirm-action', file))).toBe(true);
    }
    const html = await readFile(join(dir, 'confirm-action', 'recipe.html'), 'utf8');
    expect(html).toContain('data-hc-confirm');
  });

  it('refuses to overwrite without force, overwrites with force', async () => {
    await mkdir(join(dir, 'toast'), { recursive: true });
    await writeFile(join(dir, 'toast', 'recipe.html'), 'mine');
    await expect(copyRecipe('toast', dir)).rejects.toThrow(/Refusing to overwrite/);
    expect(await readFile(join(dir, 'toast', 'recipe.html'), 'utf8')).toBe('mine');

    await copyRecipe('toast', dir, { force: true });
    expect(await readFile(join(dir, 'toast', 'recipe.html'), 'utf8')).not.toBe('mine');
  });

  it('rejects unknown recipes, naming the available ones', async () => {
    await expect(copyRecipe('does-not-exist', dir)).rejects.toThrow(/Available: .*confirm-action/);
  });

  it('rejects non-kebab-case names (path traversal guard)', async () => {
    await expect(copyRecipe('../etc', dir)).rejects.toThrow(/Invalid recipe name/);
    await expect(copyRecipe('a/b', dir)).rejects.toThrow(/Invalid recipe name/);
  });
});

describe('bin (end to end)', () => {
  it('list prints recipes with purposes', () => {
    const { code, stdout } = run('list');
    expect(code).toBe(0);
    expect(stdout).toMatch(/confirm-action\s+Confirm/i);
    expect(stdout).toContain('live-search');
  });

  it('add copies into --dir and reports the files', () => {
    const { code, stdout } = run('add', 'live-search', '--dir', dir);
    expect(code).toBe(0);
    expect(stdout).toContain(join(dir, 'live-search', 'recipe.html'));
    expect(existsSync(join(dir, 'live-search', 'contract.md'))).toBe(true);
  });

  it('add without a name exits 1 with usage', () => {
    const { code, stderr } = run('add');
    expect(code).toBe(1);
    expect(stderr).toContain('Missing recipe name');
  });

  it('re-adding without --force exits 2', () => {
    expect(run('add', 'toast', '--dir', dir).code).toBe(0);
    const { code, stderr } = run('add', 'toast', '--dir', dir);
    expect(code).toBe(2);
    expect(stderr).toContain('Refusing to overwrite');
    expect(run('add', 'toast', '--dir', dir, '--force').code).toBe(0);
  });

  it('help and no-args print usage', () => {
    expect(run('--help').stdout).toContain('Usage:');
    expect(run().stdout).toContain('Usage:');
  });
});
