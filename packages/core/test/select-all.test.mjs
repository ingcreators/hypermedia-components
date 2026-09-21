import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installSelectAll } from '../src/js/select-all.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function place({ masterInside = true, members = ['read', 'write', 'admin'], checked = [], disabled = [] } = {}) {
  const master = '<input class="hc-checkbox" type="checkbox" data-hc-select-all="perms" data-testid="master" name="never">';
  const rows = members
    .map(
      (v) =>
        `<label><input class="hc-checkbox" type="checkbox" name="perm" value="${v}"${checked.includes(v) ? ' checked' : ''}${disabled.includes(v) ? ' disabled' : ''}> ${v}</label>`,
    )
    .join('');
  document.body.innerHTML = `
    <form>
      ${masterInside ? '' : `<label>${master} All</label>`}
      <fieldset class="hc-field" id="perms">
        <legend>Permissions</legend>
        ${masterInside ? `<label>${master} All</label>` : ''}
        ${rows}
      </fieldset>
    </form>
  `;
  return {
    master: document.querySelector('[data-testid="master"]'),
    members: [...document.querySelectorAll('input[name="perm"]')],
    form: document.querySelector('form'),
  };
}

function toggle(cb, on) {
  cb.checked = on;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('installSelectAll', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    place();
    const u1 = installSelectAll();
    const u2 = installSelectAll();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('strips a name from the master so it never serializes', () => {
    const { master, form } = place();
    uninstall = installSelectAll();
    expect(master.hasAttribute('name')).toBe(false);
    toggle(master, true);
    expect([...new FormData(form).keys()]).toEqual(['perm', 'perm', 'perm']);
  });

  it('checking the master checks every enabled member; unchecking clears them', () => {
    const { master, members } = place({ disabled: ['admin'] });
    uninstall = installSelectAll();
    toggle(master, true);
    expect(members.map((cb) => cb.checked)).toEqual([true, true, false]);
    toggle(master, false);
    expect(members.map((cb) => cb.checked)).toEqual([false, false, false]);
  });

  it('reflects the members: all → checked, some → indeterminate, none → clear', () => {
    const { master, members } = place();
    uninstall = installSelectAll();
    expect(master.checked).toBe(false);
    expect(master.indeterminate).toBe(false);

    toggle(members[0], true);
    expect(master.checked).toBe(false);
    expect(master.indeterminate).toBe(true);

    toggle(members[1], true);
    toggle(members[2], true);
    expect(master.checked).toBe(true);
    expect(master.indeterminate).toBe(false);

    toggle(members[2], false);
    expect(master.indeterminate).toBe(true);
    toggle(members[0], false);
    toggle(members[1], false);
    expect(master.checked).toBe(false);
    expect(master.indeterminate).toBe(false);
  });

  it('syncs the initial state from server-rendered checked members', () => {
    const { master } = place({ checked: ['read', 'write', 'admin'] });
    uninstall = installSelectAll();
    expect(master.checked).toBe(true);
    const { master: m2 } = place({ checked: ['read'] });
    installSelectAll(); // same root, same uninstaller — instances attach via the observer
    return tick().then(() => {
      expect(m2.indeterminate).toBe(true);
    });
  });

  it('the master may live outside the group', () => {
    const { master, members } = place({ masterInside: false });
    uninstall = installSelectAll();
    toggle(master, true);
    expect(members.every((cb) => cb.checked)).toBe(true);
    toggle(members[0], false);
    expect(master.indeterminate).toBe(true);
  });

  it('ignores disabled members when judging all / none', () => {
    const { master, members } = place({ disabled: ['admin'] });
    uninstall = installSelectAll();
    toggle(members[0], true);
    toggle(members[1], true);
    expect(master.checked).toBe(true); // the disabled one does not count
  });

  it('the master change bubbles once through the group; members fire none', () => {
    const { master, form } = place();
    uninstall = installSelectAll();
    const changes = vi.fn();
    form.addEventListener('change', changes);
    toggle(master, true);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('re-syncs after an htmx swap inside the group (new members count)', () => {
    const { master, members } = place();
    uninstall = installSelectAll();
    toggle(master, true);
    expect(master.checked).toBe(true);
    const group = document.getElementById('perms');
    group.insertAdjacentHTML('beforeend', '<label><input class="hc-checkbox" type="checkbox" name="perm" value="audit"> audit</label>');
    group.dispatchEvent(new CustomEvent('htmx:afterSwap', { bubbles: true }));
    expect(master.checked).toBe(false);
    expect(master.indeterminate).toBe(true);
    expect(members.length).toBe(3);
  });

  it('attaches to a master swapped in after install', async () => {
    uninstall = installSelectAll();
    const { master, members } = place();
    await tick();
    toggle(master, true);
    expect(members.every((cb) => cb.checked)).toBe(true);
  });

  it('does nothing when the group id resolves to nothing', () => {
    document.body.innerHTML = '<input type="checkbox" data-hc-select-all="nope">';
    uninstall = installSelectAll();
    expect(() => toggle(document.querySelector('input'), true)).not.toThrow();
  });

  it('the uninstaller detaches', () => {
    const { master, members } = place();
    const u = installSelectAll();
    u();
    toggle(master, true);
    expect(members.some((cb) => cb.checked)).toBe(false);
  });
});
