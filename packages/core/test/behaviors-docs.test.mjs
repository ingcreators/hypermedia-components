// The behaviors reference (docs) is hand-maintained prose over the same
// facts the manifest generates from source — and it has drifted before
// (three behaviors missing, count stuck at 44; fixed in #387). This
// guard pins the page to the manifest: a new installXxx cannot ship
// without its row (en + ja), a removed one cannot linger, the auto-init
// column and the intro's count must match reality, and every hc:* event
// the page mentions must exist.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../scripts/build-manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(here, '..', '..', '..', 'apps', 'docs', 'src', 'content', 'docs');
const EN = readFileSync(resolve(DOCS, 'reference', 'behaviors.mdx'), 'utf8');
const JA = readFileSync(resolve(DOCS, 'ja', 'reference', 'behaviors.mdx'), 'utf8');

const manifest = await buildManifest();
const behaviors = new Map(manifest.behaviors.map((b) => [b.name, b]));

// One entry per `| \`installXxx()\` | … |` table row.
function parseRows(mdx) {
  return [...mdx.matchAll(/^\| `(install[A-Za-z]+)\(\)` \| (.+) \|$/gm)].map((m) => {
    const cells = m[2].split(' | ');
    return { name: m[1], cells, autoCell: cells[cells.length - 1] };
  });
}

describe.each([
  ['en', EN, /The kit ships (\d+) small behaviors/, '✓', /\*\*Opt-in\*\*/],
  ['ja', JA, /キットは (\d+) 個の小さなビヘイビア/, '✓', /\*\*オプトイン\*\*/],
])('behaviors reference (%s)', (_locale, mdx, countRe, tick, optInRe) => {
  const rows = parseRows(mdx);
  const names = rows.map((r) => r.name);

  it('lists exactly the manifest behaviors, once each', () => {
    const missing = [...behaviors.keys()].filter((n) => !names.includes(n));
    const stale = names.filter((n) => !behaviors.has(n));
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(missing, 'behaviors missing from the docs table').toEqual([]);
    expect(stale, 'documented behaviors that no longer exist').toEqual([]);
    expect(dupes, 'behaviors listed twice').toEqual([]);
  });

  it("the intro's behavior count matches the manifest", () => {
    expect(Number(mdx.match(countRe)?.[1])).toBe(manifest.behaviors.length);
  });

  it('every row has the full column set', () => {
    // | Behavior | Powers | Attributes | Events | Auto-init | → 4 cells
    // after the name. A pipe inside a cell would break markdown anyway.
    for (const row of rows) {
      expect(row.cells.length, `${row.name} cell count`).toBe(4);
    }
  });

  it('the auto-init column matches the manifest', () => {
    for (const row of rows) {
      const expected = behaviors.get(row.name).autoInit;
      const documented = row.autoCell === tick;
      expect(documented, `${row.name} auto-init`).toBe(expected);
      if (!expected) expect(row.autoCell, `${row.name} opt-in cell`).toMatch(optInRe);
    }
  });

  it('every hc:* event the page mentions exists in the manifest', () => {
    const known = new Set(manifest.events.map((e) => e.name));
    const mentioned = [...new Set([...mdx.matchAll(/hc:[a-z]+/g)].map((m) => m[0]))];
    const unknown = mentioned.filter((e) => !known.has(e));
    expect(unknown, 'documented events that no source module dispatches').toEqual([]);
  });
});

describe('behaviors reference (en ↔ ja lockstep)', () => {
  it('both locales list the same behaviors in the same order', () => {
    expect(parseRows(JA).map((r) => r.name)).toEqual(parseRows(EN).map((r) => r.name));
  });
});
