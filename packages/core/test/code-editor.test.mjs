import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installCodeEditor } from '../src/js/code-editor.js';

let uninstall = () => {};

const FIELD = (gutter = true) => `
  <div class="hc-code" data-editable ${gutter ? 'data-gutter="line-numbers"' : ''}>
    <textarea class="hc-code__input" name="content">SELECT 1
FROM t</textarea>
  </div>
`;

const gutterOf = () => document.querySelector('.hc-code__gutter');
const lineCount = (el) => el.textContent.split('\n').length;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

describe('installCodeEditor', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = FIELD();
    const u1 = installCodeEditor();
    const u2 = installCodeEditor();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('builds a decorative gutter numbering each line', () => {
    document.body.innerHTML = FIELD();
    uninstall = installCodeEditor();
    const gutter = gutterOf();
    expect(gutter).not.toBeNull();
    expect(gutter.getAttribute('aria-hidden')).toBe('true');
    expect(lineCount(gutter)).toBe(2); // two lines of value
    expect(gutter.textContent).toBe('1\n2');
  });

  it('disables soft-wrap so numbers stay aligned', () => {
    document.body.innerHTML = FIELD();
    uninstall = installCodeEditor();
    expect(document.querySelector('.hc-code__input').getAttribute('wrap')).toBe('off');
  });

  it('renumbers as lines are added', () => {
    document.body.innerHTML = FIELD();
    uninstall = installCodeEditor();
    const textarea = document.querySelector('.hc-code__input');
    textarea.value = 'a\nb\nc\nd';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(lineCount(gutterOf())).toBe(4);
  });

  it('syncs the gutter scroll to the textarea', () => {
    document.body.innerHTML = FIELD();
    uninstall = installCodeEditor();
    const textarea = document.querySelector('.hc-code__input');
    textarea.scrollTop = 42;
    textarea.dispatchEvent(new Event('scroll', { bubbles: true }));
    expect(gutterOf().scrollTop).toBe(42);
  });

  it('does not add a gutter without data-gutter (plain editable)', () => {
    document.body.innerHTML = FIELD(false);
    uninstall = installCodeEditor();
    expect(gutterOf()).toBeNull();
    // The textarea is left a normal control (still submits its value).
    expect(document.querySelector('.hc-code__input').name).toBe('content');
  });

  it('enhances fields delivered by an htmx:load swap', () => {
    uninstall = installCodeEditor();
    const region = document.createElement('div');
    region.innerHTML = FIELD();
    document.body.appendChild(region);
    region.dispatchEvent(new Event('htmx:load', { bubbles: true }));
    expect(gutterOf()).not.toBeNull();
  });

  it('uninstall removes the gutter and restores the textarea', () => {
    document.body.innerHTML = FIELD();
    const u = installCodeEditor();
    expect(gutterOf()).not.toBeNull();
    u();
    expect(gutterOf()).toBeNull();
    expect(document.querySelector('.hc-code__input').getAttribute('wrap')).toBeNull();
    uninstall = () => {};
  });
});
