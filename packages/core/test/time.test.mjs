import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installTime } from '../src/js/time.js';

const NOW = new Date('2026-08-08T12:00:00Z');

let uninstall = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.useRealTimers();
});

function mount(html) {
  document.body.innerHTML = html;
}

describe('installTime', () => {
  it('renders relative time at install and sets an absolute title', () => {
    mount(`
      <time id="t" datetime="2026-08-08T11:57:00Z" data-hc-time="relative">
        2026-08-08 11:57 UTC
      </time>
    `);
    uninstall = installTime();
    const el = document.getElementById('t');
    const expected = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-3, 'minute');
    expect(el.textContent).toBe(expected);
    expect(el.getAttribute('title')).toBe(
      new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date('2026-08-08T11:57:00Z'),
      ),
    );
    expect(el.getAttribute('datetime')).toBe('2026-08-08T11:57:00Z');
  });

  it('follows the closest [lang] for the language', () => {
    mount(`
      <div lang="ja">
        <time id="t" datetime="2026-08-08T11:57:00Z" data-hc-time="relative">x</time>
      </div>
    `);
    uninstall = installTime();
    const expected = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' }).format(-3, 'minute');
    expect(document.getElementById('t').textContent).toBe(expected);
  });

  it('renders absolute datetime / date / time modes', () => {
    mount(`
      <time id="dt" datetime="2026-08-08T11:57:00Z" data-hc-time="datetime">x</time>
      <time id="d" datetime="2026-08-08T11:57:00Z" data-hc-time="date">x</time>
      <time id="tm" datetime="2026-08-08T11:57:00Z" data-hc-time="time">x</time>
    `);
    uninstall = installTime();
    const when = new Date('2026-08-08T11:57:00Z');
    expect(document.getElementById('dt').textContent).toBe(
      new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(when),
    );
    expect(document.getElementById('d').textContent).toBe(
      new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(when),
    );
    expect(document.getElementById('tm').textContent).toBe(
      new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(when),
    );
  });

  it('keeps an author-provided title and unparseable values untouched', () => {
    mount(`
      <time id="titled" datetime="2026-08-08T11:57:00Z" data-hc-time="relative"
            title="already here">x</time>
      <time id="bad" datetime="not-a-date" data-hc-time="relative">fallback</time>
    `);
    uninstall = installTime();
    expect(document.getElementById('titled').getAttribute('title')).toBe('already here');
    expect(document.getElementById('bad').textContent).toBe('fallback');
  });

  it('localizes nodes added later (htmx swaps)', async () => {
    mount('<div id="host"></div>');
    uninstall = installTime();
    const host = document.getElementById('host');
    host.innerHTML =
      '<time id="t" datetime="2026-08-08T11:00:00Z" data-hc-time="relative">x</time>';
    await Promise.resolve();
    const expected = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'hour');
    expect(document.getElementById('t').textContent).toBe(expected);
  });

  it('refreshes relative text on the shared interval', () => {
    mount(`
      <time id="t" datetime="2026-08-08T11:59:30Z" data-hc-time="relative">x</time>
    `);
    uninstall = installTime();
    const el = document.getElementById('t');
    const before = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-30, 'second');
    expect(el.textContent).toBe(before);
    vi.advanceTimersByTime(120000);
    const after = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-2, 'minute');
    expect(el.textContent).toBe(after);
  });

  it('is idempotent and uninstalls cleanly', () => {
    mount('<time id="t" datetime="2026-08-08T11:57:00Z" data-hc-time="relative">x</time>');
    uninstall = installTime();
    expect(installTime()).toBe(uninstall);
    uninstall();
    const el = document.getElementById('t');
    el.textContent = 'frozen';
    vi.advanceTimersByTime(60000);
    expect(el.textContent).toBe('frozen');
  });
});
