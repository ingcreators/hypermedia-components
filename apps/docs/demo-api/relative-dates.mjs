// Relative date expressions for filter conditions.
//
// A saved view is a stored querystring. Store an absolute date in it and
// the view is wrong tomorrow: "shipping this week" saved on Monday means
// last week by the following Monday — and time is what a large share of
// the views a business actually saves are about.
//
// So a condition value may be an EXPRESSION, and the expression is what
// gets stored:
//
//   f-ship-from=@week-start   f-ship-to=@week-end
//   f-ordered-from=@today-7d  f-received-to=@today
//
// The server resolves it per request. The client never does: resolving
// in the browser would put the browser's clock and timezone into the
// answer, and two colleagues opening the same view would see different
// rows.
//
// This module is the demo API's implementation. Real servers resolve in
// the user's timezone (or the organisation's — pick one and say which);
// the wire format is what the contract fixes, not the arithmetic.

const UNIT_DAYS = { d: 1, w: 7 };

/** Anchors that need no arithmetic. */
const ANCHORS = new Set([
  'today',
  'week-start',
  'week-end',
  'month-start',
  'month-end',
  'quarter-start',
  'quarter-end',
  'year-start',
  'year-end',
]);

// Any anchor may take an offset. Period anchors (…-start / …-end) shift
// the reference date FIRST and take the boundary after — "the end of the
// month a month back" is a different thing from "the end of this month,
// minus a month", and only the first one is what anybody means.
const OFFSET = /^([a-z-]+)([+-])(\d+)([dwmy])$/;

function iso(date) {
  return date.toISOString().slice(0, 10);
}

/** UTC midnight for the given Y/M/D, so arithmetic never crosses a DST seam. */
function utc(y, m, d) {
  return new Date(Date.UTC(y, m, d));
}

function startOfWeek(base, weekStartsOn) {
  const day = base.getUTCDay();
  const delta = (day - weekStartsOn + 7) % 7;
  return utc(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - delta);
}

function anchorDate(name, base, weekStartsOn) {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  switch (name) {
    case 'today':
      return utc(y, m, base.getUTCDate());
    case 'week-start':
      return startOfWeek(base, weekStartsOn);
    case 'week-end': {
      const s = startOfWeek(base, weekStartsOn);
      return utc(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 6);
    }
    case 'month-start':
      return utc(y, m, 1);
    case 'month-end':
      return utc(y, m + 1, 0);
    case 'quarter-start':
      return utc(y, Math.floor(m / 3) * 3, 1);
    case 'quarter-end':
      return utc(y, Math.floor(m / 3) * 3 + 3, 0);
    case 'year-start':
      return utc(y, 0, 1);
    case 'year-end':
      return utc(y, 11, 31);
    default:
      return null;
  }
}

function addUnits(date, sign, amount, unit) {
  const n = sign === '-' ? -amount : amount;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  if (unit === 'd' || unit === 'w') return utc(y, m, d + n * UNIT_DAYS[unit]);

  // Months and years CLAMP to the last day of the target month. Letting
  // the Date constructor roll over turns "a month before 31 March" into
  // 3 March — a filter that silently includes a month it was never
  // asked for.
  const targetY = unit === 'y' ? y + n : y;
  const targetM = unit === 'y' ? m : m + n;
  const lastDay = utc(targetY, targetM + 1, 0).getUTCDate();
  return utc(targetY, targetM, Math.min(d, lastDay));
}

/** True for values the server must resolve rather than take literally. */
export function isRelative(value) {
  return typeof value === 'string' && value.startsWith('@');
}

/**
 * Resolve `@…` to an ISO date, or `null` if the expression is not one we
 * know. Callers must treat `null` as an error — never as "no filter".
 *
 * @param {string} value the raw condition value
 * @param {{ now?: Date, weekStartsOn?: number }} [options]
 *   `now` pins the clock (tests, and a request-scoped "now" so every
 *   condition in one request resolves against the same instant);
 *   `weekStartsOn` is 0 for Sunday, 1 for Monday.
 */
export function resolveRelative(value, { now = new Date(), weekStartsOn = 1 } = {}) {
  if (!isRelative(value)) return value;
  const body = value.slice(1);

  if (ANCHORS.has(body)) {
    const date = anchorDate(body, now, weekStartsOn);
    return date ? iso(date) : null;
  }

  const m = OFFSET.exec(body);
  if (!m) return null;
  const [, anchor, sign, amount, unit] = m;
  if (!ANCHORS.has(anchor)) return null;

  if (anchor === 'today') {
    return iso(addUnits(anchorDate('today', now, weekStartsOn), sign, Number(amount), unit));
  }
  // A period anchor: move the reference date, then take the boundary of
  // the period it lands in. `@month-end-1m` is last month's end, and it
  // stays correct in February.
  const shifted = addUnits(
    utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    sign,
    Number(amount),
    unit,
  );
  const date = anchorDate(anchor, shifted, weekStartsOn);
  return date ? iso(date) : null;
}

/** Human wording for the bar — the expression is not for reading raw. */
const LABELS = {
  '@today': 'today',
  '@week-start': 'start of this week',
  '@week-end': 'end of this week',
  '@month-start': 'start of this month',
  '@month-end': 'end of this month',
  '@quarter-start': 'start of this quarter',
  '@quarter-end': 'end of this quarter',
  '@year-start': 'start of this year',
  '@year-end': 'end of this year',
};

/**
 * What the applied-conditions bar shows: the expression in words plus
 * what it resolved to, so a relative condition is never a guess.
 * Returns the ISO date unchanged for absolute values.
 */
export function describeRelative(value, options) {
  if (!isRelative(value)) return value;
  const resolved = resolveRelative(value, options);
  if (resolved == null) return value;
  const known = LABELS[value];
  if (known) return `${known} (${resolved})`;
  const m = OFFSET.exec(value.slice(1));
  if (!m) return `${value} (${resolved})`;
  const [, anchor, sign, amount, unit] = m;
  const units = { d: 'day', w: 'week', m: 'month', y: 'year' }[unit];
  const plural = Number(amount) === 1 ? units : `${units}s`;
  const when = sign === '-' ? 'ago' : 'ahead';
  if (anchor === 'today') return `${amount} ${plural} ${when} (${resolved})`;
  const period = anchor.replace('-start', '').replace('-end', '');
  const edge = anchor.endsWith('-end') ? 'end' : 'start';
  const near =
    Number(amount) === 1 && unit === period[0]
      ? sign === '-'
        ? `last ${period}`
        : `next ${period}`
      : `the ${period} ${amount} ${plural} ${when}`;
  return `${edge} of ${near} (${resolved})`;
}
