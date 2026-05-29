import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installSlider } from '../src/js/slider.js';

let uninstall = () => {};

const SIMPLE = `
  <input class="hc-slider" type="range" id="s1" min="0" max="100" value="40">
`;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installSlider', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = SIMPLE;
    const u1 = installSlider();
    const u2 = installSlider();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('syncs --hc-slider-value to the current input value on install', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installSlider();
    const s = document.getElementById('s1');
    expect(s.style.getPropertyValue('--hc-slider-value')).toBe('40');
  });

  it('updates --hc-slider-value on `input` events', () => {
    document.body.innerHTML = SIMPLE;
    uninstall = installSlider();
    const s = document.getElementById('s1');
    s.value = '75';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    expect(s.style.getPropertyValue('--hc-slider-value')).toBe('75');
  });

  it('handles non-zero min and max correctly (percent mapping)', () => {
    document.body.innerHTML = `
      <input class="hc-slider" type="range" id="s2" min="20" max="40" value="30">
    `;
    uninstall = installSlider();
    const s = document.getElementById('s2');
    // (30 - 20) / (40 - 20) * 100 = 50 %
    expect(s.style.getPropertyValue('--hc-slider-value')).toBe('50');
  });

  it('clamps values outside [min, max] to [0, 100]', () => {
    document.body.innerHTML = `
      <input class="hc-slider" type="range" id="s3" min="0" max="10" value="5">
    `;
    uninstall = installSlider();
    const s = document.getElementById('s3');
    // Force an out-of-range value via the property (the input will
    // normally clamp, but the behavior must defend itself).
    Object.defineProperty(s, 'value', { value: '999', configurable: true });
    s.dispatchEvent(new Event('input', { bubbles: true }));
    expect(s.style.getPropertyValue('--hc-slider-value')).toBe('100');
  });

  it('falls back to 0 when min equals max (degenerate range)', () => {
    document.body.innerHTML = `
      <input class="hc-slider" type="range" id="s4" min="5" max="5" value="5">
    `;
    uninstall = installSlider();
    expect(document.getElementById('s4').style.getPropertyValue('--hc-slider-value'))
      .toBe('0');
  });

  it('uninstall removes the listener and clears the custom property', () => {
    document.body.innerHTML = SIMPLE;
    const u = installSlider();
    const s = document.getElementById('s1');
    u();

    expect(s.style.getPropertyValue('--hc-slider-value')).toBe('');

    // After uninstall, a value change should no longer update the var.
    s.value = '90';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    expect(s.style.getPropertyValue('--hc-slider-value')).toBe('');
    uninstall = () => {};
  });

  it('picks up sliders added after install (MutationObserver)', async () => {
    uninstall = installSlider();
    const wrap = document.createElement('div');
    wrap.innerHTML = SIMPLE;
    document.body.appendChild(wrap.firstElementChild);

    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('s1').style.getPropertyValue('--hc-slider-value'))
      .toBe('40');
  });
});
