import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installCarousel } from '../src/js/carousel.js';

let uninstall = () => {};
let ioInstances = [];

class MockIntersectionObserver {
  constructor(cb, opts) {
    this.cb = cb;
    this.opts = opts;
    this.elements = [];
    ioInstances.push(this);
  }
  observe(el) {
    this.elements.push(el);
  }
  unobserve(el) {
    this.elements = this.elements.filter((e) => e !== el);
  }
  disconnect() {
    this.elements = [];
  }
}

function markup({ autoplay, dots = true } = {}) {
  const ap = autoplay != null ? ` data-autoplay="${autoplay}"` : '';
  const dotsHtml = dots
    ? '<div class="hc-carousel__dots" data-hc-carousel-dots role="group" aria-label="Choose slide"></div>'
    : '';
  return `
    <div class="hc-carousel" aria-label="Demo"${ap}>
      <div class="hc-carousel__viewport">
        <div class="hc-carousel__slide" data-testid="s0">A</div>
        <div class="hc-carousel__slide" data-testid="s1">B</div>
        <div class="hc-carousel__slide" data-testid="s2">C</div>
      </div>
      <button data-hc-carousel-prev aria-label="Previous">‹</button>
      <button data-hc-carousel-next aria-label="Next">›</button>
      ${dotsHtml}
    </div>
  `;
}

const slide = (i) => document.querySelector(`[data-testid="s${i}"]`);
const prev = () => document.querySelector('[data-hc-carousel-prev]');
const next = () => document.querySelector('[data-hc-carousel-next]');
const dots = () => Array.from(document.querySelectorAll('[data-hc-carousel-dot]'));

/** Fire the captured IntersectionObserver callback for one in-view slide. */
function intersect(index) {
  const io = ioInstances[ioInstances.length - 1];
  io.cb(
    [{ target: slide(index), isIntersecting: true, intersectionRatio: 1 }],
    io,
  );
}

beforeEach(() => {
  ioInstances = [];
  globalThis.IntersectionObserver = MockIntersectionObserver;
  window.IntersectionObserver = MockIntersectionObserver;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.matchMedia = undefined; // jsdom default: no reduced motion
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('installCarousel', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = markup();
    const u1 = installCarousel();
    const u2 = installCarousel();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('marks the first slide active and disables prev at the start', () => {
    document.body.innerHTML = markup();
    uninstall = installCarousel();

    expect(slide(0).hasAttribute('data-active')).toBe(true);
    expect(prev().disabled).toBe(true);
    expect(next().disabled).toBe(false);
  });

  it('auto-generates one dot per slide and marks the active one', () => {
    document.body.innerHTML = markup();
    uninstall = installCarousel();

    expect(dots()).toHaveLength(3);
    expect(dots()[0].getAttribute('aria-current')).toBe('true');
    expect(dots()[1].hasAttribute('aria-current')).toBe(false);
  });

  it('tracks the in-view slide and toggles end-state buttons', () => {
    document.body.innerHTML = markup();
    uninstall = installCarousel();

    intersect(2);
    expect(slide(2).hasAttribute('data-active')).toBe(true);
    expect(slide(0).hasAttribute('data-active')).toBe(false);
    expect(next().disabled).toBe(true);
    expect(prev().disabled).toBe(false);
    expect(dots()[2].getAttribute('aria-current')).toBe('true');

    intersect(0);
    expect(prev().disabled).toBe(true);
    expect(next().disabled).toBe(false);
  });

  it('next / prev / dot / ArrowRight scroll to the right slide', () => {
    document.body.innerHTML = markup();
    uninstall = installCarousel();
    const spies = [0, 1, 2].map((i) => (slide(i).scrollIntoView = vi.fn()));
    const clear = () => spies.forEach((s) => s.mockClear());

    next().click(); // 0 -> 1
    expect(spies[1]).toHaveBeenCalled();
    intersect(1);
    clear();

    dots()[2].click(); // -> 2
    expect(spies[2]).toHaveBeenCalled();
    intersect(2);
    clear();

    prev().click(); // 2 -> 1
    expect(spies[1]).toHaveBeenCalled();
    intersect(1);
    clear();

    const vp = document.querySelector('.hc-carousel__viewport');
    vp.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(spies[2]).toHaveBeenCalled();
  });

  it('emits hc:carouselchange with the active index', () => {
    document.body.innerHTML = markup();
    const seen = [];
    document.querySelector('.hc-carousel').addEventListener('hc:carouselchange', (e) => {
      seen.push(e.detail.index);
    });
    uninstall = installCarousel();
    intersect(2);
    expect(seen).toContain(2);
  });

  describe('autoplay', () => {
    it('advances on an interval and pauses on pointerenter', () => {
      vi.useFakeTimers();
      document.body.innerHTML = markup({ autoplay: 1000 });
      uninstall = installCarousel();
      [0, 1, 2].forEach((i) => {
        slide(i).scrollIntoView = vi.fn();
      });

      vi.advanceTimersByTime(1000); // tick: 0 -> 1
      expect(slide(1).scrollIntoView).toHaveBeenCalledTimes(1);

      document.querySelector('.hc-carousel').dispatchEvent(new window.Event('pointerenter'));
      slide(1).scrollIntoView.mockClear();
      vi.advanceTimersByTime(3000); // paused — no further ticks
      expect(slide(1).scrollIntoView).not.toHaveBeenCalled();
    });

    it('does not autoplay under prefers-reduced-motion', () => {
      vi.useFakeTimers();
      window.matchMedia = (q) => ({
        matches: /reduce/.test(q),
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
      document.body.innerHTML = markup({ autoplay: 1000 });
      uninstall = installCarousel();
      [0, 1, 2].forEach((i) => {
        slide(i).scrollIntoView = vi.fn();
      });

      vi.advanceTimersByTime(5000);
      expect(slide(1).scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('stops responding after uninstall', () => {
    document.body.innerHTML = markup();
    const u = installCarousel();
    [0, 1, 2].forEach((i) => {
      slide(i).scrollIntoView = vi.fn();
    });
    u();
    uninstall = () => {};
    next().click();
    expect(slide(1).scrollIntoView).not.toHaveBeenCalled();
  });
});
