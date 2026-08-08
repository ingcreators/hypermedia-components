import { describe, expect, it } from 'vitest';
import * as autosave from '../recipes/autosave.mjs';
import { call, form } from './helpers.mjs';

describe('autosave demo API', () => {
  it('answers a draft post with a timestamped status line', async () => {
    const response = await call(autosave, 'POST', '/reports/42/draft', {
      body: form({ title: 'Hello' }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(/Draft saved at \d{2}:\d{2}:\d{2}\./);
  });

  it('answers the record save and reports the draft cleared', async () => {
    const body = await (
      await call(autosave, 'POST', '/reports/42', { body: form({ title: 'Hello' }) })
    ).text();
    expect(body).toMatch(/Saved at \d{2}:\d{2}:\d{2} — draft cleared\./);
  });

  it('restores the form from the threaded draft title with data-dirty preset', async () => {
    const body = await (
      await call(autosave, 'GET', '/reports/42/draft?title=Draft%20title')
    ).text();
    expect(body).toContain('id="autosave-demo-report"');
    expect(body).toContain('data-hc-dirty-guard data-dirty');
    expect(body).toContain('value="Draft title"');
    expect(body).toContain('from:closest form');
  });

  it('deletes the draft with an empty fragment', async () => {
    const response = await call(autosave, 'DELETE', '/reports/42/draft');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('ignores other paths', async () => {
    expect(await call(autosave, 'GET', '/reports/42')).toBeNull();
  });
});
