import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installInvokerCommands, supportsInvokerCommands } from '../src/js/invoker-commands.js';

// jsdom has no Invoker Commands API, so the fallback path is what runs
// here; the "native engine" branch is exercised by defining the
// properties on the prototype for one test.

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function place({ opener = 'commandfor="dlg" command="show-modal"', closer = 'commandfor="dlg" command="close"', dialogAttrs = '' } = {}) {
  document.body.innerHTML = `
    <button type="button" id="open" ${opener}>Open</button>
    <dialog class="hc-dialog" id="dlg" ${dialogAttrs}>
      <p>Body</p>
      <form data-hx-post="/x">
        <button type="button" id="close" ${closer}>Cancel</button>
        <button type="submit" id="submit" commandfor="dlg" command="close">Apply</button>
      </form>
    </dialog>
  `;
  return {
    open: document.getElementById('open'),
    close: document.getElementById('close'),
    submit: document.getElementById('submit'),
    dialog: document.getElementById('dlg'),
  };
}

describe('installInvokerCommands', () => {
  it('jsdom has no native API (the fallback path is under test)', () => {
    expect(supportsInvokerCommands()).toBe(false);
  });

  it('is idempotent — repeated calls return the same uninstaller', () => {
    const u1 = installInvokerCommands();
    const u2 = installInvokerCommands();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('installs nothing on an engine with the native API', () => {
    Object.defineProperty(HTMLButtonElement.prototype, 'commandForElement', { value: null, configurable: true });
    Object.defineProperty(HTMLButtonElement.prototype, 'command', { value: '', configurable: true });
    try {
      expect(supportsInvokerCommands()).toBe(true);
      const { open, dialog } = place();
      const u = installInvokerCommands();
      expect(document.__hcInvokerCommandsUninstall).toBeUndefined();
      open.click();
      expect(dialog.open).toBe(false); // nothing ran — the platform would have
      u();
    } finally {
      delete HTMLButtonElement.prototype.commandForElement;
      delete HTMLButtonElement.prototype.command;
    }
  });

  it('command="show-modal" opens the dialog modally', () => {
    const { open, dialog } = place();
    uninstall = installInvokerCommands();
    const showModal = vi.spyOn(dialog, 'showModal');
    open.click();
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(true);
  });

  it('command="close" closes it — from a type="button" inside an htmx form', () => {
    const { open, close, dialog } = place();
    uninstall = installInvokerCommands();
    open.click();
    expect(dialog.open).toBe(true);
    close.click();
    expect(dialog.open).toBe(false);
  });

  it('a click inside the button (an icon) counts', () => {
    place({ opener: 'commandfor="dlg" command="show-modal"' });
    document.getElementById('open').innerHTML = '<span id="icon">⚙</span>';
    uninstall = installInvokerCommands();
    document.getElementById('icon').click();
    expect(document.getElementById('dlg').open).toBe(true);
  });

  it('an already-open dialog is left alone (no second showModal)', () => {
    const { open, dialog } = place({ dialogAttrs: 'open' });
    uninstall = installInvokerCommands();
    const showModal = vi.spyOn(dialog, 'showModal');
    open.click();
    expect(showModal).not.toHaveBeenCalled();
  });

  it('close on a closed dialog does nothing', () => {
    const { close, dialog } = place();
    uninstall = installInvokerCommands();
    const closeSpy = vi.spyOn(dialog, 'close');
    close.click();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('a disabled button does nothing', () => {
    const { open, dialog } = place();
    open.disabled = true;
    uninstall = installInvokerCommands();
    open.dispatchEvent(new MouseEvent('click', { bubbles: true })); // .click() is inert on disabled
    expect(dialog.open).toBe(false);
  });

  it('a submit button with a form owner is left to the form (as the platform does)', () => {
    const { open, submit, dialog } = place();
    uninstall = installInvokerCommands();
    open.click();
    expect(dialog.open).toBe(true);
    const form = submit.form;
    form.addEventListener('submit', (e) => e.preventDefault());
    submit.click();
    expect(dialog.open).toBe(true); // still open — the command was ignored
  });

  it('a defaultPrevented click does nothing', () => {
    const { open, dialog } = place();
    open.addEventListener('click', (e) => e.preventDefault());
    uninstall = installInvokerCommands();
    open.click();
    expect(dialog.open).toBe(false);
  });

  it('other commands and non-dialog targets are ignored', () => {
    document.body.innerHTML = `
      <button type="button" id="a" commandfor="pop" command="toggle-popover">Pop</button>
      <div id="pop" popover>…</div>
      <button type="button" id="b" commandfor="dlg" command="--custom">Custom</button>
      <dialog id="dlg"></dialog>
    `;
    uninstall = installInvokerCommands();
    expect(() => document.getElementById('a').click()).not.toThrow();
    document.getElementById('b').click();
    expect(document.getElementById('dlg').open).toBe(false);
  });

  it('resolves the target by id and tolerates a missing one', () => {
    document.body.innerHTML = '<button type="button" id="open" commandfor="nope" command="show-modal">Open</button>';
    uninstall = installInvokerCommands();
    expect(() => document.getElementById('open').click()).not.toThrow();
  });

  it('works for buttons swapped in after install (root-delegated)', () => {
    uninstall = installInvokerCommands();
    const { open, dialog } = place();
    open.click();
    expect(dialog.open).toBe(true);
  });

  it('the uninstaller detaches', () => {
    const { open, dialog } = place();
    const u = installInvokerCommands();
    u();
    open.click();
    expect(dialog.open).toBe(false);
  });
});
