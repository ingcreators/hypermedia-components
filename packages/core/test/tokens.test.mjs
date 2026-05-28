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
