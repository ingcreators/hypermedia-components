import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_MESSAGES } from '../src/js/i18n.js';

// The i18n docs page promises its catalog table is "the complete list" —
// every string a behavior can render. This guard keeps the promise: adding
// a DEFAULT_MESSAGES key without documenting it (or vice versa) fails here.
const here = dirname(fileURLToPath(import.meta.url));
const I18N_DOCS = resolve(
  here,
  '..',
  '..',
  '..',
  'apps',
  'docs',
  'src',
  'content',
  'docs',
  'fundamentals',
  'i18n.mdx',
);

describe('i18n docs completeness', () => {
  it('the docs catalog table lists exactly the DEFAULT_MESSAGES keys', () => {
    const mdx = readFileSync(I18N_DOCS, 'utf8');
    const documented = new Set(
      [...mdx.matchAll(/^\| `([\w.]+)` \|/gm)].map((m) => m[1]),
    );
    const actual = new Set(Object.keys(DEFAULT_MESSAGES));

    const undocumented = [...actual].filter((k) => !documented.has(k));
    const stale = [...documented].filter((k) => !actual.has(k));

    expect(undocumented, 'keys missing from the docs table').toEqual([]);
    expect(stale, 'documented keys that no longer exist').toEqual([]);
  });
});
