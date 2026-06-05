// installCalendar — behavior for a styled month-grid date picker.
//
// Renders a month grid into every `.hc-calendar` container and wires
// the WAI-ARIA APG date-picker keyboard model. You author only the
// container with `data-*` config; the behavior renders the header
// (prev / title / next), the localized weekday row, and a six-week
// grid of `<td role="gridcell">` day cells managed by a roving
// tabindex.
//
//   <div class="hc-calendar"
//        data-value="2026-05-29"   <!-- selected date (ISO), optional -->
//        data-min="2026-01-01" data-max="2026-12-31"  <!-- optional -->
//        data-first-day="0"        <!-- 0=Sunday (default) … 6=Saturday -->
//        data-locale="ja-JP"       <!-- optional; falls back to <html lang> -->
//        data-name="due"           <!-- optional; writes a hidden input -->
//        aria-label="Choose a date"></div>
//
// Keyboard (focus on a day cell): ← → ±1 day, ↑ ↓ ±7 days, Home / End
// first / last day of the week, PageUp / PageDown ∓1 month,
// Shift+PageUp / Shift+PageDown ∓1 year, Enter / Space select. Days
// outside `data-min` / `data-max` are `aria-disabled` and not
// selectable. Month / year names come from `Intl.DateTimeFormat`; the
// first day of the week is `data-first-day` (not `Intl…weekInfo`, which
// is not Baseline).
//
// Selecting dispatches a bubbling `hc:calendarchange` on the container
// with `detail { value: 'YYYY-MM-DD', date: Date }`, syncs `data-value`,
// and (with `data-name`) a hidden `<input>` so it serialises in a form.
//
// installCalendar(root = document) returns an idempotent uninstaller.
// hc-datepicker (the native `<input type="date">` skin) remains the
// no-JS baseline; hc-calendar is the opt-in styled grid.

import { t } from './i18n.js';

const INSTALL_KEY = '__hcCalendarUninstall';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

function partsOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m0: m - 1, d };
}

function fromParts({ y, m0, d }) {
  return new Date(y, m0, d);
}

function toISO(date) {
  return isoOf(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(iso, n) {
  const { y, m0, d } = partsOf(iso);
  return toISO(new Date(y, m0, d + n));
}

function addMonths(iso, n) {
  const { y, m0, d } = partsOf(iso);
  const first = new Date(y, m0 + n, 1);
  const daysInTarget = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return isoOf(first.getFullYear(), first.getMonth(), Math.min(d, daysInTarget));
}

function startOfWeek(iso, firstDay) {
  const weekday = fromParts(partsOf(iso)).getDay();
  return addDays(iso, -(((weekday - firstDay) % 7 + 7) % 7));
}

function inRange(iso, min, max) {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

function clampToRange(iso, min, max) {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

function todayISO() {
  const t = new Date();
  return isoOf(t.getFullYear(), t.getMonth(), t.getDate());
}

function el(doc, tag, attrs = {}, text) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) node.setAttribute(k, '');
    else if (v != null && v !== false) node.setAttribute(k, String(v));
  }
  if (text != null) node.textContent = text;
  return node;
}

function findHiddenInput(root) {
  let input = root.querySelector(':scope > input[type="hidden"].hc-calendar__value');
  if (!input) {
    input = root.ownerDocument.createElement('input');
    input.type = 'hidden';
    input.className = 'hc-calendar__value';
    root.appendChild(input);
  }
  return input;
}

function attach(root, detachers) {
  if (detachers.has(root)) return;

  const doc = root.ownerDocument;
  const firstDay = Math.max(0, Math.min(6, Number(root.getAttribute('data-first-day')) || 0));
  const locale = root.getAttribute('data-locale')
    || doc.documentElement.getAttribute('lang')
    || undefined;
  const min = root.getAttribute('data-min') || null;
  const max = root.getAttribute('data-max') || null;
  const name = root.getAttribute('data-name');
  const gridLabel = root.getAttribute('aria-label') || t('calendar.label');

  const state = {
    selected: root.getAttribute('data-value') || null,
    focused: null,
  };
  state.focused = state.selected || clampToRange(todayISO(), min, max);

  const today = todayISO();

  // Intl formatters are locale-stable for the life of the instance.
  const titleFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  const dayLabelFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const wdShortFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const wdLongFmt = new Intl.DateTimeFormat(locale, { weekday: 'long' });

  function syncHidden() {
    if (!name) return;
    const input = findHiddenInput(root);
    input.name = name;
    input.value = state.selected || '';
  }

  function render() {
    const { y, m0 } = partsOf(state.focused);

    // Preserve the hidden input (if any) across re-render.
    const hidden = root.querySelector(':scope > input.hc-calendar__value');
    root.replaceChildren();

    const header = el(doc, 'div', { class: 'hc-calendar__header' });
    header.append(
      el(doc, 'button', {
        class: 'hc-calendar__nav', type: 'button',
        'data-hc-calendar-prev': true, 'aria-label': t('calendar.prevMonth'),
      }, '‹'),
      el(doc, 'span', { class: 'hc-calendar__title', 'aria-live': 'polite' },
        titleFmt.format(new Date(y, m0, 1))),
      el(doc, 'button', {
        class: 'hc-calendar__nav', type: 'button',
        'data-hc-calendar-next': true, 'aria-label': t('calendar.nextMonth'),
      }, '›'),
    );

    const table = el(doc, 'table', { class: 'hc-calendar__grid', role: 'grid', 'aria-label': gridLabel });
    const thead = el(doc, 'thead');
    const htr = el(doc, 'tr', { role: 'row' });
    for (let i = 0; i < 7; i++) {
      const wd = (firstDay + i) % 7;
      const ref = new Date(2023, 0, 1 + wd); // 2023-01-01 is a Sunday
      htr.append(el(doc, 'th', { scope: 'col', abbr: wdLongFmt.format(ref) }, wdShortFmt.format(ref)));
    }
    thead.append(htr);
    table.append(thead);

    const tbody = el(doc, 'tbody');
    const firstWeekday = new Date(y, m0, 1).getDay();
    const lead = ((firstWeekday - firstDay) % 7 + 7) % 7;
    const cursor = new Date(y, m0, 1 - lead);
    for (let week = 0; week < 6; week++) {
      const tr = el(doc, 'tr', { role: 'row' });
      for (let dow = 0; dow < 7; dow++) {
        const iso = toISO(cursor);
        const outside = cursor.getMonth() !== m0;
        const disabled = !inRange(iso, min, max);
        const td = el(doc, 'td', {
          class: 'hc-calendar__day',
          role: 'gridcell',
          'data-date': iso,
          'aria-label': dayLabelFmt.format(cursor),
          tabindex: iso === state.focused ? '0' : '-1',
        }, String(cursor.getDate()));
        if (outside) td.setAttribute('data-outside', '');
        if (iso === today) td.setAttribute('data-today', '');
        if (iso === state.selected) td.setAttribute('aria-selected', 'true');
        if (disabled) td.setAttribute('aria-disabled', 'true');
        tr.append(td);
        cursor.setDate(cursor.getDate() + 1);
      }
      tbody.append(tr);
    }
    table.append(tbody);

    root.append(header, table);
    if (hidden) root.append(hidden);
    syncHidden();
  }

  function focusDay(iso) {
    const cell = root.querySelector(`.hc-calendar__day[data-date="${iso}"]`);
    cell?.focus();
  }

  function setFocused(iso, { focus = true } = {}) {
    state.focused = iso;
    render();
    if (focus) focusDay(iso);
  }

  function select(iso) {
    if (!inRange(iso, min, max)) return;
    state.selected = iso;
    state.focused = iso;
    root.setAttribute('data-value', iso);
    render();
    focusDay(iso);
    root.dispatchEvent(new CustomEvent('hc:calendarchange', {
      bubbles: true,
      detail: { value: iso, date: fromParts(partsOf(iso)) },
    }));
  }

  function onClick(event) {
    if (event.target.closest('[data-hc-calendar-prev]')) {
      state.focused = addMonths(state.focused, -1);
      render();
      root.querySelector('[data-hc-calendar-prev]')?.focus();
      return;
    }
    if (event.target.closest('[data-hc-calendar-next]')) {
      state.focused = addMonths(state.focused, +1);
      render();
      root.querySelector('[data-hc-calendar-next]')?.focus();
      return;
    }
    const day = event.target.closest('.hc-calendar__day');
    if (day && day.getAttribute('aria-disabled') !== 'true') {
      select(day.getAttribute('data-date'));
    }
  }

  function onKeydown(event) {
    const day = event.target.closest('.hc-calendar__day');
    if (!day) return;
    const cur = state.focused;
    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); setFocused(addDays(cur, -1)); break;
      case 'ArrowRight': event.preventDefault(); setFocused(addDays(cur, +1)); break;
      case 'ArrowUp': event.preventDefault(); setFocused(addDays(cur, -7)); break;
      case 'ArrowDown': event.preventDefault(); setFocused(addDays(cur, +7)); break;
      case 'Home': event.preventDefault(); setFocused(startOfWeek(cur, firstDay)); break;
      case 'End': event.preventDefault(); setFocused(addDays(startOfWeek(cur, firstDay), 6)); break;
      case 'PageUp': event.preventDefault(); setFocused(addMonths(cur, event.shiftKey ? -12 : -1)); break;
      case 'PageDown': event.preventDefault(); setFocused(addMonths(cur, event.shiftKey ? +12 : +1)); break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        select(cur);
        break;
      default:
        break;
    }
  }

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeydown);
  render();

  detachers.set(root, () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeydown);
  });
}

/**
 * Install the calendar behavior on every `.hc-calendar` container in the
 * document. The returned uninstaller is idempotent and a no-op when the
 * behavior is not installed.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installCalendar(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const element of root.querySelectorAll('.hc-calendar')) attach(element, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-calendar')) attach(node, detachers);
          node.querySelectorAll?.('.hc-calendar').forEach((element) => attach(element, detachers));
        }
      }
    });
    observer.observe(root.body ?? root, { childList: true, subtree: true });
  }

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    if (observer) observer.disconnect();
    for (const detach of detachers.values()) detach();
    detachers.clear();
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
