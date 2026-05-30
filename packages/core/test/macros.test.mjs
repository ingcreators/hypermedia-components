// Macro tests run against the same global customElements registry, so
// the modules are imported once at the top of the file. Each test
// builds new instances of the elements.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/macros/confirm-action.js';
import '../src/macros/live-search.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  delete globalThis.htmx;
});

describe('<hc-confirm-action>', () => {
  function place(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    const el = tpl.content.firstElementChild;
    document.body.appendChild(el);
    return el;
  }

  it('expands to .hc-action > .hc-button + .hc-spinner', () => {
    const el = place(`<hc-confirm-action action="/items/1" method="delete">Delete</hc-confirm-action>`);
    const wrapper = el.querySelector('.hc-action');
    expect(wrapper).not.toBeNull();
    expect(wrapper.querySelector('button.hc-button')).not.toBeNull();
    expect(wrapper.querySelector('.hc-spinner.htmx-indicator')).not.toBeNull();
  });

  it('uses the element text as the button label', () => {
    const el = place(`<hc-confirm-action action="/x">Delete this</hc-confirm-action>`);
    expect(el.querySelector('button').textContent).toBe('Delete this');
  });

  it('falls back to "Continue" when no label is provided', () => {
    const el = place(`<hc-confirm-action action="/x"></hc-confirm-action>`);
    expect(el.querySelector('button').textContent).toBe('Continue');
  });

  it('maps method -> data-hx-{method}, normalizing case', () => {
    const el = place(`<hc-confirm-action action="/items/1" method="DELETE">Delete</hc-confirm-action>`);
    const btn = el.querySelector('button');
    expect(btn.getAttribute('data-hx-delete')).toBe('/items/1');
    expect(btn.hasAttribute('data-hx-post')).toBe(false);
  });

  it('defaults to POST and omits target/swap when not given', () => {
    const el = place(`<hc-confirm-action action="/items">Add</hc-confirm-action>`);
    const btn = el.querySelector('button');
    expect(btn.getAttribute('data-hx-post')).toBe('/items');
    expect(btn.hasAttribute('data-hx-target')).toBe(false);
    expect(btn.getAttribute('data-hx-swap')).toBe('outerHTML');
  });

  it('always sets data-hx-trigger="hc:confirmed"', () => {
    const el = place(`<hc-confirm-action action="/x">Go</hc-confirm-action>`);
    expect(el.querySelector('button').getAttribute('data-hx-trigger')).toBe('hc:confirmed');
  });

  it('writes the message into data-hc-confirm', () => {
    const el = place(`<hc-confirm-action action="/x" message="Really?">Go</hc-confirm-action>`);
    expect(el.querySelector('button').getAttribute('data-hc-confirm')).toBe('Really?');
  });

  it('propagates variant + title + custom labels', () => {
    const el = place(`
      <hc-confirm-action
        action="/x"
        variant="error"
        title="Delete"
        confirm-label="Yes, delete"
        cancel-label="Keep">Delete</hc-confirm-action>
    `);
    const btn = el.querySelector('button');
    expect(btn.getAttribute('data-variant')).toBe('error');
    expect(btn.getAttribute('data-hc-confirm-title')).toBe('Delete');
    expect(btn.getAttribute('data-hc-confirm-label')).toBe('Yes, delete');
    expect(btn.getAttribute('data-hc-cancel-label')).toBe('Keep');
  });

  it('falls back to "post" for an unknown method', () => {
    const el = place(`<hc-confirm-action action="/x" method="bogus">Go</hc-confirm-action>`);
    expect(el.querySelector('button').getAttribute('data-hx-post')).toBe('/x');
  });

  it('omits the spinner when no-spinner is set', () => {
    const el = place(`<hc-confirm-action action="/x" no-spinner>Go</hc-confirm-action>`);
    expect(el.querySelector('.hc-spinner')).toBeNull();
  });

  it('is idempotent — connecting twice does not expand twice', () => {
    const el = place(`<hc-confirm-action action="/x">Go</hc-confirm-action>`);
    expect(el.querySelectorAll('.hc-action').length).toBe(1);

    // Re-trigger connection by detaching and re-attaching.
    document.body.removeChild(el);
    document.body.appendChild(el);
    expect(el.querySelectorAll('.hc-action').length).toBe(1);
  });

  it('calls htmx.process on the host after expansion when htmx is loaded', () => {
    const process = vi.fn();
    globalThis.htmx = { process };

    const el = place(`<hc-confirm-action action="/x">Go</hc-confirm-action>`);

    expect(process).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(el);
  });
});

describe('<hc-live-search>', () => {
  function place(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    const el = tpl.content.firstElementChild;
    document.body.appendChild(el);
    return el;
  }

  it('expands to a search form with input and submit', () => {
    const el = place(`<hc-live-search action="/items" target="#results"></hc-live-search>`);
    const form = el.querySelector('form.hc-search');
    expect(form).not.toBeNull();
    expect(form.getAttribute('role')).toBe('search');
    expect(form.getAttribute('action')).toBe('/items');
    expect(form.getAttribute('method')).toBe('get');

    expect(form.querySelector('input.hc-input[type="search"]')).not.toBeNull();
    expect(form.querySelector('button.hc-button[type="submit"]')).not.toBeNull();
  });

  it('wires the input htmx attributes (default delay 300ms)', () => {
    const el = place(`<hc-live-search action="/items" target="#results"></hc-live-search>`);
    const input = el.querySelector('input');
    expect(input.getAttribute('data-hx-get')).toBe('/items');
    expect(input.getAttribute('data-hx-trigger')).toBe('input changed delay:300ms, search');
    expect(input.getAttribute('data-hx-target')).toBe('#results');
    expect(input.getAttribute('data-hx-swap')).toBe('innerHTML');
    expect(input.getAttribute('data-hx-sync')).toBe('closest form:replace');
  });

  it('honors a custom delay and swap', () => {
    const el = place(`<hc-live-search action="/x" target="#r" delay="150ms" swap="outerHTML"></hc-live-search>`);
    const input = el.querySelector('input');
    expect(input.getAttribute('data-hx-trigger')).toBe('input changed delay:150ms, search');
    expect(input.getAttribute('data-hx-swap')).toBe('outerHTML');
  });

  it('uses aria-label when no visible label is provided', () => {
    const el = place(`<hc-live-search action="/x" target="#r"></hc-live-search>`);
    const input = el.querySelector('input');
    expect(el.querySelector('label')).toBeNull();
    expect(input.getAttribute('aria-label')).toBe('Search');
  });

  it('renders a visible label when label is provided and links it via for=', () => {
    const el = place(`<hc-live-search action="/x" target="#r" label="Find items"></hc-live-search>`);
    const input = el.querySelector('input');
    const label = el.querySelector('label.hc-field__label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Find items');
    expect(label.getAttribute('for')).toBe(input.id);
    // aria-label is omitted when a visible label is present.
    expect(input.hasAttribute('aria-label')).toBe(false);
  });

  it('uses custom name and placeholder', () => {
    const el = place(`<hc-live-search action="/x" target="#r" name="query" placeholder="Type…"></hc-live-search>`);
    const input = el.querySelector('input');
    expect(input.getAttribute('name')).toBe('query');
    expect(input.getAttribute('placeholder')).toBe('Type…');
  });

  it('omits the submit button when no-submit is set', () => {
    const el = place(`<hc-live-search action="/x" target="#r" no-submit></hc-live-search>`);
    expect(el.querySelector('button')).toBeNull();
  });

  it('is idempotent — connecting twice does not expand twice', () => {
    const el = place(`<hc-live-search action="/x" target="#r"></hc-live-search>`);
    expect(el.querySelectorAll('form').length).toBe(1);

    document.body.removeChild(el);
    document.body.appendChild(el);
    expect(el.querySelectorAll('form').length).toBe(1);
  });

  it('calls htmx.process on the host after expansion when htmx is loaded', () => {
    const process = vi.fn();
    globalThis.htmx = { process };

    const el = place(`<hc-live-search action="/x" target="#r"></hc-live-search>`);

    expect(process).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(el);
  });
});
