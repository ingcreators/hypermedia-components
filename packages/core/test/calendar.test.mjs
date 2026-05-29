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
