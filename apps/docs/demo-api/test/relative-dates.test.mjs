import { describe, expect, it } from 'vitest';
import {
  describeRelative,
  isRelative,
  resolveRelative,
} from '../relative-dates.mjs';

// Wednesday 2026-08-12, so week-start (Monday) is the 10th and
// week-end the 16th — and month/quarter/year boundaries are all
// unambiguous from here.
const NOW = new Date('2026-08-12T09:30:00Z');
const at = (v, opts = {}) => resolveRelative(v, { now: NOW, ...opts });

describe('relative date expressions', () => {
  it('leaves absolute values alone', () => {
    expect(isRelative('2026-08-01')).toBe(false);
    expect(at('2026-08-01')).toBe('2026-08-01');
  });

  it('resolves the anchors', () => {
    expect(at('@today')).toBe('2026-08-12');
    expect(at('@week-start')).toBe('2026-08-10');
    expect(at('@week-end')).toBe('2026-08-16');
    expect(at('@month-start')).toBe('2026-08-01');
    expect(at('@month-end')).toBe('2026-08-31');
    expect(at('@quarter-start')).toBe('2026-07-01');
    expect(at('@quarter-end')).toBe('2026-09-30');
    expect(at('@year-start')).toBe('2026-01-01');
    expect(at('@year-end')).toBe('2026-12-31');
  });

  it('respects the week start', () => {
    expect(at('@week-start', { weekStartsOn: 0 })).toBe('2026-08-09');
    expect(at('@week-end', { weekStartsOn: 0 })).toBe('2026-08-15');
  });

  it('resolves offsets in days, weeks, months and years', () => {
    expect(at('@today-7d')).toBe('2026-08-05');
    expect(at('@today+1d')).toBe('2026-08-13');
    expect(at('@today-2w')).toBe('2026-07-29');
    expect(at('@month-start-1m')).toBe('2026-07-01');
    expect(at('@today-1y')).toBe('2025-08-12');
  });

  it('crosses month and year boundaries correctly', () => {
    const jan1 = new Date('2026-01-01T00:00:00Z');
    expect(resolveRelative('@today-1d', { now: jan1 })).toBe('2025-12-31');
    expect(resolveRelative('@month-end', { now: jan1 })).toBe('2026-01-31');
    // February in a leap year.
    const feb = new Date('2028-02-10T00:00:00Z');
    expect(resolveRelative('@month-end', { now: feb })).toBe('2028-02-29');
  });

  it('offsets from a period anchor shift the period, not the boundary', () => {
    // "End of last month" — the expression a business user actually
    // wants, and the one the first grammar could not express at all.
    expect(at('@month-end-1m')).toBe('2026-07-31');
    expect(at('@month-start-1m')).toBe('2026-07-01');
    expect(at('@week-end-1w')).toBe('2026-08-09');
    expect(at('@year-end-1y')).toBe('2025-12-31');
    expect(at('@quarter-start-3m')).toBe('2026-04-01');
  });

  it('shifting months clamps instead of rolling over', () => {
    // A month before 31 March is 28 February, not 3 March. Rolling over
    // would silently widen the filter by a month.
    const mar31 = new Date('2026-03-31T00:00:00Z');
    expect(resolveRelative('@today-1m', { now: mar31 })).toBe('2026-02-28');
    expect(resolveRelative('@month-end-1m', { now: mar31 })).toBe('2026-02-28');
    // …and it lands on the 29th in a leap year.
    const mar31Leap = new Date('2028-03-31T00:00:00Z');
    expect(resolveRelative('@today-1m', { now: mar31Leap })).toBe('2028-02-29');
    // A year before 29 February is 28 February.
    const feb29 = new Date('2028-02-29T00:00:00Z');
    expect(resolveRelative('@today-1y', { now: feb29 })).toBe('2027-02-28');
  });

  it('describes a period offset in words', () => {
    expect(describeRelative('@month-end-1m', { now: NOW })).toBe(
      'end of last month (2026-07-31)',
    );
    expect(describeRelative('@month-start+1m', { now: NOW })).toBe(
      'start of next month (2026-09-01)',
    );
    expect(describeRelative('@quarter-start-3m', { now: NOW })).toBe(
      'start of the quarter 3 months ago (2026-04-01)',
    );
  });

  it('returns null for anything it does not know — never a fallback', () => {
    // A silently ignored condition would show MORE data than was asked
    // for, so the caller has to treat this as an error.
    expect(at('@next-fiscal-quarter')).toBeNull();
    expect(at('@today-3x')).toBeNull();
    expect(at('@nope-1m')).toBeNull();
    expect(at('@')).toBeNull();
  });

  it('describes an expression in words plus what it resolved to', () => {
    expect(describeRelative('@week-start', { now: NOW })).toBe(
      'start of this week (2026-08-10)',
    );
    expect(describeRelative('@today-7d', { now: NOW })).toBe(
      '7 days ago (2026-08-05)',
    );
    expect(describeRelative('@today+1d', { now: NOW })).toBe(
      '1 day ahead (2026-08-13)',
    );
    expect(describeRelative('2026-08-01', { now: NOW })).toBe('2026-08-01');
  });
});
