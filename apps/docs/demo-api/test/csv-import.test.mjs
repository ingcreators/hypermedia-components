import { describe, expect, it } from 'vitest';
import * as csvImport from '../recipes/csv-import.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/csv-import';

/** Multipart POST /imports with the CSV text as the `csv` file field. */
function upload(csvText, { name = 'items.csv', ...opts } = {}) {
  const body = new FormData();
  if (csvText !== null) body.append('csv', new File([csvText], name, { type: 'text/csv' }));
  return call(csvImport, 'POST', '/imports', { body, ...opts });
}

/** Pull the single-shot token out of a report fragment. */
function tokenOf(body) {
  return body.match(/name="token" value="([^"]+)"/)?.[1];
}

describe('csv-import demo API', () => {
  it('answers an all-valid upload with the summary + confirm form, importing nothing', async () => {
    const response = await upload('name,qty\nAnvil,3\nSprocket,12\n');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('2 rows ready to import.');
    expect(body).not.toContain('<table'); // no errors, no error table
    expect(body).toContain(`data-hx-post="${API}/imports/`);
    expect(body).toContain('/commit"');
    expect(body).toContain('name="token"');
    expect(body).toContain('Import the valid 2 rows');
  });

  it('reports invalid rows in a real table and offers to import the valid ones', async () => {
    const response = await upload('name,qty\nAnvil,3\nWidget,zero\n,4\nSprocket,5\n');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('2 of 4 rows ready — 2 rows have errors and will be skipped.');
    expect(body).toContain('<caption>Rows that will not be imported</caption>');
    expect(body).toContain('<th scope="col">Row</th>');
    // Line numbers count the header: Widget is CSV line 3, the blank name line 4.
    expect(body).toContain('<th scope="row">3</th>');
    expect(body).toContain('qty must be a positive integer');
    expect(body).toContain('<th scope="row">4</th>');
    expect(body).toContain('name is required');
    expect(body).toContain('Import the valid 2 rows');
  });

  it('parses quoted fields, "" escapes, and \\r\\n rows', async () => {
    const csv = 'name,qty\r\n"Widget, small",2\r\n"Say ""hi""",1\r\n';
    const response = await upload(csv);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('2 rows ready to import.');
    const commit = await call(csvImport, 'POST', `/imports/${tokenOf(body)}/commit`);
    expect(commit.status).toBe(200);
    expect(await commit.text()).toContain('2 rows imported.');
  });

  it('answers 422 with the error report and NO confirm form when nothing is valid', async () => {
    const response = await upload('name,qty\n,0\nWidget,-1\n');
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('0 of 2 rows ready');
    expect(body).toContain('<caption>Rows that will not be imported</caption>');
    expect(body).not.toContain('name="token"');
    expect(body).not.toContain('/commit');
  });

  it('answers 422 for an unreadable/empty file and a missing part', async () => {
    const empty = await upload('', { name: 'empty.csv' });
    expect(empty.status).toBe(422);
    expect(await empty.text()).toContain('empty.csv has no data rows.');

    const missing = await upload(null);
    expect(missing.status).toBe(422);
    expect(await missing.text()).toContain('A CSV file is required.');
  });

  it('commits a live token: result summary + toast + items:changed', async () => {
    const report = await (await upload('name,qty\nAnvil,3\nSprocket,12\nWidget,7\n')).text();
    const token = tokenOf(report);
    expect(token).toBeTruthy();

    const response = await call(csvImport, 'POST', `/imports/${token}/commit`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('3 rows imported.');
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('3 rows imported');
    expect(trigger).toContain('items:changed');
    expect(trigger).toMatch(/^[\x00-\x7f]+$/); // hxTrigger keeps headers latin-1-safe
  });

  it('answers 409 + the re-upload hint for expired or undecodable tokens', async () => {
    for (const token of ['expired', '!!!not-base64url!!!']) {
      const response = await call(csvImport, 'POST', `/imports/${token}/commit`);
      expect(response.status).toBe(409);
      expect(await response.text()).toContain('upload the file again');
    }
  });

  it('answers native posts with full pages (no-JS upload and commit)', async () => {
    const response = await upload('name,qty\nAnvil,3\n', { htmx: false });
    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toContain('<!doctype html>');
    expect(bodyText).toContain('1 row ready to import.');

    const commit = await call(csvImport, 'POST', `/imports/${tokenOf(bodyText)}/commit`, {
      htmx: false,
    });
    expect(commit.status).toBe(200);
    expect(await commit.text()).toContain('<!doctype html>');
  });

  it('ignores other paths and methods', async () => {
    expect(await call(csvImport, 'GET', '/imports')).toBeNull();
    expect(await call(csvImport, 'POST', '/other')).toBeNull();
  });
});
