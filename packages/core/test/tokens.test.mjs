import { describe, it, expect } from 'vitest';
import { buildTokensCss } from '../scripts/build-tokens.mjs';

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
});
