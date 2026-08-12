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
//      Emits `hc:datagridselectionchange` on the grid — including after a
//      row swap inside the tbody (selection state is re-derived from the
//      new rows' checkboxes and the select-all checkbox is re-synced).
//
// installDatagrid(root = document) returns an uninstaller. Repeated calls
// on the same root return the same uninstaller (idempotent).

const INSTALL_KEY = '__hcDatagridUninstall';
const WIDGETS = 'input, button, select, textarea, a[href]';
let detailIdSeq = 0;

// Elements matching `selector` that belong to THIS grid — excluding any
// inside a nested `.hc-datagrid` (e.g. a grid rendered in a detail panel).
function ownedBy(grid, selector) {
  return [...grid.querySelectorAll(selector)].filter(
    (el) => el.closest('.hc-datagrid') === grid,
  );
}

// Every physical body row — across the single `.hc-datagrid__body` and any
// `.hc-datagrid__record` tbodies (multi-row records). These become the
// navigation matrix rows; non-uniform widths are fine (nav clamps).
// Rows hidden by a collapsed group leave the matrix (and re-enter on
// expand — toggling rebuilds).
function bodyRows(grid) {
  return ownedBy(
    grid,
    '.hc-datagrid__body > .hc-datagrid__row, .hc-datagrid__record > .hc-datagrid__row',
  ).filter((row) => !row.hidden);
}

// The selectable units. With `.hc-datagrid__record` tbodies each record is
// one unit (it may span several physical rows); otherwise each row is a unit.
// Group rows are headings, not records — they never count as units. Rows
// hidden by a collapsed group DO count: collapsing is a viewing state and
// must not change the selection.
function recordUnits(grid) {
  const records = ownedBy(grid, '.hc-datagrid__record');
  const units = records.length
    ? records
    : ownedBy(
        grid,
        '.hc-datagrid__body > .hc-datagrid__row, .hc-datagrid__record > .hc-datagrid__row',
      );
  return units.filter((u) => !u.classList.contains('hc-datagrid__grouprow'));
}

// The record/row unit `el` belongs to — scoped to this grid (so a control
// inside a nested grid resolves to the nested unit, not an outer record).
function unitOf(el, grid) {
  const sel = ownedBy(grid, '.hc-datagrid__record').length
    ? '.hc-datagrid__record'
    : '.hc-datagrid__row';
  const unit = el.closest(sel);
  return unit && unit.closest('.hc-datagrid') === grid ? unit : null;
}

function unitRows(unit) {
  return unit.matches('.hc-datagrid__row')
    ? [unit]
    : [...unit.querySelectorAll(':scope > .hc-datagrid__row')];
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

// The navigation matrix as a VISUAL grid: a cell with rowspan/colspan is
// entered into every (row, column) slot it covers, so arrow keys move by
// visual position and multi-row records stay column-aligned (the lead
// rowspan cell is reachable from every sub-row it spans).
function buildMatrix(grid) {
  const rows = bodyRows(grid);
  const out = rows.map(() => []);
  rows.forEach((row, r) => {
    let c = 0;
    for (const cell of rowCells(row)) {
      while (out[r][c] !== undefined) c += 1; // slot taken by a rowspan above
      const cs = cell.colSpan || 1;
      // rowspan="0" = "to the end of the row group" (HTML spec); either way
      // a span never crosses into the next record's rows.
      const rs = cell.rowSpan === 0 ? rows.length - r : cell.rowSpan || 1;
      for (let dr = 0; dr < rs; dr += 1) {
        const target = rows[r + dr];
        if (!target || target.parentNode !== row.parentNode) break;
        for (let dc = 0; dc < cs; dc += 1) out[r + dr][c + dc] = cell;
      }
      c += cs;
    }
  });
  return out;
}

/** Measure header/footer heights + frozen widths → sticky offset variables. */
function measure(grid) {
  const headTrs = ownedBy(grid, '.hc-datagrid__head > tr');
  let headTotal = 0;
  headTrs.forEach((tr, i) => {
    const h = tr.getBoundingClientRect().height;
    if (i === 0) grid.style.setProperty('--hc-datagrid-head-1-h', `${h}px`);
    if (i === 1) grid.style.setProperty('--hc-datagrid-head-2-h', `${h}px`);
    headTotal += h;
  });

  // Footer rows stack upward from the bottom edge — the LAST row's height
  // is the sticky offset of the row above it.
  const footTrs = ownedBy(grid, '.hc-datagrid__foot > tr');
  let footTotal = 0;
  footTrs.forEach((tr) => {
    footTotal += tr.getBoundingClientRect().height;
  });
  if (footTrs.length) {
    const h = footTrs[footTrs.length - 1].getBoundingClientRect().height;
    grid.style.setProperty('--hc-datagrid-foot-1-h', `${h}px`);
  }

  // The reference row for column widths must be a real data row — a
  // group row's single colspan cell says nothing about the columns.
  const ref = bodyRows(grid).find(
    (row) => !row.classList.contains('hc-datagrid__grouprow'),
  );
  const offsets = [];
  let acc = 0;
  const endOffsets = [];
  let accEnd = 0;
  if (ref) {
    for (const c of [...ref.children].filter((c) => c.hasAttribute('data-frozen'))) {
      offsets.push(acc);
      acc += c.getBoundingClientRect().width;
    }
    // Frozen-end offsets accumulate from the trailing edge inward.
    const endCells = [...ref.children].filter((c) =>
      c.hasAttribute('data-frozen-end'),
    );
    for (const c of endCells.reverse()) {
      endOffsets.unshift(accEnd);
      accEnd += c.getBoundingClientRect().width;
    }
  }
  for (const row of ownedBy(
    grid,
    '.hc-datagrid__head > tr, .hc-datagrid__body > tr, .hc-datagrid__record > tr, .hc-datagrid__foot > tr',
  )) {
    const frozen = [...row.children].filter((c) => c.hasAttribute('data-frozen'));
    frozen.forEach((c, i) => {
      if (offsets[i] != null) c.style.setProperty('--hc-datagrid-left', `${offsets[i]}px`);
    });
    const frozenEnd = [...row.children].filter((c) =>
      c.hasAttribute('data-frozen-end'),
    );
    frozenEnd.forEach((c, i) => {
      // Align from the end — a row's last frozen-end cell pairs with the
      // reference row's last, so header rows with fewer cells still line up.
      const j = endOffsets.length - frozenEnd.length + i;
      if (endOffsets[j] != null) c.style.setProperty('--hc-datagrid-right', `${endOffsets[j]}px`);
    });
  }

  const scroll = grid.querySelector('.hc-datagrid__scroll');
  if (scroll) {
    scroll.style.scrollPaddingTop = `${headTotal}px`;
    scroll.style.scrollPaddingBottom = `${footTotal}px`;
    scroll.style.scrollPaddingLeft = `${acc}px`;
    scroll.style.scrollPaddingRight = `${accEnd}px`;
  }
}

function attach(grid, detachers) {
  if (detachers.has(grid)) return;

  const table = grid.querySelector('.hc-datagrid__table');
  if (!table) return;

  let matrix = [];
  let active = { r: 0, c: 0 };

  const selectAll = () =>
    ownedBy(grid, '.hc-datagrid__head input[type="checkbox"]')[0] ?? null;

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

  // Derive the select-all checkbox's checked/indeterminate state from the
  // per-unit checkboxes.
  function syncSelectAll() {
    const all = selectAll();
    if (!all) return;
    const boxes = recordUnits(grid)
      .map((u) => u.querySelector('input[type="checkbox"]'))
      .filter(Boolean);
    const checked = boxes.filter((b) => b.checked).length;
    all.checked = checked > 0 && checked === boxes.length;
    all.indeterminate = checked > 0 && checked < boxes.length;
  }

  // ---- Row ordinals ----
  //
  // A business grid is discussed out loud — "row 137 is the one that
  // failed" — and a paged grid tells a screen reader "row 3 of 40" on
  // page four, which is a lie. Both are fixed by the same numbers.
  //
  // The SERVER numbers the result set (`data-row-no` on the row, the
  // 1-based position among all matching rows; `data-row-total` on the
  // grid). ARIA counts DOM rows *including header rows*, so the offset
  // is derived here rather than asked of every server — getting it
  // wrong is an off-by-header nobody notices without a screen reader.
  //
  // A row without `data-row-no` is left alone: rows the server did not
  // number (client-inserted tree children, group headers) must not be
  // given a position they do not have.
  function applyRowOrdinals() {
    const headRows = ownedBy(grid, '.hc-datagrid__head > tr');
    const numbered = ownedBy(grid, '.hc-datagrid__row[data-row-no]');
    if (numbered.length === 0) {
      table.removeAttribute('aria-rowcount');
      return;
    }
    // aria-rowcount is the whole RESULT SET, not the page — that is the
    // point of it. `-1` is ARIA's "total unknown", which is the honest
    // answer for an infinite grid that has not reached the end.
    const total = Number(grid.getAttribute('data-row-total'));
    table.setAttribute(
      'aria-rowcount',
      Number.isFinite(total) && grid.hasAttribute('data-row-total')
        ? String(total + headRows.length)
        : '-1',
    );
    headRows.forEach((r, i) => r.setAttribute('aria-rowindex', String(i + 1)));
    for (const row of numbered) {
      const no = Number(row.getAttribute('data-row-no'));
      if (!Number.isFinite(no)) continue;
      row.setAttribute('aria-rowindex', String(no + headRows.length));
    }
  }

  function applyRoles() {
    // Tree rows (aria-level + aria-expanded) make it a treegrid — the
    // role under which those row attributes are valid.
    table.setAttribute(
      'role',
      ownedBy(grid, '[data-hc-datagrid-tree]').length ? 'treegrid' : 'grid',
    );
    for (const r of ownedBy(
      grid,
      '.hc-datagrid__head > tr, .hc-datagrid__row, .hc-datagrid__foot > tr',
    )) {
      r.setAttribute('role', 'row');
    }
    // Footer cells sit outside the navigation matrix (aggregates are not
    // navigable) but still need grid-pattern roles.
    for (const cell of ownedBy(grid, '.hc-datagrid__foot .hc-datagrid__cell')) {
      if (!cell.getAttribute('role')) {
        cell.setAttribute('role', cell.tagName === 'TH' ? 'rowheader' : 'gridcell');
      }
    }
    // Server-rendered error rows (edit feedback) — grid roles, out of
    // navigation, message announced via an inner role="alert" element.
    for (const r of ownedBy(grid, '.hc-datagrid__error-row')) {
      r.setAttribute('role', 'row');
      const cell = r.querySelector('.hc-datagrid__error');
      if (cell) cell.setAttribute('role', 'gridcell');
    }
    for (const h of ownedBy(grid, '.hc-datagrid__headcell')) {
      if (!h.getAttribute('role')) h.setAttribute('role', 'columnheader');
    }
    applyRowOrdinals();
    // Editability is a per-CELL fact (a row's state can lock it), and
    // `gridcell` supports both attributes — so derive them from what
    // the author already wrote and never overwrite a server-rendered
    // value (conditional requiredness is a server rule).
    //   editable + required → aria-required="true"
    //   editable + optional → neither
    //   not editable        → aria-readonly="true"
    // A grid with no editors at all says so ONCE on the grid instead of
    // repeating itself on every cell.
    const anyEditable = matrix
      .flat()
      .some((cell) => cell.hasAttribute('data-editable'));
    // On the TABLE, which carries role="grid" — the wrapper div has no
    // role, and aria-* on a roleless element is invalid.
    if (!anyEditable && templates.size === 0) {
      table.setAttribute('aria-readonly', 'true');
    } else {
      table.removeAttribute('aria-readonly');
    }

    // A spanning cell occupies several matrix slots — visit each cell once.
    new Set(matrix.flat()).forEach((cell) => {
      cell.setAttribute('role', cell.tagName === 'TH' ? 'rowheader' : 'gridcell');
      cell.tabIndex = -1;
      const editable =
        cell.hasAttribute('data-editable') && templates.has(cell.dataset.col);
      if (anyEditable) {
        if (!editable && !cell.hasAttribute('aria-readonly')) {
          cell.setAttribute('aria-readonly', 'true');
        }
        if (editable && !cell.hasAttribute('aria-required')) {
          const ctrl = editorControl(
            templates.get(cell.dataset.col).content.firstElementChild,
          );
          if (ctrl?.required) cell.setAttribute('aria-required', 'true');
        }
      }
      // Widgets in cells are not separate tab stops — the grid manages focus.
      cell.querySelectorAll(WIDGETS).forEach((w) => {
        w.tabIndex = -1;
      });
    });
  }

  // ---- Zebra striping ----
  // Opt-in via `data-hc-zebra`, because :nth-child() cannot express it:
  // it counts rows hidden by a collapsed group (so the stripes shuffle
  // the moment a group closes) and it cannot alternate per RECORD, which
  // is the unit users read when a record spans several physical rows.
  // Both are exactly what rebuild() already knows, so the stripe is
  // assigned here — over VISIBLE rows only, one step per record.
  //
  // Without the opt-in the attribute is left alone, so a server that
  // renders `data-alt` itself keeps working with no JS at all.
  function applyZebra() {
    if (!grid.hasAttribute('data-hc-zebra')) return;
    let i = -1;
    let lastUnit = null;
    for (const row of bodyRows(grid)) {
      if (row.classList.contains('hc-datagrid__grouprow')) {
        // A heading is not a stripe: it separates the groups it labels.
        row.removeAttribute('data-alt');
        continue;
      }
      const unit = row.closest('.hc-datagrid__record') ?? row;
      if (unit !== lastUnit) {
        i += 1;
        lastUnit = unit;
      }
      if (i % 2) row.setAttribute('data-alt', '');
      else row.removeAttribute('data-alt');
    }
  }

  function rebuild() {
    matrix = buildMatrix(grid);
    clearRange(); // swapped-in rows invalidate the range geometry
    applyRoles();
    applyZebra();
    applyResizedWidths(); // re-apply column widths to swapped-in rows
    let cur = matrix[active.r]?.[active.c];
    if (!cur) {
      cur = matrix[0]?.[0];
      const pos = cur && locate(cur);
      if (pos) active = pos;
    }
    if (cur) cur.tabIndex = 0;
  }

  // ---- Column resize ----
  // A resizable column declares `data-resizable` + `data-col` on its header
  // and the matching `data-col` on its body cells. Only that column becomes
  // fixed-width (and clips); other columns keep content-sizing.
  const MIN_COL = 40;
  const resizedWidths = new Map();
  const resizerCleanups = [];

  function columnCells(key) {
    return ownedBy(
      grid,
      `.hc-datagrid__cell[data-col="${key}"], .hc-datagrid__headcell[data-col="${key}"]`,
    );
  }

  function applyColumn(key, px) {
    for (const cell of columnCells(key)) {
      cell.style.inlineSize = px;
      cell.style.maxInlineSize = px;
      cell.setAttribute('data-resized', '');
    }
  }

  function applyResizedWidths() {
    for (const [key, px] of resizedWidths) applyColumn(key, px);
  }

  function setColumnWidth(key, w) {
    const n = Math.max(MIN_COL, Math.round(w));
    const px = `${n}px`;
    resizedWidths.set(key, px);
    applyColumn(key, px);
    const handle = ownedBy(
      grid,
      `.hc-datagrid__headcell[data-resizable][data-col="${key}"] > .hc-datagrid__resizer`,
    )[0];
    if (handle) handle.setAttribute('aria-valuenow', String(n));
    measure(grid); // a frozen column's width change shifts later frozen offsets
  }

  function emitResize(key, width) {
    const w = Math.max(MIN_COL, Math.round(width));
    // Mirror the committed width into any declared prefs input BEFORE
    // dispatching, so an event-triggered htmx request serializes the
    // fresh value — the declarative persistence hook (the
    // datagrid-prefs recipe posts it; the behavior never fetches).
    const scope = grid.closest('form') ?? grid.ownerDocument;
    for (const input of scope.querySelectorAll(
      `input[data-hc-datagrid-width="${key}"]`,
    )) {
      input.value = String(w);
    }
    grid.dispatchEvent(
      new CustomEvent('hc:datagridcolumnresize', {
        bubbles: true,
        detail: { col: key, width: w },
      }),
    );
  }

  function wireResizer(handle, th) {
    const key = th.dataset.col;
    let startX = 0;
    let startW = 0;
    let dragging = false;

    function onPointerDown(event) {
      dragging = true;
      startX = event.clientX;
      startW = th.getBoundingClientRect().width;
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
    function onPointerMove(event) {
      if (!dragging) return;
      setColumnWidth(key, startW + (event.clientX - startX));
    }
    function onPointerUp(event) {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(event.pointerId);
      emitResize(key, th.getBoundingClientRect().width);
    }
    // Auto-size: fit the column to its widest rendered cell content
    // (scrollWidth includes padding, so a clipped cell reports its full
    // content width). Double-click the grip, or Enter while it has focus.
    function autoSize() {
      let max = MIN_COL;
      for (const cell of columnCells(key)) {
        max = Math.max(max, cell.scrollWidth + 2);
      }
      setColumnWidth(key, max);
      emitResize(key, max);
    }

    function onDblclickHandle(event) {
      event.preventDefault();
      event.stopPropagation(); // not a cell double-click (edit)
      autoSize();
    }

    function onKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        autoSize();
        return;
      }
      const step = event.shiftKey ? 32 : 8;
      const cur = th.getBoundingClientRect().width;
      let w;
      if (event.key === 'ArrowRight') w = cur + step;
      else if (event.key === 'ArrowLeft') w = cur - step;
      else return;
      event.preventDefault();
      setColumnWidth(key, w);
      emitResize(key, w);
    }

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('dblclick', onDblclickHandle);
    handle.addEventListener('keydown', onKeydown);
    resizerCleanups.push(() => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('dblclick', onDblclickHandle);
      handle.removeEventListener('keydown', onKeydown);
      handle.remove();
    });
  }

  function initResizers() {
    for (const th of ownedBy(grid, '.hc-datagrid__headcell[data-resizable]')) {
      if (!th.dataset.col) continue;
      if (th.querySelector(':scope > .hc-datagrid__resizer')) continue; // idempotent
      const handle = grid.ownerDocument.createElement('span');
      handle.className = 'hc-datagrid__resizer';
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      handle.tabIndex = 0;
      handle.setAttribute(
        'aria-label',
        `Resize ${th.textContent.trim() || 'column'}`,
      );
      // A focusable separator is a window-splitter — it needs a value.
      handle.setAttribute('aria-valuemin', String(MIN_COL));
      handle.setAttribute('aria-valuenow', String(Math.round(th.getBoundingClientRect().width)));
      th.appendChild(handle);
      wireResizer(handle, th);
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

  // Arrow movement: walk from the active slot in direction (dr, dc),
  // skipping further slots of the same spanning cell so a rowspan/colspan
  // cell counts as a single stop. The active slot (not the cell's top-left)
  // is the walk origin, so the entry row/column is kept while crossing a
  // span — ↓ then ↑ round-trips.
  function step(dr, dc) {
    const { r, c } = active;
    const cur = matrix[r]?.[c];
    let nr = r + dr;
    let nc = c + dc;
    while (cur && matrix[nr]?.[nc] === cur) {
      nr += dr;
      nc += dc;
    }
    setActive(nr, nc);
  }

  // ---- Range selection (Shift+Arrow / Shift+Click) ----
  // A rectangle between the anchor slot and the active slot, painted with
  // `data-in-range`. Purely visual + clipboard — no network, no persistence;
  // any grid re-render (htmx swap) clears it.
  let rangeAnchor = null; // {r, c} | null
  let rangePainted = new Set();

  function clearRange() {
    rangeAnchor = null;
    for (const cell of rangePainted) cell.removeAttribute('data-in-range');
    rangePainted = new Set();
  }

  function rangeRect() {
    if (!rangeAnchor) return null;
    return {
      r1: Math.min(rangeAnchor.r, active.r),
      r2: Math.max(rangeAnchor.r, active.r),
      c1: Math.min(rangeAnchor.c, active.c),
      c2: Math.max(rangeAnchor.c, active.c),
    };
  }

  function paintRange() {
    const rect = rangeRect();
    if (!rect) return;
    const next = new Set();
    for (let r = rect.r1; r <= rect.r2; r += 1) {
      for (let c = rect.c1; c <= rect.c2; c += 1) {
        const cell = matrix[r]?.[c];
        if (cell) next.add(cell);
      }
    }
    for (const cell of rangePainted) {
      if (!next.has(cell)) cell.removeAttribute('data-in-range');
    }
    for (const cell of next) cell.setAttribute('data-in-range', '');
    rangePainted = next;
  }

  // TSV of the range (or the active cell alone). A spanning cell
  // contributes its text once — at the first slot of the rectangle it
  // covers; its remaining slots come out empty, mirroring the visual grid.
  function copyRange() {
    const rect = rangeRect() ?? {
      r1: active.r,
      r2: active.r,
      c1: active.c,
      c2: active.c,
    };
    const seen = new Set();
    const lines = [];
    for (let r = rect.r1; r <= rect.r2; r += 1) {
      const out = [];
      for (let c = rect.c1; c <= rect.c2; c += 1) {
        const cell = matrix[r]?.[c];
        if (!cell || seen.has(cell)) {
          out.push('');
        } else {
          seen.add(cell);
          out.push(cell.textContent.trim());
        }
      }
      lines.push(out.join('\t'));
    }
    const text = lines.join('\n');
    const ok = grid.dispatchEvent(
      new CustomEvent('hc:datagridcopy', {
        bubbles: true,
        cancelable: true,
        detail: {
          text,
          rows: rect.r2 - rect.r1 + 1,
          cols: rect.c2 - rect.c1 + 1,
        },
      }),
    );
    // Cancelling the event claims the copy (e.g. to put a richer payload
    // on the clipboard); otherwise we write the TSV ourselves.
    if (ok) navigator.clipboard?.writeText?.(text);
  }

  function selectAllUnits() {
    const all = selectAll();
    if (all) {
      all.checked = true;
      all.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    for (const unit of recordUnits(grid)) setUnitSelected(unit, true);
    emitSelection();
  }

  function toggleRow(r) {
    const row = bodyRows(grid)[r];
    if (!row) return;
    const unit = unitOf(row, grid) ?? row;
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
    if (!isOurs(event)) return; // nested grid handles its own
    if (event.target.closest('.hc-datagrid__head')) return; // header keys (sort) handled separately
    if (!matrix.length) return;
    const { r, c } = active;
    const activeCell = matrix[r]?.[c];
    if (
      isGroupRow(activeCell?.parentElement) &&
      (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')
    ) {
      event.preventDefault();
      toggleGroup(activeCell.parentElement);
      return;
    }
    const treeBtn = activeCell?.querySelector?.('[data-hc-datagrid-tree]');
    if (treeBtn && event.key === 'Enter') {
      const row = treeRowOf(treeBtn);
      if (row) {
        event.preventDefault();
        toggleTree(row);
        return;
      }
    }
    const toggleBtn = activeCell?.querySelector?.('[data-hc-datagrid-toggle]');
    if (toggleBtn && event.key === 'Enter') {
      event.preventDefault();
      const record = toggleBtn.closest('.hc-datagrid__record');
      if (record) setExpanded(record, !record.hasAttribute('data-expanded'));
      return;
    }
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
      (event.isComposing || event.key === 'Process' || event.keyCode === 229)
    ) {
      // An IME composition is targeting the cell. The session belongs to
      // the IME — cancelling the keydown (or seeding event.key) would drop
      // or corrupt it, so open the editor unseeded, without preventDefault,
      // and let the IME re-target composition into the focused input.
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
    const mod = event.ctrlKey || event.metaKey;
    if (mod && (event.key === 'c' || event.key === 'C')) {
      // A real text selection keeps native copy; otherwise copy the range
      // (or the active cell alone) as TSV.
      const sel = grid.ownerDocument.getSelection?.();
      if (rangeAnchor || !sel || sel.isCollapsed) {
        event.preventDefault();
        copyRange();
      }
      return;
    }
    if (mod && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault(); // never select the whole document from a grid
      selectAllUnits();
      return;
    }
    if (event.key === 'Escape') {
      if (!rangeAnchor) return;
      event.preventDefault();
      clearRange();
      return;
    }
    // In RTL the columns run right-to-left, so mirror the horizontal arrows.
    let key = event.key;
    if (getComputedStyle(grid).direction === 'rtl') {
      if (key === 'ArrowRight') key = 'ArrowLeft';
      else if (key === 'ArrowLeft') key = 'ArrowRight';
    }
    const isArrow =
      key === 'ArrowDown' || key === 'ArrowUp' ||
      key === 'ArrowRight' || key === 'ArrowLeft';
    const extending = event.shiftKey && isArrow;
    if (extending && !rangeAnchor) rangeAnchor = { ...active };
    switch (key) {
      case 'ArrowDown': step(1, 0); break;
      case 'ArrowUp': step(-1, 0); break;
      case 'ArrowRight': step(0, 1); break;
      case 'ArrowLeft': step(0, -1); break;
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
    if (extending) paintRange();
    else if (rangeAnchor && key !== ' ' && key !== 'Spacebar') clearRange();
    event.preventDefault();
  }

  // Some engines fire compositionstart before any keydown reaches the
  // grid — same answer as the keydown path: open the editor unseeded so
  // the composition lands in the input instead of being swallowed by the
  // non-editable cell.
  function onCompositionstart(event) {
    if (editingCell || !isOurs(event)) return;
    const cell = event.target.closest?.('.hc-datagrid__cell');
    if (!cell || matrix[active.r]?.[active.c] !== cell) return;
    if (!cell.hasAttribute('data-editable') || !templates.has(cell.dataset.col)) return;
    startEdit(cell);
  }

  // Shift+Click extends the range from the active cell; a plain click on a
  // cell drops any range. mousedown (not click) so we can suppress the
  // browser's shift-click text selection before it starts.
  function onMousedown(event) {
    if (!isOurs(event)) return;
    const cell = event.target.closest?.('.hc-datagrid__cell');
    if (!cell || !grid.contains(cell)) return;
    if (!event.shiftKey) {
      if (rangeAnchor) clearRange();
      return;
    }
    const pos = locate(cell);
    if (!pos) return;
    event.preventDefault();
    rangeAnchor ??= { ...active };
    setActive(pos.r, pos.c);
    paintRange();
  }

  function onFocusin(event) {
    if (!isOurs(event)) return;
    const cell = event.target.closest?.('.hc-datagrid__cell');
    if (!cell || !grid.contains(cell)) return;
    const pos = locate(cell);
    if (!pos) return;
    if (matrix[active.r]?.[active.c] !== cell) {
      setActive(pos.r, pos.c, false); // don't re-focus; focus is already here
    } else {
      // Already the active cell — keep the active slot as-is so a spanning
      // cell remembers which sub-row/column it was entered from.
      cell.setAttribute('data-active', '');
    }
  }

  function onChange(event) {
    if (!isOurs(event)) return;
    const cb = event.target;
    if (!(cb instanceof HTMLInputElement) || cb.type !== 'checkbox') return;
    if (cb === selectAll()) {
      for (const unit of recordUnits(grid)) {
        const ucb = unit.querySelector('input[type="checkbox"]');
        if (ucb) ucb.checked = cb.checked;
        setUnitSelected(unit, cb.checked);
      }
    } else {
      const unit = unitOf(cb, grid);
      if (unit) setUnitSelected(unit, cb.checked);
      syncSelectAll();
    }
    emitSelection();
  }

  // Ignore events bubbling up from a NESTED grid (e.g. one rendered inside
  // an expanded detail panel) — that grid handles its own.
  function isOurs(event) {
    return event.target.closest?.('.hc-datagrid') === grid;
  }

  // ---- Sortable column headers ----
  function sortableHeaders() {
    return ownedBy(grid, '.hc-datagrid__headcell[data-sortable]');
  }

  function initSort() {
    for (const th of sortableHeaders()) {
      if (!th.hasAttribute('tabindex')) th.tabIndex = 0;
      if (!th.hasAttribute('aria-sort')) th.setAttribute('aria-sort', 'none');
    }
  }

  const isSorted = (h) =>
    /^(ascending|descending)$/.test(h.getAttribute('aria-sort') || '');

  // Opt-in client sort of the ALREADY-RENDERED page (data-sortable="client")
  // — explicitly allowed by the depth plan for small, fully-loaded tables.
  // Reorders the flat tbody rows only; any htmx swap restores the server's
  // order, which is correct (the server's order wins after a round trip).
  function clientSort(th, direction) {
    if (direction == null) return; // cleared — the server's order returns on swap
    const key = th.dataset.col;
    const colIndex = [...th.parentElement.children].indexOf(th);
    const tbody = grid.querySelector('.hc-datagrid__body');
    if (!tbody) return; // multi-row records: server sort only
    const rows = [...tbody.children].filter(
      (r) =>
        r.classList.contains('hc-datagrid__row') &&
        !r.classList.contains('hc-datagrid__grouprow'),
    );
    const valueOf = (row) => {
      const cell =
        (key && row.querySelector(`[data-col="${key}"]`)) || rowCells(row)[colIndex];
      const raw = cell?.dataset.value ?? cell?.textContent.trim() ?? '';
      const n = Number(raw.replace(/[,\s]/g, ''));
      return raw !== '' && Number.isFinite(n) ? n : raw;
    };
    rows.sort((a, b) => {
      const va = valueOf(a);
      const vb = valueOf(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
      return direction === 'desc' ? -cmp : cmp;
    });
    for (const row of rows) tbody.appendChild(row); // observer rebuilds
  }

  // A plain activation resets to single-column sort; Shift adds the
  // column to the sort set instead. The client only marks the
  // instruction (aria-sort + the data-sort-index ordinal) — the server
  // returns the sorted page (`?sort=name,-price` convention).
  function cycleSort(th, additive = false) {
    const current = th.getAttribute('aria-sort') || 'none';
    const next =
      current === 'none'
        ? 'ascending'
        : current === 'ascending'
          ? 'descending'
          : 'none';
    if (additive) {
      if (current === 'none') {
        // Entering the set: append after the existing sorted columns.
        th.dataset.sortIndex = String(sortableHeaders().filter(isSorted).length + 1);
      }
    } else {
      // Single-column sort: clear the others.
      for (const h of sortableHeaders()) {
        if (h !== th) {
          h.setAttribute('aria-sort', 'none');
          delete h.dataset.sortIndex;
        }
      }
      delete th.dataset.sortIndex;
    }
    th.setAttribute('aria-sort', next);
    if (next === 'none') delete th.dataset.sortIndex;
    // Renumber 1…n in set order; a single sorted column carries no
    // ordinal (the arrow alone says everything).
    const sorted = sortableHeaders()
      .filter(isSorted)
      .sort(
        (a, b) => Number(a.dataset.sortIndex || 0) - Number(b.dataset.sortIndex || 0),
      );
    sorted.forEach((h, i) => {
      if (sorted.length > 1) h.dataset.sortIndex = String(i + 1);
      else delete h.dataset.sortIndex;
    });

    const colOf = (h) => h.dataset.col || (h.textContent || '').trim();
    const direction = next === 'ascending' ? 'asc' : next === 'descending' ? 'desc' : null;
    const sorts = sorted.map((h) => ({
      col: colOf(h),
      direction: h.getAttribute('aria-sort') === 'ascending' ? 'asc' : 'desc',
    }));
    if (th.getAttribute('data-sortable') === 'client') {
      clientSort(th, direction);
    }
    // Mirror the committed sort set into any declared input BEFORE
    // dispatching, so an event-triggered htmx request serializes the
    // fresh value — the same hook the width prefs use. It is what puts
    // sort INSIDE the filter form: the sort then survives an Apply, and
    // a saved view captures it, because both read the form's fields.
    // Wire format: `name,-price` — ordered, leading `-` for descending.
    const wire = sorts
      .map((s) => (s.direction === 'desc' ? `-${s.col}` : s.col))
      .join(',');
    const scope = grid.closest('form') ?? grid.ownerDocument;
    for (const input of scope.querySelectorAll('input[data-hc-datagrid-sort]')) {
      input.value = wire;
    }
    grid.dispatchEvent(
      new CustomEvent('hc:datagridsort', {
        bubbles: true,
        detail: { col: colOf(th), direction, sorts },
      }),
    );
  }

  function sortableTargetOf(event) {
    if (event.target.closest('.hc-datagrid__resizer')) return null; // resize, not sort
    const th = event.target.closest('.hc-datagrid__headcell[data-sortable]');
    return th && th.closest('.hc-datagrid') === grid ? th : null;
  }

  function onSortClick(event) {
    const th = sortableTargetOf(event);
    if (th) cycleSort(th, event.shiftKey);
  }

  function onSortKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const th = sortableTargetOf(event);
    if (!th) return;
    event.preventDefault();
    cycleSort(th, event.shiftKey);
  }

  // ---- Grouped rows (server-rendered, client-toggled) ----
  // The server interleaves `.hc-datagrid__grouprow` heading rows (also
  // carrying .hc-datagrid__row so they join keyboard navigation) with one
  // colspan cell holding the group label and any aggregates it chose to
  // render. Collapse is pure visibility — the rows are already on the
  // page; paging happens within the server's rendering choice.
  function isGroupRow(el) {
    return !!el && el.classList?.contains('hc-datagrid__grouprow');
  }

  function groupLevel(row) {
    return Number(row.dataset.groupLevel || 1);
  }

  // The expansion state lives on the heading's CELL — aria-expanded is
  // valid on gridcell, but on row only inside a treegrid.
  function groupCell(row) {
    return row.querySelector('.hc-datagrid__cell');
  }

  function groupExpanded(row) {
    return groupCell(row)?.getAttribute('aria-expanded') !== 'false';
  }

  function setGroupExpanded(row, on, { silent = false } = {}) {
    groupCell(row)?.setAttribute('aria-expanded', on ? 'true' : 'false');
    const level = groupLevel(row);
    let el = row.nextElementSibling;
    let skipUntil = null; // a collapsed sub-group's level while expanding
    while (el) {
      if (isGroupRow(el)) {
        const l = groupLevel(el);
        if (l <= level) break; // the group ends at a same-or-higher heading
        if (!on) {
          el.hidden = true;
        } else {
          if (skipUntil != null && l <= skipUntil) skipUntil = null;
          if (skipUntil == null) {
            el.hidden = false;
            // A collapsed sub-group re-appears, but keeps its members hidden.
            if (!groupExpanded(el)) skipUntil = l;
          }
        }
      } else if (!on) {
        el.hidden = true;
      } else if (skipUntil == null) {
        el.hidden = false;
      }
      el = el.nextElementSibling;
    }
    rebuild(); // hidden rows leave the navigation matrix
    if (!silent) {
      grid.dispatchEvent(
        new CustomEvent('hc:datagridgrouptoggle', {
          bubbles: true,
          detail: { row, expanded: on },
        }),
      );
    }
  }

  function toggleGroup(row) {
    setGroupExpanded(row, !groupExpanded(row));
  }

  function initGroups() {
    for (const row of ownedBy(grid, '.hc-datagrid__grouprow')) {
      const cell = groupCell(row);
      if (cell && !cell.hasAttribute('aria-expanded')) {
        cell.setAttribute('aria-expanded', 'true');
      }
      // The server may render a group pre-collapsed.
      if (!groupExpanded(row) && !row.hidden) {
        setGroupExpanded(row, false, { silent: true });
      }
    }
  }

  function onGroupClick(event) {
    if (!isOurs(event)) return;
    // Widgets inside a group row (e.g. a link in the label) keep their job.
    if (event.target.closest('a, button, input, select, textarea, label')) return;
    const row = event.target.closest('.hc-datagrid__grouprow');
    if (row && grid.contains(row)) toggleGroup(row);
  }

  // ---- Tree rows (lazy hypermedia hierarchy) ----
  // Rows carry aria-level; a row with children carries aria-expanded and
  // a `data-hc-datagrid-tree` toggle in its lead cell. Children are
  // sibling rows one level deeper — either server-rendered, or loaded
  // once via htmx (`data-lazy` on the row + data-hx-trigger on
  // `hc:datagridtreeload`, afterend swap). Collapse is pure visibility.
  function rowLevel(row) {
    return Number(row?.getAttribute?.('aria-level')) || 1;
  }

  function treeRowOf(el) {
    const row = el?.closest?.('.hc-datagrid__row');
    return row && row.hasAttribute('aria-expanded') && grid.contains(row)
      ? row
      : null;
  }

  function setTreeExpanded(row, on, { silent = false } = {}) {
    row.setAttribute('aria-expanded', on ? 'true' : 'false');
    // The button's own aria-expanded only drives the +/− glyph (it is
    // aria-hidden; the row announces the state).
    const btn = row.querySelector('[data-hc-datagrid-tree]');
    if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');

    if (on && row.hasAttribute('data-lazy') && !row.hasAttribute('data-loaded')) {
      // First expand: hand the fetch to htmx; the tbody observer clears
      // aria-busy when the child rows arrive.
      row.setAttribute('data-loaded', '');
      row.setAttribute('aria-busy', 'true');
      row.dispatchEvent(
        new CustomEvent('hc:datagridtreeload', { bubbles: true, detail: { row } }),
      );
    } else {
      const level = rowLevel(row);
      let el = row.nextElementSibling;
      let skipUntil = null; // a collapsed sub-tree's level while expanding
      while (el) {
        const l = rowLevel(el);
        if (l <= level) break; // the subtree ends at a same-or-higher row
        if (!on) {
          el.hidden = true;
        } else {
          if (skipUntil != null && l <= skipUntil) skipUntil = null;
          if (skipUntil == null) {
            el.hidden = false;
            // A collapsed child keeps its own subtree hidden.
            if (el.getAttribute('aria-expanded') === 'false') skipUntil = l;
          }
        }
        el = el.nextElementSibling;
      }
    }
    rebuild(); // hidden rows leave the navigation matrix
    if (!silent) {
      grid.dispatchEvent(
        new CustomEvent('hc:datagridtreetoggle', {
          bubbles: true,
          detail: { row, expanded: on },
        }),
      );
    }
  }

  function toggleTree(row) {
    setTreeExpanded(row, row.getAttribute('aria-expanded') !== 'true');
  }

  function initTrees() {
    for (const btn of ownedBy(grid, '[data-hc-datagrid-tree]')) {
      const row = btn.closest('.hc-datagrid__row');
      if (!row) continue;
      if (!row.hasAttribute('aria-expanded')) {
        row.setAttribute('aria-expanded', 'false');
      }
      btn.setAttribute(
        'aria-expanded',
        row.getAttribute('aria-expanded') === 'true' ? 'true' : 'false',
      );
      // Already-rendered children mean no lazy fetch is needed.
      const next = row.nextElementSibling;
      if (next && rowLevel(next) > rowLevel(row)) {
        row.setAttribute('data-loaded', '');
        if (row.getAttribute('aria-expanded') !== 'true' && !row.hidden) {
          setTreeExpanded(row, false, { silent: true });
        }
      }
    }
  }

  function onTreeClick(event) {
    if (!isOurs(event)) return;
    const btn = event.target.closest('[data-hc-datagrid-tree]');
    if (!btn || !grid.contains(btn)) return;
    const row = treeRowOf(btn);
    if (row) toggleTree(row);
  }

  // ---- Expandable row detail (master / detail) ----
  function detailRowOf(record) {
    return record.querySelector(':scope > .hc-datagrid__detail-row');
  }

  // Lazy detail: when a `data-lazy` detail cell is opened the first time, fire
  // `hc:datagriddetailload` on it (htmx loads via hx-trigger) and show a busy
  // spinner until content arrives. The request itself is htmx's job.
  function loadDetail(record, cell) {
    cell.dataset.loaded = ''; // load only once
    cell.setAttribute('aria-busy', 'true');
    if (typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(() => {
        cell.removeAttribute('aria-busy');
        obs.disconnect();
      });
      obs.observe(cell, { childList: true });
    }
    cell.dispatchEvent(
      new CustomEvent('hc:datagriddetailload', { bubbles: true, detail: { record } }),
    );
  }

  function setExpanded(record, on) {
    const detail = detailRowOf(record);
    const cell = detail?.querySelector('.hc-datagrid__detail');
    const btn = record.querySelector('[data-hc-datagrid-toggle]');
    record.toggleAttribute('data-expanded', on);
    if (detail) detail.hidden = !on;
    if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on && cell && cell.hasAttribute('data-lazy') && cell.dataset.loaded == null) {
      loadDetail(record, cell);
    }
    grid.dispatchEvent(
      new CustomEvent(on ? 'hc:datagridexpand' : 'hc:datagridcollapse', {
        bubbles: true,
        detail: { record },
      }),
    );
  }

  function initDetails() {
    for (const record of ownedBy(grid, '.hc-datagrid__record')) {
      const btn = record.querySelector('[data-hc-datagrid-toggle]');
      const detail = detailRowOf(record);
      if (!btn || !detail) continue;
      const cell = detail.querySelector('.hc-datagrid__detail');
      if (cell) {
        if (!cell.id) {
          detailIdSeq += 1;
          cell.id = `hc-datagrid-detail-${detailIdSeq}`;
        }
        detail.setAttribute('role', 'row');
        cell.setAttribute('role', 'gridcell');
        btn.setAttribute('aria-controls', cell.id);
      }
      const open = record.hasAttribute('data-expanded');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      detail.hidden = !open;
    }
  }

  function onToggleClick(event) {
    if (!isOurs(event)) return;
    const btn = event.target.closest('[data-hc-datagrid-toggle]');
    if (!btn || !grid.contains(btn)) return;
    const record = btn.closest('.hc-datagrid__record');
    if (record) setExpanded(record, !record.hasAttribute('data-expanded'));
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
    // Native validation gates the commit: an editor control carrying
    // required / pattern / min / max / maxlength must satisfy them before
    // the value is written back. The editor stays open with the native
    // message; Escape still cancels. (A combobox pick bypasses this —
    // options are valid by construction.)
    if (!restore && !pendingCombo) {
      const ctrl = editorControl(editingCell.firstElementChild ?? editingCell);
      if (ctrl && typeof ctrl.checkValidity === 'function' && !ctrl.checkValidity()) {
        ctrl.reportValidity?.();
        return;
      }
    }
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
      // Opt-in saving state: the commit is optimistic — mark the cell
      // pending until the server's row re-render replaces it (the
      // edit-feedback contract). Only with data-hc-datagrid-pending on
      // the grid: without the re-render wiring nothing would clear it.
      if (grid.hasAttribute('data-hc-datagrid-pending')) {
        cell.setAttribute('data-pending', '');
        cell.setAttribute('aria-busy', 'true');
      }
      // Dispatch from the CELL so the event bubbles through the row and
      // its record tbody — that is what lets per-record htmx wiring
      // (the edit-errors recipe) hear only its own edits. Grid-level
      // listeners keep working via the same bubble.
      cell.dispatchEvent(
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
    if (editingCell) {
      commitEdit();
      if (editingCell) return; // commit refused (invalid) — stay there
    }

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
    if (!isOurs(event)) return;
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
  // A cell that carries its own message (an error tooltip wired through
  // aria-describedby, or a server-rendered data-invalid) owns the
  // hover/focus gesture — showing the overflow tip too would put two
  // meanings on one interaction. Error wins; the clipped text stays
  // readable by widening the column.
  function ownsItsTip(cell) {
    return !!cell?.matches?.('[data-invalid], [aria-describedby]');
  }
  function onPointerOver(event) {
    if (!isOurs(event)) return;
    const el = event.target.closest?.('.hc-datagrid__truncate');
    if (ownsItsTip(el?.closest?.('.hc-datagrid__cell'))) return;
    if (isClipped(el)) showTip(el);
  }
  function onPointerOut(event) {
    if (event.target.closest?.('.hc-datagrid__truncate')) hideTip();
  }
  function onTipFocusin(event) {
    if (!isOurs(event)) return;
    const cell = event.target.closest?.('.hc-datagrid__cell');
    if (ownsItsTip(cell)) {
      hideTip();
      return;
    }
    const el = cell?.querySelector?.(':scope > .hc-datagrid__truncate') ?? null;
    if (isClipped(el)) showTip(el);
    else hideTip();
  }

  // ---- Fragment navigation (report → row, or → the offending cell) ----
  // A link like `#row-101` (a bulk-error report entry, a deep link)
  // scrolls the row into view for free — but scrolling alone strands
  // keyboard and screen-reader users. When the hash names a row in
  // THIS grid, move the active cell to its first cell and focus it, so
  // arrow keys continue from where the user landed. `:target` supplies
  // the visual emphasis (CSS); this supplies the focus.
  //
  // The hash may name a CELL instead (`#cell-101-ship-date`). A row of
  // thirty columns does not tell the user which one was rejected, and
  // the offending column is often scrolled out of view — landing on the
  // cell fixes both, because setActive() scrolls it in on both axes.
  function focusHashRow() {
    const hash = grid.ownerDocument.defaultView?.location?.hash;
    if (!hash || hash.length < 2) return;
    let target;
    try {
      target = grid.querySelector(
        `${hash}.hc-datagrid__row, ${hash}.hc-datagrid__cell`,
      );
    } catch {
      return; // not a usable id selector
    }
    if (!target || target.closest('.hc-datagrid') !== grid) return;
    const cell = target.classList.contains('hc-datagrid__cell')
      ? target
      : rowCells(target)[0];
    const row = cell?.closest('.hc-datagrid__row');
    if (!cell || !row || row.hidden) return;
    const pos = locate(cell);
    if (pos) setActive(pos.r, pos.c);
  }

  const onHashChange = () => focusHashRow();

  rebuild();
  initGroups();
  initTrees();
  measure(grid);
  initDetails();
  initResizers();
  initSort();

  table.addEventListener('keydown', onKeydown);
  table.addEventListener('mousedown', onMousedown);
  table.addEventListener('compositionstart', onCompositionstart);
  table.addEventListener('keydown', onSortKeydown);
  table.addEventListener('change', onChange);
  table.addEventListener('focusin', onFocusin);
  table.addEventListener('dblclick', onDblclick);
  table.addEventListener('click', onToggleClick);
  table.addEventListener('click', onTreeClick);
  table.addEventListener('click', onGroupClick);
  table.addEventListener('click', onSortClick);
  grid.addEventListener('pointerover', onPointerOver);
  grid.addEventListener('pointerout', onPointerOut);
  grid.addEventListener('focusin', onTipFocusin);
  grid.addEventListener('focusout', hideTip);
  if (scrollEl) scrollEl.addEventListener('scroll', hideTip, { passive: true });
  const view = grid.ownerDocument.defaultView;
  if (view) view.addEventListener('hashchange', onHashChange);
  focusHashRow(); // a deep link that arrived with the page

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => measure(grid));
    ro.observe(grid);
  }
  let mo = null;
  const tbody = grid.querySelector('.hc-datagrid__body');
  if (typeof MutationObserver !== 'undefined') {
    mo = new MutationObserver(() => {
      // A row replaced WHILE its editor was open (an SSE update,
      // another user's change, a pager refresh) leaves editingCell
      // pointing at a detached node. Left alone it strands the
      // behavior: onKeydown returns early whenever editingCell is set,
      // so keyboard navigation stops responding, and a later commit
      // would write into a node no longer in the document. The row is
      // gone either way — drop the editing state so navigation
      // resumes. (Apps that cannot afford silent loss should pair
      // remote row updates with the edit-conflict contract.)
      if (editingCell && !grid.contains(editingCell)) {
        delete editingCell.__hcOldValue;
        delete editingCell.__hcOldHTML;
        editingCell = null;
        pendingCombo = null;
      }
      rebuild();
      // Lazy tree children have arrived — clear the loading state.
      for (const r of ownedBy(grid, '.hc-datagrid__row[data-loaded][aria-busy]')) {
        r.removeAttribute('aria-busy');
      }
      // A row re-render answered the pending commit — a swapped row
      // arrives without data-pending, and any survivor elsewhere is
      // stale (belt-and-braces for multi-edit races).
      for (const cell of ownedBy(grid, '.hc-datagrid__cell[data-pending]')) {
        cell.removeAttribute('data-pending');
        cell.removeAttribute('aria-busy');
      }
      measure(grid);
      // Swapped-in rows carry their own selection state (usually none;
      // possibly server-rendered `checked` + aria-selected). Normalize the
      // unit attributes from the checkboxes — the form truth — then tell
      // selection consumers, so a selection actions bar clears itself after
      // a bulk action re-renders the page.
      for (const unit of recordUnits(grid)) {
        const cb = unit.querySelector('input[type="checkbox"]');
        if (cb) setUnitSelected(unit, cb.checked);
      }
      syncSelectAll();
      emitSelection();
    });
    if (tbody) mo.observe(tbody, { childList: true });
    // Record layouts have no single __body — the records are table-level
    // tbodies, and a record swap (the edit-errors contract's unit)
    // replaces one of them. Observe the table's children so those swaps
    // rebuild too.
    mo.observe(table, { childList: true });
  }

  detachers.set(grid, () => {
    table.removeEventListener('keydown', onKeydown);
    table.removeEventListener('mousedown', onMousedown);
    table.removeEventListener('compositionstart', onCompositionstart);
    table.removeEventListener('keydown', onSortKeydown);
    table.removeEventListener('change', onChange);
    table.removeEventListener('focusin', onFocusin);
    table.removeEventListener('dblclick', onDblclick);
    table.removeEventListener('click', onToggleClick);
    table.removeEventListener('click', onTreeClick);
    table.removeEventListener('click', onGroupClick);
    table.removeEventListener('click', onSortClick);
    grid.removeEventListener('pointerover', onPointerOver);
    grid.removeEventListener('pointerout', onPointerOut);
    grid.removeEventListener('focusin', onTipFocusin);
    grid.removeEventListener('focusout', hideTip);
    if (scrollEl) scrollEl.removeEventListener('scroll', hideTip);
    if (view) view.removeEventListener('hashchange', onHashChange);
    tip.remove();
    for (const cleanup of resizerCleanups) cleanup();
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
