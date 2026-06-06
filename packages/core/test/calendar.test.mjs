import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installCalendar } from '../src/js/calendar.js';

let uninstall = () => {};

// data-value pins the displayed month so tests are deterministic.
const FIXTURE = `
  <div class="hc-calendar" data-value="2026-05-15" data-name="due"
       data-first-day="0" data-locale="en-US" aria-label="Pick a date"></div>
`;

function cal() {
  return document.querySelector('.hc-calendar');
}
function cell(iso) {
  return document.querySelector(`.hc-calendar__day[data-date="${iso}"]`);
}
function title() {
  return document.querySelector('.hc-calendar__title').textContent;
}
function press(el, key, opts = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}
function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installCalendar', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIXTURE;
    const u1 = installCalendar();
    const u2 = installCalendar();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('renders a grid: title, 7 weekday headers, 42 day cells', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    expect(title()).toBe('May 2026');
    expect(document.querySelector('.hc-calendar__grid').getAttribute('role')).toBe('grid');
    expect(document.querySelectorAll('.hc-calendar__grid th')).toHaveLength(7);
    expect(document.querySelectorAll('.hc-calendar__day')).toHaveLength(42);
  });

  it('orders weekday headers from data-first-day', () => {
    document.body.innerHTML = FIXTURE; // first-day=0 (Sunday)
    uninstall = installCalendar();
    expect(document.querySelector('.hc-calendar__grid th').textContent).toBe('Sun');
    uninstall();

    document.body.innerHTML = FIXTURE.replace('data-first-day="0"', 'data-first-day="1"');
    uninstall = installCalendar();
    expect(document.querySelector('.hc-calendar__grid th').textContent).toBe('Mon');
  });

  it('marks the selected date with aria-selected and the roving tab stop', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    expect(cell('2026-05-15').getAttribute('aria-selected')).toBe('true');
    expect(cell('2026-05-15').getAttribute('tabindex')).toBe('0');
    expect(cell('2026-05-14').getAttribute('tabindex')).toBe('-1');
  });

  it('renders adjacent-month days as outside, and a hidden input from data-name', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    expect(document.querySelector('.hc-calendar__day[data-outside]')).toBeTruthy();
    const hidden = cal().querySelector('input[type="hidden"]');
    expect(hidden.name).toBe('due');
    expect(hidden.value).toBe('2026-05-15');
  });

  it('clicking a day selects it: aria-selected, data-value, hidden input, event', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    const detail = vi.fn();
    cal().addEventListener('hc:calendarchange', (e) => detail(e.detail));

    click(cell('2026-05-20'));

    expect(cell('2026-05-20').getAttribute('aria-selected')).toBe('true');
    expect(cell('2026-05-15').hasAttribute('aria-selected')).toBe(false);
    expect(cal().getAttribute('data-value')).toBe('2026-05-20');
    expect(cal().querySelector('input[type="hidden"]').value).toBe('2026-05-20');
    expect(detail).toHaveBeenCalledTimes(1);
    expect(detail.mock.calls[0][0].value).toBe('2026-05-20');
    expect(detail.mock.calls[0][0].date).toBeInstanceOf(Date);
  });

  it('prev / next buttons change the displayed month', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    click(document.querySelector('[data-hc-calendar-prev]'));
    expect(title()).toBe('April 2026');
    click(document.querySelector('[data-hc-calendar-next]'));
    click(document.querySelector('[data-hc-calendar-next]'));
    expect(title()).toBe('June 2026');
  });

  it('arrow keys move the focused day and cross month boundaries', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    press(cell('2026-05-15'), 'ArrowRight');
    expect(cell('2026-05-16').getAttribute('tabindex')).toBe('0');
    press(cell('2026-05-16'), 'ArrowDown'); // +7 → 23
    expect(cell('2026-05-23').getAttribute('tabindex')).toBe('0');

    // Step deterministically to 05-31, then one more day into June.
    press(cell('2026-05-23'), 'ArrowDown'); // → 30
    press(cell('2026-05-30'), 'ArrowRight'); // → 31
    press(cell('2026-05-31'), 'ArrowRight'); // → June 1 (re-renders to June)
    expect(title()).toBe('June 2026');
    expect(cell('2026-06-01').getAttribute('tabindex')).toBe('0');
  });

  it('PageDown / Shift+PageDown move by month / year', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    press(cell('2026-05-15'), 'PageDown');
    expect(title()).toBe('June 2026');
    press(cell('2026-06-15'), 'PageDown', { shiftKey: true });
    expect(title()).toBe('June 2027');
  });

  it('Home / End move to the first / last day of the week', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    press(cell('2026-05-15'), 'Home');
    const home = document.activeElement;
    expect(new Date(home.getAttribute('data-date')).getDay()).toBe(0); // Sunday (first-day=0)
    press(home, 'End');
    expect(new Date(document.activeElement.getAttribute('data-date')).getDay()).toBe(6); // Saturday
  });

  it('Enter selects the focused day', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    press(cell('2026-05-15'), 'ArrowRight'); // focus 16
    press(cell('2026-05-16'), 'Enter');
    expect(cell('2026-05-16').getAttribute('aria-selected')).toBe('true');
  });

  it('disables and refuses selection outside data-min / data-max', () => {
    document.body.innerHTML = FIXTURE
      .replace('data-name="due"', 'data-min="2026-05-10" data-max="2026-05-20"');
    uninstall = installCalendar();
    const detail = vi.fn();
    cal().addEventListener('hc:calendarchange', detail);

    expect(cell('2026-05-05').getAttribute('aria-disabled')).toBe('true');
    expect(cell('2026-05-25').getAttribute('aria-disabled')).toBe('true');
    expect(cell('2026-05-15').hasAttribute('aria-disabled')).toBe(false);

    click(cell('2026-05-05')); // disabled → no-op
    expect(detail).not.toHaveBeenCalled();
    expect(cal().getAttribute('data-value')).toBe('2026-05-15');
  });

  it('marks today', () => {
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    document.body.innerHTML = `<div class="hc-calendar" data-value="${iso}" aria-label="Cal"></div>`;
    uninstall = installCalendar();
    expect(cell(iso).hasAttribute('data-today')).toBe(true);
  });

  it('uninstall removes the listeners', () => {
    document.body.innerHTML = FIXTURE;
    const u = installCalendar();
    u();
    const detail = vi.fn();
    cal().addEventListener('hc:calendarchange', detail);
    click(cell('2026-05-20'));
    expect(detail).not.toHaveBeenCalled();
  });

  it('picks up a calendar added to the DOM after install (MutationObserver)', async () => {
    uninstall = installCalendar();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.hc-calendar__grid')).toBeTruthy();
  });
});

describe('installCalendar — range mode', () => {
  // Pre-selected range 2026-05-10 .. 2026-05-14 (May pinned for determinism).
  const RANGE = `
    <div class="hc-calendar" data-mode="range" data-value="2026-05-10/2026-05-14"
         data-name="stay" data-first-day="0" data-locale="en-US" aria-label="Stay"></div>
  `;
  const hidden = (n) => cal().querySelector(`input[type="hidden"][name="${n}"]`);

  it('parses data-value="START/END" and paints the band with both ends', () => {
    document.body.innerHTML = RANGE;
    uninstall = installCalendar();
    expect(cell('2026-05-10').getAttribute('data-range-start')).toBe('');
    expect(cell('2026-05-10').getAttribute('aria-selected')).toBe('true');
    expect(cell('2026-05-14').getAttribute('data-range-end')).toBe('');
    expect(cell('2026-05-14').getAttribute('aria-selected')).toBe('true');
    expect(cell('2026-05-12').hasAttribute('data-in-range')).toBe(true);
    expect(cell('2026-05-09').hasAttribute('data-in-range')).toBe(false);
  });

  it('writes two hidden inputs (name-start / name-end)', () => {
    document.body.innerHTML = RANGE;
    uninstall = installCalendar();
    expect(hidden('stay-start').value).toBe('2026-05-10');
    expect(hidden('stay-end').value).toBe('2026-05-14');
  });

  it('first click starts a new range; the second sets the end', () => {
    document.body.innerHTML = RANGE;
    uninstall = installCalendar();

    click(cell('2026-05-20')); // both ends were set → begin a new range
    expect(cell('2026-05-20').getAttribute('data-range-start')).toBe('');
    expect(cell('2026-05-22').hasAttribute('data-in-range')).toBe(false);
    expect(cal().getAttribute('data-value')).toBe('2026-05-20');

    click(cell('2026-05-22'));
    expect(cell('2026-05-22').getAttribute('data-range-end')).toBe('');
    expect(cell('2026-05-21').hasAttribute('data-in-range')).toBe(true);
    expect(cal().getAttribute('data-value')).toBe('2026-05-20/2026-05-22');
    expect(hidden('stay-start').value).toBe('2026-05-20');
    expect(hidden('stay-end').value).toBe('2026-05-22');
  });

  it('clicking before the start swaps the ends so start <= end', () => {
    document.body.innerHTML = RANGE;
    uninstall = installCalendar();
    click(cell('2026-05-20')); // new start
    click(cell('2026-05-18')); // earlier than start → swap
    expect(cell('2026-05-18').getAttribute('data-range-start')).toBe('');
    expect(cell('2026-05-20').getAttribute('data-range-end')).toBe('');
    expect(cal().getAttribute('data-value')).toBe('2026-05-18/2026-05-20');
  });

  it('emits hc:calendarrangechange with start / end / Date objects', () => {
    document.body.innerHTML = RANGE;
    uninstall = installCalendar();
    const detail = vi.fn();
    cal().addEventListener('hc:calendarrangechange', (e) => detail(e.detail));

    click(cell('2026-05-20'));
    expect(detail.mock.calls[0][0]).toMatchObject({ start: '2026-05-20', end: null });

    click(cell('2026-05-22'));
    const d = detail.mock.calls[1][0];
    expect(d.start).toBe('2026-05-20');
    expect(d.end).toBe('2026-05-22');
    expect(d.startDate).toBeInstanceOf(Date);
    expect(d.endDate).toBeInstanceOf(Date);
  });

  it('keyboard: Enter sets the start, then the end after moving focus', () => {
    document.body.innerHTML = RANGE;
    uninstall = installCalendar();
    press(cell('2026-05-10'), 'Enter'); // focused start → begin new range at 10
    expect(cell('2026-05-10').getAttribute('data-range-start')).toBe('');
    expect(cell('2026-05-14').hasAttribute('data-range-end')).toBe(false);

    press(cell('2026-05-10'), 'ArrowRight'); // focus 11
    press(cell('2026-05-11'), 'Enter');
    expect(cell('2026-05-11').getAttribute('data-range-end')).toBe('');
    expect(cell('2026-05-10').getAttribute('data-range-start')).toBe('');
  });

  it('previews the tentative band while choosing the second end (keyboard)', () => {
    document.body.innerHTML = RANGE;
    uninstall = installCalendar();
    click(cell('2026-05-20')); // start a new range
    press(cell('2026-05-20'), 'ArrowRight'); // focus 21 → preview 20..21
    expect(cell('2026-05-21').getAttribute('data-range-preview-end')).toBe('');
    expect(cell('2026-05-21').hasAttribute('data-range-preview')).toBe(true);
  });

  it('refuses a range endpoint outside data-min / data-max', () => {
    document.body.innerHTML = RANGE.replace(
      'data-name="stay"',
      'data-min="2026-05-12" data-max="2026-05-25"',
    );
    uninstall = installCalendar();
    const detail = vi.fn();
    cal().addEventListener('hc:calendarrangechange', detail);
    expect(cell('2026-05-05').getAttribute('aria-disabled')).toBe('true');
    click(cell('2026-05-05')); // disabled → no-op
    expect(detail).not.toHaveBeenCalled();
  });
});

describe('installCalendar — month / year quick nav', () => {
  // data-value 2026-05-15 → May (m0 = 4) 2026.
  const NAV = FIXTURE.replace('class="hc-calendar"', 'class="hc-calendar" data-nav="select"');
  const monthSel = () => document.querySelector('.hc-calendar__month-select');
  const yearSel = () => document.querySelector('.hc-calendar__year-select');
  function changeSelect(sel, value) {
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('replaces the title with month + year dropdowns reflecting the focused month', () => {
    document.body.innerHTML = NAV;
    uninstall = installCalendar();
    expect(document.querySelector('.hc-calendar__title')).toBeNull();
    expect(monthSel().value).toBe('4'); // May (0-indexed)
    expect(yearSel().value).toBe('2026');
    expect(monthSel().options).toHaveLength(12);
  });

  it('changing the month dropdown navigates to that month', () => {
    document.body.innerHTML = NAV;
    uninstall = installCalendar();
    changeSelect(monthSel(), '0'); // January
    expect(monthSel().value).toBe('0'); // re-rendered
    expect(cell('2026-01-01')).toBeTruthy();
  });

  it('changing the year dropdown navigates to that year', () => {
    document.body.innerHTML = NAV;
    uninstall = installCalendar();
    changeSelect(yearSel(), '2030');
    expect(yearSel().value).toBe('2030');
    expect(cell('2030-05-01')).toBeTruthy();
  });

  it('bounds the year range by data-min / data-max', () => {
    document.body.innerHTML = NAV.replace(
      'data-value="2026-05-15"',
      'data-value="2026-05-15" data-min="2025-01-01" data-max="2027-12-31"',
    );
    uninstall = installCalendar();
    const years = [...yearSel().options].map((o) => o.value);
    expect(years).toEqual(['2025', '2026', '2027']);
  });

  it('does not add dropdowns without data-nav="select"', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCalendar();
    expect(document.querySelector('.hc-calendar__month-select')).toBeNull();
    expect(document.querySelector('.hc-calendar__title')).toBeTruthy();
  });
});
