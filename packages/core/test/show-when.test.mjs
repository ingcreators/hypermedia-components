import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { installShowWhen, switchValue } from '../src/js/show-when.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function change(el) {
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const FORM = `
  <form id="f">
    <select name="op" data-hc-show-switch id="op">
      <option value="insert" selected>insert</option>
      <option value="update">update</option>
      <option value="delete">delete</option>
    </select>
    <div id="filter" data-hc-show-when="update delete">filter column</div>
    <div id="values" data-hc-show-when="insert update">values</div>
  </form>`;

describe('switchValue', () => {
  it('reads a select/input value', () => {
    document.body.innerHTML = '<input id="i" value="abc">';
    expect(switchValue(document.getElementById('i'))).toBe('abc');
  });

  it('reads the checked radio of the group, empty when none checked', () => {
    document.body.innerHTML = `
      <form>
        <input type="radio" name="mode" value="a" id="ra">
        <input type="radio" name="mode" value="b" id="rb" checked>
      </form>`;
    expect(switchValue(document.getElementById('ra'))).toBe('b');
    document.getElementById('rb').checked = false;
    expect(switchValue(document.getElementById('ra'))).toBe('');
  });

  it('reads a checkbox as value-or-on when checked, empty otherwise', () => {
    document.body.innerHTML = '<input type="checkbox" id="c">';
    const c = document.getElementById('c');
    expect(switchValue(c)).toBe('');
    c.checked = true;
    expect(switchValue(c)).toBe('on');
    c.value = 'advanced';
    expect(switchValue(c)).toBe('advanced');
  });

  it('returns null for no control', () => {
    expect(switchValue(null)).toBeNull();
  });
});

describe('installShowWhen', () => {
  it('evaluates once at install so server-rendered state is honored', () => {
    document.body.innerHTML = FORM;
    uninstall = installShowWhen();

    expect(document.getElementById('filter').hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('values').hasAttribute('hidden')).toBe(false);
  });

  it('re-evaluates on change without any request or focus loss', () => {
    document.body.innerHTML = FORM;
    uninstall = installShowWhen();

    const op = document.getElementById('op');
    op.focus();
    op.value = 'delete';
    change(op);

    expect(document.getElementById('filter').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('values').hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(op);
  });

  it('scopes the switch to the closest form', () => {
    document.body.innerHTML = `
      <form><input data-hc-show-switch value="a"></form>
      <form>
        <input data-hc-show-switch value="b">
        <div id="x" data-hc-show-when="b">second-form field</div>
      </form>`;
    uninstall = installShowWhen();
    expect(document.getElementById('x').hasAttribute('hidden')).toBe(false);
  });

  it('honors the data-hc-show-src selector override across forms', () => {
    document.body.innerHTML = `
      <select id="global-mode"><option value="sql" selected>sql</option></select>
      <form>
        <input data-hc-show-switch value="other">
        <div id="x" data-hc-show-when="sql" data-hc-show-src="#global-mode">sql panel</div>
      </form>`;
    uninstall = installShowWhen();
    expect(document.getElementById('x').hasAttribute('hidden')).toBe(false);

    document.getElementById('global-mode').innerHTML = '<option value="js" selected>js</option>';
    change(document.getElementById('global-mode'));
    expect(document.getElementById('x').hasAttribute('hidden')).toBe(true);
  });

  it('drives visibility from a radio group switch', () => {
    document.body.innerHTML = `
      <form>
        <input type="radio" name="rule" value="exact" data-hc-show-switch checked>
        <input type="radio" name="rule" value="range" data-hc-show-switch id="range">
        <div id="upper" data-hc-show-when="range">upper bound</div>
      </form>`;
    uninstall = installShowWhen();
    expect(document.getElementById('upper').hasAttribute('hidden')).toBe(true);

    const range = document.getElementById('range');
    range.checked = true;
    change(range);
    expect(document.getElementById('upper').hasAttribute('hidden')).toBe(false);
  });

  it('leaves elements with an unresolvable switch untouched', () => {
    document.body.innerHTML = `
      <div id="a" data-hc-show-when="x" hidden>server-hidden</div>
      <div id="b" data-hc-show-when="x">server-shown</div>`;
    uninstall = installShowWhen();
    expect(document.getElementById('a').hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('b').hasAttribute('hidden')).toBe(false);
  });

  it('keeps hidden controls submitting (only the hidden attribute changes)', () => {
    document.body.innerHTML = FORM;
    uninstall = installShowWhen();

    const filter = document.getElementById('filter');
    expect(filter.hasAttribute('hidden')).toBe(true);
    expect(filter.style.display).toBe('');
    // Nothing is disabled and no name is removed — the behavior never
    // touches submission semantics.
    expect(document.querySelectorAll('[disabled]').length).toBe(0);
  });

  it('picks up elements swapped in after install (MutationObserver)', async () => {
    document.body.innerHTML = FORM;
    uninstall = installShowWhen();

    const form = document.getElementById('f');
    form.insertAdjacentHTML(
      'beforeend',
      '<div id="late" data-hc-show-when="insert">late field</div>' +
      '<div id="late-hidden" data-hc-show-when="delete">late hidden</div>',
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('late').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('late-hidden').hasAttribute('hidden')).toBe(true);
  });

  it('re-evaluates swapped-in-place content on htmx:afterSwap', () => {
    document.body.innerHTML = FORM;
    uninstall = installShowWhen();

    const form = document.getElementById('f');
    document.getElementById('op').value = 'delete';
    // Simulate htmx replacing the form contents in place, then firing
    // its afterSwap event on the swap target.
    form.dispatchEvent(new CustomEvent('htmx:afterSwap', { bubbles: true }));

    expect(document.getElementById('filter').hasAttribute('hidden')).toBe(false);
  });

  it('is idempotent and the uninstaller detaches everything', () => {
    document.body.innerHTML = FORM;
    const off = installShowWhen();
    expect(installShowWhen()).toBe(off);

    off();
    const op = document.getElementById('op');
    op.value = 'delete';
    change(op);
    // No listener anymore — visibility stays as evaluated at install.
    expect(document.getElementById('filter').hasAttribute('hidden')).toBe(true);
  });
});
