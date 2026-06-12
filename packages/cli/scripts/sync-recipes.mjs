// prepack: bundle the repo's recipes/ into the package so the published
// tarball works offline. In the workspace the CLI reads ../../recipes
// directly (lib/recipes.mjs falls back), so this only matters for pack.
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(pkgRoot, '..', '..', 'recipes');
const dest = join(pkgRoot, 'recipes');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

let count = 0;
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue; // skip recipes/README.md
  await cp(join(source, entry.name), join(dest, entry.name), { recursive: true });
  count += 1;
}
process.stdout.write(`Synced ${count} recipes into ${dest}\n`);
