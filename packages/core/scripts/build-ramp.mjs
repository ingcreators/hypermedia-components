// Regenerate the chromatic ramps in src/tokens/primitive.tokens.json
// from the shared ladder (scripts/oklch.mjs).
//
//   node scripts/build-ramp.mjs [--check]
//
// Each chromatic ramp is one hue angle plus the ladder: constant H down
// the ramp, L from the ladder, C as a fraction of the in-gamut maximum
// at that (L, H). That is what makes `600` mean the same darkness on
// every hue, and what makes white-on-600 clear 4.5:1 everywhere.
//
// The neutral ramps are NOT generated. They were already perceptually
// uniform before this change (lightness spread <= 1.8 points at every
// step, against 18.3 for the chromatic ramps), they carry the extra
// `350` step, and dark mode is built entirely from them. Regenerating
// them would move the whole UI for no gain.
//
// `--check` reports drift without writing, for CI or a quick diff.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LADDER_STEPS, rampStep, formatOklch, parseOklch, oklchToHex } from './oklch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(here, '..', 'src', 'tokens', 'primitive.tokens.json');

/**
 * Hue angle per chromatic ramp, anchored on the hue of the most
 * saturated step of the original Tailwind-derived palette so each ramp
 * keeps its identity.
 */
export const RAMP_HUES = {
  blue: 264.4,
  red: 27.3,
  green: 163.2,
  amber: 70.1,
  indigo: 277.0,
  rose: 17.6,
  violet: 293.0,
};

/** `{ blue: { 50: 'oklch(…)', … }, … }` straight from the ladder. */
export function generateRamps() {
  const out = {};
  for (const [name, hue] of Object.entries(RAMP_HUES)) {
    out[name] = {};
    for (const step of LADDER_STEPS) out[name][step] = formatOklch(rampStep(hue, step));
  }
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  const source = readFileSync(TOKENS, 'utf8');
  const tree = JSON.parse(source);
  const generated = generateRamps();

  let text = source;
  const changes = [];

  for (const [name, steps] of Object.entries(generated)) {
    for (const [step, value] of Object.entries(steps)) {
      const current = tree.color?.[name]?.[step]?.$value;
      if (current === undefined) throw new Error(`missing token color.${name}.${step}`);
      if (current === value) continue;
      changes.push({ token: `color.${name}.${step}`, from: current, to: value });
      // Replace only inside this ramp's block, so identical values in
      // other ramps are untouched.
      const block = new RegExp(`("${name}"\\s*:\\s*\\{[\\s\\S]*?)"${step}"(\\s*:\\s*\\{[^}]*?"\\$value"\\s*:\\s*")[^"]*(")`);
      const next = text.replace(block, `$1"${step}"$2${value}$3`);
      if (next === text) throw new Error(`could not rewrite color.${name}.${step}`);
      text = next;
    }
  }

  if (check) {
    if (!changes.length) {
      console.log('ramps match the ladder');
      return;
    }
    console.log(`${changes.length} token(s) drift from the ladder:`);
    for (const c of changes) {
      console.log(`  ${c.token.padEnd(18)} ${c.from}  ->  ${c.to}`);
    }
    process.exitCode = 1;
    return;
  }

  writeFileSync(TOKENS, text);
  console.log(`primitive.tokens.json: ${changes.length} chromatic value(s) regenerated`);
  for (const c of changes) {
    const from = oklchToHex(parseOklch(c.from) ?? { L: 0, C: 0, H: 0 });
    const to = oklchToHex(parseOklch(c.to));
    console.log(`  ${c.token.padEnd(18)} ${from} -> ${to}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('build-ramp.mjs')) main();
