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
// Range mode (`data-mode="range"`): the first click / Enter sets the start,
// the next sets the end (auto-swapped so start <= end); a third begins a new
// range. The band paints `data-in-range` between the ends with
// `data-range-start` / `data-range-end` markers, and `data-range-preview*`
// while the second end is still being chosen (pointer or keyboard). Each
// change dispatches `hc:calendarrangechange` with
// `detail { start, end, startDate, endDate }`; `data-value` becomes
// `"START/END"` and `data-name` writes two hidden inputs (`name-start` /
// `name-end`). Single mode stays the default.
//
// installCalendar(root = document) returns an idempotent uninstaller.
// hc-datepicker (the native `<input type="date">` skin) remains the
// no-JS baseline; hc-calendar is the opt-in styled grid.

import { t } from './i18n.js';

import { hasRemovals, pruneDetachers } from './lifecycle.js';

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
  // data-target: a selector for an external field the calendar drives. On
  // each commit the calendar writes the value into it and closes the
  // enclosing popover (if any), so a "custom date field" needs no per-field
  // JavaScript — just markup.
  const target = root.getAttribute('data-target');
  const gridLabel = root.getAttribute('aria-label') || t('calendar.label');

  // data-mode="range" tracks a start / end pair; single (default) tracks one
  // selected date.
  const mode = root.getAttribute('data-mode') === 'range' ? 'range' : 'single';
  // Single source of truth: when `data-value` is omitted but the calendar is
  // linked to a field (`data-target`), inherit the initial selection from
  // that field's current value — so the date is written once on the input,
  // not duplicated here. An explicit `data-value` still wins.
  let dataValue = root.getAttribute('data-value');
  if (!dataValue && target) {
    let initField = null;
    try { initField = doc.querySelector(target); } catch { /* invalid selector */ }
    if (initField && initField.value) dataValue = initField.value;
  }

  const state = { selected: null, start: null, end: null, focused: null };
  if (mode === 'range') {
    let s = root.getAttribute('data-start') || null;
    let e = root.getAttribute('data-end') || null;
    if (!s && dataValue) {
      const parts = dataValue.split('/');
      s = parts[0] || null;
      e = parts[1] || null;
    }
    if (s && e && e < s) [s, e] = [e, s]; // normalise so start <= end
    state.start = s || null;
    state.end = e || null;
    state.focused = state.start || clampToRange(todayISO(), min, max);
  } else {
    state.selected = dataValue || null;
    state.focused = state.selected || clampToRange(todayISO(), min, max);
  }

  const today = todayISO();

  // Quick month / year navigation via dropdowns (opt-in: data-nav="select").
  const navSelect = root.getAttribute('data-nav') === 'select';

  // Intl formatters are locale-stable for the life of the instance.
  const titleFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  const monthLongFmt = new Intl.DateTimeFormat(locale, { month: 'long' });
  const dayLabelFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const wdShortFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const wdLongFmt = new Intl.DateTimeFormat(locale, { weekday: 'long' });

  // Maintain hidden <input>s so the value serialises in a form. Single mode
  // writes one (`name`); range mode writes two (`name-start` / `name-end`).
  function ensureHidden(suffix) {
    const cls = `hc-calendar__value${suffix}`;
    let input = root.querySelector(`:scope > input.${cls}`);
    if (!input) {
      input = doc.createElement('input');
      input.type = 'hidden';
      input.className = cls;
      root.appendChild(input);
    }
    return input;
  }

  function syncHidden() {
    if (!name) return;
    if (mode === 'range') {
      const s = ensureHidden('-start');
      s.name = `${name}-start`;
      s.value = state.start || '';
      const e = ensureHidden('-end');
      e.name = `${name}-end`;
      e.value = state.end || '';
    } else {
      const input = ensureHidden('');
      input.name = name;
      input.value = state.selected || '';
    }
  }

  function dayCells() {
    return root.querySelectorAll('.hc-calendar__day');
  }

  // Live preview of the tentative band while one end is chosen (the other is
  // the hovered / focused day). Transient — cleared on the next render.
  function clearPreview() {
    for (const c of dayCells()) {
      c.removeAttribute('data-range-preview');
      c.removeAttribute('data-range-preview-end');
    }
  }

  function paintPreview(toIso) {
    clearPreview();
    if (mode !== 'range' || !state.start || state.end || !toIso || toIso === state.start) return;
    const lo = state.start < toIso ? state.start : toIso;
    const hi = state.start < toIso ? toIso : state.start;
    for (const c of dayCells()) {
      const iso = c.getAttribute('data-date');
      if (iso >= lo && iso <= hi) c.setAttribute('data-range-preview', '');
      if (iso === toIso) c.setAttribute('data-range-preview-end', '');
    }
  }

  // Build the month + year dropdowns shown in place of the title when
  // data-nav="select". The year range spans data-min..data-max (or the
  // focused year ±10), always including the focused year.
  function buildMonthYearNav(y, m0) {
    const wrap = el(doc, 'div', { class: 'hc-calendar__monthnav' });
    const monthSel = el(doc, 'select', {
      class: 'hc-calendar__month-select', 'aria-label': t('calendar.month'),
    });
    for (let i = 0; i < 12; i += 1) {
      const opt = doc.createElement('option');
      opt.value = String(i);
      opt.textContent = monthLongFmt.format(new Date(2020, i, 1));
      if (i === m0) opt.selected = true;
      monthSel.appendChild(opt);
    }
    const yearSel = el(doc, 'select', {
      class: 'hc-calendar__year-select', 'aria-label': t('calendar.year'),
    });
    const loY = Math.min(min ? partsOf(min).y : y - 10, y);
    const hiY = Math.max(max ? partsOf(max).y : y + 10, y);
    for (let yr = loY; yr <= hiY; yr += 1) {
      const opt = doc.createElement('option');
      opt.value = String(yr);
      opt.textContent = String(yr);
      if (yr === y) opt.selected = true;
      yearSel.appendChild(opt);
    }
    wrap.append(monthSel, yearSel);
    return wrap;
  }

  function render() {
    const { y, m0 } = partsOf(state.focused);

    // Preserve the hidden input(s) (if any) across re-render.
    const hiddenInputs = [...root.querySelectorAll(':scope > input[type="hidden"]')];
    root.replaceChildren();

    const header = el(doc, 'div', { class: 'hc-calendar__header' });
    const middle = navSelect
      ? buildMonthYearNav(y, m0)
      : el(doc, 'span', { class: 'hc-calendar__title', 'aria-live': 'polite' },
          titleFmt.format(new Date(y, m0, 1)));
    header.append(
      el(doc, 'button', {
        class: 'hc-calendar__nav', type: 'button',
        'data-hc-calendar-prev': true, 'aria-label': t('calendar.prevMonth'),
      }, '‹'),
      middle,
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
        if (mode === 'range') {
          const { start, end } = state;
          if (start && end && iso >= start && iso <= end) td.setAttribute('data-in-range', '');
          if (start && iso === start) {
            td.setAttribute('data-range-start', '');
            td.setAttribute('aria-selected', 'true');
          }
          if (end && iso === end) {
            td.setAttribute('data-range-end', '');
            td.setAttribute('aria-selected', 'true');
          }
        } else if (iso === state.selected) {
          td.setAttribute('aria-selected', 'true');
        }
        if (disabled) td.setAttribute('aria-disabled', 'true');
        tr.append(td);
        cursor.setDate(cursor.getDate() + 1);
      }
      tbody.append(tr);
    }
    table.append(tbody);

    root.append(header, table);
    for (const h of hiddenInputs) root.append(h);
    syncHidden();
    // Re-apply the keyboard preview band after the grid is rebuilt.
    if (mode === 'range') paintPreview(state.focused);
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

  // Drive an external field declared via `data-target`: set its value, fire
  // input/change (so forms, validation, and htmx `hx-trigger="change"` see
  // it), and close the enclosing popover so a dropdown date field needs no
  // per-field script. No-op without `data-target`.
  function applyTarget(value) {
    if (!target) return;
    let field = null;
    try { field = doc.querySelector(target); } catch { /* invalid selector → leave null */ }
    if (field) {
      if ('value' in field) field.value = value;
      field.dispatchEvent(new CustomEvent('input', { bubbles: true }));
      field.dispatchEvent(new CustomEvent('change', { bubbles: true }));
    }
    const pop = root.closest('[popover]');
    if (pop && typeof pop.hidePopover === 'function') {
      try { pop.hidePopover(); } catch { /* already closed */ }
    }
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
    applyTarget(iso);
  }

  function dispatchRangeChange() {
    root.dispatchEvent(new CustomEvent('hc:calendarrangechange', {
      bubbles: true,
      detail: {
        start: state.start,
        end: state.end,
        startDate: state.start ? fromParts(partsOf(state.start)) : null,
        endDate: state.end ? fromParts(partsOf(state.end)) : null,
      },
    }));
  }

  function selectRange(iso) {
    if (!inRange(iso, min, max)) return;
    if (!state.start || (state.start && state.end)) {
      // Begin a new range.
      state.start = iso;
      state.end = null;
    } else if (iso < state.start) {
      // Second click before the start — swap so start <= end.
      state.end = state.start;
      state.start = iso;
    } else {
      state.end = iso;
    }
    state.focused = iso;
    root.setAttribute('data-value', state.end ? `${state.start}/${state.end}` : state.start);
    render();
    focusDay(iso);
    dispatchRangeChange();
    // Only drive the field / close the popover once a full range is picked.
    if (state.start && state.end) applyTarget(`${state.start}/${state.end}`);
  }

  function commit(iso) {
    if (mode === 'range') selectRange(iso);
    else select(iso);
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
      commit(day.getAttribute('data-date'));
    }
  }

  // Range preview follows the pointer while one end is chosen.
  function onPointerover(event) {
    if (mode !== 'range' || !state.start || state.end) return;
    const day = event.target.closest?.('.hc-calendar__day');
    if (day && day.getAttribute('aria-disabled') !== 'true') {
      paintPreview(day.getAttribute('data-date'));
    }
  }

  function onPointerleave() {
    if (mode === 'range') paintPreview(state.focused);
  }

  function onChange(event) {
    const isMonth = event.target.classList?.contains?.('hc-calendar__month-select');
    const isYear = event.target.classList?.contains?.('hc-calendar__year-select');
    if (!isMonth && !isYear) return;
    const { y, m0 } = partsOf(state.focused);
    const newM = isMonth ? Number(event.target.value) : m0;
    const newY = isYear ? Number(event.target.value) : y;
    state.focused = clampToRange(isoOf(newY, newM, 1), min, max);
    render();
    root
      .querySelector(isMonth ? '.hc-calendar__month-select' : '.hc-calendar__year-select')
      ?.focus();
  }

  function onKeydown(event) {
    const day = event.target.closest('.hc-calendar__day');
    if (!day) return;
    const cur = state.focused;
    // In RTL the grid runs right-to-left, so the horizontal arrows are
    // mirrored (ArrowLeft = next day); vertical arrows are not.
    let key = event.key;
    if (getComputedStyle(root).direction === 'rtl') {
      if (key === 'ArrowRight') key = 'ArrowLeft';
      else if (key === 'ArrowLeft') key = 'ArrowRight';
    }
    switch (key) {
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
        commit(cur);
        break;
      default:
        break;
    }
  }

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeydown);
  if (navSelect) root.addEventListener('change', onChange);
  if (mode === 'range') {
    root.addEventListener('pointerover', onPointerover);
    root.addEventListener('pointerleave', onPointerleave);
  }
  render();

  detachers.set(root, () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeydown);
    root.removeEventListener('change', onChange);
    root.removeEventListener('pointerover', onPointerover);
    root.removeEventListener('pointerleave', onPointerleave);
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
      // A batch that removed nodes may have swapped instances away —
      // run their detachers and let go of them (see lifecycle.js).
      if (hasRemovals(records)) pruneDetachers(detachers);
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
