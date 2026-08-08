import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  LADDER,
  LADDER_STEPS,
  FG_LIGHTNESS_PIVOT,
  GAMUT_HEADROOM,
  parseOklch,
  oklchToRgb,
  oklchToHex,
  hexToOklch,
  inSrgbGamut,
  maxChroma,
  rampStep,
  autoForeground,
} from '../scripts/oklch.mjs';
import { RAMP_HUES, generateRamps } from '../scripts/build-ramp.mjs';

const tokensDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tokens');
const read = (file) => JSON.parse(readFileSync(join(tokensDir, file), 'utf8'));

const primitives = read('primitive.tokens.json').color;
const CHROMATIC = Object.keys(RAMP_HUES);

/** WCAG relative luminance of an OKLCH colour, via sRGB. */
function luminance(oklch) {
  const [r, g, b] = oklchToRgb(oklch).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE_Y = luminance(parseOklch(primitives.white.$value));
const DARK_Y = luminance(parseOklch(primitives.gray['900'].$value));

describe('chromatic ramps follow the shared ladder', () => {
  it.each(CHROMATIC)('%s: lightness matches the ladder at every step', (ramp) => {
    for (const step of LADDER_STEPS) {
      const { L } = parseOklch(primitives[ramp][step].$value);
      expect(L, `${ramp}.${step}`).toBeCloseTo(LADDER[step].L, 3);
    }
  });

  it.each(CHROMATIC)('%s: hue is constant down the ramp', (ramp) => {
    const hues = new Set(LADDER_STEPS.map((s) => parseOklch(primitives[ramp][s].$value).H));
    expect([...hues]).toEqual([RAMP_HUES[ramp]]);
  });

  it.each(CHROMATIC)('%s: chroma hits the ladder target or the gamut ceiling', (ramp) => {
    for (const step of LADDER_STEPS) {
      const { L, C, H } = parseOklch(primitives[ramp][step].$value);
      const ceiling = GAMUT_HEADROOM * maxChroma(L, H);
      expect(C, `${ramp}.${step}`).toBeCloseTo(Math.min(LADDER[step].C, ceiling), 3);
      expect(inSrgbGamut({ L, C, H }), `${ramp}.${step} in gamut`).toBe(true);
    }
  });

  it('lightness decreases monotonically down every ramp', () => {
    for (const ramp of CHROMATIC) {
      const ls = LADDER_STEPS.map((s) => parseOklch(primitives[ramp][s].$value).L);
      for (let i = 1; i < ls.length; i += 1) {
        expect(ls[i], `${ramp} step ${LADDER_STEPS[i]}`).toBeLessThan(ls[i - 1]);
      }
    }
  });

  it('the committed ramps are exactly what build-ramp.mjs generates', () => {
    const generated = generateRamps();
    for (const ramp of CHROMATIC) {
      for (const step of LADDER_STEPS) {
        expect(primitives[ramp][step].$value, `${ramp}.${step}`).toBe(generated[ramp][step]);
      }
    }
  });
});

describe('the ladder carries the contrast guarantee', () => {
  it('white text clears AA on step 600 for every hue', () => {
    for (const ramp of CHROMATIC) {
      const ratio = contrast(luminance(parseOklch(primitives[ramp]['600'].$value)), WHITE_Y);
      expect(ratio, `white on ${ramp}.600`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('white text clears AA on step 700 for every hue', () => {
    for (const ramp of CHROMATIC) {
      const ratio = contrast(luminance(parseOklch(primitives[ramp]['700'].$value)), WHITE_Y);
      expect(ratio, `white on ${ramp}.700`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark text clears AA on steps 300 and 400 for every hue', () => {
    for (const ramp of CHROMATIC) {
      for (const step of ['300', '400']) {
        const ratio = contrast(luminance(parseOklch(primitives[ramp][step].$value)), DARK_Y);
        expect(ratio, `gray.900 on ${ramp}.${step}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('every text-bearing step has an AA-safe foreground, and it is the one the pivot picks', () => {
    const TEXT_STEPS = LADDER_STEPS.filter((s) => s !== '500');
    for (const ramp of CHROMATIC) {
      for (const step of TEXT_STEPS) {
        const value = primitives[ramp][step].$value;
        const { L } = parseOklch(value);
        const y = luminance(parseOklch(value));
        const expected = L <= FG_LIGHTNESS_PIVOT ? WHITE_Y : DARK_Y;
        expect(contrast(y, expected), `${ramp}.${step} vs the fg the pivot picks`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('step 500 is the dead band — neither foreground clears AA', () => {
    // L 0.62 is too dark for dark text and too light for white text on
    // the more saturated hues. That is why `500` is the focus-ring and
    // accent step and never a text surface: the axes use 600 for the
    // action background (see the axis suite below). Asserted rather
    // than merely commented so a future ladder change cannot quietly
    // turn 500 into something callers assume is safe.
    const offenders = CHROMATIC.filter((ramp) => {
      const y = luminance(parseOklch(primitives[ramp]['500'].$value));
      return contrast(y, WHITE_Y) < 4.5 && contrast(y, DARK_Y) < 4.5;
    });
    expect(offenders.length).toBeGreaterThan(0);
  });
});

describe('the colour axes are one shape', () => {
  const AXES = {
    default: ['color.default.tokens.json', 'blue'],
    indigo: ['color.indigo.tokens.json', 'indigo'],
    emerald: ['color.emerald.tokens.json', 'green'],
    rose: ['color.rose.tokens.json', 'rose'],
    amber: ['color.amber.tokens.json', 'amber'],
  };

  it.each(Object.entries(AXES))('%s uses 600 / 700 / 500 with white text', (_name, [file, ramp]) => {
    const tree = read(file).color;
    expect(tree.action.primary.bg.$value).toBe(`{primitive.color.${ramp}.600}`);
    expect(tree.action.primary.border.$value).toBe(`{primitive.color.${ramp}.600}`);
    expect(tree.action['primary-hover'].bg.$value).toBe(`{primitive.color.${ramp}.700}`);
    expect(tree['focus-ring'].$value).toBe(`{primitive.color.${ramp}.500}`);
    expect(tree.action.primary.fg.$value).toBe('{primitive.color.white}');
    // No per-theme tint percentage any more.
    expect(tree.action['primary-soft'].bg.$value).toBe(
      `color-mix(in oklab, {primitive.color.${ramp}.600} 12%, transparent)`,
    );
  });

  it('every axis foreground is the one autoForeground would pick', () => {
    for (const [file, ramp] of Object.values(AXES)) {
      const tree = read(file).color;
      const bg = primitives[ramp]['600'].$value;
      const fg = autoForeground(bg, { light: '{primitive.color.white}', dark: '{primitive.color.gray.900}' });
      expect(fg, `${file}`).toBe(tree.action.primary.fg.$value);
    }
  });
});

describe('rampStep is the shared source of truth', () => {
  it('reproduces the committed primitives for the built-in hues', () => {
    for (const [ramp, hue] of Object.entries(RAMP_HUES)) {
      for (const step of LADDER_STEPS) {
        const generated = rampStep(hue, step);
        const committed = parseOklch(primitives[ramp][step].$value);
        expect(generated.L, `${ramp}.${step} L`).toBeCloseTo(committed.L, 4);
        expect(generated.C, `${ramp}.${step} C`).toBeCloseTo(committed.C, 4);
        expect(generated.H, `${ramp}.${step} H`).toBeCloseTo(committed.H, 2);
      }
    }
  });

  it('produces an AA-safe 600 for hues that have no built-in ramp', () => {
    // What the theme builder does: pick a hue, take the ladder. No hue
    // needs review because lightness, not hue, carries the guarantee.
    for (let hue = 0; hue < 360; hue += 15) {
      const step = rampStep(hue, '600');
      expect(inSrgbGamut(step), `hue ${hue} in gamut`).toBe(true);
      expect(contrast(luminance(step), WHITE_Y), `white on hue ${hue}`).toBeGreaterThanOrEqual(4.5);
      expect(autoForeground(step)).toBe('#ffffff');
    }
  });
});

describe('oklch module round-trips', () => {
  it('hexToOklch and oklchToHex are inverses across the palette', () => {
    for (const ramp of Object.keys(primitives)) {
      const node = primitives[ramp];
      const values = node.$value ? [node.$value] : Object.values(node).map((n) => n.$value);
      for (const value of values) {
        const hex = oklchToHex(parseOklch(value));
        expect(oklchToHex(hexToOklch(hex))).toBe(hex);
      }
    }
  });
});
