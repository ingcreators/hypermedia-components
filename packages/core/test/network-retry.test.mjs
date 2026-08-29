import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installNetworkRetry } from '../src/js/network-retry.js';
import { setMessages, resetMessages } from '../src/js/i18n.js';

let uninstall = () => {};

function host() {
  return document.querySelector('[data-hc-network-retry]');
}

// htmx fires sendError/timeout on the requesting element with the
// request's config in the detail; afterRequest follows every attempt
// (xhr.status 0 for the failure itself, the real status otherwise).
function fail(elt, name = 'htmx:sendError', { verb = 'post', path = '/save', parameters } = {}) {
  elt.dispatchEvent(
    new CustomEvent(name, {
      bubbles: true,
      detail: { xhr: { status: 0 }, requestConfig: { elt, verb, path, parameters } },
    }),
  );
}

function respond(elt, status = 200) {
  elt.dispatchEvent(
    new CustomEvent('htmx:afterRequest', {
      bubbles: true,
      detail: { xhr: { status }, elt, successful: status < 400 },
    }),
  );
}

beforeEach(() => {
  document.body.innerHTML = `
    <div data-hc-network-retry></div>
    <form id="save-form"><input name="amount" value="1200"><button type="submit">Save</button></form>
    <button id="other">Other</button>
  `;
  window.htmx = { ajax: vi.fn() };
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  delete window.htmx;
  resetMessages();
  document.body.innerHTML = '';
});

describe('installNetworkRetry', () => {
  it('renders a retry alert into the host on htmx:sendError', () => {
    uninstall = installNetworkRetry();
    fail(document.querySelector('#save-form'));
    const alert = host().querySelector('.hc-alert');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('data-variant')).toBe('error');
    expect(alert.getAttribute('role')).toBe('status');
    expect(alert.textContent).toContain("didn't reach the server");
    expect(alert.querySelector('button[data-hc-network-retry-now]')).toBeTruthy();
  });

  it('renders on htmx:timeout too', () => {
    uninstall = installNetworkRetry();
    fail(document.querySelector('#save-form'), 'htmx:timeout');
    expect(host().querySelector('.hc-alert')).toBeTruthy();
  });

  it('re-renders in place on repeat failures — one host, one alert', () => {
    uninstall = installNetworkRetry();
    const form = document.querySelector('#save-form');
    fail(form);
    fail(form);
    fail(form);
    expect(host().querySelectorAll('.hc-alert')).toHaveLength(1);
  });

  it('does nothing without a host', () => {
    host().remove();
    uninstall = installNetworkRetry();
    expect(() => fail(document.querySelector('#save-form'))).not.toThrow();
  });

  it('Retry re-issues the failed request through htmx.ajax with the source only (values re-collect)', () => {
    uninstall = installNetworkRetry();
    const form = document.querySelector('#save-form');
    fail(form, 'htmx:sendError', { verb: 'post', path: '/save', parameters: { amount: '1200' } });
    host().querySelector('[data-hc-network-retry-now]').click();
    expect(window.htmx.ajax).toHaveBeenCalledWith('post', '/save', { source: form });
  });

  it('a vanished requester clears the alert instead of replaying', () => {
    uninstall = installNetworkRetry();
    const form = document.querySelector('#save-form');
    fail(form);
    form.remove();
    host().querySelector('[data-hc-network-retry-now]').click();
    expect(window.htmx.ajax).not.toHaveBeenCalled();
    expect(host().children).toHaveLength(0);
  });

  it('any real response on the failed element clears the alert — success or error alike', () => {
    uninstall = installNetworkRetry();
    const form = document.querySelector('#save-form');
    fail(form);
    respond(form, 500); // the server answered: the errors map owns it now
    expect(host().children).toHaveLength(0);
  });

  it('a response elsewhere does NOT clear the alert (the failed action is still pending)', () => {
    uninstall = installNetworkRetry();
    fail(document.querySelector('#save-form'));
    respond(document.querySelector('#other'), 200);
    expect(host().querySelector('.hc-alert')).toBeTruthy();
  });

  it('the failure’s own afterRequest (status 0) never clears', () => {
    uninstall = installNetworkRetry();
    const form = document.querySelector('#save-form');
    fail(form);
    respond(form, 0);
    expect(host().querySelector('.hc-alert')).toBeTruthy();
  });

  it('host attributes override the catalog strings', () => {
    host().setAttribute('data-hc-network-retry-message', 'Offline!');
    host().setAttribute('data-hc-network-retry-label', 'Try again');
    uninstall = installNetworkRetry();
    fail(document.querySelector('#save-form'));
    expect(host().querySelector('.hc-alert__title').textContent).toBe('Offline!');
    expect(host().querySelector('[data-hc-network-retry-now]').textContent).toBe('Try again');
  });

  it('speaks through the i18n catalog', () => {
    const restore = setMessages({ 'networkRetry.failed': 'ネットワークエラー', 'networkRetry.retry': '再試行' });
    uninstall = installNetworkRetry();
    fail(document.querySelector('#save-form'));
    expect(host().querySelector('.hc-alert__title').textContent).toBe('ネットワークエラー');
    expect(host().querySelector('[data-hc-network-retry-now]').textContent).toBe('再試行');
    restore();
  });

  it('is idempotent and uninstall stops it', () => {
    uninstall = installNetworkRetry();
    expect(installNetworkRetry()).toBe(uninstall);
    uninstall();
    fail(document.querySelector('#save-form'));
    expect(host().children).toHaveLength(0);
    uninstall = () => {};
  });
});
