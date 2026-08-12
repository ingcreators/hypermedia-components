// Range condition values — `A..B` on the wire.
//
// A date filter is a PERIOD, and a period is one condition: one chip in
// the applied-conditions bar, one thing to remove, one value a saved
// view stores. Two params (`f-due-from` + `f-due-to`) cannot carry a
// preset from a single control — "last month" has to write both ends —
// so the wire carries one:
//
//   ?f-due=2026-07-01..2026-07-31            absolute
//   ?f-due=@month-start-1m..@month-end-1m    relative, both ends
//   ?f-due=@month-start-1m..2026-07-15       mixed — normal in practice
//   ?f-due=@today..                          open ended
//
// The `-from` / `-to` pair is still accepted, because that is what the
// two date inputs submit when installRangeValue() never ran. Servers
// take both shapes; this module is where the demo API does.
//
// Each end is resolved independently by relative-dates.mjs, so a mixed
// range needs no special case.

import { describeRelative, resolveRelative } from './relative-dates.mjs';

const SEP = '..';

/** `A..B` → the two ends. A bare value is a single point. */
export function splitRangeValue(value) {
  const raw = String(value ?? '');
  const at = raw.indexOf(SEP);
  if (at === -1) {
    const point = raw.trim();
    return { from: point, to: point };
  }
  return { from: raw.slice(0, at).trim(), to: raw.slice(at + SEP.length).trim() };
}

/** Two ends → `A..B`. Both empty is not a condition. */
export function joinRangeValue(from, to) {
  const a = String(from ?? '').trim();
  const b = String(to ?? '').trim();
  if (!a && !b) return '';
  return `${a}${SEP}${b}`;
}

/**
 * The range a request asks for, whichever shape it arrived in: the
 * single `param` value, or the `param-from` / `param-to` pair the
 * no-JS path submits.
 *
 * @returns {string} the canonical `A..B` value, or `''` for no condition.
 */
export function rangeFromParams(params, param) {
  const single = params.get(param);
  if (single) return single.trim();
  return joinRangeValue(params.get(`${param}-from`), params.get(`${param}-to`));
}

/**
 * Resolve both ends against one instant.
 *
 * @returns {{from: string|null, to: string|null, error: string|null}}
 *   ISO dates for the ends that are set, `null` where open. `error`
 *   names the end that could not be resolved — the caller must fail
 *   closed rather than answer with more rows than were asked for.
 */
export function resolveRange(value, { now = new Date() } = {}) {
  const { from, to } = splitRangeValue(value);
  const out = { from: null, to: null, error: null };
  if (from) {
    out.from = resolveRelative(from, { now });
    if (out.from == null) return { ...out, error: from };
  }
  if (to) {
    out.to = resolveRelative(to, { now });
    if (out.to == null) return { ...out, error: to };
  }
  return out;
}

/**
 * How a range reads in the conditions bar: the operator and the value,
 * separately, because the bar renders them as separate elements.
 *
 * Each end shows the expression that was STORED and the date it
 * resolved to — showing only one of the two is how a relative condition
 * becomes a guess.
 */
export function describeRange(value, { now = new Date() } = {}) {
  const { from, to } = splitRangeValue(value);
  const one = (end) => describeRelative(end, { now });
  if (from && to && from === to) return { op: 'is', value: one(from) };
  if (from && to) return { op: 'between', value: `${one(from)} – ${one(to)}` };
  if (from) return { op: 'from', value: one(from) };
  return { op: 'until', value: one(to) };
}

/**
 * One readable line for a range — what a select option says when the
 * stored value is not one of the presets, so a composed or mixed range
 * round-trips readably instead of turning back into raw syntax.
 */
export function labelRange(value, { now = new Date() } = {}) {
  const { op, value: text } = describeRange(value, { now });
  if (op === 'between') return text;
  if (op === 'from') return `From ${text}`;
  if (op === 'until') return `Until ${text}`;
  return text;
}
