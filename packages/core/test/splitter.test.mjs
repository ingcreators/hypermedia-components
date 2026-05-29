import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSplitter } from '../src/js/splitter.js';

let uninstall = () => {};

const FIXTURE = `
  <div class="hc-splitter" data-orientation="horizontal">
    <div class="hc-splitter__panel" id="pane-a">A</div>
    <div class="hc-splitter__handle" role="separator" tabindex="0" aria-label="Resize"></div>
    <div class="hc-splitter__panel">B</div>
  </div>
`;

function root() {
  return document.querySelector('.hc-splitter');
}
function handle() {
  return document.querySelector('.hc-splitter__handle');
}
function pos() {
  return root().style.getPropertyValue('--hc-splitter-pos');
}
function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installSplitter', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIXTURE;
    const u1 = installSplitter();
    const u2 = installSplitter();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('wires the window-splitter ARIA attributes and initial position', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSplitter();
    const h = handle();
    expect(h.getAttribute('role')).toBe('separator');
    expect(h.getAttribute('tabindex')).toBe('0');
    // Side-by-side panes → the separator line is vertical.
    expect(h.getAttribute('aria-orientation')).toBe('vertical');
    expect(h.getAttribute('aria-controls')).toBe('pane-a');
    expect(h.getAttribute('aria-valuemin')).toBe('10');
    expect(h.getAttribute('aria-valuemax')).toBe('90');
    expect(h.getAttribute('aria-valuenow')).toBe('50');
    expect(pos()).toBe('50%');
  });

  it('honours data-value / data-min / data-max', () => {
    document.body.innerHTML = FIXTURE
      .replace('data-orientation="horizontal"', 'data-orientation="horizontal" data-value="30" data-min="20" data-max="80"');
    uninstall = installSplitter();
    expect(handle().getAttribute('aria-valuenow')).toBe('30');
    expect(handle().getAttribute('aria-valuemin')).toBe('20');
    expect(pos()).toBe('30%');
  });

  it('arrow keys resize by the step and update value + custom property', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSplitter();
    press(handle(), 'ArrowRight'); // 50 → 55
    expect(handle().getAttribute('aria-valuenow')).toBe('55');
    expect(pos()).toBe('55%');
    press(handle(), 'ArrowLeft'); // 55 → 50
    expect(pos()).toBe('50%');
  });

  it('clamps to min / max; Home and End jump to the extremes', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSplitter();
    press(handle(), 'End');
    expect(pos()).toBe('90%');
    press(handle(), 'ArrowRight'); // already at max → stays
    expect(pos()).toBe('90%');
    press(handle(), 'Home');
    expect(pos()).toBe('10%');
  });

  it('dispatches hc:splitterchange with the new value', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSplitter();
    const detail = vi.fn();
    root().addEventListener('hc:splitterchange', (e) => detail(e.detail.value));
    press(handle(), 'ArrowRight');
    expect(detail).toHaveBeenCalledWith(55);
  });

  it('vertical orientation resizes with Up / Down, not Left / Right', () => {
    document.body.innerHTML = FIXTURE.replace('data-orientation="horizontal"', 'data-orientation="vertical"');
    uninstall = installSplitter();
    expect(handle().getAttribute('aria-orientation')).toBe('horizontal');
    press(handle(), 'ArrowRight'); // ignored for vertical
    expect(pos()).toBe('50%');
    press(handle(), 'ArrowDown'); // 50 → 55
    expect(pos()).toBe('55%');
  });

  it('pointer drag updates the position from the container rect', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installSplitter();
    root().getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0 });
    handle().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    handle().dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 150 }));
    expect(handle().getAttribute('aria-valuenow')).toBe('75'); // 150/200 = 75%
  });

  it('uninstall removes the listeners', () => {
    document.body.innerHTML = FIXTURE;
    const u = installSplitter();
    u();
    press(handle(), 'ArrowRight');
    expect(pos()).toBe('50%'); // unchanged after uninstall
  });

  it('picks up a splitter added to the DOM after install (MutationObserver)', async () => {
    uninstall = installSplitter();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    expect(handle().getAttribute('aria-valuenow')).toBe('50');
  });
});
