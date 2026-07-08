import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/file-upload.mjs';
import { call } from './helpers.mjs';

/** Multipart POST /files with an optional File in the `doc` field. */
function upload(file, { fields = {}, ...opts } = {}) {
  const body = new FormData();
  if (file) body.append('doc', file);
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return call(mod, 'POST', '/files', { body, ...opts });
}

/** Same, but as the dropzone form (hidden `form=dropzone` field). */
function dropzoneUpload(file, opts = {}) {
  return upload(file, { fields: { form: 'dropzone' }, ...opts });
}

function file(name, bytes, type = 'application/octet-stream') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('file-upload demo API', () => {
  it('answers a valid upload with the item + OOB pristine form + toast (htmx)', async () => {
    const response = await upload(file('請求書.png', 123_456, 'image/png'));
    expect(response.status).toBe(200);

    // The toast header must be latin-1-safe: hxTrigger \uXXXX-escapes
    // every non-ASCII character of the Japanese filename.
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('uploaded');
    expect(trigger).toContain('success');
    expect(trigger).toMatch(/^[\x00-\x7f]+$/);
    expect(trigger).toContain('\\u8acb'); // 請

    const body = await response.text();
    expect(body).toContain('<li class="hc-item" id="file-upload-demo-file-');
    expect(body).toContain('請求書.png — 123 kB');
    // The OOB pristine form — the blessed file-input reset.
    expect(body).toContain('hx-swap-oob="true"');
    expect(body).toContain('id="file-upload-demo-form"');
    expect(body).toContain('enctype="multipart/form-data"');
    expect(body).toContain('data-hx-encoding="multipart/form-data"');
    expect(body).toContain('data-hx-target="#file-upload-demo-files"');
  });

  it('accepts extensions case-insensitively (.PDF)', async () => {
    const response = await upload(file('SCAN.PDF', 2048, 'application/pdf'));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('SCAN.PDF — 2 kB');
  });

  it('rejects a disallowed extension with a retargeted 422 type error', async () => {
    const response = await upload(file('notes.txt', 64, 'text/plain'));
    expect(response.status).toBe(422);
    expect(response.headers.get('HX-Retarget')).toBe('#file-upload-demo-errors');
    expect(response.headers.get('HX-Reswap')).toBe('innerHTML');
    const body = await response.text();
    expect(body).toContain('data-hc-field-errors');
    expect(body).toContain('The file was not accepted.');
    expect(body).toContain('data-field="doc"');
    expect(body).toContain('data-code="type"');
    expect(body).toContain('only PDF or PNG files are allowed');
  });

  it('rejects a file over 1 MiB with a 422 size error', async () => {
    const response = await upload(file('big.png', 1024 * 1024 + 1, 'image/png'));
    expect(response.status).toBe(422);
    expect(response.headers.get('HX-Retarget')).toBe('#file-upload-demo-errors');
    const body = await response.text();
    expect(body).toContain('data-code="size"');
    expect(body).toContain('files must be 1 MB or smaller');
  });

  it('rejects a missing file with a 422 required error', async () => {
    const response = await upload(null);
    expect(response.status).toBe(422);
    expect(response.headers.get('HX-Retarget')).toBe('#file-upload-demo-errors');
    const body = await response.text();
    expect(body).toContain('data-code="required"');
  });

  it('rejects an empty-name file part (empty file input) as required', async () => {
    const response = await upload(new File([], ''));
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('data-code="required"');
  });

  it('answers a dropzone upload with the item + the OOB pristine DROPZONE form', async () => {
    const response = await dropzoneUpload(file('scan.pdf', 4096, 'application/pdf'));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('scan.pdf — 4 kB');
    // The OOB reset re-sends the dropzone form, not the plain one.
    expect(body).toContain('id="file-upload-demo-dropzone-form" hx-swap-oob="true"');
    expect(body).not.toContain('id="file-upload-demo-form"');
    // Pristine dropzone markup + the discriminator ride along.
    expect(body).toContain('class="hc-dropzone"');
    expect(body).toContain('class="hc-dropzone__input"');
    expect(body).toContain('<input type="hidden" name="form" value="dropzone">');
    expect(body).toContain('data-hx-target="#file-upload-demo-files"');
  });

  it('retargets a dropzone 422 into the dropzone form\'s own errors div', async () => {
    const response = await dropzoneUpload(file('notes.txt', 64, 'text/plain'));
    expect(response.status).toBe(422);
    expect(response.headers.get('HX-Retarget')).toBe(
      '#file-upload-demo-dropzone-errors',
    );
    expect(response.headers.get('HX-Reswap')).toBe('innerHTML');
    expect(await response.text()).toContain('data-code="type"');
  });

  it('treats an unrecognized form discriminator as the plain form (strict allow-list)', async () => {
    const response = await upload(file('notes.txt', 64, 'text/plain'), {
      fields: { form: '"><script>alert(1)</script>' },
    });
    expect(response.status).toBe(422);
    expect(response.headers.get('HX-Retarget')).toBe('#file-upload-demo-errors');

    const ok = await upload(file('scan.pdf', 4096, 'application/pdf'), {
      fields: { form: 'DROPZONE' },
    });
    const body = await ok.text();
    expect(body).toContain('id="file-upload-demo-form"');
    expect(body).not.toContain('file-upload-demo-dropzone-form');
  });

  it('answers a no-JS valid upload with a 303 post/redirect/get', async () => {
    const response = await upload(file('report.pdf', 4096, 'application/pdf'), {
      htmx: false,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      '/hypermedia-components/recipes/file-upload/',
    );
  });

  it('lists two canned items on GET /files (htmx)', async () => {
    const response = await call(mod, 'GET', '/files');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.match(/class="hc-item"/g)).toHaveLength(2);
    expect(body).toContain('spec.pdf');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(mod, 'GET', '/nope')).toBeNull();
    expect(await call(mod, 'DELETE', '/files')).toBeNull();
  });
});
