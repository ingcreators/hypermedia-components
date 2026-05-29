import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installToggleGroup } from '../src/js/toggle-group.js';

let uninstall = () => {};

const SINGLE = `
  <div class="hc-toggle-group" role="radiogroup" data-type="single"
       aria-label="Align" data-testid="grp">
    <button type="button" class="hc-toggle" role="radio" aria-checked="true"
            data-value="left" id="t-left">Left</button>
    <button type="button" class="hc-toggle" role="radio" aria-checked="false"
            data-value="center" id="t-center">Center</button>
    <button type="button" class="hc-toggle" role="radio" aria-checked="false"
            data-value="right" id="t-right" aria-disabled="true">Right</button>
    <button type="button" class="hc-toggle" role="radio" aria-checked="false"
            data-value="justify" id="t-justify">Justify</button>
  </div>
`;

const MULTIPLE = `
  <div class="hc-toggle-group" role="group" data-type="multiple"
       aria-label="Format" data-testid="grp">
    <button type="button" class="hc-toggle" aria-pressed="false"
            data-value="bold" id="m-bold">B</button>
    <button type="button" class="hc-toggle" aria-pressed="true"
            data-value="italic" id="m-italic">I</button>
    <button type="button" class="hc-toggle" aria-pressed="false"
            data-value="underline" id="m-underline">U</button>
  </div>
`;

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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

describe('installToggleGroup', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = SINGLE;
    const u1 = installToggleGroup();
    const u2 = installToggleGroup();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('single: roving tabindex parks on the checked option', () => {
    document.body.innerHTML = SINGLE;
    uninstall = installToggleGroup();
    expect(document.getElementById('t-left').getAttribute('tabindex')).toBe('0');
    expect(document.getElementById('t-center').getAttribute('tabindex')).toBe('-1');
    expect(document.getElementById('t-justify').getAttribute('tabindex')).toBe('-1');
  });

  it('single: clicking selects exclusively and fires the change event', () => {
    document.body.innerHTML = SINGLE;
    uninstall = installToggleGroup();
    const group = document.querySelector('.hc-toggle-group');
    const detail = vi.fn();
    group.addEventListener('hc:togglegroupchange', (e) => detail(e.detail));

    click(document.getElementById('t-center'));

    expect(document.getElementById('t-left').getAttribute('aria-checked')).toBe('false');
    expect(document.getElementById('t-center').getAttribute('aria-checked')).toBe('true');
    expect(document.getElementById('t-center').getAttribute('tabindex')).toBe('0');
    expect(document.getElementById('t-left').getAttribute('tabindex')).toBe('-1');
    expect(detail).toHaveBeenCalledTimes(1);
    expect(detail.mock.calls[0][0]).toMatchObject({ type: 'single', value: 'center' });
  });

  it('single: clicking the already-checked option is a no-op (radio semantics)', () => {
    document.body.innerHTML = SINGLE;
    uninstall = installToggleGroup();
    const group = document.querySelector('.hc-toggle-group');
    const detail = vi.fn();
    group.addEventListener('hc:togglegroupchange', detail);

    click(document.getElementById('t-left'));

    expect(document.getElementById('t-left').getAttribute('aria-checked')).toBe('true');
    expect(detail).not.toHaveBeenCalled();
  });

  it('single: ArrowRight moves focus and selection together, skipping disabled', () => {
    document.body.innerHTML = SINGLE;
    uninstall = installToggleGroup();
    const left = document.getElementById('t-left');
    left.focus();

    press(left, 'ArrowRight'); // → center
    expect(document.activeElement.id).toBe('t-center');
    expect(document.getElementById('t-center').getAttribute('aria-checked')).toBe('true');

    press(document.activeElement, 'ArrowRight'); // skip disabled right → justify
    expect(document.activeElement.id).toBe('t-justify');
    expect(document.getElementById('t-justify').getAttribute('aria-checked')).toBe('true');

    press(document.activeElement, 'ArrowRight'); // wraps → left
    expect(document.activeElement.id).toBe('t-left');
  });

  it('single: Home / End select the first / last enabled option', () => {
    document.body.innerHTML = SINGLE;
    uninstall = installToggleGroup();
    const center = document.getElementById('t-center');
    center.focus();

    press(center, 'End'); // last enabled = justify (right is disabled)
    expect(document.activeElement.id).toBe('t-justify');
    expect(document.getElementById('t-justify').getAttribute('aria-checked')).toBe('true');

    press(document.activeElement, 'Home');
    expect(document.activeElement.id).toBe('t-left');
    expect(document.getElementById('t-left').getAttribute('aria-checked')).toBe('true');
  });

  it('multiple: roving tabindex parks on the first enabled button', () => {
    document.body.innerHTML = MULTIPLE;
    uninstall = installToggleGroup();
    expect(document.getElementById('m-bold').getAttribute('tabindex')).toBe('0');
    expect(document.getElementById('m-italic').getAttribute('tabindex')).toBe('-1');
  });

  it('multiple: clicking toggles aria-pressed on and off with event detail', () => {
    document.body.innerHTML = MULTIPLE;
    uninstall = installToggleGroup();
    const group = document.querySelector('.hc-toggle-group');
    const detail = vi.fn();
    group.addEventListener('hc:togglegroupchange', (e) => detail(e.detail));

    click(document.getElementById('m-bold')); // off → on
    expect(document.getElementById('m-bold').getAttribute('aria-pressed')).toBe('true');
    expect(detail.mock.calls[0][0]).toMatchObject({
      type: 'multiple',
      pressed: true,
      values: ['bold', 'italic'],
    });

    click(document.getElementById('m-italic')); // on → off
    expect(document.getElementById('m-italic').getAttribute('aria-pressed')).toBe('false');
    expect(detail.mock.calls[1][0]).toMatchObject({
      type: 'multiple',
      pressed: false,
      values: ['bold'],
    });
  });

  it('multiple: ArrowRight moves focus only — it does not toggle', () => {
    document.body.innerHTML = MULTIPLE;
    uninstall = installToggleGroup();
    const bold = document.getElementById('m-bold');
    bold.focus();

    press(bold, 'ArrowRight');
    expect(document.activeElement.id).toBe('m-italic');
    expect(document.getElementById('m-italic').getAttribute('aria-pressed')).toBe('true'); // unchanged
    expect(document.getElementById('m-bold').getAttribute('aria-pressed')).toBe('false'); // unchanged
    expect(document.getElementById('m-italic').getAttribute('tabindex')).toBe('0');
  });

  it('single: data-name maintains one hidden input with the checked value', () => {
    document.body.innerHTML = SINGLE.replace('data-type="single"', 'data-type="single" data-name="align"');
    uninstall = installToggleGroup();
    const group = document.querySelector('.hc-toggle-group');

    let inputs = group.querySelectorAll('input[type="hidden"]');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].name).toBe('align');
    expect(inputs[0].value).toBe('left');

    click(document.getElementById('t-center'));
    inputs = group.querySelectorAll('input[type="hidden"]');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].value).toBe('center');
  });

  it('multiple: data-name maintains one hidden input per pressed value', () => {
    document.body.innerHTML = MULTIPLE.replace('data-type="multiple"', 'data-type="multiple" data-name="format"');
    uninstall = installToggleGroup();
    const group = document.querySelector('.hc-toggle-group');

    // italic starts pressed → one input
    expect([...group.querySelectorAll('input[type="hidden"]')].map((i) => i.value)).toEqual([
      'italic',
    ]);

    click(document.getElementById('m-bold')); // press bold too
    expect([...group.querySelectorAll('input[type="hidden"]')].map((i) => i.value)).toEqual([
      'bold',
      'italic',
    ]);
  });

  it('the hidden-input container does not break the last toggle being last-of-type', () => {
    document.body.innerHTML = MULTIPLE.replace('data-type="multiple"', 'data-type="multiple" data-name="format"');
    uninstall = installToggleGroup();
    const group = document.querySelector('.hc-toggle-group');
    const toggles = group.querySelectorAll('.hc-toggle');
    const last = toggles[toggles.length - 1];
    // The injected hidden <span> is the real lastChild, but the last
    // toggle must still be the last <button> (so :last-of-type holds).
    expect(group.lastElementChild.classList.contains('hc-toggle-group__hidden')).toBe(true);
    expect(last.matches('button:last-of-type')).toBe(true);
  });

  it('uninstall removes the listeners', () => {
    document.body.innerHTML = SINGLE;
    const u = installToggleGroup();
    u();
    const group = document.querySelector('.hc-toggle-group');
    const detail = vi.fn();
    group.addEventListener('hc:togglegroupchange', detail);
    click(document.getElementById('t-center'));
    expect(detail).not.toHaveBeenCalled();
    expect(document.getElementById('t-center').getAttribute('aria-checked')).toBe('false');
  });

  it('picks up a group added to the DOM after install (MutationObserver)', async () => {
    uninstall = installToggleGroup();
    document.body.innerHTML = MULTIPLE;
    await new Promise((r) => setTimeout(r, 0));
    // The observer normalised the roving tabindex on the new group.
    expect(document.getElementById('m-bold').getAttribute('tabindex')).toBe('0');
  });
});
