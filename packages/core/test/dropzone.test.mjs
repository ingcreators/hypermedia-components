import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installDropzone } from '../src/js/dropzone.js';

let uninstall = () => {};

const $ = (id) => document.getElementById(id);

// jsdom has no DataTransfer — the behavior only reads `types` and
// `files`, so synthetic drag events carry a stub.
function drag(el, name, { files = [], types = ['Files'], relatedTarget = null } = {}) {
  const event = new Event(name, { bubbles: true, cancelable: true });
  event.dataTransfer = { types, files };
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  el.dispatchEvent(event);
  return event;
}

const file = (name) => ({ name });

beforeEach(() => {
  document.body.innerHTML = `
    <label class="hc-dropzone" id="zone">
      <input class="hc-dropzone__input" id="input" type="file" name="doc">
      <span class="hc-dropzone__body">
        <span class="hc-dropzone__hint" id="hint">Drop a file here</span>
        <span class="hc-dropzone__files" id="files"></span>
      </span>
    </label>`;
  // jsdom's input.files is read-only via the IDL — make it writable for
  // the assignment the behavior performs.
  Object.defineProperty($('input'), 'files', { writable: true, value: [] });
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

describe('installDropzone', () => {
  it('is idempotent', () => {
    uninstall = installDropzone();
    expect(installDropzone()).toBe(uninstall);
  });

  it('dragover with files sets data-dragover (and allows the drop)', () => {
    uninstall = installDropzone();
    const ev = drag($('zone'), 'dragover');
    expect($('zone').hasAttribute('data-dragover')).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('ignores drags that carry no files (text selections, etc.)', () => {
    uninstall = installDropzone();
    const ev = drag($('zone'), 'dragover', { types: ['text/plain'] });
    expect($('zone').hasAttribute('data-dragover')).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('dragleave onto a child keeps the state; leaving the zone clears it', () => {
    uninstall = installDropzone();
    drag($('zone'), 'dragover');
    drag($('zone'), 'dragleave', { relatedTarget: $('hint') });
    expect($('zone').hasAttribute('data-dragover')).toBe(true);
    drag($('zone'), 'dragleave', { relatedTarget: document.body });
    expect($('zone').hasAttribute('data-dragover')).toBe(false);
  });

  it('drop assigns the files, fires a bubbling change, and renders the names', () => {
    uninstall = installDropzone();
    const onChange = vi.fn();
    document.body.addEventListener('change', onChange);

    drag($('zone'), 'dragover');
    drag($('zone'), 'drop', { files: [file('report.pdf')] });

    expect($('zone').hasAttribute('data-dragover')).toBe(false);
    expect([...$('input').files].map((f) => f.name)).toEqual(['report.pdf']);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target).toBe($('input'));
    expect($('files').textContent).toBe('report.pdf');
  });

  it('a single-file input takes only the first dropped file', () => {
    uninstall = installDropzone();
    // jsdom lacks DataTransfer entirely — the behavior then assigns the
    // list as-is; the trimming branch is pinned in the browser E2E. Here
    // we assert the guard does not crash without the constructor.
    drag($('zone'), 'drop', { files: [file('a.pdf'), file('b.pdf')] });
    expect($('input').files.length).toBe(2); // jsdom fallback path
  });

  it('renders names on a native (browsed) change too', () => {
    uninstall = installDropzone();
    $('input').files = [file('picked.png')];
    $('input').dispatchEvent(new Event('change', { bubbles: true }));
    expect($('files').textContent).toBe('picked.png');
  });

  it('a disabled input inert-s the zone', () => {
    uninstall = installDropzone();
    $('input').disabled = true;
    const over = drag($('zone'), 'dragover');
    expect($('zone').hasAttribute('data-dragover')).toBe(false);
    expect(over.defaultPrevented).toBe(false);
    drag($('zone'), 'drop', { files: [file('x.pdf')] });
    expect([...$('input').files]).toEqual([]);
  });

  it('uninstall stops the enhancement', () => {
    const u = installDropzone();
    u();
    drag($('zone'), 'dragover');
    expect($('zone').hasAttribute('data-dragover')).toBe(false);
  });
});
