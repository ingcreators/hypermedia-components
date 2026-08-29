import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildTokensCss, resolveTokens, DEFAULT_SOURCES } from '../scripts/build-tokens.mjs';

const tokensDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tokens');

/** Build the full token bundle from the real DTCG sources on disk. */
function buildRealTokens() {
  const trees = {};
  for (const src of DEFAULT_SOURCES) {
    trees[src.namespace] = JSON.parse(readFileSync(join(tokensDir, src.file), 'utf8'));
  }
  return buildTokensCss({ sources: DEFAULT_SOURCES, trees });
}

const SOURCES = [
  { namespace: 'primitive', emit: false },
  { namespace: 'semantic',  selector: ':root, [data-theme="light"]' },
  { namespace: 'component', selector: ':root' },
  { namespace: 'theme.dark', selector: '[data-theme="dark"]' },
];

const TREES = {
  primitive: {
    color: {
      gray: {
        '50':  { $type: 'color', $value: '#f9fafb' },
        '900': { $type: 'color', $value: '#111827' },
      },
      blue: {
        '600': { $type: 'color', $value: '#2563eb' },
      },
    },
    space: {
      '4': { $type: 'dimension', $value: '1rem' },
    },
  },
  semantic: {
    color: {
      bg:   { $type: 'color', $value: '{primitive.color.gray.50}' },
      text: { $type: 'color', $value: '{primitive.color.gray.900}' },
      action: {
        primary: {
          bg: { $type: 'color', $value: '{primitive.color.blue.600}' },
        },
      },
    },
    control: {
      'padding-x': { $type: 'dimension', $value: '{primitive.space.4}' },
    },
  },
  component: {
    button: {
      'padding-x': { $type: 'dimension', $value: '{semantic.control.padding-x}' },
      primary: {
        bg: { $type: 'color', $value: '{semantic.color.action.primary.bg}' },
      },
    },
  },
  'theme.dark': {
    color: {
      bg: { $type: 'color', $value: '{primitive.color.gray.900}' },
    },
  },
};

describe('buildTokensCss', () => {
  it('drops the file namespace from variable names', () => {
    const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
    expect(css).toContain('--hc-color-bg: #f9fafb;');
    expect(css).toContain('--hc-button-padding-x: 1rem;');
    expect(css).toContain('--hc-button-primary-bg: #2563eb;');
    // The "semantic." or "component." namespace is never part of a var name.
    expect(css).not.toMatch(/--hc-(semantic|component|primitive)-/);
  });

  it('resolves references transitively across layers', () => {
    const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
    // component.button.primary.bg -> semantic.color.action.primary.bg -> primitive.color.blue.600
    expect(css).toMatch(/--hc-button-primary-bg:\s*#2563eb;/);
  });

  it('skips emission for sources with emit:false', () => {
    const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
    // Primitives are referenced but never emitted as variables.
    expect(css).not.toContain('--hc-color-gray-50');
    expect(css).not.toContain('--hc-color-blue-600');
  });

  it('groups each emitted source under its own selector block', () => {
    const { css, blockCount } = buildTokensCss({ sources: SOURCES, trees: TREES });
    expect(blockCount).toBe(3); // semantic, component, theme.dark
    expect(css).toContain(':root, [data-theme="light"] {');
    expect(css).toContain(':root {');
    expect(css).toContain('[data-theme="dark"] {');
    expect(css).toContain('@layer hc.tokens {');
  });

  it('produces light/dark overrides for the same variable name', () => {
    const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
    // Both selectors define --hc-color-bg with different values.
    const lightMatch = css.match(/\[data-theme="light"\]\s*\{[^}]*--hc-color-bg:\s*([^;]+);/);
    const darkMatch = css.match(/\[data-theme="dark"\]\s*\{[^}]*--hc-color-bg:\s*([^;]+);/);
    expect(lightMatch?.[1]).toBe('#f9fafb');
    expect(darkMatch?.[1]).toBe('#111827');
  });

  it('counts every emitted variable', () => {
    const { varCount } = buildTokensCss({ sources: SOURCES, trees: TREES });
    // semantic: bg, text, action.primary.bg, control.padding-x = 4
    // component: button.padding-x, button.primary.bg = 2
    // theme.dark: color.bg = 1
    expect(varCount).toBe(7);
  });

  it('throws on an unknown reference', () => {
    expect(() =>
      buildTokensCss({
        sources: [{ namespace: 'semantic', selector: ':root' }],
        trees: {
          semantic: {
            color: { bg: { $type: 'color', $value: '{primitive.color.gray.50}' } },
          },
        },
      })
    ).toThrowError(/Unknown token reference: \{primitive\.color\.gray\.50\}/);
  });

  it('detects circular references', () => {
    expect(() =>
      buildTokensCss({
        sources: [{ namespace: 'a', selector: ':root' }],
        trees: {
          a: {
            x: { $type: 'color', $value: '{a.y}' },
            y: { $type: 'color', $value: '{a.x}' },
          },
        },
      })
    ).toThrowError(/Circular token reference/);
  });

  it('keeps literal (non-reference) values verbatim', () => {
    const { css } = buildTokensCss({
      sources: [{ namespace: 'semantic', selector: ':root' }],
      trees: {
        semantic: {
          color: {
            overlay: { $type: 'color', $value: 'rgba(17, 24, 39, 0.5)' },
          },
        },
      },
    });
    expect(css).toContain('--hc-color-overlay: rgba(17, 24, 39, 0.5);');
  });

  it('emits each density layer as its own selector block', () => {
    const { css, blockCount } = buildTokensCss({
      sources: [
        { namespace: 'primitive', emit: false },
        { namespace: 'density.comfortable', selector: ':root, [data-density="comfortable"]' },
        { namespace: 'density.compact',     selector: '[data-density="compact"]' },
        { namespace: 'density.dense',       selector: '[data-density="dense"]' },
      ],
      trees: {
        primitive: {
          size: { control: {
            xs: { $type: 'dimension', $value: '28px' },
            sm: { $type: 'dimension', $value: '32px' },
            md: { $type: 'dimension', $value: '40px' },
          } },
          space: {
            2: { $type: 'dimension', $value: '0.5rem' },
            3: { $type: 'dimension', $value: '0.75rem' },
            4: { $type: 'dimension', $value: '1rem' },
          },
        },
        'density.comfortable': {
          control: {
            height:      { $type: 'dimension', $value: '{primitive.size.control.md}' },
            'padding-x': { $type: 'dimension', $value: '{primitive.space.4}' },
          },
        },
        'density.compact': {
          control: {
            height:      { $type: 'dimension', $value: '{primitive.size.control.sm}' },
            'padding-x': { $type: 'dimension', $value: '{primitive.space.3}' },
          },
        },
        'density.dense': {
          control: {
            height:      { $type: 'dimension', $value: '{primitive.size.control.xs}' },
            'padding-x': { $type: 'dimension', $value: '{primitive.space.2}' },
          },
        },
      },
    });

    expect(blockCount).toBe(3);
    expect(css).toContain(':root, [data-density="comfortable"] {');
    expect(css).toContain('[data-density="compact"] {');
    expect(css).toContain('[data-density="dense"] {');

    // Each block defines the two control vars at the plan §9.3 values.
    expect(css).toMatch(/\[data-density="comfortable"\]\s*\{[^}]*--hc-control-height:\s*40px;/);
    expect(css).toMatch(/\[data-density="compact"\]\s*\{[^}]*--hc-control-height:\s*32px;/);
    expect(css).toMatch(/\[data-density="dense"\]\s*\{[^}]*--hc-control-height:\s*28px;/);
    expect(css).toMatch(/\[data-density="comfortable"\]\s*\{[^}]*--hc-control-padding-x:\s*1rem;/);
    expect(css).toMatch(/\[data-density="compact"\]\s*\{[^}]*--hc-control-padding-x:\s*0\.75rem;/);
    expect(css).toMatch(/\[data-density="dense"\]\s*\{[^}]*--hc-control-padding-x:\s*0\.5rem;/);
  });

  it('passes through literal var() values without resolving them', () => {
    // Component-level tokens use `var(--hc-control-*)` literals to
    // pick up the active density at runtime instead of baking in the
    // semantic.control.* value at build time.
    const { css } = buildTokensCss({
      sources: [{ namespace: 'component', selector: ':root' }],
      trees: {
        component: {
          button: {
            height:      { $type: 'dimension', $value: 'var(--hc-control-height)' },
            'padding-x': { $type: 'dimension', $value: 'var(--hc-control-padding-x)' },
          },
        },
      },
    });

    expect(css).toContain('--hc-button-height: var(--hc-control-height);');
    expect(css).toContain('--hc-button-padding-x: var(--hc-control-padding-x);');
  });

  it('joins nested JSON paths with hyphens', () => {
    const { css } = buildTokensCss({
      sources: [{ namespace: 'component', selector: ':root' }],
      trees: {
        component: {
          field: { 'label-font-size': { $type: 'dimension', $value: '0.875rem' } },
        },
      },
    });
    expect(css).toContain('--hc-field-label-font-size: 0.875rem;');
  });

  describe('runtime theme overlay (shadcn-style leaf emission)', () => {
    // Re-emitting theme-dependent component leaves inside each
    // [data-color] / [data-density] block is the fix for the CSS
    // custom-property "eager substitution" trap: a component token
    // like `--hc-button-primary-bg: var(--hc-color-action-primary-bg)`
    // declared once on :root has its var() resolved at :root and is
    // then inherited as a frozen colour, so a nested wrapper that
    // redefines `--hc-color-action-primary-bg` cannot recolour
    // buttons inside it. By emitting leaves in each themed block we
    // sidestep var() indirection entirely — matches how shadcn / Radix
    // emit `--card`, `--sidebar-primary`, etc.
    const SOURCES_WITH_THEMES = [
      { namespace: 'primitive', emit: false },
      { namespace: 'semantic',  selector: ':root' },
      { namespace: 'component', selector: ':root' },
      { namespace: 'color.default', selector: ':root, [data-color="default"]' },
      { namespace: 'color.indigo',  selector: '[data-color="indigo"]' },
    ];

    const TREES_WITH_THEMES = {
      primitive: {
        color: {
          blue:   { '600': { $type: 'color', $value: '#2563eb' } },
          indigo: { '600': { $type: 'color', $value: '#4f46e5' } },
          gray:   { '100': { $type: 'color', $value: '#f3f4f6' }, '900': { $type: 'color', $value: '#111827' } },
        },
      },
      semantic: {
        color: {
          action: {
            primary:   { bg: { $type: 'color', $value: '{primitive.color.blue.600}' } },
            secondary: { bg: { $type: 'color', $value: '{primitive.color.gray.100}' } },
          },
        },
      },
      component: {
        button: {
          primary:   { bg: { $type: 'color', $value: '{semantic.color.action.primary.bg}' } },
          secondary: { bg: { $type: 'color', $value: '{semantic.color.action.secondary.bg}' } },
        },
      },
      'color.default': {
        color: { action: { primary: { bg: { $type: 'color', $value: '{primitive.color.blue.600}' } } } },
      },
      'color.indigo': {
        color: { action: { primary: { bg: { $type: 'color', $value: '{primitive.color.indigo.600}' } } } },
      },
    };

    it('emits a theme-dependent component leaf inside every [data-color] block with that theme resolved value', () => {
      const { css } = buildTokensCss({ sources: SOURCES_WITH_THEMES, trees: TREES_WITH_THEMES });

      // Default block resolves --hc-button-primary-bg through color.default → blue.
      expect(css).toMatch(/:root, \[data-color="default"\]\s*\{[^}]*--hc-button-primary-bg:\s*#2563eb;/);
      // Indigo block re-emits it with the indigo theme overlay applied.
      expect(css).toMatch(/\[data-color="indigo"\]\s*\{[^}]*--hc-button-primary-bg:\s*#4f46e5;/);
    });

    it('does NOT emit theme-dependent leaves in the bare :root component block', () => {
      const { css } = buildTokensCss({ sources: SOURCES_WITH_THEMES, trees: TREES_WITH_THEMES });
      // Walk every selector block; ensure no plain :root block
      // (without any data-color attribute) lists --hc-button-primary-bg.
      const blocks = [...css.matchAll(/(?<selector>[^{}\n]+)\s*\{(?<body>[^}]*)\}/g)];
      for (const { groups } of blocks) {
        const selector = groups.selector.trim();
        if (/data-color|data-density|data-theme/.test(selector)) continue;
        expect(groups.body).not.toContain('--hc-button-primary-bg');
      }
      // The theme-independent component leaf still appears somewhere.
      expect(css).toContain('--hc-button-secondary-bg: #f3f4f6;');
    });

    it('skips emitting non-themed component leaves inside themed blocks', () => {
      const { css } = buildTokensCss({ sources: SOURCES_WITH_THEMES, trees: TREES_WITH_THEMES });
      // The indigo block contains the themed primary bg…
      const indigoBlock = css.match(/\[data-color="indigo"\]\s*\{[^}]+\}/)?.[0] ?? '';
      expect(indigoBlock).toContain('--hc-button-primary-bg');
      // …but not button.secondary (which doesn't depend on any colour
      // theme key).
      expect(indigoBlock).not.toContain('--hc-button-secondary-bg');
    });

    // The CLI writes per-axis files (hc.tokens.color-indigo.css, etc.)
    // by keeping every source in the list for {ref} resolution but
    // flagging only the target axis to emit. These two cases lock that
    // emit-subset behaviour the granular token files rely on.
    it('per-axis: emits only the requested colour axis block', () => {
      const sources = SOURCES_WITH_THEMES.map((s) => ({
        ...s,
        emit: s.emit === false ? false : s.namespace === 'color.indigo',
      }));
      const { css } = buildTokensCss({ sources, trees: TREES_WITH_THEMES });
      // Just the indigo block, with its overlaid themed leaf.
      expect(css).toMatch(/\[data-color="indigo"\]\s*\{[^}]*--hc-button-primary-bg:\s*#4f46e5;/);
      // No base (:root) leaves and no other axis block leak in.
      expect(css).not.toContain('[data-color="default"]');
      expect(css).not.toContain('--hc-button-secondary-bg');
    });

    it('core: omits the non-default colour axis block', () => {
      const sources = SOURCES_WITH_THEMES.map((s) => ({
        ...s,
        emit: s.emit === false ? false : s.namespace !== 'color.indigo',
      }));
      const { css } = buildTokensCss({ sources, trees: TREES_WITH_THEMES });
      expect(css).not.toContain('[data-color="indigo"]');
      expect(css).toMatch(/\[data-color="default"\]\s*\{[^}]*--hc-button-primary-bg:\s*#2563eb;/);
      expect(css).toContain('--hc-button-secondary-bg: #f3f4f6;');
    });
  });

  describe('dark mode component leaf re-emission', () => {
    // Unlike the colour / density axes (which can be set on a nested
    // wrapper and so lift their leaves *out* of :root), dark mode is an
    // override layer: light stays the :root default and
    // [data-theme="dark"] overrides on top. A component leaf that
    // resolves through a semantic key `theme.dark` redefines
    // (surface, text, border, muted-bg, action.secondary, …) must keep
    // its light value on :root AND gain a dark re-emission — otherwise
    // it bakes the light value once and buttons / cards / menus stay
    // light under [data-theme="dark"].
    const SOURCES_DARK = [
      { namespace: 'primitive', emit: false },
      { namespace: 'semantic',  selector: ':root, [data-theme="light"]' },
      { namespace: 'component', selector: ':root' },
      { namespace: 'theme.dark', selector: '[data-theme="dark"]' },
    ];

    const TREES_DARK = {
      primitive: {
        color: {
          white: { $type: 'color', $value: '#ffffff' },
          gray: { '100': { $type: 'color', $value: '#f3f4f6' }, '800': { $type: 'color', $value: '#1f2937' } },
        },
      },
      semantic: {
        color: {
          surface:   { $type: 'color', $value: '{primitive.color.white}' },
          'muted-bg': { $type: 'color', $value: '{primitive.color.gray.100}' },
        },
      },
      component: {
        card: { bg: { $type: 'color', $value: '{semantic.color.surface}' } },
        // A leaf that does NOT resolve through any dark-overridden key.
        badge: { bg: { $type: 'color', $value: '{primitive.color.gray.100}' } },
      },
      'theme.dark': {
        color: {
          surface:   { $type: 'color', $value: '{primitive.color.gray.800}' },
          'muted-bg': { $type: 'color', $value: '{primitive.color.gray.800}' },
        },
      },
    };

    it('keeps the light value on :root and overrides it under [data-theme="dark"]', () => {
      const { css } = buildTokensCss({ sources: SOURCES_DARK, trees: TREES_DARK });
      // Light default still baked on the static component block…
      expect(css).toMatch(/:root\s*\{[^}]*--hc-card-bg:\s*#ffffff;/);
      // …and re-emitted with the dark-overlaid value under dark.
      expect(css).toMatch(/\[data-theme="dark"\]\s*\{[^}]*--hc-card-bg:\s*#1f2937;/);
    });

    it('does not re-emit component leaves that do not depend on a dark-overridden key', () => {
      const { css } = buildTokensCss({ sources: SOURCES_DARK, trees: TREES_DARK });
      // badge.bg resolves straight from a primitive, untouched by dark.
      expect(css).toContain('--hc-badge-bg: #f3f4f6;');
      const darkBlock = css.match(/\[data-theme="dark"\]\s*\{[^}]+\}/)?.[0] ?? '';
      expect(darkBlock).toContain('--hc-card-bg');
      expect(darkBlock).not.toContain('--hc-badge-bg');
    });
  });

  describe('neutral axis (light + compound dark)', () => {
    // The neutral axis swaps the surface-family ramp. It is an override
    // layer (like dark, not like colour): the default ramp stays on :root,
    // and a non-default ramp adds a light block plus a compound
    // [data-theme="dark"][data-neutral="X"] block. The dark block uses
    // `overlay: ['theme.dark', 'neutral.X.dark']` so component leaves
    // resolve through the dark baseline and then the ramp's dark surfaces.
    const SOURCES = [
      { namespace: 'primitive', emit: false },
      { namespace: 'semantic',  selector: ':root, [data-theme="light"]' },
      { namespace: 'component', selector: ':root' },
      { namespace: 'theme.dark', selector: '[data-theme="dark"]' },
      { namespace: 'neutral.slate', selector: '[data-neutral="slate"]' },
      { namespace: 'neutral.slate.dark', selector: '[data-theme="dark"][data-neutral="slate"]', overlay: ['theme.dark', 'neutral.slate.dark'] },
    ];
    const TREES = {
      primitive: { color: {
        white: { $type: 'color', $value: '#ffffff' },
        gray:  { 300: { $type: 'color', $value: '#d0d5dd' }, 800: { $type: 'color', $value: '#1f2937' } },
        slate: { 300: { $type: 'color', $value: '#cbd5e1' }, 800: { $type: 'color', $value: '#1e293b' } },
      } },
      semantic: { color: {
        surface: { $type: 'color', $value: '{primitive.color.white}' },
        border:  { $type: 'color', $value: '{primitive.color.gray.300}' },
      } },
      component: { card: {
        bg:     { $type: 'color', $value: '{semantic.color.surface}' },
        border: { $type: 'color', $value: '{semantic.color.border}' },
      } },
      'theme.dark': { color: { surface: { $type: 'color', $value: '{primitive.color.gray.800}' } } },
      'neutral.slate': { color: { border: { $type: 'color', $value: '{primitive.color.slate.300}' } } },
      'neutral.slate.dark': { color: { surface: { $type: 'color', $value: '{primitive.color.slate.800}' } } },
    };

    it('keeps the default neutral on :root', () => {
      const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
      expect(css).toMatch(/:root\s*\{[^}]*--hc-card-border: #d0d5dd;/);
    });

    it('light neutral re-emits the ramp-dependent leaf only', () => {
      const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
      const block = css.match(/\[data-neutral="slate"\]\s*\{[^}]*\}/)[0];
      expect(block).toContain('--hc-card-border: #cbd5e1;');
      // surface is not overridden in light, so card.bg is not re-emitted.
      expect(block).not.toContain('--hc-card-bg');
    });

    it('compound dark block overlays dark then the ramp dark surface', () => {
      const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
      const block = css.match(/\[data-theme="dark"\]\[data-neutral="slate"\]\s*\{[^}]*\}/)[0];
      expect(block).toContain('--hc-card-bg: #1e293b;');
    });
  });

  describe('dark mode error-text contrast (real tokens)', () => {
    // Regression: error/help text in an invalid field used semantic
    // color.error (red-600), which renders at only 3.67:1 on the dark
    // surface — below WCAG AA 4.5:1 for normal text. The dark theme now
    // lightens color.error to red-400 (≥4.5:1), so the field error
    // message and every error border/fill that resolves through it
    // inherits the readable red. Light mode stays red-600.
    //
    // Asserted on OKLCH lightness rather than a literal colour: the
    // guarantee is "dark mode's error is perceptibly lighter", which is
    // what the fix was about and what a ramp change must not undo.
    const lightnessOf = (block, name) =>
      Number(block.match(new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)`))[1]);

    it('lightens color.error and the field error message under [data-theme="dark"]', () => {
      const { css } = buildRealTokens();
      const dark = css.match(/\[data-theme="dark"\] \{[\s\S]*?\n {2}\}/)[0];
      const light = css.match(/:root, \[data-theme="light"\] \{[\s\S]*?\n {2}\}/)[0];
      expect(lightnessOf(dark, 'hc-color-error'))
        .toBeGreaterThan(lightnessOf(light, 'hc-color-error') + 0.1);
      // Component leaf re-emitted with the dark-resolved error colour.
      expect(lightnessOf(dark, 'hc-field-invalid-message-color'))
        .toBe(lightnessOf(dark, 'hc-color-error'));
    });

    it('keeps the light error colour at red-600', () => {
      const { css } = buildRealTokens();
      const light = css.match(/:root, \[data-theme="light"\] \{[\s\S]*?\n {2}\}/)[0];
      const primitives = JSON.parse(
        readFileSync(join(tokensDir, 'primitive.tokens.json'), 'utf8'),
      );
      const red600 = primitives.color.red['600'].$value;
      expect(light).toContain(`--hc-color-error: ${red600};`);
    });
  });

  describe('elevation shadow scale (real tokens)', () => {
    // Component box-shadows route through semantic.shadow.* instead of
    // hard-coded rgb() literals, so a dark page gets stronger alphas (a
    // light-tuned shadow is nearly invisible on a dark surface) and full
    // themes can override elevation like any other token.
    const NAMES = ['sm', 'md', 'lg', 'overlay', 'edge'];

    it('emits the scale in the light block', () => {
      const { css } = buildRealTokens();
      const light = css.match(/:root, \[data-theme="light"\] \{[\s\S]*?\n {2}\}/)[0];
      expect(light).toMatch(/--hc-shadow-sm:\s*0 1px 2px rgb\(0, 0, 0, 0\.15\);/);
      expect(light).toMatch(/--hc-shadow-overlay:\s*0 10px 30px rgb\(0, 0, 0, 0\.15\);/);
      // edge is colour-only: the directional geometry stays in the CSS
      // that composes it (tabs scroll fades, datagrid frozen columns).
      expect(light).toMatch(/--hc-shadow-edge:\s*rgb\(0, 0, 0, 0\.2\);/);
      for (const name of NAMES) expect(light).toContain(`--hc-shadow-${name}:`);
    });

    it('overrides every step with a stronger alpha under [data-theme="dark"]', () => {
      const { css } = buildRealTokens();
      const light = css.match(/:root, \[data-theme="light"\] \{[\s\S]*?\n {2}\}/)[0];
      const dark = css.match(/\[data-theme="dark"\] \{[\s\S]*?\n {2}\}/)[0];
      for (const name of NAMES) {
        const re = new RegExp(`--hc-shadow-${name}:\\s*([^;]+);`);
        const lightValue = light.match(re)?.[1];
        const darkValue = dark.match(re)?.[1];
        expect(lightValue, `${name} light`).toBeTruthy();
        expect(darkValue, `${name} dark`).toBeTruthy();
        expect(darkValue).not.toBe(lightValue);
      }
      expect(dark).toMatch(/--hc-shadow-overlay:\s*0 10px 30px rgb\(0, 0, 0, 0\.6\);/);
      expect(dark).toMatch(/--hc-shadow-edge:\s*rgb\(0, 0, 0, 0\.5\);/);
    });
  });
});

describe('resolveTokens', () => {
  const LAYERS = [
    { namespace: 'primitive' },
    { namespace: 'semantic' },
    { namespace: 'component' },
  ];

  it('returns flat literal values with the --hc- names minus the prefix', () => {
    const map = resolveTokens({ sources: LAYERS, trees: TREES });
    expect(map.get('color-bg')).toBe('#f9fafb');
    expect(map.get('button-padding-x')).toBe('1rem');
    expect(map.get('button-primary-bg')).toBe('#2563eb');
    // Primitives feed resolution but are never emitted.
    expect(map.has('color-gray-50')).toBe(false);
    // Every value is a resolved literal — no {ref} survives.
    for (const [name, value] of map) {
      expect(value, name).not.toContain('{');
    }
  });

  it('applies overlay layers to semantic keys AND dependent component leaves', () => {
    const sources = [...LAYERS, { namespace: 'theme.dark' }];
    const map = resolveTokens({ sources, trees: TREES });
    expect(map.get('color-bg')).toBe('#111827'); // dark override
    expect(map.get('color-text')).toBe('#111827'); // untouched base key still present
  });

  it('re-resolves component leaves through the overlay, later layers winning', () => {
    const trees = {
      ...TREES,
      'color.test': {
        color: { action: { primary: { bg: { $type: 'color', $value: '{primitive.color.gray.900}' } } } },
      },
      'color.later': {
        color: { action: { primary: { bg: { $type: 'color', $value: '{primitive.color.gray.50}' } } } },
      },
    };
    const sources = [...LAYERS, { namespace: 'color.test' }, { namespace: 'color.later' }];
    const map = resolveTokens({ sources, trees });
    expect(map.get('color-action-primary-bg')).toBe('#f9fafb');
    expect(map.get('button-primary-bg')).toBe('#f9fafb');
  });

  it('emits overlay-only keys absent from the base semantic tree', () => {
    const trees = {
      ...TREES,
      'color.extra': {
        color: { accent: { $type: 'color', $value: '{primitive.color.blue.600}' } },
      },
    };
    const map = resolveTokens({ sources: [...LAYERS, { namespace: 'color.extra' }], trees });
    expect(map.get('color-accent')).toBe('#2563eb');
  });

  it('resolves the real DTCG sources for a light and a dark combination', () => {
    const trees = {};
    for (const src of DEFAULT_SOURCES) {
      trees[src.namespace] = JSON.parse(readFileSync(join(tokensDir, src.file), 'utf8'));
    }
    const base = ['primitive', 'semantic', 'component', 'density.comfortable', 'color.default'];
    const light = resolveTokens({
      sources: [...base, 'color.teal', 'neutral.slate'].map((namespace) => ({ namespace })),
      trees,
    });
    const dark = resolveTokens({
      sources: [...base, 'color.teal', 'neutral.slate', 'theme.dark', 'neutral.slate.dark']
        .map((namespace) => ({ namespace })),
      trees,
    });
    for (const map of [light, dark]) {
      expect(map.get('button-primary-bg')).toBeTruthy();
      for (const [name, value] of map) {
        expect(value, name).not.toContain('{');
        expect(value, name).not.toContain('var(');
      }
    }
    // The combination actually themes: dark surfaces differ from light.
    expect(dark.get('color-bg')).not.toBe(light.get('color-bg'));
  });

});

describe('bare-anchor link rules', () => {
  // `:visited` cannot read a custom property — engines refuse to resolve
  // var() in a visited-dependent declaration, because resolving it would let
  // a page read the history bit back out of the cascade. So the colour has
  // to be a literal, baked per theme. These tests pin the two things that
  // can silently rot: the literal drifting away from the token it mirrors,
  // and the cascade order that decides which literal a page actually gets.
  const linkLayer = (css) => css.slice(css.indexOf('@layer hc.base {'));

  /** [{ selector, color }] for every `a:visited` rule, in emission order. */
  function visitedRules(css) {
    return [...linkLayer(css).matchAll(/^ {2}(\S.*a:visited[^{]*)\{\n\s*color: ([^;]+);/gm)]
      .map((m) => ({ selector: m[1].trim(), color: m[2].trim() }));
  }

  it('bakes a literal that matches the block it was emitted from', () => {
    const { css } = buildRealTokens();
    // Pair every `--hc-color-link-visited` declaration with the `a:visited`
    // rule generated from the same block, and require them to agree. A
    // hand-maintained rule is exactly what this issue set out to remove, so
    // a drift here means the generator stopped being the single source.
    const declared = [...css.matchAll(/^ {2}(\S[^{]*)\{([^}]*)\}/gm)]
      .map(([, selector, body]) => ({
        selector: selector.trim(),
        value: body.match(/--hc-color-link-visited:\s*([^;]+);/)?.[1]?.trim(),
      }))
      .filter((b) => b.value);

    const rules = visitedRules(css);
    expect(declared.length).toBe(rules.length);
    expect(declared.length).toBeGreaterThan(0);
    for (const [i, block] of declared.entries()) {
      expect(rules[i].color, block.selector).toBe(block.value);
      // The rule is that block's selector, scoped to a descendant anchor.
      const scoped = block.selector.split(',').map((p) => `${p.trim()} a:visited`).join(', ');
      expect(rules[i].selector).toBe(scoped);
    }
  });

  it('covers every theme x accent combination', () => {
    const selectors = visitedRules(buildRealTokens().css).map((r) => r.selector);
    // Light: the semantic default plus the four non-default accents.
    expect(selectors[0]).toBe(':root a:visited, [data-theme="light"] a:visited');
    for (const accent of ['teal', 'lime', 'orange', 'fuchsia']) {
      expect(selectors).toContain(`[data-color="${accent}"] a:visited`);
      // Dark: the compound block, in both the descendant and same-element
      // form, because data-theme and data-color need not share a node.
      expect(selectors).toContain(
        `[data-theme="dark"] [data-color="${accent}"] a:visited, ` +
        `[data-theme="dark"][data-color="${accent}"] a:visited`,
      );
    }
    expect(selectors).toContain('[data-theme="dark"] a:visited');
  });

  it('pins hover at the same specificity as visited, and after it', () => {
    // Without this pair the compound dark blocks (0,2,1) would outrank the
    // plain `a:hover` in hc.base.css (0,1,1), and hovering a visited link on
    // a dark themed page would leave it stuck on its visited colour.
    const layer = linkLayer(buildRealTokens().css);
    for (const { selector } of visitedRules(buildRealTokens().css)) {
      const hover = selector.replaceAll('a:visited', 'a:hover');
      expect(layer).toContain(hover);
      expect(layer.indexOf(hover)).toBeGreaterThan(layer.indexOf(selector));
    }
  });

  it('emits the rules into hc.base, never hc.tokens', () => {
    const { css } = buildRealTokens();
    // hc.base is the later layer, so these still lose to anything the app
    // writes outside the hc layers — and they must not sit in hc.tokens,
    // where hc.base.css's own `a { color: … }` would beat them wholesale.
    const tokensLayer = css.slice(css.indexOf('@layer hc.tokens {'), css.indexOf('@layer hc.base {'));
    expect(tokensLayer).not.toContain('a:visited');
    expect(linkLayer(css)).toContain('a:visited');
  });

  it('never defines a variable only under a non-default selector', () => {
    // A component leaf that depends on a key the runtime colour axes
    // redefine is lifted OUT of the static `:root` block and re-emitted per
    // axis — so it silently has no value on the light default path unless
    // `color.default` redefines that key too. Adding `--hc-chat-link-fg` as
    // `{semantic.color.link-hover}` hit exactly this: it appeared in the
    // dark and the four accent blocks, and nowhere a plain `<html>` could
    // reach it. Every variable must be reachable with no attributes set.
    const { css } = buildRealTokens();
    const defaults = new Set();
    const all = new Set();
    for (const [, selector, body] of css.matchAll(/^ {2}(\S[^{]*)\{([^}]*)\}/gm)) {
      // The blocks a bare `<html>` matches: `:root` on its own, or a
      // selector list with a `:root` arm.
      const isDefault = selector.split(',').some((s) => s.trim() === ':root');
      for (const [, name] of body.matchAll(/^\s*(--hc-[\w-]+):/gm)) {
        all.add(name);
        if (isDefault) defaults.add(name);
      }
    }
    expect(all.size).toBeGreaterThan(0);
    const unreachable = [...all].filter((n) => !defaults.has(n));
    expect(unreachable).toEqual([]);
  });

  it('leaves the link rules out when no source defines them', () => {
    // The synthetic fixture has no link tokens, so no stray empty layer.
    const { css } = buildTokensCss({ sources: SOURCES, trees: TREES });
    expect(css).not.toContain('@layer hc.base');
  });
});
