// Unit coverage for the shared positioning fallback. Eight behaviors
// (tooltip, popover, hovercard, menu, submenu, navmenu, combobox,
// multicombobox) route through this module on engines without CSS Anchor
// Positioning — a regression here breaks all of them at once. The
// Playwright anchor-fallback.spec.mjs stays the integration layer; these
// tests pin the geometry and lifecycle contracts in isolation.
import { describe, it, expect, vi } from 'vitest';
import {
  supportsAnchorPositioning,
  readSideAlign,
  positionFloating,
  trackFloating,
} from '../src/js/anchor-fallback.js';

const VW = window.innerWidth;   // 1024 under jsdom
const VH = window.innerHeight;  // 768 under jsdom

/** Stub an element's getBoundingClientRect with a fixed rect. */
function stubRect(el, { top, left, width, height }) {
  el.getBoundingClientRect = () => ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  });
}

function mount({ anchor = {}, floating = {} } = {}) {
  const a = document.createElement('button');
  const f = document.createElement('div');
  document.body.append(a, f);
  stubRect(a, { top: 300, left: 400, width: 100, height: 40, ...anchor });
  stubRect(f, { top: 0, left: 0, width: 200, height: 100, ...floating });
  return { a, f };
}

const px = (n) => `${n}px`;

// jsdom < 30 has no CSS interface at all; jsdom 30's CSS.supports parses
// anchor-name for real. Pin the detection contract against explicit stubs
// instead of whatever the current jsdom answers.
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = { supports: () => false, escape: (s) => String(s) };
}

describe('supportsAnchorPositioning', () => {
  it('mirrors CSS.supports("anchor-name", …)', () => {
    const orig = CSS.supports;
    CSS.supports = () => false;
    expect(supportsAnchorPositioning()).toBe(false);
    CSS.supports = (prop) => prop === 'anchor-name';
    expect(supportsAnchorPositioning()).toBe(true);
    CSS.supports = orig;
  });

  it('is false when CSS.supports is missing or throws', () => {
    const orig = CSS.supports;
    CSS.supports = undefined;
    expect(supportsAnchorPositioning()).toBe(false);
    CSS.supports = () => {
      throw new Error('boom');
    };
    expect(supportsAnchorPositioning()).toBe(false);
    CSS.supports = orig;
  });
});

describe('readSideAlign', () => {
  it('maps physical data-side to the logical axis', () => {
    const el = document.createElement('div');
    for (const [attr, side] of [
      ['top', 'block-start'],
      ['bottom', 'block-end'],
      ['left', 'inline-start'],
      ['right', 'inline-end'],
    ]) {
      el.setAttribute('data-side', attr);
      expect(readSideAlign(el).side).toBe(side);
    }
  });

  it('falls back per option, then to block-end / start, on absent or invalid values', () => {
    const el = document.createElement('div');
    expect(readSideAlign(el)).toEqual({ side: 'block-end', align: 'start' });
    expect(readSideAlign(el, { side: 'block-start', align: 'center' })).toEqual({
      side: 'block-start',
      align: 'center',
    });
    el.setAttribute('data-side', 'diagonal');
    el.setAttribute('data-align', 'middle');
    expect(readSideAlign(el)).toEqual({ side: 'block-end', align: 'start' });
  });

  it('accepts only start / center / end for data-align', () => {
    const el = document.createElement('div');
    el.setAttribute('data-align', 'end');
    expect(readSideAlign(el).align).toBe('end');
  });
});

describe('positionFloating — block sides (dropdown)', () => {
  it('places below the anchor with the gap, inline-start aligned', () => {
    const { a, f } = mount();
    positionFloating(f, a, { side: 'block-end', gap: 4 });
    expect(f.style.top).toBe(px(300 + 40 + 4));
    expect(f.style.left).toBe(px(400));
    expect(f.style.position).toBe('fixed');
  });

  it('flips above when below would overflow and there is room', () => {
    const { a, f } = mount({ anchor: { top: VH - 50 } }); // bottom = VH - 10
    positionFloating(f, a, { side: 'block-end', gap: 4 });
    expect(f.style.top).toBe(px(VH - 50 - 100 - 4)); // a.top - f.height - gap
  });

  it('places above for block-start and flips below on overflow', () => {
    const { a, f } = mount({ anchor: { top: 20 } }); // no room above (120 needed)
    positionFloating(f, a, { side: 'block-start', gap: 4 });
    expect(f.style.top).toBe(px(20 + 40 + 4)); // flipped below
  });

  it('centers on the inline axis with align: center', () => {
    const { a, f } = mount();
    positionFloating(f, a, { align: 'center' });
    expect(f.style.left).toBe(px(400 + (100 - 200) / 2));
  });

  it('aligns inline-end edges with align: end', () => {
    const { a, f } = mount();
    positionFloating(f, a, { align: 'end' });
    expect(f.style.left).toBe(px(400 + 100 - 200)); // a.right - f.width
  });

  it('clamps so the surface never sits off-screen', () => {
    const { a, f } = mount({ anchor: { top: -200, left: -300 } });
    positionFloating(f, a, { gap: 4 });
    expect(parseFloat(f.style.top)).toBeGreaterThanOrEqual(4);
    expect(parseFloat(f.style.left)).toBeGreaterThanOrEqual(4);
  });

  it('swaps the physical edge for align under RTL', () => {
    const { a, f } = mount();
    a.style.direction = 'rtl';
    positionFloating(f, a, { align: 'start' });
    // RTL start = inline-start = physical right edge alignment.
    expect(f.style.left).toBe(px(400 + 100 - 200));
  });

  it('matchWidth pins min-width to the anchor width', () => {
    const { a, f } = mount();
    positionFloating(f, a, { matchWidth: true });
    expect(f.style.minWidth).toBe(px(100));
  });
});

describe('positionFloating — inline sides (submenu)', () => {
  it('places to the physical right for inline-end in LTR, tops aligned', () => {
    const { a, f } = mount();
    positionFloating(f, a, { side: 'inline-end', gap: 4 });
    expect(f.style.left).toBe(px(400 + 100 + 4)); // a.right + gap
    expect(f.style.top).toBe(px(300));            // align start = tops
  });

  it('flips to the other side when it would overflow the viewport', () => {
    const { a, f } = mount({ anchor: { left: VW - 120 } }); // right = VW - 20
    positionFloating(f, a, { side: 'inline-end', gap: 4 });
    expect(f.style.left).toBe(px(VW - 120 - 200 - 4)); // a.left - f.width - gap
  });

  it('resolves inline-end to the physical left under RTL', () => {
    const { a, f } = mount();
    a.style.direction = 'rtl';
    positionFloating(f, a, { side: 'inline-end', gap: 4 });
    expect(f.style.left).toBe(px(400 - 200 - 4)); // a.left - f.width - gap
  });
});

describe('trackFloating', () => {
  it('positions immediately and re-positions on scroll and resize', () => {
    const { a, f } = mount();
    const cleanup = trackFloating(f, a, { side: 'block-end', gap: 4 });
    expect(f.style.top).toBe(px(344));

    stubRect(a, { top: 100, left: 400, width: 100, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    expect(f.style.top).toBe(px(144));

    stubRect(a, { top: 200, left: 400, width: 100, height: 40 });
    window.dispatchEvent(new Event('resize'));
    expect(f.style.top).toBe(px(244));
    cleanup();
  });

  it('cleanup detaches both listeners, clears inline styles, and is idempotent', () => {
    const { a, f } = mount();
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const cleanup = trackFloating(f, a, {});
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function));

    cleanup();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(f.style.position).toBe('');
    expect(f.style.top).toBe('');
    expect(f.style.left).toBe('');

    const removeCalls = remove.mock.calls.length;
    cleanup(); // second call must be a no-op
    expect(remove.mock.calls.length).toBe(removeCalls);
    add.mockRestore();
    remove.mockRestore();
  });

  it('stops tracking after cleanup', () => {
    const { a, f } = mount();
    const cleanup = trackFloating(f, a, { side: 'block-end', gap: 4 });
    cleanup();
    stubRect(a, { top: 100, left: 400, width: 100, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    expect(f.style.top).toBe(''); // cleared by cleanup, not re-set
  });
});
