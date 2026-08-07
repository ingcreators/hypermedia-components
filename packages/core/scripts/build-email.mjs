// build-email.mjs — bake the default-theme email artifacts into the
// package (#448), so frameworks consume them like the CSS: as
// versioned files resolved from the package/WebJar, not as a
// generation ritual. Custom themes/tokens keep using the CLI's
// `email eject` — this bakes only the built-in axes.
//
//   dist/email/contract.json                      machine-readable contract
//   dist/email/default-<neutral>/email-tokens.json
//   dist/email/default-<neutral>/<flavor>/hc-email.html
//   dist/email/default-<neutral>/<flavor>/hc-email-layout.html
//
// One theme per neutral ramp (default accent), both flavors
// (thymeleaf + plain). The transform is the same engine `email eject`
// and the docs theme builder run, so baked output and ejected output
// can never drift.
//
// contract.json lists every fragment's th:fragment name and parameter
// names (parsed from the sources — a signature change without a
// contract change is impossible), so downstream guards validate
// against data instead of regexing the HTML.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTokens } from './token-transform.mjs';
import {
  buildEmailFiles,
  emailLayerStacks,
  emailManifestComment,
  emailTokensJson,
  EMAIL_FRAGMENTS,
  EMAIL_PARTIALS,
} from './email-transform.mjs';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const EMAIL_NEUTRALS = ['gray', 'slate', 'zinc', 'neutral', 'stone'];
export const EMAIL_FLAVORS = ['thymeleaf', 'plain'];

const SIGNATURE_RE = /th:fragment="([A-Za-z0-9]+)(?:\(([^)]*)\))?"/g;

async function read(rel) {
  return readFile(join(CORE, rel), 'utf8');
}

/** Every artifact as `{ path → content }`, deterministic. */
export async function buildEmailArtifacts() {
  const pkg = JSON.parse(await read('package.json'));

  const fragmentSources = {};
  for (const name of [...EMAIL_FRAGMENTS, ...EMAIL_PARTIALS]) {
    fragmentSources[name] = await read(`src/email/${name}/fragment.html`);
  }

  // --- contract ---------------------------------------------------------
  const fragments = [];
  for (const source of [...EMAIL_FRAGMENTS, ...EMAIL_PARTIALS]) {
    const contractMd = await read(`src/email/${source}/contract.md`).catch(() => '');
    const purpose = contractMd.match(/^#\s*email\/[a-z-]+\s+—\s*(.+)$/m)?.[1]?.trim() ?? '';
    for (const m of fragmentSources[source].matchAll(SIGNATURE_RE)) {
      fragments.push({
        name: m[1],
        params: m[2] ? m[2].split(',').map((p) => p.trim()) : [],
        source,
        purpose,
      });
    }
  }
  const contract = {
    $schema: 'https://ingcreators.com/hypermedia-components/api/email-contract-schema-v1',
    version: pkg.version,
    themes: EMAIL_NEUTRALS.map((n) => `default-${n}`),
    flavors: EMAIL_FLAVORS,
    files: ['hc-email.html', 'hc-email-layout.html'],
    fragments,
    partials: [...EMAIL_PARTIALS],
  };

  const out = new Map();
  out.set('contract.json', JSON.stringify(contract, null, 2) + '\n');

  // --- baked themes -----------------------------------------------------
  for (const neutral of EMAIL_NEUTRALS) {
    const theme = `default-${neutral}`;
    const stacks = emailLayerStacks({ color: 'default', neutral });
    const trees = {};
    for (const ns of new Set([...stacks.light, ...stacks.dark])) {
      trees[ns] = JSON.parse(await read(`src/tokens/${ns}.tokens.json`));
    }
    const toSources = (list) => list.map((namespace) => ({ namespace }));
    const tokens = resolveTokens({ sources: toSources(stacks.light), trees });
    const darkTokens = resolveTokens({ sources: toSources(stacks.dark), trees });

    out.set(`${theme}/email-tokens.json`, emailTokensJson(tokens, darkTokens));

    for (const flavor of EMAIL_FLAVORS) {
      const manifest = emailManifestComment({
        version: pkg.version,
        color: 'default',
        neutral,
        flavor,
        command:
          'baked into the package by scripts/build-email.mjs (core build); ' +
          'custom themes: npx @hypermedia-components/cli email eject',
      });
      const files = buildEmailFiles({ fragmentSources, tokens, darkTokens, flavor, manifest });
      for (const [name, content] of Object.entries(files)) {
        out.set(`${theme}/${flavor}/${name}`, content);
      }
    }
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const artifacts = await buildEmailArtifacts();
  const root = join(CORE, 'dist/email');
  await rm(root, { recursive: true, force: true });
  for (const [rel, content] of artifacts) {
    const target = join(root, rel);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  console.log(`dist/email written (${artifacts.size} files)`);
}
