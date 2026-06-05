import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installToolbar } from '../src/js/toolbar.js';

let uninstall = () => {};

const HORIZONTAL = `
  <div class="hc-toolbar" role="toolbar" aria-label="Editor" data-testid="tb">
    <button type="button" class="hc-button" id="b-bold">Bold</button>
    <button type="button" class="hc-button" id="b-italic" disabled>Italic</button>
    <button type="button" class="hc-button" id="b-underline">Underline</button>
    <hr role="separator" aria-orientation="vertical" />
    <a class="hc-button" id="b-link" href="#help">Help</a>
    <span data-hc-spacer="true"></span>
    <button type="button" class="hc-button" id="b-save">Save</button>
  </div>
`;

const VERTICAL = `
  <div class="hc-toolbar" role="toolbar" aria-orientation="vertical"
       aria-label="Tools" data-testid="tb">
    <button type="button" class="hc-button" id="v-1">One</button>
    <button type="button" class="hc-button" id="v-2">Two</button>
    <button type="button" class="hc-button" id="v-3">Three</button>
  </div>
`;

const WITH_FIELD = `
  <div class="hc-toolbar" role="toolbar" aria-label="Find" data-testid="tb">
    <button type="button" class="hc-button" id="f-prev">Prev</button>
    <input type="text" class="hc-input" id="f-query" value="abc" />
    <button type="button" class="hc-button" id="f-next">Next</button>
  </div>
`;

function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function id(name) {
  return document.getElementById(name);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installToolbar', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = HORIZONTAL;
    const u1 = installToolbar();
    const u2 = installToolbar();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('parks a single roving tab stop on the first navigable control', () => {
    document.body.innerHTML = HORIZONTAL;
    uninstall = installToolbar();
    expect(id('b-bold').getAttribute('tabindex')).toBe('0');
    expect(id('b-italic').getAttribute('tabindex')).toBe('-1');
    expect(id('b-underline').getAttribute('tabindex')).toBe('-1');
    expect(id('b-link').getAttribute('tabindex')).toBe('-1');
    expect(id('b-save').getAttribute('tabindex')).toBe('-1');
  });

  it('only enhances toolbars with role="toolbar"', () => {
    document.body.innerHTML = HORIZONTAL.replace('role="toolbar"', '');
    uninstall = installToolbar();
    // A plain layout .hc-toolbar gets no roving tabindex.
    expect(id('b-bold').hasAttribute('tabindex')).toBe(false);
  });

  it('ArrowRight moves focus to the next control, skipping disabled, and wraps', () => {
    document.body.innerHTML = HORIZONTAL;
    uninstall = installToolbar();
    id('b-bold').focus();

    press(id('b-bold'), 'ArrowRight'); // skip disabled italic → underline
    expect(document.activeElement.id).toBe('b-underline');
    expect(id('b-underline').getAttribute('tabindex')).toBe('0');
    expect(id('b-bold').getAttribute('tabindex')).toBe('-1');

    press(document.activeElement, 'ArrowRight'); // → link
    expect(document.activeElement.id).toBe('b-link');

    press(document.activeElement, 'ArrowRight'); // → save
    expect(document.activeElement.id).toBe('b-save');

    press(document.activeElement, 'ArrowRight'); // wrap → bold
    expect(document.activeElement.id).toBe('b-bold');
  });

  it('ArrowLeft moves to the previous control and wraps backwards', () => {
    document.body.innerHTML = HORIZONTAL;
    uninstall = installToolbar();
    id('b-bold').focus();

    press(id('b-bold'), 'ArrowLeft'); // wrap → save
    expect(document.activeElement.id).toBe('b-save');

    press(document.activeElement, 'ArrowLeft'); // → link
    expect(document.activeElement.id).toBe('b-link');
  });

  it('Home / End jump to the first / last navigable control', () => {
    document.body.innerHTML = HORIZONTAL;
    uninstall = installToolbar();
    id('b-underline').focus();

    press(id('b-underline'), 'End');
    expect(document.activeElement.id).toBe('b-save');

    press(document.activeElement, 'Home');
    expect(document.activeElement.id).toBe('b-bold');
  });

  it('horizontal toolbar ignores the vertical arrows', () => {
    document.body.innerHTML = HORIZONTAL;
    uninstall = installToolbar();
    id('b-bold').focus();
    press(id('b-bold'), 'ArrowDown');
    expect(document.activeElement.id).toBe('b-bold'); // unchanged
  });

  it('vertical orientation navigates with Up / Down and wraps', () => {
    document.body.innerHTML = VERTICAL;
    uninstall = installToolbar();
    id('v-1').focus();

    press(id('v-1'), 'ArrowDown');
    expect(document.activeElement.id).toBe('v-2');

    press(document.activeElement, 'ArrowUp');
    expect(document.activeElement.id).toBe('v-1');

    press(document.activeElement, 'ArrowUp'); // wrap → last
    expect(document.activeElement.id).toBe('v-3');

    // Horizontal arrows do nothing for a vertical toolbar.
    press(document.activeElement, 'ArrowRight');
    expect(document.activeElement.id).toBe('v-3');
  });

  it('focusing a control makes it the tab stop (e.g. after a click)', () => {
    document.body.innerHTML = HORIZONTAL;
    uninstall = installToolbar();
    id('b-save').focus();
    expect(id('b-save').getAttribute('tabindex')).toBe('0');
    expect(id('b-bold').getAttribute('tabindex')).toBe('-1');
  });

  it('yields the on-axis arrow to a text field but Home still navigates', () => {
    document.body.innerHTML = WITH_FIELD;
    uninstall = installToolbar();
    const field = id('f-query');
    field.focus();

    // ArrowRight (on-axis) must NOT move toolbar focus — the caret wins.
    press(field, 'ArrowRight');
    expect(document.activeElement.id).toBe('f-query');

    // Home still jumps to the first control.
    press(field, 'Home');
    expect(document.activeElement.id).toBe('f-prev');
  });

  it('re-normalises the tab stop when controls are added later', async () => {
    document.body.innerHTML = `
      <div class="hc-toolbar" role="toolbar" aria-label="Dyn" id="dyn"></div>
    `;
    uninstall = installToolbar();
    const tb = document.getElementById('dyn');
    tb.innerHTML =
      '<button type="button" class="hc-button" id="d-1">A</button>' +
      '<button type="button" class="hc-button" id="d-2">B</button>';
    await new Promise((r) => setTimeout(r, 0));
    expect(id('d-1').getAttribute('tabindex')).toBe('0');
    expect(id('d-2').getAttribute('tabindex')).toBe('-1');
  });

  it('picks up a toolbar added to the DOM after install (MutationObserver)', async () => {
    uninstall = installToolbar();
    document.body.innerHTML = HORIZONTAL;
    await new Promise((r) => setTimeout(r, 0));
    expect(id('b-bold').getAttribute('tabindex')).toBe('0');
  });

  it('uninstall removes the keyboard navigation', () => {
    document.body.innerHTML = HORIZONTAL;
    const u = installToolbar();
    u();
    id('b-bold').focus();
    press(id('b-bold'), 'ArrowRight');
    expect(document.activeElement.id).toBe('b-bold'); // no navigation after uninstall
  });
});
