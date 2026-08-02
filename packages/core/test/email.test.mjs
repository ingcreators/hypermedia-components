import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolveTokens, DEFAULT_SOURCES } from '../scripts/build-tokens.mjs';
import {
  expandEmailHtml,
  stripThymeleaf,
  buildEmailFiles,
  emailLayerStacks,
  emailManifestComment,
  emailTokensJson,
  EMAIL_FRAGMENTS,
  EMAIL_PARTIALS,
} from '../scripts/email-transform.mjs';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const emailDir = join(pkgRoot, 'src', 'email');

const trees = {};
for (const src of DEFAULT_SOURCES) {
  trees[src.namespace] = JSON.parse(
    readFileSync(join(pkgRoot, 'src', 'tokens', src.file), 'utf8')
  );
}

function loadFragmentSources() {
  const sources = {};
  for (const name of [...EMAIL_FRAGMENTS, ...EMAIL_PARTIALS]) {
    sources[name] = readFileSync(join(emailDir, name, 'fragment.html'), 'utf8');
  }
  return sources;
}

function resolvedMaps(axes) {
  const stacks = emailLayerStacks(axes);
  const toSources = (list) => list.map((namespace) => ({ namespace }));
  return {
    tokens: resolveTokens({ sources: toSources(stacks.light), trees }),
    darkTokens: resolveTokens({ sources: toSources(stacks.dark), trees }),
  };
}

function generate(axes = {}, flavor = 'thymeleaf') {
  const { tokens, darkTokens } = resolvedMaps(axes);
  return {
    files: buildEmailFiles({ fragmentSources: loadFragmentSources(), tokens, darkTokens, flavor }),
    tokens,
    darkTokens,
  };
}

// Everything an email client is guaranteed to render — plus the two
// media-feature names the declaration scan can't distinguish from
// properties. Layout-era CSS (flex/grid/position), var(), and custom
// properties must never appear.
const ALLOWED_PROPERTIES = new Set([
  'margin', 'padding', 'background-color',
  'border', 'border-top', 'border-bottom', 'border-color', 'border-radius',
  'color', 'font-family', 'font-size', 'font-weight', 'line-height',
  'text-decoration', 'display', 'width', 'max-width', 'max-height',
  'overflow', 'mso-hide',
  'max-width', 'prefers-color-scheme',
]);

describe('email fragment sources', () => {
  it('ship exactly the planned inventory, each with fragment.html + contract.md', () => {
    const dirs = readdirSync(emailDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs).toEqual([...EMAIL_FRAGMENTS, ...EMAIL_PARTIALS].sort());
    for (const name of dirs) {
      expect(existsSync(join(emailDir, name, 'fragment.html')), `${name}/fragment.html`).toBe(true);
      expect(existsSync(join(emailDir, name, 'contract.md')), `${name}/contract.md`).toBe(true);
    }
  });

  it('only the styles partial uses {name.dark} placeholders', () => {
    for (const name of [...EMAIL_FRAGMENTS, 'layout']) {
      const src = readFileSync(join(emailDir, name, 'fragment.html'), 'utf8');
      expect(src, name).not.toMatch(/\{[a-z0-9-]+\.dark\}/);
    }
  });
});

describe('email generation (real tokens)', () => {
  it('resolves every placeholder to a literal — no refs, vars, or rem on the wire', () => {
    const { files } = generate();
    for (const [name, html] of Object.entries(files)) {
      expect(html, name).not.toMatch(/(?<!\$)\{[a-z0-9][a-z0-9-]*(\.dark)?\}/);
      expect(html, name).not.toContain('var(');
      expect(html, name).not.toContain('--hc-');
      expect(html, name).not.toMatch(/\d(rem|em)\b/);
    }
  });

  it('keeps every declaration inside the email-safe property allowlist', () => {
    const { files } = generate();
    const all = Object.values(files).join('\n');
    const declarations = [];
    for (const m of all.matchAll(/style="([^"]*)"/g)) {
      for (const decl of m[1].split(';')) {
        if (decl.includes(':')) declarations.push(decl.slice(0, decl.indexOf(':')).trim());
      }
    }
    const styleTag = (all.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );
    for (const m of styleTag.matchAll(/([a-z-]+)\s*:/g)) declarations.push(m[1]);
    expect(declarations.length).toBeGreaterThan(50);
    for (const prop of declarations) {
      expect(ALLOWED_PROPERTIES.has(prop), `disallowed property: ${prop}`).toBe(true);
    }
  });

  it('bakes the styles partial into the layout head', () => {
    const { files, darkTokens } = generate();
    const layout = files['hc-email-layout.html'];
    expect(layout).not.toContain('<!--hc:styles-->');
    expect(layout).toContain('<style>');
    expect(layout).toContain('prefers-color-scheme: dark');
    // Dark overrides carry actual dark values.
    expect(layout).toContain(darkTokens.get('color-bg'));
  });

  it('exposes every documented th:fragment signature', () => {
    const { files } = generate();
    const all = files['hc-email.html'] + files['hc-email-layout.html'];
    for (const frag of [
      'hcLayout(title, preheader, content)',
      'hcButton(href, label)', 'hcButtonSecondary(href, label)',
      'hcHeading(text)', 'hcSubheading(text)',
      'hcText(text)', 'hcTextMuted(text)',
      'hcLink(href, label)', 'hcSeparator',
      'hcBadge(label)', 'hcBadgeInfo(label)', 'hcBadgeSuccess(label)',
      'hcBadgeWarning(label)', 'hcBadgeError(label)',
      'hcAlertInfo(title, text)', 'hcAlertSuccess(title, text)',
      'hcAlertWarning(title, text)', 'hcAlertError(title, text)',
      'hcPanel(content)', 'hcKvTable(rows)', 'hcFooter(text)',
    ]) {
      expect(all, frag).toContain(`th:fragment="${frag}"`);
    }
  });

  it('plain flavor strips all Thymeleaf syntax but keeps the baked styling', () => {
    const { files, tokens } = generate({}, 'plain');
    for (const [name, html] of Object.entries(files)) {
      // Attribute-shaped only — `width:` inside CSS also contains "th:".
      expect(html, name).not.toMatch(/(?:th|xmlns):[a-z-]+="/);
    }
    expect(files['hc-email.html']).toContain(`background-color:${tokens.get('button-primary-bg')}`);
  });

  it('themes follow the axis combination', () => {
    const stock = generate();
    const themed = generate({ color: 'indigo', neutral: 'slate' });
    expect(themed.tokens.get('button-primary-bg')).not.toBe(stock.tokens.get('button-primary-bg'));
    expect(themed.files['hc-email.html']).toContain(themed.tokens.get('button-primary-bg'));
    expect(themed.files['hc-email.html']).not.toContain(stock.tokens.get('button-primary-bg'));
  });
});

describe('email-transform unit surface', () => {
  it('expandEmailHtml converts rem to px at the 16px root', () => {
    const tokens = new Map([['pad', '0.875rem 1rem']]);
    expect(expandEmailHtml('<td style="padding:{pad};">', { tokens })).toBe(
      '<td style="padding:14px 16px;">'
    );
  });

  it('expandEmailHtml throws on an unknown placeholder', () => {
    expect(() => expandEmailHtml('{nope-nope}', { tokens: new Map() })).toThrowError(
      /Unknown email token reference: \{nope-nope\}/
    );
  });

  it('stripThymeleaf removes th:* and xmlns:th attributes only', () => {
    const src = '<a th:href="${href}" href="#" th:text="${label}" xmlns:th="http://x">L</a>';
    expect(stripThymeleaf(src)).toBe('<a href="#">L</a>');
  });

  it('emailLayerStacks appends dark layers in DEFAULT_SOURCES overlay order', () => {
    const { light, dark } = emailLayerStacks({ color: 'indigo', neutral: 'slate' });
    expect(light).toEqual([
      'primitive', 'semantic', 'component', 'density.comfortable',
      'color.default', 'color.indigo', 'neutral.slate',
    ]);
    expect(dark).toEqual([...light, 'theme.dark', 'neutral.slate.dark']);
  });

  it('manifest comment and tokens JSON round-trip', () => {
    const manifest = emailManifestComment({
      version: '0.0.0-test', color: 'indigo', neutral: 'slate',
      flavor: 'thymeleaf', command: 'npx @hypermedia-components/cli email eject --color indigo',
    });
    expect(manifest).toContain('color=indigo neutral=slate');
    expect(manifest).toContain('email eject --color indigo');
    const { tokens, darkTokens } = resolvedMaps({});
    const parsed = JSON.parse(emailTokensJson(tokens, darkTokens));
    expect(parsed.light['button-primary-bg']).toBe(tokens.get('button-primary-bg'));
    expect(parsed.dark['color-bg']).toBe(darkTokens.get('color-bg'));
  });
});
