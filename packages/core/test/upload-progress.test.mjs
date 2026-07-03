import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installUploadProgress } from '../src/js/upload-progress.js';

let uninstall = () => {};

const $ = (id) => document.getElementById(id);

// Mimic htmx: request lifecycle events fire on the requesting element
// (the form) and bubble; htmx:xhr:progress carries the ProgressEvent
// fields as detail — for BOTH the upload and the response-download
// phases of one request.
function fire(el, name, detail) {
  el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}
const progress = (el, loaded, total, lengthComputable = true) =>
  fire(el, 'htmx:xhr:progress', { lengthComputable, loaded, total });

beforeEach(() => {
  document.body.innerHTML = `
    <form id="form">
      <input type="file" name="doc">
      <progress id="bar" class="hc-progress htmx-indicator"
                data-hc-upload-progress value="0" max="100"
                aria-label="Upload progress"></progress>
    </form>
    <form id="other"><input type="file" name="x"></form>`;
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

describe('installUploadProgress', () => {
  it('is idempotent', () => {
    uninstall = installUploadProgress();
    expect(installUploadProgress()).toBe(uninstall);
  });

  it('maps loaded/total onto 0–100', () => {
    uninstall = installUploadProgress();
    fire($('form'), 'htmx:beforeRequest');
    progress($('form'), 25, 100);
    expect($('bar').value).toBe(25);
    progress($('form'), 999, 1000);
    expect($('bar').value).toBe(100); // rounded
  });

  it('is monotonic within a request — the response-download phase cannot rewind the bar', () => {
    uninstall = installUploadProgress();
    fire($('form'), 'htmx:beforeRequest');
    progress($('form'), 9_000_000, 10_000_000); // upload at 90%
    expect($('bar').value).toBe(90);
    progress($('form'), 120, 512); // response download: small total, 23%
    expect($('bar').value).toBe(90); // held
    progress($('form'), 10_000_000, 10_000_000);
    expect($('bar').value).toBe(100);
  });

  it('resets on the next request and settles at 100 after one', () => {
    uninstall = installUploadProgress();
    fire($('form'), 'htmx:beforeRequest');
    progress($('form'), 40, 100);
    fire($('form'), 'htmx:afterRequest');
    expect($('bar').value).toBe(100);

    fire($('form'), 'htmx:beforeRequest'); // second upload
    expect($('bar').value).toBe(0);
  });

  it('ignores non-computable and zero-total events', () => {
    uninstall = installUploadProgress();
    fire($('form'), 'htmx:beforeRequest');
    progress($('form'), 10, 100, false);
    progress($('form'), 10, 0);
    fire($('form'), 'htmx:xhr:progress', {}); // no detail fields
    expect($('bar').value).toBe(0);
  });

  it('leaves forms without a bar (and other forms) untouched', () => {
    uninstall = installUploadProgress();
    fire($('form'), 'htmx:beforeRequest');
    progress($('other'), 50, 100); // a different form's request
    expect($('bar').value).toBe(0);
    expect(() => fire($('other'), 'htmx:afterRequest')).not.toThrow();
  });

  it('uninstall stops updates', () => {
    const u = installUploadProgress();
    u();
    fire($('form'), 'htmx:beforeRequest');
    progress($('form'), 50, 100);
    expect($('bar').value).toBe(0);
  });
});
