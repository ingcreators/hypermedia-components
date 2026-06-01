// installDatagrid — behavior for hc-datagrid.
//
// Upgrades a server-rendered semantic <table class="hc-datagrid__table">
// into an interactive grid. It does three things and never touches the
// network (pagination / persistence stay with htmx / the server):
//
//   1. Measures the rendered header-row heights and frozen-column widths
//      and writes them back as the sticky offset variables
//      (--hc-datagrid-head-1-h / -2-h, per-cell --hc-datagrid-left), so the
//      CSS sticky positions match the real layout. Re-measures on resize.
//      Also sets scroll-padding so keyboard scrolling clears the sticky
//      header / frozen edge.
//
//   2. Applies the WAI-ARIA grid roles and a roving tabindex over the body
//      cells. Arrow keys / Home / End / Ctrl+Home·End / PageUp·Down move
//      the active cell; the grid is a single tab stop.
//
//   3. Row selection: Space toggles the active row's checkbox and
//      aria-selected; the header select-all checkbox toggles every row.
//      Emits `hc:datagridselectionchange` on the grid.
//
// installDatagrid(root = document) returns an uninstaller. Repeated calls
// on the same root return the same uninstaller (idempotent).

const INSTALL_KEY = '__hcDatagridUninstall';
const WIDGETS = 'input, button, select, textarea, a[href]';

// Every physical body row — across the single `.hc-datagrid__body` and any
// `.hc-datagrid__record` tbodies (multi-row records). These become the
// navigation matrix rows; non-uniform widths are fine (nav clamps).
function bodyRows(grid) {
  return [
    ...grid.querySelectorAll(
      '.hc-datagrid__body > .hc-datagrid__row, .hc-datagrid__record > .hc-datagrid__row',
    ),
  ];
}

// The selectable units. With `.hc-datagrid__record` tbodies each record is
// one unit (it may span several physical rows); otherwise each row is a unit.
function recordUnits(grid) {
  const records = [...grid.querySelectorAll('.hc-datagrid__record')];
  return records.length ? records : bodyRows(grid);
}

function unitOf(el) {
  return el.closest('.hc-datagrid__record') ?? el.closest('.hc-datagrid__row');
}

function unitRows(unit) {
  return unit.matches('.hc-datagrid__row')
    ? [unit]
    : [...unit.querySelectorAll('.hc-datagrid__row')];
}

function setUnitSelected(unit, on) {
  unit.toggleAttribute('data-selected', on);
  for (const tr of unitRows(unit)) {
    tr.setAttribute('aria-selected', on ? 'true' : 'false');
  }
}

function rowCells(row) {
  return [...row.children].filter((c) =>
    c.classList.contains('hc-datagrid__cell'),
  );
}

/** Measure header heights + frozen widths → sticky offset variables. */
function measure(grid) {
  const headTrs = [...grid.querySelectorAll('.hc-datagrid__head > tr')];
  let headTotal = 0;
  headTrs.forEach((tr, i) => {
    const h = tr.getBoundingClientRect().height;
    if (i === 0) grid.style.setProperty('--hc-datagrid-head-1-h', `${h}px`);
    if (i === 1) grid.style.setProperty('--hc-datagrid-head-2-h', `${h}px`);
    headTotal += h;
  });

  const ref = bodyRows(grid)[0];
  const offsets = [];
  let acc = 0;
  if (ref) {
    for (const c of [...ref.children].filter((c) => c.hasAttribute('data-frozen'))) {
      offsets.push(acc);
      acc += c.getBoundingClientRect().width;
    }
  }
  for (const row of grid.querySelectorAll(
    '.hc-datagrid__head > tr, .hc-datagrid__body > tr, .hc-datagrid__record > tr',
  )) {
    const frozen = [...row.children].filter((c) => c.hasAttribute('data-frozen'));
    frozen.forEach((c, i) => {
      if (offsets[i] != null) c.style.setProperty('--hc-datagrid-left', `${offsets[i]}px`);
    });
  }

  const scroll = grid.querySelector('.hc-datagrid__scroll');
  if (scroll) {
    scroll.style.scrollPaddingTop = `${headTotal}px`;
    scroll.style.scrollPaddingLeft = `${acc}px`;
  }
}

function attach(grid, detachers) {
  if (detachers.has(grid)) return;

  const table = grid.querySelector('.hc-datagrid__table');
  if (!table) return;

  let matrix = [];
  let active = { r: 0, c: 0 };

  const selectAll = () =>
    grid.querySelector('.hc-datagrid__head input[type="checkbox"]');

  function emitSelection() {
    const units = recordUnits(grid);
    const total = units.length;
    const selected = units.filter((u) => u.hasAttribute('data-selected')).length;
    grid.dispatchEvent(
      new CustomEvent('hc:datagridselectionchange', {
        bubbles: true,
        detail: { selected, total },
      }),
    );
  }

  function applyRoles() {
    table.setAttribute('role', 'grid');
    for (const r of grid.querySelectorAll(
      '.hc-datagrid__head > tr, .hc-datagrid__body > tr, .hc-datagrid__record > tr',
    )) {
      r.setAttribute('role', 'row');
    }
    for (const h of grid.querySelectorAll('.hc-datagrid__headcell')) {
      if (!h.getAttribute('role')) h.setAttribute('role', 'columnheader');
    }
    matrix.flat().forEach((cell) => {
      cell.setAttribute('role', cell.tagName === 'TH' ? 'rowheader' : 'gridcell');
      cell.tabIndex = -1;
      // Widgets in cells are not separate tab stops — the grid manages focus.
      cell.querySelectorAll(WIDGETS).forEach((w) => {
        w.tabIndex = -1;
      });
    });
  }

  function rebuild() {
    matrix = bodyRows(grid).map(rowCells);
    applyRoles();
    const cur = matrix[active.r]?.[active.c] ?? matrix[0]?.[0];
    if (cur) {
      cur.tabIndex = 0;
      const pos = locate(cur);
      if (pos) active = pos;
    }
  }

  function locate(cell) {
    for (let r = 0; r < matrix.length; r += 1) {
      const c = matrix[r].indexOf(cell);
      if (c !== -1) return { r, c };
    }
    return null;
  }

  function pageStep() {
    const scroll = grid.querySelector('.hc-datagrid__scroll');
    const cell = matrix[0]?.[0];
    const rowH = cell ? cell.getBoundingClientRect().height : 0;
    const vh = scroll ? scroll.clientHeight : 0;
    return rowH ? Math.max(1, Math.floor(vh / rowH) - 1) : 10;
  }

  function setActive(r, c, focusIt = true) {
    if (!matrix.length) return;
    const rr = Math.max(0, Math.min(r, matrix.length - 1));
    const cc = Math.max(0, Math.min(c, (matrix[rr]?.length ?? 1) - 1));
    const prev = matrix[active.r]?.[active.c];
    if (prev) {
      prev.tabIndex = -1;
      prev.removeAttribute('data-active');
    }
    active = { r: rr, c: cc };
    const cell = matrix[rr]?.[cc];
    if (!cell) return;
    cell.tabIndex = 0;
    cell.setAttribute('data-active', '');
    // Highlight the active cell's record (multi-row mode).
    const rec = cell.closest('.hc-datagrid__record');
    if (rec) {
      for (const r of grid.querySelectorAll('.hc-datagrid__record[data-current]')) {
        if (r !== rec) r.removeAttribute('data-current');
      }
      rec.setAttribute('data-current', '');
    }
    if (focusIt) cell.focus();
    cell.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function toggleRow(r) {
    const row = bodyRows(grid)[r];
    if (!row) return;
    const unit = unitOf(row) ?? row;
    const cb = unit.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      setUnitSelected(unit, !unit.hasAttribute('data-selected'));
      emitSelection();
    }
  }

  function onKeydown(event) {
    if (editingCell) return; // the editor handles its own keys
    if (!matrix.length) return;
    const { r, c } = active;
    const activeCell = matrix[r]?.[c];
    const editable =
      activeCell?.hasAttribute('data-editable') &&
      templates.has(activeCell.dataset.col);
    if (editable && (event.key === 'Enter' || event.key === 'F2')) {
      event.preventDefault();
      startEdit(activeCell);
      return;
    }
    if (
      editable &&
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      startEdit(activeCell, event.key); // type-to-edit (Excel-style)
      return;
    }
    switch (event.key) {
      case 'ArrowDown': setActive(r + 1, c); break;
      case 'ArrowUp': setActive(r - 1, c); break;
      case 'ArrowRight': setActive(r, c + 1); break;
      case 'ArrowLeft': setActive(r, c - 1); break;
      case 'Home': setActive(event.ctrlKey ? 0 : r, 0); break;
      case 'End':
        if (event.ctrlKey) setActive(matrix.length - 1, Infinity);
        else setActive(r, Infinity);
        break;
      case 'PageDown': setActive(r + pageStep(), c); break;
      case 'PageUp': setActive(r - pageStep(), c); break;
      case ' ':
      case 'Spacebar':
        // Only when the cell itself holds focus — let a focused widget
        // handle its own Space.
        if (event.target.classList.contains('hc-datagrid__cell')) {
          toggleRow(r);
        } else {
          return;
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onFocusin(event) {
    const cell = event.target.closest?.('.hc-datagrid__cell');
    if (!cell || !grid.contains(cell)) return;
    const pos = locate(cell);
    if (!pos) return;
    if (pos.r !== active.r || pos.c !== active.c) {
      setActive(pos.r, pos.c, false); // don't re-focus; focus is already here
    } else {
      cell.setAttribute('data-active', '');
    }
  }

  function onChange(event) {
    const cb = event.target;
    if (!(cb instanceof HTMLInputElement) || cb.type !== 'checkbox') return;
    if (cb === selectAll()) {
      for (const unit of recordUnits(grid)) {
        const ucb = unit.querySelector('input[type="checkbox"]');
        if (ucb) ucb.checked = cb.checked;
        setUnitSelected(unit, cb.checked);
      }
    } else {
      const unit = unitOf(cb);
      if (unit) setUnitSelected(unit, cb.checked);
      const all = selectAll();
      if (all) {
        const boxes = recordUnits(grid)
          .map((u) => u.querySelector('input[type="checkbox"]'))
          .filter(Boolean);
        const checked = boxes.filter((b) => b.checked).length;
        all.checked = checked > 0 && checked === boxes.length;
        all.indeterminate = checked > 0 && checked < boxes.length;
      }
    }
    emitSelection();
  }

  // ---- Inline editing ----
  // Editable columns declare a <template data-datagrid-editor data-col="…">
  // holding an HC form control (hc-input / hc-select / hc-combobox). On
  // activation the template is cloned into the cell; on commit the value is
  // written back and `hc:datagridedit` is dispatched (htmx persists).
  const templates = new Map();
  for (const t of grid.querySelectorAll('template[data-datagrid-editor]')) {
    if (t.dataset.col) templates.set(t.dataset.col, t);
  }
  let editingCell = null;
  let pendingCombo = null;

  function editorControl(rootEl) {
    return rootEl.matches('input, select, textarea')
      ? rootEl
      : rootEl.querySelector('input, select, textarea');
  }

  function readEditor(rootEl) {
    if (pendingCombo) return pendingCombo;
    const ctrl = editorControl(rootEl);
    if (!ctrl) return { value: '', label: '' };
    if (ctrl.tagName === 'SELECT') {
      return {
        value: ctrl.value,
        label: ctrl.selectedOptions[0]?.textContent?.trim() ?? ctrl.value,
      };
    }
    return { value: ctrl.value, label: ctrl.value };
  }

  function endEdit(restore) {
    if (!editingCell) return;
    const cell = editingCell;
    editingCell = null;
    cell.removeAttribute('data-editing');
    const oldValue = cell.__hcOldValue;
    let detail = null;
    if (restore) {
      cell.innerHTML = cell.__hcOldHTML;
    } else {
      const { value, label } = readEditor(cell.firstElementChild ?? cell);
      cell.textContent = label;
      if (value != null && value !== '') cell.dataset.value = value;
      if (value !== oldValue) {
        detail = { cell, col: cell.dataset.col, value, label, oldValue };
      }
    }
    delete cell.__hcOldValue;
    delete cell.__hcOldHTML;
    pendingCombo = null;
    cell.tabIndex = 0;
    cell.focus();
    if (detail) {
      grid.dispatchEvent(
        new CustomEvent('hc:datagridedit', { bubbles: true, detail }),
      );
    }
  }
  const commitEdit = () => endEdit(false);
  const cancelEdit = () => endEdit(true);

  function onEditorKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      // A combobox owns Enter (it picks the active option and commits via
      // hc:comboboxselect) — don't double-handle it here.
      if (!event.target.closest('.hc-combobox')) {
        event.preventDefault();
        event.stopPropagation();
        commitEdit();
      }
    }
  }
  function onEditorSelect(event) {
    pendingCombo = { value: event.detail.value, label: event.detail.label };
    commitEdit();
  }
  function onEditorFocusout() {
    setTimeout(() => {
      if (editingCell && !editingCell.contains(document.activeElement)) {
        commitEdit();
      }
    }, 0);
  }

  function startEdit(cell, seedChar) {
    if (!cell || !cell.hasAttribute('data-editable')) return;
    const tpl = templates.get(cell.dataset.col);
    if (!tpl) return;
    hideTip();
    if (editingCell) commitEdit();

    const oldLabel = cell.textContent.trim();
    const oldValue = cell.dataset.value ?? oldLabel;
    cell.__hcOldValue = oldValue;
    cell.__hcOldHTML = cell.innerHTML;

    const clone = tpl.content.firstElementChild.cloneNode(true);
    const isCombobox = clone.classList?.contains('hc-combobox');
    cell.setAttribute('data-editing', '');
    cell.replaceChildren(clone);
    editingCell = cell;
    pendingCombo = null;

    const ctrl = editorControl(clone);
    if (ctrl) {
      if (ctrl.tagName === 'SELECT') ctrl.value = oldValue;
      else if (isCombobox) ctrl.value = oldLabel;
      else ctrl.value = seedChar != null ? seedChar : oldLabel;
    }

    clone.addEventListener('keydown', onEditorKeydown);
    clone.addEventListener('focusout', onEditorFocusout);
    if (isCombobox) clone.addEventListener('hc:comboboxselect', onEditorSelect);

    (ctrl ?? clone).focus();
    if (seedChar != null && ctrl && ctrl.tagName === 'INPUT') {
      ctrl.value = seedChar;
      ctrl.setSelectionRange?.(ctrl.value.length, ctrl.value.length);
    }
  }

  function onDblclick(event) {
    const cell = event.target.closest?.('.hc-datagrid__cell');
    if (!cell || !grid.contains(cell)) return;
    const pos = locate(cell);
    if (pos) {
      setActive(pos.r, pos.c, false);
      startEdit(cell);
    }
  }

  // ---- Overflow tooltip ----
  // A single shared, styled tooltip per grid shows the full text of a
  // `.hc-datagrid__truncate` element when (and only when) it is clipped.
  const scrollEl = grid.querySelector('.hc-datagrid__scroll');
  const tip = grid.ownerDocument.createElement('div');
  tip.className = 'hc-datagrid__tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  grid.appendChild(tip);

  function showTip(el) {
    tip.textContent = el.textContent.trim();
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const doc = grid.ownerDocument.documentElement;
    const vw = doc.clientWidth || 0;
    const vh = doc.clientHeight || 0;
    let left = r.left;
    if (left + tr.width > vw - 4) left = Math.max(4, vw - tr.width - 4);
    let top = r.bottom + 4;
    if (top + tr.height > vh - 4) top = Math.max(4, r.top - tr.height - 4);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  function hideTip() {
    tip.hidden = true;
  }
  function isClipped(el) {
    return el && grid.contains(el) && el.scrollWidth > el.clientWidth + 1;
  }
  function onPointerOver(event) {
    const el = event.target.closest?.('.hc-datagrid__truncate');
    if (isClipped(el)) showTip(el);
  }
  function onPointerOut(event) {
    if (event.target.closest?.('.hc-datagrid__truncate')) hideTip();
  }
  function onTipFocusin(event) {
    const cell = event.target.closest?.('.hc-datagrid__cell');
    const el = cell?.querySelector?.(':scope > .hc-datagrid__truncate') ?? null;
    if (isClipped(el)) showTip(el);
    else hideTip();
  }

  rebuild();
  measure(grid);

  table.addEventListener('keydown', onKeydown);
  table.addEventListener('change', onChange);
  table.addEventListener('focusin', onFocusin);
  table.addEventListener('dblclick', onDblclick);
  grid.addEventListener('pointerover', onPointerOver);
  grid.addEventListener('pointerout', onPointerOut);
  grid.addEventListener('focusin', onTipFocusin);
  grid.addEventListener('focusout', hideTip);
  if (scrollEl) scrollEl.addEventListener('scroll', hideTip, { passive: true });

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => measure(grid));
    ro.observe(grid);
  }
  let mo = null;
  const tbody = grid.querySelector('.hc-datagrid__body');
  if (tbody && typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(() => {
      rebuild();
      measure(grid);
    });
    mo.observe(tbody, { childList: true });
  }

  detachers.set(grid, () => {
    table.removeEventListener('keydown', onKeydown);
    table.removeEventListener('change', onChange);
    table.removeEventListener('focusin', onFocusin);
    table.removeEventListener('dblclick', onDblclick);
    grid.removeEventListener('pointerover', onPointerOver);
    grid.removeEventListener('pointerout', onPointerOut);
    grid.removeEventListener('focusin', onTipFocusin);
    grid.removeEventListener('focusout', hideTip);
    if (scrollEl) scrollEl.removeEventListener('scroll', hideTip);
    tip.remove();
    if (ro) ro.disconnect();
    if (mo) mo.disconnect();
  });
}

/**
 * Install the data-grid behavior on every `.hc-datagrid` in the document:
 * sticky-offset measurement, ARIA grid roles + roving-tabindex keyboard
 * navigation, and row selection. The CSS layout works without it; this
 * adds the interactive layer.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installDatagrid(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const el of root.querySelectorAll('.hc-datagrid')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-datagrid')) attach(node, detachers);
          node.querySelectorAll?.('.hc-datagrid').forEach((el) =>
            attach(el, detachers),
          );
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
