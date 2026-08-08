// Email template ejection. Token resolution + fragment expansion come
// from @hypermedia-components/core (`resolveTokens` / email-transform),
// resolved through the declared dependency — the same engine the docs
// theme builder runs in the browser, so `email eject` and the builder's
// Email tab can never drift apart.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTokens } from '@hypermedia-components/core/token-transform';
import {
  buildEmailFiles,
  emailLayerStacks,
  emailManifestComment,
  emailTokensJson,
  EMAIL_FRAGMENTS,
  EMAIL_PARTIALS,
} from '@hypermedia-components/core/email-transform';

const corePath = (subpath) =>
  fileURLToPath(import.meta.resolve(`@hypermedia-components/core/${subpath}`));

export const EMAIL_COLORS = ['default', 'teal', 'lime', 'orange', 'fuchsia'];
export const EMAIL_NEUTRALS = ['gray', 'slate', 'zinc', 'neutral', 'stone'];
export const EMAIL_FLAVORS = ['thymeleaf', 'plain'];
export const EMAIL_FILES = ['hc-email.html', 'hc-email-layout.html', 'email-tokens.json'];

// Namespaces a theme-builder patch export may carry (Full-theme mode).
// Anything else in a --tokens file is treated as a single accent tree.
const PATCH_NAMESPACES = ['semantic', 'component', 'theme.dark', 'color.default'];

async function coreVersion() {
  const pkgPath = resolve(corePath('email-transform'), '..', '..', 'package.json');
  return JSON.parse(await readFile(pkgPath, 'utf8')).version;
}

/** @returns {Promise<Array<{ name: string, purpose: string }>>} fragments then partials */
export async function listEmailFragments() {
  const out = [];
  for (const name of [...EMAIL_FRAGMENTS, ...EMAIL_PARTIALS]) {
    const contract = await readFile(corePath(`email/${name}/contract.md`), 'utf8').catch(() => '');
    // "# email/button — bulletproof button" -> "bulletproof button"
    const purpose = contract.match(/^#\s*email\/[a-z-]+\s+—\s*(.+)$/m)?.[1]?.trim() ?? '';
    out.push({ name, purpose });
  }
  return out;
}

function mergeDeep(base, patch) {
  const out = { ...base };
  for (const k in patch) {
    const pv = patch[k];
    out[k] =
      pv && typeof pv === 'object' && !Array.isArray(pv) && base && typeof base[k] === 'object'
        ? mergeDeep(base[k], pv)
        : pv;
  }
  return out;
}

/**
 * Generate the themed email files.
 *
 * @param {Object} opts
 * @param {string} [opts.color] built-in accent axis (default 'default')
 * @param {string} [opts.neutral] neutral ramp (default 'gray')
 * @param {string} [opts.tokensFile] theme-builder DTCG export: either a
 *   Full-theme patch map ({ semantic, 'theme.dark', … }) or an accent
 *   tree (applied as a `color.custom` overlay)
 * @param {string} [opts.flavor] 'thymeleaf' | 'plain'
 * @param {string} [opts.dir] parent directory (files land in <dir>/email/)
 * @param {boolean} [opts.force] overwrite existing files
 * @returns {Promise<string[]>} written file paths
 */
export async function ejectEmail({
  color = 'default',
  neutral = 'gray',
  tokensFile,
  flavor = 'thymeleaf',
  dir = '.',
  force = false,
} = {}) {
  if (!EMAIL_COLORS.includes(color)) {
    throw new Error(`Unknown color ${JSON.stringify(color)}. Available: ${EMAIL_COLORS.join(', ')}`);
  }
  if (!EMAIL_NEUTRALS.includes(neutral)) {
    throw new Error(
      `Unknown neutral ${JSON.stringify(neutral)}. Available: ${EMAIL_NEUTRALS.join(', ')}`,
    );
  }
  if (!EMAIL_FLAVORS.includes(flavor)) {
    throw new Error(`Unknown flavor ${JSON.stringify(flavor)}. Available: ${EMAIL_FLAVORS.join(', ')}`);
  }

  const stacks = emailLayerStacks({ color, neutral });
  const darkExtras = stacks.dark.slice(stacks.light.length);
  const light = [...stacks.light];

  const trees = {};
  for (const ns of new Set([...light, ...darkExtras])) {
    trees[ns] = JSON.parse(await readFile(corePath(`tokens/${ns}.tokens.json`), 'utf8'));
  }

  let custom = false;
  if (tokensFile) {
    custom = true;
    const parsed = JSON.parse(await readFile(resolve(tokensFile), 'utf8'));
    if (PATCH_NAMESPACES.some((ns) => ns in parsed)) {
      for (const ns of PATCH_NAMESPACES) {
        if (parsed[ns]) trees[ns] = mergeDeep(trees[ns] ?? {}, parsed[ns]);
      }
    } else {
      trees['color.custom'] = parsed;
      light.push('color.custom');
    }
  }
  const dark = [...light, ...darkExtras];

  const toSources = (list) => list.map((namespace) => ({ namespace }));
  const tokens = resolveTokens({ sources: toSources(light), trees });
  const darkTokens = resolveTokens({ sources: toSources(dark), trees });

  const fragmentSources = {};
  for (const name of [...EMAIL_FRAGMENTS, ...EMAIL_PARTIALS]) {
    fragmentSources[name] = await readFile(corePath(`email/${name}/fragment.html`), 'utf8');
  }

  const command = [
    'npx @hypermedia-components/cli email eject',
    color !== 'default' ? `--color ${color}` : '',
    neutral !== 'gray' ? `--neutral ${neutral}` : '',
    tokensFile ? `--tokens ${tokensFile}` : '',
    `--flavor ${flavor}`,
  ]
    .filter(Boolean)
    .join(' ');
  const manifest = emailManifestComment({
    version: await coreVersion(),
    color: custom && !EMAIL_COLORS.includes(color) ? 'custom' : color,
    neutral,
    flavor,
    custom,
    command,
  });

  const files = {
    ...buildEmailFiles({ fragmentSources, tokens, darkTokens, flavor, manifest }),
    'email-tokens.json': emailTokensJson(tokens, darkTokens),
  };

  const dest = join(resolve(dir), 'email');
  if (!force) {
    for (const name of EMAIL_FILES) {
      const target = join(dest, name);
      if (existsSync(target)) {
        throw new Error(`Refusing to overwrite ${target} (pass --force to replace).`);
      }
    }
  }
  await mkdir(dest, { recursive: true });
  const written = [];
  for (const name of EMAIL_FILES) {
    const target = join(dest, name);
    await writeFile(target, files[name]);
    written.push(target);
  }
  return written;
}
