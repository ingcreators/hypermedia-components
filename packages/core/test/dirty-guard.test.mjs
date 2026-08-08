import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installDirtyGuard } from '../src/js/dirty-guard.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = `
    <form id="f" data-hc-dirty-guard>
      <input id="title" name="title" value="Hello">
      <div id="draft"></div>
      <button type="submit">Save</button>
    </form>
    <form id="plain">
      <input name="q" value="">
    </form>
    <a id="away" href="/elsewhere">Away</a>
  `;
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.restoreAllMocks();
});

const form = () => document.getElementById('f');
const title = () => document.getElementById('title');

function focusIn(el) {
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

function edit(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function fireBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('installDirtyGuard', () => {
  it('flips data-dirty and dispatches hc:dirtychange on edits', () => {
    uninstall = installDirtyGuard();
    const flips = [];
    form().addEventListener('hc:dirtychange', (e) => flips.push(e.detail.dirty));
    focusIn(title());
    edit(title(), 'Hello!');
    expect(form().hasAttribute('data-dirty')).toBe(true);
    edit(title(), 'Hello');
    expect(form().hasAttribute('data-dirty')).toBe(false);
    expect(flips).toEqual([true, false]);
  });

  it('ignores forms without the guard attribute', () => {
    uninstall = installDirtyGuard();
    const q = document.querySelector('#plain input');
    focusIn(q);
    edit(q, 'search');
    expect(document.getElementById('plain').hasAttribute('data-dirty')).toBe(false);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('prompts on beforeunload only while dirty', () => {
    uninstall = installDirtyGuard();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    focusIn(title());
    edit(title(), 'Edited');
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it('does not prompt during the form own submission', () => {
    uninstall = installDirtyGuard();
    focusIn(title());
    edit(title(), 'Edited');
    form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('re-snapshots to clean only when the form itself saved', () => {
    uninstall = installDirtyGuard();
    focusIn(title());
    edit(title(), 'Edited');
    // A draft autosaver inside the form (different elt) must not clean.
    form().dispatchEvent(
      new CustomEvent('htmx:afterRequest', {
        bubbles: true,
        detail: { elt: document.getElementById('draft'), successful: true },
      }),
    );
    expect(form().hasAttribute('data-dirty')).toBe(true);
    form().dispatchEvent(
      new CustomEvent('htmx:afterRequest', {
        bubbles: true,
        detail: { elt: form(), successful: true },
      }),
    );
    expect(form().hasAttribute('data-dirty')).toBe(false);
    // The saved value is the new baseline.
    edit(title(), 'Edited');
    expect(form().hasAttribute('data-dirty')).toBe(false);
    edit(title(), 'Changed again');
    expect(form().hasAttribute('data-dirty')).toBe(true);
  });

  it('confirms boosted-link navigation while dirty', () => {
    uninstall = installDirtyGuard();
    focusIn(title());
    edit(title(), 'Edited');
    const issueRequest = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const away = document.getElementById('away');
    const event = new CustomEvent('htmx:confirm', {
      bubbles: true,
      cancelable: true,
      detail: { elt: away, issueRequest },
    });
    away.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(issueRequest).toHaveBeenCalledWith(true);
  });

  it('blocks boosted-link navigation when the confirm is rejected', () => {
    uninstall = installDirtyGuard();
    focusIn(title());
    edit(title(), 'Edited');
    const issueRequest = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const away = document.getElementById('away');
    const event = new CustomEvent('htmx:confirm', {
      bubbles: true,
      cancelable: true,
      detail: { elt: away, issueRequest },
    });
    away.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(issueRequest).not.toHaveBeenCalled();
  });

  it('lets boosted links pass while everything is clean', () => {
    uninstall = installDirtyGuard();
    const issueRequest = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const away = document.getElementById('away');
    const event = new CustomEvent('htmx:confirm', {
      bubbles: true,
      cancelable: true,
      detail: { elt: away, issueRequest },
    });
    away.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('is idempotent and uninstalls cleanly', () => {
    uninstall = installDirtyGuard();
    expect(installDirtyGuard()).toBe(uninstall);
    uninstall();
    focusIn(title());
    edit(title(), 'Edited');
    expect(form().hasAttribute('data-dirty')).toBe(false);
  });
});
