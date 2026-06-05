import './dom-setup.mjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installAvatar } from '../src/js/avatar.js';

let uninstall = () => {};

function composite({ src = 'https://example.com/a.jpg', delay } = {}) {
  const delayAttr = delay != null ? ` data-delay="${delay}"` : '';
  const srcAttr = src != null ? ` src="${src}"` : '';
  return `
    <span class="hc-avatar" role="img" aria-label="Ada Lovelace"
          data-testid="av"${delayAttr}>
      <img class="hc-avatar__image"${srcAttr} alt="" />
      <span class="hc-avatar__fallback" aria-hidden="true">AL</span>
    </span>
  `;
}

const avatar = () => document.querySelector('.hc-avatar');
const image = () => document.querySelector('.hc-avatar__image');

function fire(el, type) {
  el.dispatchEvent(new Event(type));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('installAvatar', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = composite();
    const u1 = installAvatar();
    const u2 = installAvatar();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('starts a fetching image in the loading state', () => {
    document.body.innerHTML = composite();
    uninstall = installAvatar();
    expect(avatar().dataset.state).toBe('loading');
  });

  it('a successful load switches to loaded', () => {
    document.body.innerHTML = composite();
    uninstall = installAvatar();
    fire(image(), 'load');
    expect(avatar().dataset.state).toBe('loaded');
  });

  it('a failed load switches to error', () => {
    document.body.innerHTML = composite();
    uninstall = installAvatar();
    fire(image(), 'error');
    expect(avatar().dataset.state).toBe('error');
  });

  it('an image with no src is an immediate error (no listeners needed)', () => {
    document.body.innerHTML = composite({ src: null });
    uninstall = installAvatar();
    expect(avatar().dataset.state).toBe('error');
  });

  it('an empty src is treated as error', () => {
    document.body.innerHTML = composite({ src: '' });
    uninstall = installAvatar();
    expect(avatar().dataset.state).toBe('error');
  });

  it('dispatches hc:avatarstatechange on each transition', () => {
    document.body.innerHTML = composite();
    uninstall = installAvatar();
    const seen = vi.fn();
    avatar().addEventListener('hc:avatarstatechange', (e) => seen(e.detail.state));
    fire(image(), 'load');
    expect(seen).toHaveBeenCalledWith('loaded');
  });

  it('a cached, already-decoded image resolves to loaded synchronously', () => {
    document.body.innerHTML = composite();
    const img = image();
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 64, configurable: true });
    uninstall = installAvatar();
    expect(avatar().dataset.state).toBe('loaded');
  });

  it('data-delay keeps the avatar pending, then reveals the fallback (loading)', () => {
    vi.useFakeTimers();
    document.body.innerHTML = composite({ delay: 200 });
    uninstall = installAvatar();
    expect(avatar().dataset.state).toBe('pending');

    vi.advanceTimersByTime(199);
    expect(avatar().dataset.state).toBe('pending');

    vi.advanceTimersByTime(1);
    expect(avatar().dataset.state).toBe('loading');
  });

  it('an image that loads within the delay window never shows the fallback', () => {
    vi.useFakeTimers();
    document.body.innerHTML = composite({ delay: 200 });
    uninstall = installAvatar();
    expect(avatar().dataset.state).toBe('pending');

    fire(image(), 'load'); // arrives before the delay elapses
    expect(avatar().dataset.state).toBe('loaded');

    // The pending→loading timer must have been cancelled.
    vi.advanceTimersByTime(500);
    expect(avatar().dataset.state).toBe('loaded');
  });

  it('leaves plain (non-composite) avatars untouched', () => {
    document.body.innerHTML =
      '<span class="hc-avatar" aria-label="Ada">AL</span>';
    uninstall = installAvatar();
    expect(avatar().hasAttribute('data-state')).toBe(false);
  });

  it('picks up an avatar added to the DOM after install (MutationObserver)', async () => {
    uninstall = installAvatar();
    document.body.innerHTML = composite();
    await new Promise((r) => setTimeout(r, 0));
    expect(avatar().dataset.state).toBe('loading');
  });

  it('uninstall stops reacting to later load / error events', () => {
    document.body.innerHTML = composite();
    const u = installAvatar();
    expect(avatar().dataset.state).toBe('loading');
    u();
    fire(image(), 'load');
    expect(avatar().dataset.state).toBe('loading'); // frozen after uninstall
  });
});
