// Shared fallback positioning for popovers when CSS Anchor Positioning is
// unavailable (e.g. current Firefox). The components position their popovers
// with CSS anchor positioning + `position-try-fallbacks`; in engines without
// it, a `[popover]` would otherwise sit centred in the viewport. This module
// mirrors that CSS behaviour in JS: place the floating element next to its
// anchor, flip on overflow, clamp to the viewport, and keep it tracking on
// scroll / resize until cleaned up.
//
// Geometry is set with PHYSICAL `top` / `left` (computed from
// getBoundingClientRect, which is physical), so it is correct under both LTR
// and RTL; inline-axis *alignment* is direction-aware.

/**
 * Feature-detect CSS Anchor Positioning. Returns false where `CSS.supports`
 * is missing (e.g. jsdom < 30), which routes those environments through the
 * fallback too. Note jsdom 30+ *parses* anchor-name and answers true here
 * without doing any layout — tests that exercise the fallback stub
 * `CSS.supports` to false explicitly.
 *
 * @returns {boolean}
 */
export function supportsAnchorPositioning() {
  try {
    return (
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('anchor-name', '--x')
    );
  } catch {
    return false;
  }
}

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// data-side (physical) → fallback `side` (logical block / inline axis).
const SIDE_TO_AXIS = {
  top: 'block-start',
  bottom: 'block-end',
  left: 'inline-start',
  right: 'inline-end',
};

/**
 * Read a floating element's `data-side` / `data-align` attributes into the
 * `{ side, align }` options {@link positionFloating} understands, falling
 * back to the component's default when an attribute is absent or invalid.
 * The CSS Anchor Positioning path keys off the same attributes
 * (`position-area`), so both paths place the element identically.
 *
 * @param {Element} el
 * @param {{ side?: string, align?: string }} [fallback]
 * @returns {{ side: string, align: 'start'|'center'|'end' }}
 */
export function readSideAlign(el, fallback = {}) {
  const side = SIDE_TO_AXIS[el.getAttribute('data-side')] ?? fallback.side ?? 'block-end';
  const alignAttr = el.getAttribute('data-align');
  const align = ['start', 'center', 'end'].includes(alignAttr)
    ? alignAttr
    : fallback.align ?? 'start';
  return { side, align };
}

/**
 * Position `floating` next to `anchor`, once.
 *
 * @param {HTMLElement} floating  the popover to place (already in the top layer)
 * @param {HTMLElement} anchor    the trigger to place it against
 * @param {object} [opts]
 * @param {'block-end'|'block-start'|'inline-end'|'inline-start'} [opts.side='block-end']
 *   primary side. The block sides drop the floating element below / above the
 *   anchor (dropdown); the inline sides place it to the right / left
 *   (submenu), aligning their block-start edges.
 * @param {'start'|'center'} [opts.align='start']  inline-axis alignment (block sides only)
 * @param {number} [opts.gap=4]  distance from the anchor, px
 * @param {boolean} [opts.matchWidth=false]  set min-width to the anchor width
 */
export function positionFloating(floating, anchor, opts = {}) {
  const { side = 'block-end', align = 'start', gap = 4, matchWidth = false } = opts;
  // When the JS fallback runs, it owns placement: neutralise any CSS Anchor
  // Positioning the engine may still apply. A browser without anchor support
  // ignores these (a no-op), but one that supports them would otherwise let
  // the stylesheet's `position-area` / `position-try-fallbacks` override our
  // inline top/left (observed in Chrome 149 / Playwright 1.61).
  floating.style.setProperty('position-area', 'none');
  floating.style.setProperty('position-try-fallbacks', 'none');
  floating.style.setProperty('position-anchor', 'none');
  const a = anchor.getBoundingClientRect();
  const f = floating.getBoundingClientRect();
  const view = floating.ownerDocument.defaultView;
  const vw = view?.innerWidth ?? 0;
  const vh = view?.innerHeight ?? 0;
  const rtl = view ? view.getComputedStyle(anchor).direction === 'rtl' : false;

  // Inline sides (submenu): place beside the anchor, align block tops.
  if (side === 'inline-end' || side === 'inline-start') {
    // `inline-end` resolves to the physical right in LTR, left in RTL.
    const toRight = (side === 'inline-end') !== rtl;
    let left;
    if (toRight) {
      left = a.right + gap;
      if (left + f.width > vw && a.left - f.width - gap >= 0) left = a.left - f.width - gap;
    } else {
      left = a.left - f.width - gap;
      if (left < 0 && a.right + f.width + gap <= vw) left = a.right + gap;
    }
    // Cross axis (block): align start (tops) / center / end (bottoms),
    // flipping the chosen edge when it would overflow.
    let top;
    if (align === 'center') {
      top = a.top + (a.height - f.height) / 2;
    } else if (align === 'end') {
      top = a.bottom - f.height;
      if (top < 0 && a.top + f.height <= vh) top = a.top;
    } else {
      top = a.top;
      if (top + f.height > vh && a.bottom - f.height >= 0) top = a.bottom - f.height;
    }
    top = clamp(top, gap, Math.max(gap, vh - f.height - gap));
    left = clamp(left, gap, Math.max(gap, vw - f.width - gap));

    floating.style.position = 'fixed';
    // Clear any CSS-set insets first. `inset` covers the logical longhands the
    // anchor-positioning stylesheet sets; setting `inset-block-start: auto`
    // after `top` would instead clobber it (they are aliases — last wins,
    // and Chrome 149 orders logical after physical).
    floating.style.setProperty('inset', 'auto');
    floating.style.top = `${top}px`;
    floating.style.left = `${left}px`;
    floating.style.margin = '0';
    if (matchWidth) floating.style.minWidth = `${a.width}px`;
    return;
  }

  // Block axis: primary side, flip when it would overflow and there is room.
  let top;
  if (side === 'block-start') {
    top = a.top - f.height - gap;
    if (top < 0 && a.bottom + f.height + gap <= vh) top = a.bottom + gap;
  } else {
    top = a.bottom + gap;
    if (top + f.height > vh && a.top - f.height - gap >= 0) top = a.top - f.height - gap;
  }

  // Inline axis: align start / center / end, then flip on overflow.
  let left;
  if (align === 'center') {
    left = a.left + (a.width - f.width) / 2;
  } else {
    // `start` aligns the inline-start edges, `end` the inline-end edges; RTL
    // swaps which physical edge each maps to.
    const startToLeft = (align !== 'end') !== rtl;
    if (startToLeft) {
      left = a.left;
      if (left + f.width > vw && a.right - f.width >= 0) left = a.right - f.width;
    } else {
      left = a.right - f.width;
      if (left < 0 && a.left + f.width <= vw) left = a.left;
    }
  }

  // Final safety clamp so it can never sit fully off-screen.
  top = clamp(top, gap, Math.max(gap, vh - f.height - gap));
  left = clamp(left, gap, Math.max(gap, vw - f.width - gap));

  floating.style.position = 'fixed';
  // Clear any CSS-set insets first (see the inline-side branch above).
  floating.style.setProperty('inset', 'auto');
  floating.style.top = `${top}px`;
  floating.style.left = `${left}px`;
  floating.style.margin = '0';
  if (matchWidth) floating.style.minWidth = `${a.width}px`;
}

const CLEARED = [
  'position',
  'top',
  'left',
  'inset',
  'position-area',
  'position-try-fallbacks',
  'position-anchor',
  'margin',
  'min-width',
];

/**
 * Position `floating` against `anchor` now and keep it tracking while open.
 * Re-runs on scroll (in any ancestor, via capture) and on resize.
 *
 * @param {HTMLElement} floating
 * @param {HTMLElement} anchor
 * @param {object} [opts]  see {@link positionFloating}
 * @returns {() => void}  cleanup — removes the listeners and clears the inline
 *   styles. Idempotent.
 */
export function trackFloating(floating, anchor, opts = {}) {
  const view = floating.ownerDocument.defaultView;
  const reposition = () => positionFloating(floating, anchor, opts);
  reposition();
  // capture:true so scrolls in ancestor scroll containers are caught too.
  view?.addEventListener('scroll', reposition, true);
  view?.addEventListener('resize', reposition);

  let done = false;
  return () => {
    if (done) return;
    done = true;
    view?.removeEventListener('scroll', reposition, true);
    view?.removeEventListener('resize', reposition);
    for (const prop of CLEARED) floating.style.removeProperty(prop);
  };
}
