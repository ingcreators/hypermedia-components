#!/usr/bin/env node
// Docs i18n drift check (CONTRIBUTING.md § "Japanese translations").
//
// Policy, mechanized: every English docs page has a `ja/` mirror, and a
// PR that changes an English page must change its Japanese counterpart
// in the same PR (a translation update, or at minimum a conscious
// touch). This script compares two git revisions and fails when an
// English page under apps/docs/src/content/docs/ changed while its
// ja/ twin did not.
//
// Usage:
//   node apps/docs/scripts/check-i18n-drift.mjs <base-rev> <head-rev>
//   pnpm -w run docs:i18n-drift origin/main HEAD
//
// CI runs it in the docs job on pull_request events with the PR base
// SHA. ja-only edits never require the reverse (English is the source
// language).

import { execFileSync } from 'node:child_process';

const DOCS_ROOT = 'apps/docs/src/content/docs/';
const JA_ROOT = `${DOCS_ROOT}ja/`;

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error('usage: check-i18n-drift.mjs <base-rev> <head-rev>');
  process.exit(2);
}

const diff = execFileSync(
  'git',
  ['diff', '--name-status', '--no-renames', base, head, '--', DOCS_ROOT],
  { encoding: 'utf8' },
);

/** @type {Map<string, string>} path → status letter (A/M/D) */
const changed = new Map();
for (const line of diff.split('\n')) {
  if (!line) continue;
  const [status, file] = line.split('\t');
  if (/\.(md|mdx)$/.test(file)) changed.set(file, status);
}

const violations = [];
for (const [file, status] of changed) {
  if (file.startsWith(JA_ROOT)) continue; // ja-only edits are always fine
  const twin = file.replace(DOCS_ROOT, JA_ROOT);
  if (!changed.has(twin)) violations.push({ file, status, twin });
}

if (violations.length > 0) {
  console.error('✖ Docs i18n drift: English pages changed without their ja/ twin.\n');
  for (const { file, status, twin } of violations) {
    const verb = { A: 'added', M: 'modified', D: 'deleted' }[status] ?? status;
    console.error(`  ${verb.padEnd(8)} ${file}`);
    console.error(`           → expected a change to ${twin}`);
  }
  console.error(`
Every English page under apps/docs/src/content/docs/ has a Japanese
mirror under docs/ja/ (CONTRIBUTING.md § "Japanese translations").
Update the translation in the same PR — or, for a change that is
genuinely content-neutral for ja (an English-only typo, a code-block
fix), apply the same edit to the twin so the pair stays in sync.`);
  process.exit(1);
}

console.log(`✓ i18n drift check: ${changed.size} docs page(s) changed, en/ja in sync.`);
