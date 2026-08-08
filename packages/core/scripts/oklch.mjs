// OKLCH <-> sRGB conversion.
//
// The design primitives are authored as `oklch()` (see
// `src/tokens/primitive.tokens.json`). Nothing in the token pipeline
// needs to understand colour — values pass through `token-transform.mjs`
// as opaque strings — but the docs need to *render* them: swatch labels,
// the palette page, and the theme builder all want the sRGB triple.
//
// Dependency-free and side-effect-free so it can be bundled into a
// browser script as well as run in Node, the same way
// `./token-transform` already is.

const CBRT = (x) => Math.cbrt(x);

/** Parse `oklch(L C H)`. Returns null for anything else. */
export function parseOklch(value) {
  const m = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(String(value).trim());
  if (!m) return null;
  const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  return { L, C: parseFloat(m[2]), H: parseFloat(m[3]) };
}

/** Linear-light sRGB channel -> gamma-encoded 0..1. */
const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
/** Gamma-encoded 0..1 -> linear-light. */
const decode = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * OKLCH -> linear-light sRGB. Channels may fall outside 0..1 when the
 * colour is out of gamut; `oklchToRgb` clamps, `inSrgbGamut` reports.
 */
export function oklchToLinearSrgb({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** True when the colour needs no gamut mapping to render in sRGB. */
export function inSrgbGamut(oklch, epsilon = 1e-4) {
  return oklchToLinearSrgb(oklch).every((v) => v >= -epsilon && v <= 1 + epsilon);
}

/**
 * OKLCH -> 8-bit sRGB `[r, g, b]`, clamped into gamut.
 *
 * Good for display — swatch labels, docs, the theme builder preview —
 * but not bit-exact against a browser for every input. Two independent
 * float pipelines disagree by 1/255 on values that land within half an
 * ulp of an 8-bit boundary; measured across the committed palette, 3 of
 * 139 values differ that way. Assert what the browser paints, not what
 * this returns, when the two must agree exactly.
 */
export function oklchToRgb(oklch) {
  return oklchToLinearSrgb(oklch).map((v) => Math.round(encode(Math.min(1, Math.max(0, v))) * 255));
}

/** OKLCH -> `#rrggbb`. */
export function oklchToHex(oklch) {
  return `#${oklchToRgb(oklch)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** 8-bit sRGB -> OKLCH. */
export function rgbToOklch([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((v) => decode(v / 255));
  const l = CBRT(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = CBRT(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = CBRT(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    L,
    C: Math.hypot(A, B),
    H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  };
}

/** `#rrggbb` -> OKLCH, or null if the string is not a 6-digit hex. */
export function hexToOklch(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgbToOklch([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}

/**
 * Render any token colour as `#rrggbb` for display. Accepts the
 * `oklch()` form the primitives use and passes hex through unchanged,
 * so callers do not have to care which era a value comes from.
 */
export function toHex(value) {
  const parsed = parseOklch(value);
  if (parsed) return oklchToHex(parsed);
  const m = /^#?([0-9a-f]{6})$/i.exec(String(value).trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

// ---------------------------------------------------------------------
// The ramp ladder
// ---------------------------------------------------------------------

/**
 * Shared ladder for the chromatic ramps: one `L` and one target `C` per
 * step, so `600` means the same darkness *and* the same colourfulness
 * on every hue.
 *
 * `C` is an absolute chroma, clamped to what the hue can actually hold
 * in sRGB at that lightness (`GAMUT_HEADROOM` below). The alternative —
 * chroma as a *fraction* of the in-gamut maximum — sounds tidier but
 * traces the gamut boundary, whose shape swings wildly by hue: green's
 * sRGB gamut is widest at high lightness, so a fixed fraction makes
 * `green.200` more chromatic than `green.500` and the light tints come
 * out neon. With an absolute target every ramp peaks where a ramp
 * should, and hues that cannot reach the target simply clamp — which is
 * a fact about sRGB, not a design choice.
 *
 * The numbers are the median absolute chroma the pre-OKLCH ramps used
 * at each step, so the palette keeps the colourfulness curve a human
 * designed while its lightness becomes systematic.
 *
 * `L: 0.54` at step 600 is load-bearing: white text clears 4.5:1 on
 * every hue below L 0.554 (green is the strictest), so `600` is
 * white-text-safe by construction. See `autoForeground`.
 *
 * Step `500` (L 0.62) is deliberately **not** a text surface. It sits
 * in the dead band where the saturated hues clear neither white
 * (3.4–4.0:1) nor dark text (4.4–5.2:1), which is why it is the
 * focus-ring and accent step while `600` carries the action surface.
 * `test/ramp.test.mjs` asserts this rather than trusting the comment.
 */
export const LADDER = {
  50:  { L: 0.97, C: 0.016 },
  100: { L: 0.94, C: 0.032 },
  200: { L: 0.89, C: 0.059 },
  300: { L: 0.82, C: 0.104 },
  400: { L: 0.72, C: 0.159 },
  500: { L: 0.62, C: 0.204 },
  600: { L: 0.54, C: 0.215 },
  700: { L: 0.47, C: 0.198 },
  800: { L: 0.4, C: 0.171 },
  900: { L: 0.33, C: 0.135 },
  950: { L: 0.24, C: 0.087 },
};

/**
 * Stay this far inside the sRGB gamut boundary when a hue cannot hold
 * the ladder's target chroma. Pure boundary values round-trip badly
 * through 8-bit sRGB.
 */
export const GAMUT_HEADROOM = 0.98;

/** Ladder steps in order, as strings (the token keys). */
export const LADDER_STEPS = Object.keys(LADDER);

/**
 * Largest chroma that still fits inside sRGB at this lightness and hue.
 * Bisection — the gamut boundary is not analytic.
 */
export function maxChroma(L, H, iterations = 40) {
  let lo = 0;
  let hi = 0.45;
  for (let i = 0; i < iterations; i += 1) {
    const mid = (lo + hi) / 2;
    if (inSrgbGamut({ L, C: mid, H })) lo = mid;
    else hi = mid;
  }
  return lo;
}

const round = (n, places) => Number(n.toFixed(places));

/**
 * One ramp step for a hue: `{ L, C, H }`, in gamut by construction.
 * This is what both the token generator and the theme builder call, so
 * a generated axis is built exactly like the five built-in ones.
 */
export function rampStep(hue, step) {
  const rung = LADDER[step];
  if (!rung) throw new Error(`rampStep: unknown step ${step}`);
  const ceiling = GAMUT_HEADROOM * maxChroma(rung.L, hue);
  return {
    L: rung.L,
    C: round(Math.min(rung.C, ceiling), 4),
    H: round(hue, 2),
  };
}

/** `rampStep` as the `oklch(L C H)` string a token holds. */
export function formatOklch({ L, C, H }) {
  return C === 0 ? `oklch(${round(L, 4)} 0 0)` : `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 2)})`;
}

/**
 * Lightness at or below which white text clears 4.5:1.
 *
 * Contrast at a fixed L is near-independent of hue and chroma — across
 * all 360 hues at ladder chroma, white on L 0.54 scores 4.73–5.86:1,
 * and sweeping chroma 0→0.25 at one hue moves it only 5.06→5.43. So
 * the foreground choice is a threshold, not a search.
 */
export const FG_LIGHTNESS_PIVOT = 0.55;

/** Pick the readable foreground for a background colour. */
export function autoForeground(background, { light = '#ffffff', dark = '#111827' } = {}) {
  const parsed = typeof background === 'string' ? parseOklch(background) : background;
  const L = parsed?.L ?? 1;
  return L <= FG_LIGHTNESS_PIVOT ? light : dark;
}
