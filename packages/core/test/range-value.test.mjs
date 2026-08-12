import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  installRangeValue,
  splitRange,
  joinRange,
} from '../src/js/range-value.js';

let uninstall = () => {};

const FIXTURE = `
  <form id="filters">
    <input name="f-status" id="status" value="open">
    <div data-hc-range="f-ship">
      <input type="date" name="f-ship-from" id="from" value="2026-07-01">
      <input type="date" name="f-ship-to" id="to" value="2026-07-31">
    </div>
    <input name="f-carrier" id="carrier" value="road">
  </form>
`;

// jsdom implements FormData but not the `formdata` event, so build the
// entry list by hand and dispatch the event the way a browser would
// while constructing `new FormData(form)` — the same helper shape the
// multi-value and format tests use. Real-browser firing is pinned by
// test-browser/range-value.spec.mjs across all three engines.
function serialize(form) {
  const formData = new FormData();
  for (const el of form.elements) {
    if (el.name && !el.disabled && el.value !== undefined && el.type !== 'submit') {
      formData.append(el.name, el.value);
    }
  }
  const event = new Event('formdata', { bubbles: true });
  event.formData = formData;
  form.dispatchEvent(event);
  return [...formData.entries()];
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

describe('splitRange', () => {
  it('splits both ends', () => {
    expect(splitRange('2026-07-01..2026-07-31')).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('keeps an open end open', () => {
    expect(splitRange('2026-07-01..')).toEqual({ from: '2026-07-01', to: '' });
    expect(splitRange('..2026-07-31')).toEqual({ from: '', to: '2026-07-31' });
  });

  it('reads a bare value as a single point', () => {
    expect(splitRange('2026-07-01')).toEqual({
      from: '2026-07-01',
      to: '2026-07-01',
    });
  });

  it('survives relative expressions on either end', () => {
    expect(splitRange('@month-start-1m..@month-end-1m')).toEqual({
      from: '@month-start-1m',
      to: '@month-end-1m',
    });
    expect(splitRange('@month-start-1m..2026-07-15')).toEqual({
      from: '@month-start-1m',
      to: '2026-07-15',
    });
  });
});

describe('joinRange', () => {
  it('joins with the separator', () => {
    expect(joinRange('2026-07-01', '2026-07-31')).toBe(
      '2026-07-01..2026-07-31',
    );
  });

  it('keeps an open end open', () => {
    expect(joinRange('2026-07-01', '')).toBe('2026-07-01..');
    expect(joinRange('', '2026-07-31')).toBe('..2026-07-31');
  });

  it('two empty ends are not a condition', () => {
    expect(joinRange('', '')).toBe('');
    expect(joinRange('  ', null)).toBe('');
  });
});

describe('installRangeValue', () => {
  it('sends one param, where the pair started', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installRangeValue();
    expect(serialize(document.getElementById('filters'))).toEqual([
      ['f-status', 'open'],
      ['f-ship', '2026-07-01..2026-07-31'],
      ['f-carrier', 'road'],
    ]);
  });

  it('keeps an open end open', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installRangeValue();
    document.getElementById('to').value = '';
    expect(
      serialize(document.getElementById('filters')).find(
        ([name]) => name === 'f-ship',
      ),
    ).toEqual(['f-ship', '2026-07-01..']);
  });

  it('an emptied range disappears rather than arriving as ".."', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installRangeValue();
    document.getElementById('from').value = '';
    document.getElementById('to').value = '';
    const names = serialize(document.getElementById('filters')).map(([n]) => n);
    expect(names).toEqual(['f-status', 'f-carrier']);
  });

  it('marks a reversed range invalid instead of swapping it', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installRangeValue();
    const to = document.getElementById('to');
    to.value = '2026-06-01';
    to.dispatchEvent(new Event('change', { bubbles: true }));

    expect(to.validationMessage).not.toBe('');
    expect(to.getAttribute('aria-invalid')).toBe('true');
    // The values are exactly what was typed — nothing was reordered.
    expect(
      serialize(document.getElementById('filters')).find(
        ([name]) => name === 'f-ship',
      ),
    ).toEqual(['f-ship', '2026-07-01..2026-06-01']);
  });

  it('clears the refusal once the range is the right way round', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installRangeValue();
    const to = document.getElementById('to');
    to.value = '2026-06-01';
    to.dispatchEvent(new Event('change', { bubbles: true }));
    to.value = '2026-08-01';
    to.dispatchEvent(new Event('change', { bubbles: true }));

    expect(to.validationMessage).toBe('');
    expect(to.hasAttribute('aria-invalid')).toBe(false);
  });

  it('does not judge an end it cannot compare as written', () => {
    // A relative expression is the server's to resolve; a lone end has
    // nothing to be reversed against.
    document.body.innerHTML = `
      <form id="filters">
        <div data-hc-range="f-ship">
          <input name="f-ship-from" id="from" value="@month-end-1m">
          <input name="f-ship-to" id="to" value="2026-01-01">
        </div>
      </form>`;
    uninstall = installRangeValue();
    const to = document.getElementById('to');
    to.dispatchEvent(new Event('change', { bubbles: true }));
    expect(to.validationMessage).toBe('');
    expect(serialize(document.getElementById('filters'))).toEqual([
      ['f-ship', '@month-end-1m..2026-01-01'],
    ]);
  });

  it('compares numbers as numbers', () => {
    document.body.innerHTML = `
      <form id="filters">
        <div data-hc-range="f-amount">
          <input type="number" name="f-amount-from" id="from" value="100">
          <input type="number" name="f-amount-to" id="to" value="20">
        </div>
      </form>`;
    uninstall = installRangeValue();
    const to = document.getElementById('to');
    to.dispatchEvent(new Event('change', { bubbles: true }));
    // Lexically "100" > "20"; numerically it is the reversal it looks
    // like. The opposite case must NOT be refused:
    expect(to.validationMessage).not.toBe('');
    to.value = '1000';
    to.dispatchEvent(new Event('change', { bubbles: true }));
    expect(to.validationMessage).toBe('');
  });

  it('finds the ends by marker attribute when the names differ', () => {
    document.body.innerHTML = `
      <form id="filters">
        <div data-hc-range="f-ship">
          <input name="start" data-hc-range-from value="2026-07-01">
          <input name="end" data-hc-range-to value="2026-07-31">
        </div>
      </form>`;
    uninstall = installRangeValue();
    expect(serialize(document.getElementById('filters'))).toEqual([
      ['f-ship', '2026-07-01..2026-07-31'],
    ]);
  });

  it('leaves a group alone when an end is missing or disabled', () => {
    document.body.innerHTML = `
      <form id="filters">
        <div data-hc-range="f-ship">
          <input name="f-ship-from" value="2026-07-01">
        </div>
        <div data-hc-range="f-due">
          <input name="f-due-from" value="2026-07-01" disabled>
          <input name="f-due-to" value="2026-07-31">
        </div>
      </form>`;
    uninstall = installRangeValue();
    expect(serialize(document.getElementById('filters'))).toEqual([
      ['f-ship-from', '2026-07-01'],
      ['f-due-to', '2026-07-31'],
    ]);
  });

  it('is idempotent and uninstalls cleanly', () => {
    document.body.innerHTML = FIXTURE;
    const first = installRangeValue();
    const second = installRangeValue();
    expect(second).toBe(first);
    expect(
      serialize(document.getElementById('filters')).filter(
        ([name]) => name === 'f-ship',
      ),
    ).toHaveLength(1);

    first();
    uninstall = () => {};
    // Back to the no-JS wire: the pair submits under its own names.
    expect(serialize(document.getElementById('filters'))).toEqual([
      ['f-status', 'open'],
      ['f-ship-from', '2026-07-01'],
      ['f-ship-to', '2026-07-31'],
      ['f-carrier', 'road'],
    ]);
  });
});
