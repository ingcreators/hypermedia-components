import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installPasswordToggle } from '../src/js/password-toggle.js';

let uninstall = () => {};

function markup({ controls = true } = {}) {
  const aria = controls ? ' aria-controls="pw"' : '';
  return `
    <div class="hc-input-group">
      <input class="hc-input" type="password" id="pw" />
      <button type="button" class="hc-button" data-hc-password-toggle${aria}
              data-testid="toggle">show</button>
    </div>
  `;
}

const field = () => document.getElementById('pw');
const toggle = () => document.querySelector('[data-hc-password-toggle]');

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installPasswordToggle', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = markup();
    const u1 = installPasswordToggle();
    const u2 = installPasswordToggle();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('initializes aria-pressed=false and a default show label', () => {
    document.body.innerHTML = markup();
    uninstall = installPasswordToggle();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Show password');
    expect(field().type).toBe('password');
  });

  it('reveals the field on click and restores it on a second click', () => {
    document.body.innerHTML = markup();
    uninstall = installPasswordToggle();

    toggle().click();
    expect(field().type).toBe('text');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Hide password');

    toggle().click();
    expect(field().type).toBe('password');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Show password');
  });

  it('honors custom data-hc-label-show / -hide labels', () => {
    document.body.innerHTML = `
      <div class="hc-input-group">
        <input class="hc-input" type="password" id="pw" />
        <button type="button" data-hc-password-toggle aria-controls="pw"
                data-hc-label-show="表示" data-hc-label-hide="非表示">👁</button>
      </div>
    `;
    uninstall = installPasswordToggle();
    expect(toggle().getAttribute('aria-label')).toBe('表示');
    toggle().click();
    expect(toggle().getAttribute('aria-label')).toBe('非表示');
  });

  it('falls back to the nearest input in the group when aria-controls is absent', () => {
    document.body.innerHTML = markup({ controls: false });
    uninstall = installPasswordToggle();
    toggle().click();
    expect(field().type).toBe('text');
  });

  it('upgrades dynamically added toggles via MutationObserver', async () => {
    uninstall = installPasswordToggle();
    document.body.innerHTML = markup();
    await Promise.resolve();
    // Allow the observer microtask/queue to flush.
    await new Promise((r) => setTimeout(r, 0));
    toggle().click();
    expect(field().type).toBe('text');
  });

  it('stops responding after uninstall', () => {
    document.body.innerHTML = markup();
    const u = installPasswordToggle();
    u();
    uninstall = () => {};
    toggle().click();
    // Click after teardown should not toggle (listener removed).
    expect(field().type).toBe('password');
  });
});
