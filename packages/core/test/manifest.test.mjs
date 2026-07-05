// The manifest keystone: the structured index must match reality, so
// new API surface cannot ship without the manifest (and the CEM)
// learning about it. Mirrors the checks build-manifest.mjs enforces at
// build time and adds cross-artifact assertions the generator cannot
// do alone.

import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../scripts/build-manifest.mjs';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CORE, '..', '..');

const manifest = await buildManifest();

describe('manifest.json', () => {
  it('covers every component stylesheet (plus the documented virtual blocks)', async () => {
    const cssBlocks = (await readdir(join(CORE, 'src/css')))
      .filter((f) => f.startsWith('hc-') && f.endsWith('.css'))
      .map((f) => f.replace(/\.css$/, ''));
    const manifestBlocks = manifest.components.map((c) => c.block);
    for (const block of cssBlocks) expect(manifestBlocks).toContain(block);
    // context-menu is documented but reuses hc-menu's stylesheet.
    expect(manifestBlocks).toContain('hc-context-menu');
    expect(manifestBlocks.length).toBe(cssBlocks.length + 1);
  });

  it('claims every install* export exactly where the sources say', async () => {
    const indexSrc = await readFile(join(CORE, 'src/js/index.js'), 'utf8');
    const installs = [
      ...new Set([...indexSrc.matchAll(/\b(install[A-Z][A-Za-z]+)\b/g)].map((m) => m[1])),
    ];
    const behaviorNames = manifest.behaviors.map((b) => b.name).sort();
    expect(behaviorNames).toEqual(installs.sort());

    const claimed = new Set([
      ...manifest.components.map((c) => c.behavior).filter(Boolean),
      ...manifest.recipes.map((r) => r.needsBehavior).filter(Boolean),
      // platform glue is not tied to one component/recipe:
      'installValidation',
      'installCsrfHeader',
      'installThemeToggle',
      'installNavCurrent',
    ]);
    const unclaimed = installs.filter((n) => !claimed.has(n));
    expect(unclaimed).toEqual([]);
  });

  it('matches the auto-init roster (installChart is the one opt-in)', async () => {
    const rosterSrc = await readFile(join(CORE, 'src/js/behaviors.js'), 'utf8');
    const roster = new Set(
      [...rosterSrc.matchAll(/\b(install[A-Z][A-Za-z]+)\b/g)].map((m) => m[1]),
    );
    for (const b of manifest.behaviors) {
      expect(b.autoInit, b.name).toBe(roster.has(b.name));
    }
    expect(manifest.behaviors.filter((b) => !b.autoInit).map((b) => b.name)).toEqual([
      'installChart',
    ]);
  });

  it('lists exactly the recipes on disk, each with the full scaffold', async () => {
    const dirs = (await readdir(join(REPO, 'recipes'), { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(manifest.recipes.map((r) => r.name)).toEqual(dirs);
    for (const r of manifest.recipes) {
      expect(r.files, r.name).toEqual([
        'recipe.html',
        'expanded.html',
        'contract.md',
        'checks.json',
      ]);
      expect(r.purpose, `${r.name} purpose`).not.toBe('');
    }
  });

  it('keeps the custom-elements manifest in sync with the macro sources', async () => {
    const cem = JSON.parse(await readFile(join(CORE, 'custom-elements.json'), 'utf8'));
    const cemByTag = new Map(
      cem.modules.map((m) => [m.declarations[0].tagName, m.declarations[0]]),
    );
    for (const macro of manifest.macros) {
      const decl = cemByTag.get(macro.tag);
      expect(decl, macro.tag).toBeDefined();
      const cemAttrs = decl.attributes.map((a) => a.name).sort();
      expect(cemAttrs, macro.tag).toEqual(macro.attributes);
    }
    expect(cem.modules.length).toBe(manifest.macros.length);
  });

  it('is deterministic (two builds byte-identical) and sorted', async () => {
    const again = await buildManifest();
    expect(JSON.stringify(again)).toBe(JSON.stringify(manifest));
    const names = manifest.components.map((c) => c.block);
    expect(names).toEqual([...names].sort());
  });

  it('exports the artifacts from the package', async () => {
    const pkg = JSON.parse(await readFile(join(CORE, 'package.json'), 'utf8'));
    expect(pkg.exports['./manifest.json']).toBe('./dist/manifest.json');
    expect(pkg.exports['./custom-elements.json']).toBe('./custom-elements.json');
    expect(pkg.customElements).toBe('custom-elements.json');
    expect(manifest.exports).toContain('./manifest.json');
  });
});
