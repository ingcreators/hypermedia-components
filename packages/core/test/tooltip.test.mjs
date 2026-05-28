import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installTooltip } from '../src/js/tooltip.js';

let uninstall = () => {};

const SIMPLE = `
  <button id="trigger" type="button" aria-describedby="tip">Save</button>
  <div id="tip" class="hc-tooltip">Save document</div>
`;

// jsdom doesn't implement the popover algorithm or the `CSS` global
// — same shim cluster the menu tests use. Wrapping matches once so
// the behavior's `:popover-open` short-circuit can flip via a
// `data-open-stub` attribute.
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

describe('installTooltip', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installTooltip();
    const u2 = installTooltip();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('auto-sets popover="manual" and role="tooltip" on the tooltip element', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTooltip();
    const tip = document.getElementById('tip');
    expect(tip.getAttribute('popover')).toBe('manual');
    expect(tip.getAttribute('role')).toBe('tooltip');
  });

  it('does not overwrite an author-supplied popover or role attribute', () => {
    document.body.innerHTML = `
      <button id="trigger" aria-describedby="tip">Save</button>
      <div id="tip" class="hc-tooltip" popover="auto" role="status">Save</div>
    `;
    uninstall = installTooltip();
    const tip = document.getElementById('tip');
    expect(tip.getAttribute('popover')).toBe('auto');
    expect(tip.getAttribute('role')).toBe('status');
  });

  it('shows on mouseenter after the 300ms delay and hides on mouseleave after 100ms', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTooltip();
    const trigger = document.getElementById('trigger');
    const tip = document.getElementById('tip');

    fire(trigger, 'mouseenter');
    expect(tip.matches(':popover-open')).toBe(false);
    vi.advanceTimersByTime(299);
    expect(tip.matches(':popover-open')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(tip.matches(':popover-open')).toBe(true);

    fire(trigger, 'mouseleave');
    expect(tip.matches(':popover-open')).toBe(true);
    vi.advanceTimersByTime(100);
    expect(tip.matches(':popover-open')).toBe(false);
  });

  it('shows immediately on focus (a11y — no delay for keyboard users)', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTooltip();
    const trigger = document.getElementById('trigger');
    const tip = document.getElementById('tip');

    fire(trigger, 'focus');
    expect(tip.matches(':popover-open')).toBe(true);
  });

  it('hides immediately on blur', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTooltip();
    const trigger = document.getElementById('trigger');
    const tip = document.getElementById('tip');

    fire(trigger, 'focus');
    expect(tip.matches(':popover-open')).toBe(true);
    fire(trigger, 'blur');
    expect(tip.matches(':popover-open')).toBe(false);
  });

  it('Escape on the trigger hides the tooltip without losing focus', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTooltip();
    const trigger = document.getElementById('trigger');
    const tip = document.getElementById('tip');

    fire(trigger, 'focus');
    expect(tip.matches(':popover-open')).toBe(true);

    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(tip.matches(':popover-open')).toBe(false);
  });

  it('mouseleave during the show delay cancels the pending show', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installTooltip();
    const trigger = document.getElementById('trigger');
    const tip = document.getElementById('tip');

    fire(trigger, 'mouseenter');
    vi.advanceTimersByTime(150);
    fire(trigger, 'mouseleave');
    vi.advanceTimersByTime(500);
    expect(tip.matches(':popover-open')).toBe(false);
  });

  it('one tooltip can serve multiple triggers via aria-describedby', () => {
    document.body.innerHTML = `
      <button id="t1" aria-describedby="tip">A</button>
      <button id="t2" aria-describedby="tip">B</button>
      <div id="tip" class="hc-tooltip">Shared</div>
    `;
    uninstall = installTooltip();
    const t1 = document.getElementById('t1');
    const t2 = document.getElementById('t2');
    const tip = document.getElementById('tip');

    fire(t1, 'focus');
    expect(tip.matches(':popover-open')).toBe(true);
    fire(t1, 'blur');
    expect(tip.matches(':popover-open')).toBe(false);
    fire(t2, 'focus');
    expect(tip.matches(':popover-open')).toBe(true);
  });

  it('skips .hc-tooltip without an id (cannot be targeted by aria-describedby)', () => {
    document.body.innerHTML = `<div class="hc-tooltip">Orphan</div>`;
    uninstall = installTooltip();
    const tip = document.querySelector('.hc-tooltip');
    expect(tip.hasAttribute('popover')).toBe(false);
  });

  it('skips .hc-tooltip with no matching aria-describedby trigger', () => {
    document.body.innerHTML = `<div class="hc-tooltip" id="orphan-tip">Lonely</div>`;
    uninstall = installTooltip();
    expect(document.getElementById('orphan-tip').hasAttribute('popover')).toBe(false);
  });

  it('uninstall detaches listeners and hides any open tooltip', () => {
    document.body.innerHTML = SIMPLE;
    const u = installTooltip();
    const trigger = document.getElementById('trigger');
    const tip = document.getElementById('tip');

    fire(trigger, 'focus');
    expect(tip.matches(':popover-open')).toBe(true);

    u();
    expect(tip.matches(':popover-open')).toBe(false);

    // After uninstall, focus no longer triggers show.
    fire(trigger, 'focus');
    expect(tip.matches(':popover-open')).toBe(false);
    uninstall = () => {};
  });

  it('picks up .hc-tooltip added after install (MutationObserver)', async () => {
    document.body.innerHTML = `<button id="trigger" aria-describedby="late-tip">A</button>`;
    uninstall = installTooltip();

    const tip = document.createElement('div');
    tip.id = 'late-tip';
    tip.className = 'hc-tooltip';
    tip.textContent = 'Late';
    document.body.appendChild(tip);

    // MutationObserver fires async.
    await vi.advanceTimersByTimeAsync(0);

    expect(tip.getAttribute('popover')).toBe('manual');
    expect(tip.getAttribute('role')).toBe('tooltip');
  });
});
