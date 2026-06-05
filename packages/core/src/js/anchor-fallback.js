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
 * is missing (e.g. jsdom), which routes those environments through the
 * fallback too.
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
    // Align the submenu's top with the anchor's; flip up if it overflows.
    let top = a.top;
    if (top + f.height > vh && a.bottom - f.height >= 0) top = a.bottom - f.height;
    top = clamp(top, gap, Math.max(gap, vh - f.height - gap));
    left = clamp(left, gap, Math.max(gap, vw - f.width - gap));

    floating.style.position = 'fixed';
    floating.style.top = `${top}px`;
    floating.style.left = `${left}px`;
    floating.style.insetInlineStart = 'auto';
    floating.style.insetBlockStart = 'auto';
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

  // Inline axis: align, then flip the alignment on overflow.
  let left;
  if (align === 'center') {
    left = a.left + (a.width - f.width) / 2;
  } else if (rtl) {
    // Align the inline-start (right) edges; flip to the left edge on overflow.
    left = a.right - f.width;
    if (left < 0 && a.left + f.width <= vw) left = a.left;
  } else {
    // Align the inline-start (left) edges; flip to the right edge on overflow.
    left = a.left;
    if (left + f.width > vw && a.right - f.width >= 0) left = a.right - f.width;
  }

  // Final safety clamp so it can never sit fully off-screen.
  top = clamp(top, gap, Math.max(gap, vh - f.height - gap));
  left = clamp(left, gap, Math.max(gap, vw - f.width - gap));

  floating.style.position = 'fixed';
  floating.style.top = `${top}px`;
  floating.style.left = `${left}px`;
  floating.style.insetInlineStart = 'auto';
  floating.style.insetBlockStart = 'auto';
  floating.style.margin = '0';
  if (matchWidth) floating.style.minWidth = `${a.width}px`;
}

const CLEARED = [
  'position',
  'top',
  'left',
  'inset-inline-start',
  'inset-block-start',
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
