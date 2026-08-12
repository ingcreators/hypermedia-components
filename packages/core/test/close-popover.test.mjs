import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installClosePopover } from '../src/js/close-popover.js';

// jsdom does not implement popover APIs. Polyfill the bits used by
// the behavior: hidePopover() removes the open state attribute.
function polyfillPopover(el) {
  el.showPopover = function () { el.setAttribute('data-popover-open', ''); };
  el.hidePopover = vi.fn(function () { el.removeAttribute('data-popover-open'); });
  el.setAttribute('data-popover-open', ''); // start open
}

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = `
    <div id="p" popover>
      <form id="f" data-hc-close-popover-on-success>
        <button id="submit" type="submit">Apply</button>
      </form>
    </div>
  `;
  polyfillPopover(document.getElementById('p'));
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

function fireAfterRequest(target, { successful = true } = {}) {
  target.dispatchEvent(new CustomEvent('htmx:afterRequest', {
    bubbles: true,
    detail: { successful },
  }));
}

describe('installClosePopover', () => {
  it('closes the closest popover after a successful request', () => {
    uninstall = installClosePopover();
    const popover = document.getElementById('p');
    expect(popover.hidePopover).not.toHaveBeenCalled();

    fireAfterRequest(document.getElementById('f'));
    expect(popover.hidePopover).toHaveBeenCalledTimes(1);
  });

  it('keeps the popover open on failure', () => {
    uninstall = installClosePopover();
    fireAfterRequest(document.getElementById('f'), { successful: false });
    expect(document.getElementById('p').hidePopover).not.toHaveBeenCalled();
  });

  it('does nothing if the opt-in attribute is absent', () => {
    document.getElementById('f').removeAttribute('data-hc-close-popover-on-success');
    uninstall = installClosePopover();
    fireAfterRequest(document.getElementById('f'));
    expect(document.getElementById('p').hidePopover).not.toHaveBeenCalled();
  });

  it('does nothing when no popover ancestor exists', () => {
    document.body.innerHTML = `<form id="orphan" data-hc-close-popover-on-success></form>`;
    uninstall = installClosePopover();
    expect(() => fireAfterRequest(document.getElementById('orphan'))).not.toThrow();
  });

  it('idempotent: repeated installs return the same uninstaller', () => {
    const off1 = installClosePopover();
    const off2 = installClosePopover();
    uninstall = off1;
    expect(off1).toBe(off2);
  });

  it('uninstall stops responding to events', () => {
    const off = installClosePopover();
    off();
    fireAfterRequest(document.getElementById('f'));
    expect(document.getElementById('p').hidePopover).not.toHaveBeenCalled();
  });

  it('an inner region can opt out with ="false", so a self-editing panel stays open', () => {
    // A sort or column panel edits itself: its add / remove round trips
    // succeed, and without this the panel would dismiss itself while
    // the user is still working in it.
    document.body.innerHTML = `
      <div id="p2" popover>
        <form id="f2" data-hc-close-popover-on-success>
          <div id="keys" data-hc-close-popover-on-success="false">
            <button id="add" type="button">Add</button>
          </div>
          <button id="apply" type="submit">Apply</button>
        </form>
      </div>
    `;
    polyfillPopover(document.getElementById('p2'));
    uninstall = installClosePopover();

    fireAfterRequest(document.getElementById('add'));
    expect(document.getElementById('p2').hidePopover).not.toHaveBeenCalled();

    // Apply still closes it — the NEAREST carrier is the form.
    fireAfterRequest(document.getElementById('f2'));
    expect(document.getElementById('p2').hidePopover).toHaveBeenCalled();
  });
});
