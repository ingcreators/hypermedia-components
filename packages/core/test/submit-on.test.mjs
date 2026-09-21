import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSubmitOnChange, installSubmitOnEnter } from '../src/js/submit-on.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

const spySubmit = (form) => vi.spyOn(form, 'requestSubmit').mockImplementation(() => {});

// The install observer attaches swapped-in instances on the next microtask.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function change(el) {
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function keydown(el, init) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

/* ------------------------------------------------------------------ */
/* submit-on-change                                                    */
/* ------------------------------------------------------------------ */

describe('installSubmitOnChange', () => {
  function placeSwitch({ formAttrs = '', controlAttrs = '' } = {}) {
    document.body.innerHTML = `
      <form method="post" action="/flags" ${formAttrs}>
        <input class="hc-switch" type="checkbox" role="switch" name="beta"
               data-hc-submit-on-change ${controlAttrs}>
      </form>
    `;
    return {
      form: document.querySelector('form'),
      control: document.querySelector('[data-hc-submit-on-change]'),
    };
  }

  it('is idempotent — repeated calls return the same uninstaller', () => {
    placeSwitch();
    const u1 = installSubmitOnChange();
    const u2 = installSubmitOnChange();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('submits the form with requestSubmit() on change', () => {
    const { form, control } = placeSwitch();
    uninstall = installSubmitOnChange();
    const requestSubmit = spySubmit(form);

    change(control);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    // No submitter: a control that IS the action has no button value to send.
    expect(requestSubmit).toHaveBeenCalledWith();
  });

  it('attaches to controls swapped in after install', async () => {
    uninstall = installSubmitOnChange();
    const { form, control } = placeSwitch();
    await tick();
    const requestSubmit = spySubmit(form);
    change(control);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits an htmx form whose trigger is the default (submit)', () => {
    const { form, control } = placeSwitch({ formAttrs: 'data-hx-post="/flags"' });
    uninstall = installSubmitOnChange();
    const requestSubmit = spySubmit(form);
    change(control);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('is exempt when the form already triggers on change (hx-trigger)', async () => {
    uninstall = installSubmitOnChange();
    for (const spec of ['change', 'change delay:300ms', 'keyup, change', 'input changed']) {
      const { form, control } = placeSwitch({
        formAttrs: `data-hx-post="/flags" data-hx-trigger="${spec}"`,
      });
      await tick();
      const requestSubmit = spySubmit(form);
      change(control);
      const expected = spec === 'input changed' ? 1 : 0; // `changed` is not `change`
      expect(requestSubmit, spec).toHaveBeenCalledTimes(expected);
    }
  });

  it('is exempt when the control carries its own htmx verb', () => {
    const { form, control } = placeSwitch({
      controlAttrs: 'data-hx-post="/flags/beta" data-hx-trigger="change"',
    });
    uninstall = installSubmitOnChange();
    const requestSubmit = spySubmit(form);
    change(control);
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('works from a container: change events from descendants bubble to it', () => {
    document.body.innerHTML = `
      <form method="post" action="/prefs">
        <fieldset data-hc-submit-on-change>
          <input type="checkbox" name="a">
          <select name="b"><option>1</option><option>2</option></select>
        </fieldset>
      </form>
    `;
    uninstall = installSubmitOnChange();
    const form = document.querySelector('form');
    const requestSubmit = spySubmit(form);
    change(document.querySelector('select'));
    change(document.querySelector('input'));
    expect(requestSubmit).toHaveBeenCalledTimes(2);
  });

  it('listens for the event the attribute value names (hc:otpcomplete)', () => {
    document.body.innerHTML = `
      <form data-hx-post="/verify">
        <div class="hc-inputotp" data-length="6" data-hc-submit-on-change="hc:otpcomplete">
          <input class="hc-inputotp__input" type="text" name="code">
        </div>
      </form>
    `;
    uninstall = installSubmitOnChange();
    const form = document.querySelector('form');
    const root = document.querySelector('.hc-inputotp');
    const requestSubmit = spySubmit(form);

    change(root.querySelector('input')); // a plain change is NOT the trigger here
    expect(requestSubmit).not.toHaveBeenCalled();

    root.dispatchEvent(new CustomEvent('hc:otpcomplete', { bubbles: true, detail: { value: '123456' } }));
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('honours the form= attribute of a control outside its form', () => {
    document.body.innerHTML = `
      <form id="prefs" method="post" action="/prefs"></form>
      <input type="checkbox" name="x" form="prefs" data-hc-submit-on-change>
    `;
    uninstall = installSubmitOnChange();
    const form = document.getElementById('prefs');
    const requestSubmit = spySubmit(form);
    change(document.querySelector('input'));
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a control with no form', () => {
    document.body.innerHTML = `<input type="checkbox" data-hc-submit-on-change>`;
    uninstall = installSubmitOnChange();
    expect(() => change(document.querySelector('input'))).not.toThrow();
  });

  it('the uninstaller detaches', () => {
    const { form, control } = placeSwitch();
    const u = installSubmitOnChange();
    const requestSubmit = spySubmit(form);
    u();
    change(control);
    expect(requestSubmit).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* submit-on-enter                                                     */
/* ------------------------------------------------------------------ */

describe('installSubmitOnEnter', () => {
  function placeComposer(attrs = '') {
    document.body.innerHTML = `
      <form data-hx-post="/chat">
        <textarea class="hc-input" name="prompt" data-hc-submit-on-enter ${attrs}></textarea>
        <button class="hc-button" type="submit">Send</button>
      </form>
    `;
    return {
      form: document.querySelector('form'),
      field: document.querySelector('textarea'),
    };
  }

  it('is idempotent — repeated calls return the same uninstaller', () => {
    placeComposer();
    const u1 = installSubmitOnEnter();
    const u2 = installSubmitOnEnter();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('Enter submits the form and suppresses the newline', () => {
    const { form, field } = placeComposer();
    uninstall = installSubmitOnEnter();
    const requestSubmit = spySubmit(form);
    const event = keydown(field, { key: 'Enter' });
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Shift+Enter and Alt+Enter insert the newline (no submit)', () => {
    const { form, field } = placeComposer();
    uninstall = installSubmitOnEnter();
    const requestSubmit = spySubmit(form);
    expect(keydown(field, { key: 'Enter', shiftKey: true }).defaultPrevented).toBe(false);
    expect(keydown(field, { key: 'Enter', altKey: true }).defaultPrevented).toBe(false);
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('Ctrl/Cmd+Enter submits too', () => {
    const { form, field } = placeComposer();
    uninstall = installSubmitOnEnter();
    const requestSubmit = spySubmit(form);
    keydown(field, { key: 'Enter', ctrlKey: true });
    keydown(field, { key: 'Enter', metaKey: true });
    expect(requestSubmit).toHaveBeenCalledTimes(2);
  });

  it('an Enter that ends an IME composition is ignored', () => {
    const { form, field } = placeComposer();
    uninstall = installSubmitOnEnter();
    const requestSubmit = spySubmit(form);
    // Modern engines: isComposing; legacy: keyCode 229 with isComposing false.
    expect(keydown(field, { key: 'Enter', isComposing: true }).defaultPrevented).toBe(false);
    expect(keydown(field, { key: 'Enter', keyCode: 229 }).defaultPrevented).toBe(false);
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('other keys pass through', () => {
    const { form, field } = placeComposer();
    uninstall = installSubmitOnEnter();
    const requestSubmit = spySubmit(form);
    keydown(field, { key: 'a' });
    keydown(field, { key: 'Tab' });
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('leaves disabled and readonly fields alone (swapped in after install)', async () => {
    uninstall = installSubmitOnEnter();
    for (const attr of ['disabled', 'readonly']) {
      const { form, field } = placeComposer(attr);
      await tick();
      const requestSubmit = spySubmit(form);
      expect(keydown(field, { key: 'Enter' }).defaultPrevented).toBe(false);
      expect(requestSubmit, attr).not.toHaveBeenCalled();
    }
  });

  it('the uninstaller detaches', () => {
    const { form, field } = placeComposer();
    const u = installSubmitOnEnter();
    const requestSubmit = spySubmit(form);
    u();
    keydown(field, { key: 'Enter' });
    expect(requestSubmit).not.toHaveBeenCalled();
  });
});
