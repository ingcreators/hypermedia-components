import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installHovercard } from '../src/js/hovercard.js';

let uninstall = () => {};

const SIMPLE = `
  <a href="#" id="trigger" aria-describedby="card">Ada Lovelace</a>
  <div class="hc-hovercard" id="card">
    <header class="hc-hovercard__header">
      <div>
        <div class="hc-hovercard__title">Ada Lovelace</div>
      </div>
    </header>
    <div class="hc-hovercard__body">
      <p>First computer programmer. <a href="#" id="card-link">View</a></p>
    </div>
  </div>
`;

if (!HTMLElement.prototype.hidePopover) {
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute('data-open-stub');
    this.dispatchEvent(new Event('toggle'));
  };
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute('data-open-stub', '');
    this.dispatchEvent(new Event('toggle'));
  };
}
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {
    supports: () => false,
    escape: (s) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`),
  };
}
const ORIG_MATCHES = Element.prototype.matches;
Element.prototype.matches = function (sel) {
  if (sel === ':popover-open') return this.hasAttribute('data-open-stub');
  return ORIG_MATCHES.call(this, sel);
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function fire(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: false }));
}

describe('installHovercard', () => {
  it('is idempotent', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installHovercard();
    const u2 = installHovercard();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('auto-sets popover="manual" on the card', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    expect(document.getElementById('card').getAttribute('popover')).toBe('manual');
  });

  it('mouseenter on the trigger opens the card after the 500ms delay', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    const trigger = document.getElementById('trigger');
    const card = document.getElementById('card');

    fire(trigger, 'mouseenter');
    expect(card.matches(':popover-open')).toBe(false);
    vi.advanceTimersByTime(499);
    expect(card.matches(':popover-open')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(card.matches(':popover-open')).toBe(true);
  });

  it('focus on the trigger shows the card immediately', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    const trigger = document.getElementById('trigger');
    fire(trigger, 'focus');
    expect(document.getElementById('card').matches(':popover-open')).toBe(true);
  });

  it('mouseleave on trigger waits 200ms before hiding', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    const trigger = document.getElementById('trigger');
    const card = document.getElementById('card');
    fire(trigger, 'focus');
    expect(card.matches(':popover-open')).toBe(true);
    // Pretend the trigger was hovered too; clear that hover.
    fire(trigger, 'blur');
    expect(card.matches(':popover-open')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(card.matches(':popover-open')).toBe(false);
  });

  it('hovering INTO the card cancels the pending hide (move from trigger into card)', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    const trigger = document.getElementById('trigger');
    const card = document.getElementById('card');

    fire(trigger, 'mouseenter');
    vi.advanceTimersByTime(500);
    expect(card.matches(':popover-open')).toBe(true);

    // User leaves the trigger but enters the card immediately.
    fire(trigger, 'mouseleave');
    fire(card, 'mouseenter');
    vi.advanceTimersByTime(500);
    // Card stays open because cardHovered is still true.
    expect(card.matches(':popover-open')).toBe(true);
  });

  it('leaving the card after entering it schedules the hide', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    const trigger = document.getElementById('trigger');
    const card = document.getElementById('card');

    fire(trigger, 'mouseenter');
    vi.advanceTimersByTime(500);
    fire(trigger, 'mouseleave');
    fire(card, 'mouseenter');
    expect(card.matches(':popover-open')).toBe(true);

    fire(card, 'mouseleave');
    vi.advanceTimersByTime(200);
    expect(card.matches(':popover-open')).toBe(false);
  });

  it('Escape on the trigger closes the card without losing focus', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    const trigger = document.getElementById('trigger');
    const card = document.getElementById('card');
    fire(trigger, 'focus');
    expect(card.matches(':popover-open')).toBe(true);

    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(card.matches(':popover-open')).toBe(false);
  });

  it('mouseleave during the show delay cancels the pending show', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installHovercard();
    const trigger = document.getElementById('trigger');
    const card = document.getElementById('card');

    fire(trigger, 'mouseenter');
    vi.advanceTimersByTime(200);
    fire(trigger, 'mouseleave');
    vi.advanceTimersByTime(1000);
    expect(card.matches(':popover-open')).toBe(false);
  });

  it('skips cards without an id (cannot be targeted)', () => {
    document.body.innerHTML = '<div class="hc-hovercard">Orphan</div>';
    uninstall = installHovercard();
    expect(document.querySelector('.hc-hovercard').hasAttribute('popover')).toBe(false);
  });

  it('uninstall detaches handlers and closes any open card', () => {
    document.body.innerHTML = SIMPLE;
    const u = installHovercard();
    const trigger = document.getElementById('trigger');
    const card = document.getElementById('card');
    fire(trigger, 'focus');
    expect(card.matches(':popover-open')).toBe(true);

    u();
    expect(card.matches(':popover-open')).toBe(false);
    fire(trigger, 'focus');
    expect(card.matches(':popover-open')).toBe(false);
    uninstall = () => {};
  });

  it('picks up .hc-hovercard added after install (MutationObserver)', async () => {
    document.body.innerHTML = '<a href="#" id="trigger" aria-describedby="late-card">A</a>';
    uninstall = installHovercard();

    const card = document.createElement('div');
    card.id = 'late-card';
    card.className = 'hc-hovercard';
    card.textContent = 'Late';
    document.body.appendChild(card);

    await vi.advanceTimersByTimeAsync(0);
    expect(card.getAttribute('popover')).toBe('manual');
  });
});
