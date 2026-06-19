import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installNavCurrent, pickCurrent } from '../src/js/nav-current.js';

const ORIGIN = 'https://app.test';
const links = (...paths) => paths.map((p) => ({ href: `${ORIGIN}${p}` }));

describe('pickCurrent', () => {
  it('returns the exact pathname match', () => {
    const ls = links('/app/explorer', '/app/docs');
    expect(pickCurrent('/app/docs', ls, ORIGIN)).toBe(ls[1]);
  });

  it('prefers the exact match over a shorter prefix', () => {
    const ls = links('/app', '/app/docs');
    expect(pickCurrent('/app/docs', ls, ORIGIN)).toBe(ls[1]);
  });

  it('picks the longest path-segment prefix on a subpage', () => {
    const ls = links('/app/docs', '/app/docs/coverage', '/app');
    // On /app/docs/coverage/api the coverage link is the longest prefix.
    expect(pickCurrent('/app/docs/coverage/api', ls, ORIGIN)).toBe(ls[1]);
  });

  it('does not let root "/" win as a prefix', () => {
    const ls = links('/', '/app/docs');
    expect(pickCurrent('/app/docs', ls, ORIGIN)).toBe(ls[1]);
  });

  it('lets root "/" win only on an exact match', () => {
    const ls = links('/', '/app');
    expect(pickCurrent('/', ls, ORIGIN)).toBe(ls[0]);
  });

  it('treats a trailing slash as equivalent (both directions)', () => {
    // trailing slash on the current path
    expect(pickCurrent('/app/docs/', links('/app/docs'), ORIGIN)).not.toBe(null);
    // trailing slash on the link
    const withSlash = links('/app/docs/');
    expect(pickCurrent('/app/docs', withSlash, ORIGIN)).toBe(withSlash[0]);
  });

  it('does not fall for the substring trap (/users vs /users-archive)', () => {
    const ls = links('/users');
    expect(pickCurrent('/users-archive', ls, ORIGIN)).toBe(null);
  });

  it('ignores cross-origin links', () => {
    const ls = [{ href: 'https://other.test/app/docs' }, { href: `${ORIGIN}/app` }];
    expect(pickCurrent('/app/docs', ls, ORIGIN)).toBe(ls[1]);
  });

  it('returns null when nothing matches', () => {
    expect(pickCurrent('/nope', links('/app', '/app/docs'), ORIGIN)).toBe(null);
  });
});

let uninstall = () => {};

function setPath(path) {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  setPath('/app/docs');
  document.body.innerHTML = `
    <nav class="hc-shell__sidebar" data-hc-nav-current aria-label="Primary">
      <a id="n-explorer" class="hc-item" href="/app/explorer">Explorer</a>
      <a id="n-docs" class="hc-item" href="/app/docs">Docs</a>
      <a id="n-cov" class="hc-item" href="/app/docs/coverage">Coverage</a>
    </nav>`;
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
  setPath('/');
});

const current = () => document.querySelector('[aria-current="page"]')?.id ?? null;

describe('installNavCurrent', () => {
  it('is idempotent and returns an uninstaller', () => {
    uninstall = installNavCurrent();
    expect(installNavCurrent()).toBe(uninstall);
  });

  it('marks the exact-match link on install', () => {
    uninstall = installNavCurrent();
    expect(current()).toBe('n-docs');
  });

  it('marks the longest prefix on a subpage', () => {
    setPath('/app/docs/coverage/detail');
    uninstall = installNavCurrent();
    expect(current()).toBe('n-cov');
  });

  it('marks exactly one link', () => {
    setPath('/app/docs/coverage');
    uninstall = installNavCurrent();
    expect(document.querySelectorAll('[aria-current="page"]').length).toBe(1);
  });

  it('re-marks after popstate (back/forward)', () => {
    uninstall = installNavCurrent();
    expect(current()).toBe('n-docs');

    setPath('/app/explorer');
    window.dispatchEvent(new Event('popstate'));
    expect(current()).toBe('n-explorer');
  });

  it('re-marks after htmx:pushedIntoHistory', () => {
    uninstall = installNavCurrent();
    setPath('/app/docs/coverage');
    document.body.dispatchEvent(new CustomEvent('htmx:pushedIntoHistory', { bubbles: true }));
    expect(current()).toBe('n-cov');
  });

  it('wires a [data-hc-nav-current] container added later', () => {
    uninstall = installNavCurrent();
    setPath('/app/explorer');
    document.body.insertAdjacentHTML(
      'beforeend',
      `<nav data-hc-nav-current><a id="late" class="hc-item" href="/app/explorer">X</a></nav>`,
    );
    return Promise.resolve().then(() => {
      expect(document.getElementById('late').getAttribute('aria-current')).toBe('page');
    });
  });

  it('clears the link it set and removes listeners on uninstall', () => {
    uninstall = installNavCurrent();
    expect(current()).toBe('n-docs');

    uninstall();
    uninstall = () => {};
    expect(current()).toBe(null);

    // popstate after uninstall is a no-op.
    setPath('/app/explorer');
    window.dispatchEvent(new Event('popstate'));
    expect(current()).toBe(null);
  });
});
