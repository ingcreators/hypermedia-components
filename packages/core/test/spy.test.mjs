import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installSpy } from '../src/js/spy.js';

// jsdom ships no IntersectionObserver and lays nothing out. A controllable
// fake captures the callback so a test can trigger a recompute, and records
// observe()/disconnect() so we can assert the wiring. Section geometry is
// stubbed per test via getBoundingClientRect; the activation line is
// innerHeight * 0.3.
class FakeIO {
  static instances = [];
  constructor(cb, opts) {
    this.cb = cb;
    this.opts = opts;
    this.observed = new Set();
    this.disconnected = false;
    FakeIO.instances.push(this);
  }
  observe(el) {
    this.observed.add(el);
  }
  unobserve(el) {
    this.observed.delete(el);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  // Test helper — trigger a recompute (entries are ignored by the behavior).
  fire() {
    this.cb([], this);
  }
}

let uninstall = () => {};

// Activation line = innerHeight * 0.3 = 300 with this height.
function setTops(map) {
  for (const [id, top] of Object.entries(map)) {
    document.getElementById(id).getBoundingClientRect = () => ({ top });
  }
}

beforeEach(() => {
  FakeIO.instances = [];
  globalThis.IntersectionObserver = FakeIO;
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  document.body.innerHTML = `
    <nav class="hc-toc" data-hc-spy aria-label="On this page">
      <a id="l1" class="hc-toc__link" href="#s1">One</a>
      <a id="l2" class="hc-toc__link" href="#s2">Two</a>
      <a id="lx" class="hc-toc__link" href="#missing">Missing</a>
    </nav>
    <section id="s1">1</section>
    <section id="s2">2</section>`;
  setTops({ s1: 400, s2: 900 }); // both below the line by default
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
  delete globalThis.IntersectionObserver;
});

const io = () => FakeIO.instances[0];

describe('installSpy', () => {
  it('is idempotent and returns an uninstaller', () => {
    uninstall = installSpy();
    expect(installSpy()).toBe(uninstall);
  });

  it('observes only sections that exist (skips the missing target)', () => {
    uninstall = installSpy();
    expect(io().observed.size).toBe(2);
    expect([...io().observed].map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('marks the section that has reached the activation line', () => {
    uninstall = installSpy();
    setTops({ s1: 10, s2: 600 }); // s1 above the line, s2 below
    io().fire();

    const l1 = document.getElementById('l1');
    expect(l1.getAttribute('aria-current')).toBe('location');
    expect(l1.hasAttribute('data-active')).toBe(true);
  });

  it('moves the marker as a new section reaches the line, clearing the old', () => {
    uninstall = installSpy();
    setTops({ s1: 10, s2: 600 });
    io().fire();
    setTops({ s1: -500, s2: 10 }); // s2 now at the top
    io().fire();

    expect(document.getElementById('l1').hasAttribute('aria-current')).toBe(false);
    expect(document.getElementById('l2').getAttribute('aria-current')).toBe('location');
  });

  it('picks the LAST section past the line, not the edge-touching earlier one', () => {
    // Both above the line — the earlier section only edge-touches; the later
    // one is the real current section.
    uninstall = installSpy();
    setTops({ s1: -500, s2: 100 });
    io().fire();

    expect(document.getElementById('l2').getAttribute('aria-current')).toBe('location');
    expect(document.getElementById('l1').hasAttribute('aria-current')).toBe(false);
  });

  it('keeps the first link active before any heading reaches the line', () => {
    uninstall = installSpy();
    setTops({ s1: 400, s2: 900 }); // both below the line
    io().fire();

    expect(document.getElementById('l1').getAttribute('aria-current')).toBe('location');
  });

  it('only ever marks one link at a time', () => {
    uninstall = installSpy();
    setTops({ s1: -500, s2: 10 });
    io().fire();
    expect(document.querySelectorAll('.hc-toc__link[aria-current="location"]').length).toBe(1);
  });

  it('wires each [data-hc-spy] nav with its own observer', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<nav class="hc-toc" data-hc-spy><a class="hc-toc__link" href="#s2">Two</a></nav>`,
    );
    uninstall = installSpy();
    expect(FakeIO.instances.length).toBe(2);
  });

  it('creates no observer for a nav whose sections are all missing', () => {
    document.body.innerHTML = `
      <nav class="hc-toc" data-hc-spy><a class="hc-toc__link" href="#nope">x</a></nav>`;
    uninstall = installSpy();
    expect(FakeIO.instances.length).toBe(0);
  });

  it('is a no-op when IntersectionObserver is unavailable; links still work', () => {
    delete globalThis.IntersectionObserver;
    expect(() => {
      uninstall = installSpy();
    }).not.toThrow();
    expect(FakeIO.instances.length).toBe(0);
  });

  it('disconnects observers and clears the marker on uninstall', () => {
    uninstall = installSpy();
    setTops({ s1: 10, s2: 600 });
    io().fire();
    const observer = io();

    uninstall();
    uninstall = () => {};

    expect(observer.disconnected).toBe(true);
    expect(document.getElementById('l1').hasAttribute('aria-current')).toBe(false);
  });
});
