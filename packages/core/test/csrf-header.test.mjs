import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installCsrfHeader } from '../src/js/csrf-header.js';

let uninstall = () => {};

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '<button id="btn">Save</button>';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

function setMeta(content, attrs = '') {
  document.head.innerHTML =
    content == null ? '' : `<meta name="csrf-token" content="${content}" ${attrs}>`;
}

// Simulate htmx firing configRequest on the requesting element; returns
// the headers object after every listener ran.
function configRequest(headers = {}) {
  document.getElementById('btn').dispatchEvent(
    new CustomEvent('htmx:configRequest', { bubbles: true, detail: { headers } }),
  );
  return headers;
}

describe('installCsrfHeader', () => {
  it('is idempotent and returns an uninstaller', () => {
    uninstall = installCsrfHeader();
    expect(installCsrfHeader()).toBe(uninstall);
  });

  it('adds X-CSRF-Token from the meta tag to every htmx request', () => {
    setMeta('tok-1');
    uninstall = installCsrfHeader();
    expect(configRequest()).toEqual({ 'X-CSRF-Token': 'tok-1' });
  });

  it('reads the meta at request time, so a rotated token is picked up', () => {
    setMeta('tok-1');
    uninstall = installCsrfHeader();
    expect(configRequest()).toEqual({ 'X-CSRF-Token': 'tok-1' });

    document.querySelector('meta[name="csrf-token"]').setAttribute('content', 'tok-2');
    expect(configRequest()).toEqual({ 'X-CSRF-Token': 'tok-2' });
  });

  it('honours data-header for stacks expecting a different header name', () => {
    setMeta('django-tok', 'data-header="X-CSRFToken"');
    uninstall = installCsrfHeader();
    expect(configRequest()).toEqual({ 'X-CSRFToken': 'django-tok' });
  });

  it('never overwrites a header already on the request (data-hx-headers wins)', () => {
    setMeta('page-tok');
    uninstall = installCsrfHeader();
    expect(configRequest({ 'X-CSRF-Token': 'explicit' }))
      .toEqual({ 'X-CSRF-Token': 'explicit' });
  });

  it('is a strict no-op without the meta tag or with empty content', () => {
    uninstall = installCsrfHeader();
    expect(configRequest()).toEqual({});

    setMeta('');
    expect(configRequest()).toEqual({});
  });

  it('tolerates events without a headers object', () => {
    setMeta('tok');
    uninstall = installCsrfHeader();
    expect(() => {
      document.getElementById('btn').dispatchEvent(
        new CustomEvent('htmx:configRequest', { bubbles: true, detail: {} }),
      );
      document.getElementById('btn').dispatchEvent(
        new CustomEvent('htmx:configRequest', { bubbles: true }),
      );
    }).not.toThrow();
  });

  it('does nothing after uninstall', () => {
    setMeta('tok');
    uninstall = installCsrfHeader();
    uninstall();
    uninstall = () => {};
    expect(configRequest()).toEqual({});
  });
});
