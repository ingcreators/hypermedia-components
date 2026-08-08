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

/** OKLCH -> 8-bit sRGB `[r, g, b]`, clamped into gamut. */
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
