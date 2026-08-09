import { describe, expect, it } from 'vitest';
import * as datagridPrefs from '../recipes/datagrid-prefs.mjs';
import { call, form } from './helpers.mjs';

describe('datagrid-prefs demo API', () => {
  it('answers a status fragment naming the saved widths', async () => {
    const response = await call(datagridPrefs, 'POST', '/prefs/columns', {
      body: form({ 'w-name': '220', 'w-status': '96' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Saved — Name 220px, Status 96px');
  });

  it('clamps out-of-range values and ignores non-numeric or unknown ones', async () => {
    const body = await (
      await call(datagridPrefs, 'POST', '/prefs/columns', {
        body: form({ 'w-name': '9999', 'w-status': 'abc', 'w-bogus': '50' }),
      })
    ).text();
    expect(body).toContain('Name 800px');
    expect(body).not.toContain('Status');
    expect(body).not.toContain('bogus');
  });

  it('answers politely when nothing was mirrored yet', async () => {
    const body = await (
      await call(datagridPrefs, 'POST', '/prefs/columns', { body: form({}) })
    ).text();
    expect(body).toContain('Nothing to save yet');
  });
});
