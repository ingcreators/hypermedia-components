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

function bodyRows(grid) {
  return [...grid.querySelectorAll('.hc-datagrid__body > .hc-datagrid__row')];
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

  const ref = grid.querySelector('.hc-datagrid__body > .hc-datagrid__row');
  const offsets = [];
  let acc = 0;
  if (ref) {
    for (const c of [...ref.children].filter((c) => c.hasAttribute('data-frozen'))) {
      offsets.push(acc);
      acc += c.getBoundingClientRect().width;
    }
  }
  for (const row of grid.querySelectorAll(
    '.hc-datagrid__head > tr, .hc-datagrid__body > tr',
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
    const total = bodyRows(grid).length;
    const selected = bodyRows(grid).filter(
      (r) => r.getAttribute('aria-selected') === 'true',
    ).length;
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
      '.hc-datagrid__head > tr, .hc-datagrid__body > tr',
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
    if (focusIt) cell.focus();
    cell.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function toggleRow(r) {
    const row = bodyRows(grid)[r];
    if (!row) return;
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const sel = row.getAttribute('aria-selected') === 'true';
      row.setAttribute('aria-selected', sel ? 'false' : 'true');
      emitSelection();
    }
  }

  function onKeydown(event) {
    if (!matrix.length) return;
    const { r, c } = active;
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
      for (const row of bodyRows(grid)) {
        const rcb = row.querySelector('input[type="checkbox"]');
        if (rcb) rcb.checked = cb.checked;
        row.setAttribute('aria-selected', cb.checked ? 'true' : 'false');
      }
    } else {
      const row = cb.closest('.hc-datagrid__row');
      if (row) row.setAttribute('aria-selected', cb.checked ? 'true' : 'false');
      const all = selectAll();
      if (all) {
        const boxes = bodyRows(grid)
          .map((r) => r.querySelector('input[type="checkbox"]'))
          .filter(Boolean);
        const checked = boxes.filter((b) => b.checked).length;
        all.checked = checked > 0 && checked === boxes.length;
        all.indeterminate = checked > 0 && checked < boxes.length;
      }
    }
    emitSelection();
  }

  rebuild();
  measure(grid);

  table.addEventListener('keydown', onKeydown);
  table.addEventListener('change', onChange);
  table.addEventListener('focusin', onFocusin);

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
