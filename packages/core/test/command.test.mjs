import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installCommand } from '../src/js/command.js';

let uninstall = () => {};

const FIXTURE = `
  <dialog id="cmd-dialog" class="hc-command-dialog" data-hc-command-hotkey="k">
    <div class="hc-command">
      <input class="hc-command__input" type="text" role="combobox" aria-label="Command" id="cmd-input">
      <div class="hc-command__list" id="cmd-list" role="listbox">
        <div class="hc-command__group" role="group" aria-labelledby="g-nav">
          <div class="hc-command__group-heading" id="g-nav">Navigation</div>
          <div class="hc-command__item" role="option" id="i-home" data-value="home"><span>Go home</span><kbd class="hc-command__shortcut">G H</kbd></div>
          <div class="hc-command__item" role="option" id="i-settings" data-value="settings"><span>Open settings</span></div>
        </div>
        <div class="hc-command__group" role="group" aria-labelledby="g-act">
          <div class="hc-command__group-heading" id="g-act">Actions</div>
          <div class="hc-command__item" role="option" id="i-new" data-value="new"><span>New file</span></div>
          <div class="hc-command__item" role="option" id="i-del" data-value="delete" aria-disabled="true"><span>Delete</span></div>
        </div>
      </div>
      <div class="hc-command__empty" hidden>No results.</div>
    </div>
  </dialog>
`;

function press(el, key, opts = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function $(id) {
  return document.getElementById(id);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installCommand', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIXTURE;
    const u1 = installCommand();
    const u2 = installCommand();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('highlights the first enabled item initially', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    expect($('i-home').getAttribute('data-active')).toBe('true');
    expect($('cmd-input').getAttribute('aria-activedescendant')).toBe('i-home');
  });

  it('filters items by label and hides groups that empty out', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const input = $('cmd-input');
    input.value = 'settings';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect($('i-home').hasAttribute('hidden')).toBe(true);
    expect($('i-settings').hasAttribute('hidden')).toBe(false);
    expect($('i-new').hasAttribute('hidden')).toBe(true);
    // Navigation still has a visible item; Actions is fully filtered out.
    expect(document.querySelector('[aria-labelledby="g-nav"]').hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[aria-labelledby="g-act"]').hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('.hc-command__empty').hasAttribute('hidden')).toBe(true);
  });

  it('shows the empty state when nothing matches', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const input = $('cmd-input');
    input.value = 'zzzzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('.hc-command__empty').hasAttribute('hidden')).toBe(false);
  });

  it('does not match against the shortcut text', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const input = $('cmd-input');
    input.value = 'G H'; // the kbd shortcut on i-home — must NOT match
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect($('i-home').hasAttribute('hidden')).toBe(true);
  });

  it('ArrowDown / ArrowUp move the active item and wrap, skipping disabled', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const input = $('cmd-input');

    press(input, 'ArrowDown'); // home → settings
    expect($('i-settings').getAttribute('data-active')).toBe('true');
    press(input, 'ArrowDown'); // settings → new
    expect($('i-new').getAttribute('data-active')).toBe('true');
    press(input, 'ArrowDown'); // new → wrap to home (i-del disabled, skipped)
    expect($('i-home').getAttribute('data-active')).toBe('true');
    press(input, 'ArrowUp'); // home → wrap to new
    expect($('i-new').getAttribute('data-active')).toBe('true');
  });

  it('Home / End jump to first / last enabled item', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const input = $('cmd-input');
    press(input, 'End');
    expect($('i-new').getAttribute('data-active')).toBe('true'); // i-del disabled
    press(input, 'Home');
    expect($('i-home').getAttribute('data-active')).toBe('true');
  });

  it('Enter runs the active item, dispatches hc:commandselect, and closes the dialog', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const dialog = $('cmd-dialog');
    dialog.showModal();
    const detail = vi.fn();
    document.querySelector('.hc-command').addEventListener('hc:commandselect', (e) => detail(e.detail));

    press($('cmd-input'), 'ArrowDown'); // → settings
    press($('cmd-input'), 'Enter');

    expect(detail).toHaveBeenCalledTimes(1);
    expect(detail.mock.calls[0][0]).toMatchObject({ value: 'settings' });
    expect(detail.mock.calls[0][0].item.id).toBe('i-settings');
    expect(dialog.open).toBe(false);
  });

  it('clicking an item runs it; a disabled item does nothing', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const detail = vi.fn();
    document.querySelector('.hc-command').addEventListener('hc:commandselect', detail);

    click($('i-del')); // disabled → ignored
    expect(detail).not.toHaveBeenCalled();

    $('cmd-dialog').showModal();
    click($('i-new'));
    expect(detail).toHaveBeenCalledTimes(1);
  });

  it('Cmd+K toggles the dialog and focuses the input on open', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const dialog = $('cmd-dialog');
    expect(dialog.open).toBe(false);

    const e1 = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(e1);
    expect(e1.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(document.activeElement.id).toBe('cmd-input');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(dialog.open).toBe(false);
  });

  it('resets the filter when the dialog closes', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installCommand();
    const input = $('cmd-input');
    $('cmd-dialog').showModal();
    input.value = 'settings';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect($('i-home').hasAttribute('hidden')).toBe(true);

    $('cmd-dialog').close();
    expect(input.value).toBe('');
    expect($('i-home').hasAttribute('hidden')).toBe(false);
  });

  it('uninstall removes the listeners', () => {
    document.body.innerHTML = FIXTURE;
    const u = installCommand();
    u();
    const detail = vi.fn();
    document.querySelector('.hc-command').addEventListener('hc:commandselect', detail);
    $('cmd-dialog').showModal();
    click($('i-new'));
    expect(detail).not.toHaveBeenCalled();
  });

  it('picks up a palette added to the DOM after install (MutationObserver)', async () => {
    uninstall = installCommand();
    document.body.innerHTML = FIXTURE;
    await new Promise((r) => setTimeout(r, 0));
    expect($('i-home').getAttribute('data-active')).toBe('true');
  });
});
