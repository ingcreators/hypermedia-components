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
});
