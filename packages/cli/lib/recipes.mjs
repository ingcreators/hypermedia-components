// Recipe resolution + copying. The published tarball bundles a synced
// copy of the repo's recipes/ (created by scripts/sync-recipes.mjs at
// prepack), so the CLI works offline; inside the workspace the repo's
// recipes/ directory itself is used, so dev never needs a sync step.
import { cp, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The three files every recipe ships (the recipe DoD's source format). */
export const RECIPE_FILES = ['recipe.html', 'expanded.html', 'contract.md'];

/** Bundled copy first (published tarball), repo root second (workspace dev). */
export function recipesRoot() {
  for (const candidate of [join(PKG_ROOT, 'recipes'), resolve(PKG_ROOT, '..', '..', 'recipes')]) {
    if (existsSync(join(candidate))) return candidate;
  }
  throw new Error('No recipes directory found (looked in the package and the workspace root).');
}

/** @returns {Promise<Array<{ name: string, purpose: string }>>} sorted by name */
export async function listRecipes() {
  const root = recipesRoot();
  const entries = await readdir(root, { withFileTypes: true });
  const recipes = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(join(root, entry.name, 'recipe.html'))) continue;
    const contract = await readFile(join(root, entry.name, 'contract.md'), 'utf8').catch(() => '');
    const purpose = contract.match(/^Purpose:\s*(.+)$/m)?.[1]?.trim() ?? '';
    recipes.push({ name: entry.name, purpose });
  }
  return recipes.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Copy a recipe's source files into `<targetDir>/<name>/`.
 *
 * @param {string} name
 * @param {string} targetDir
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<string[]>} the written file paths
 */
export async function copyRecipe(name, targetDir, { force = false } = {}) {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid recipe name: ${JSON.stringify(name)} (expected kebab-case).`);
  }
  const source = join(recipesRoot(), name);
  const known = await listRecipes();
  if (!known.some((r) => r.name === name)) {
    throw new Error(
      `Unknown recipe ${JSON.stringify(name)}. Available: ${known.map((r) => r.name).join(', ')}`,
    );
  }

  const dest = join(resolve(targetDir), name);
  if (!force) {
    for (const file of RECIPE_FILES) {
      const target = join(dest, file);
      if (existsSync(target)) {
        throw new Error(`Refusing to overwrite ${target} (pass --force to replace).`);
      }
    }
  }

  await mkdir(dest, { recursive: true });
  const written = [];
  for (const file of RECIPE_FILES) {
    const from = join(source, file);
    if (!(await stat(from).catch(() => null))) continue;
    await cp(from, join(dest, file), { force: true });
    written.push(join(dest, file));
  }
  return written;
}
