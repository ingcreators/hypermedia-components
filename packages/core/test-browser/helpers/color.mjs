import { expect as baseExpect } from '@playwright/test';

/**
 * Resolve a CSS colour to 8-bit sRGB, whatever colour space it was
 * authored in.
 *
 * The primitives are `oklch()` now, and `getComputedStyle()` hands back
 * the authored colour space verbatim — `oklch(0.5461 0.2152 262.88)`
 * for a plain token, `color(srgb …)` once `color-mix()` is involved.
 * Comparing those strings against an `rgb(…)` literal tells you nothing
 * about what the user sees, and the serialization differs per engine.
 *
 * Painting the value onto a 1x1 canvas and reading the pixel back gives
 * the sRGB triple that actually gets rasterized, which is what these
 * specs mean to assert. Output matches the `rgb()` / `rgba()` shape
 * browsers use, so expectations read the same as before.
 *
 * Alpha note: the canvas backing store is premultiplied, so a
 * translucent colour loses a little precision in the RGB channels on
 * the way through. Assert opaque colours here; for translucent ones
 * check the alpha alone.
 *
 * @param {import('@playwright/test').Locator} locator
 * @param {string} prop  camelCase CSSOM name (`backgroundColor`) or a
 *                       custom property (`--hc-tabs-tab-indicator`).
 * @param {string} [pseudo]  e.g. `'::before'`.
 * @returns {Promise<string>} `rgb(r, g, b)` or `rgba(r, g, b, a)`
 */
export function cssColor(locator, prop, pseudo) {
  return locator.evaluate((el, [name, pseudoEl]) => {
    const cs = getComputedStyle(el, pseudoEl || undefined);
    const raw = name.startsWith('--') ? cs.getPropertyValue(name).trim() : cs[name];
    if (!raw) throw new Error(`cssColor: ${name} resolved to an empty value`);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = raw;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255
      ? `rgb(${r}, ${g}, ${b})`
      : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(2))})`;
  }, [prop, pseudo]);
}

const parseRgbString = (value) => {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(String(value).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
};

/**
 * `expect` extended with `toBeColor(expected, tolerance = 1)`.
 *
 * The tokens are `oklch()`, and engines disagree by 1/255 on values
 * that land within half an ulp of an 8-bit boundary — Chromium paints
 * `green.600` as rgb(9, 131, 91) where Firefox and WebKit paint
 * rgb(10, 131, 91), and neither is wrong. A hard string equality can
 * therefore never satisfy all three engines at once. These specs assert
 * "the token reached the surface", not a rasterizer's rounding, so the
 * matcher compares channels with a ±1 default tolerance (alpha ±0.02).
 */
export const expect = baseExpect.extend({
  toBeColor(received, expected, tolerance = 1) {
    const got = parseRgbString(received);
    const want = parseRgbString(expected);
    if (!got || !want) {
      return {
        pass: false,
        message: () => `toBeColor: could not parse ${JSON.stringify(!got ? received : expected)} as rgb()/rgba()`,
      };
    }
    const channelDelta = Math.max(...[0, 1, 2].map((i) => Math.abs(got[i] - want[i])));
    const alphaDelta = Math.abs(got[3] - want[3]);
    const pass = channelDelta <= tolerance && alphaDelta <= 0.02;
    return {
      pass,
      message: () =>
        `expected ${received} to ${this.isNot ? 'not ' : ''}be ${expected} within ±${tolerance}/255 ` +
        `(channel Δ ${channelDelta}, alpha Δ ${alphaDelta.toFixed(3)})`,
    };
  },
});
