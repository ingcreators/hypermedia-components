import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installRange } from '../src/js/range.js';

let uninstall = () => {};

const RANGE = `
  <div class="hc-range" id="r">
    <input class="hc-range__input" type="range" id="low" name="price_min"
           min="0" max="100" value="20" aria-label="Minimum price">
    <input class="hc-range__input" type="range" id="high" name="price_max"
           min="0" max="100" value="80" aria-label="Maximum price">
  </div>
`;

const input = (id, value) => {
  const el = document.getElementById(id);
  el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return el;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installRange', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = RANGE;
    const u1 = installRange();
    const u2 = installRange();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('syncs the fill percentages onto the container at install', () => {
    document.body.innerHTML = RANGE;
    uninstall = installRange();
    const r = document.getElementById('r');
    expect(r.style.getPropertyValue('--hc-range-low')).toBe('20');
    expect(r.style.getPropertyValue('--hc-range-high')).toBe('80');
  });

  it('updates the percentages on input', () => {
    document.body.innerHTML = RANGE;
    uninstall = installRange();
    input('low', 35);
    const r = document.getElementById('r');
    expect(r.style.getPropertyValue('--hc-range-low')).toBe('35');
  });

  it('clamps low to high when dragged past it (the sibling holds)', () => {
    document.body.innerHTML = RANGE;
    uninstall = installRange();
    input('low', 95);
    expect(document.getElementById('low').value).toBe('80');
    expect(document.getElementById('high').value).toBe('80');
  });

  it('clamps high to low when dragged past it', () => {
    document.body.innerHTML = RANGE;
    uninstall = installRange();
    input('high', 5);
    expect(document.getElementById('high').value).toBe('20');
    expect(document.getElementById('low').value).toBe('20');
  });

  it('emits hc:rangechange with numeric input values', () => {
    document.body.innerHTML = RANGE;
    uninstall = installRange();
    let detail = null;
    document.getElementById('r').addEventListener('hc:rangechange', (e) => {
      detail = e.detail;
    });
    input('low', 30);
    expect(detail).toEqual({ low: 30, high: 80 });
  });

  it('maps non-zero min/max onto 0–100 percentages', () => {
    document.body.innerHTML = `
      <div class="hc-range" id="r2">
        <input class="hc-range__input" type="range" min="100" max="500" value="200" aria-label="Min">
        <input class="hc-range__input" type="range" min="100" max="500" value="400" aria-label="Max">
      </div>
    `;
    uninstall = installRange();
    const r = document.getElementById('r2');
    expect(r.style.getPropertyValue('--hc-range-low')).toBe('25');
    expect(r.style.getPropertyValue('--hc-range-high')).toBe('75');
  });

  it('picks up ranges swapped in later (MutationObserver)', async () => {
    uninstall = installRange();
    document.body.innerHTML = RANGE;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const r = document.getElementById('r');
    expect(r.style.getPropertyValue('--hc-range-low')).toBe('20');
  });

  it('the uninstaller removes listeners and properties', () => {
    document.body.innerHTML = RANGE;
    const u = installRange();
    u();
    const r = document.getElementById('r');
    expect(r.style.getPropertyValue('--hc-range-low')).toBe('');
    input('low', 95);
    // No clamp after uninstall — the raw value stands.
    expect(document.getElementById('low').value).toBe('95');
  });
});
