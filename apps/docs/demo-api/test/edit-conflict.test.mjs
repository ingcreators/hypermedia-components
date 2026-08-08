import { describe, expect, it } from 'vitest';
import * as editConflict from '../recipes/edit-conflict.mjs';
import { call, form } from './helpers.mjs';

describe('edit-conflict demo API', () => {
  it('answers a stale save with the retargeted conflict dialog', async () => {
    const response = await call(editConflict, 'PUT', '/tickets/7', {
      body: form({ version: '12', title: 'Restock the beans (mine)' }),
    });
    expect(response.status).toBe(409);
    expect(response.headers.get('HX-Retarget')).toBe('#edit-conflict-demo-dialog');
    const body = await response.text();
    expect(body).toContain('Someone saved first');
    expect(body).toContain('Restock the beans (theirs)');
    expect(body).toContain('Restock the beans (mine)');
    expect(body).toContain('value="13"');
    expect(body).toContain('force=1');
    expect(body).toContain('data-hc-close-dialog-on-success');
  });

  it('saves cleanly at the current version', async () => {
    const response = await call(editConflict, 'PUT', '/tickets/7', {
      body: form({ version: '13', title: 'New title' }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Saved as v14');
  });

  it('force wins only with the fresh version', async () => {
    const win = await call(editConflict, 'PUT', '/tickets/7?force=1', {
      body: form({ version: '13', title: 'Mine' }),
    });
    expect(win.status).toBe(200);
    expect(await win.text()).toContain('overwrote v13');

    const stale = await call(editConflict, 'PUT', '/tickets/7?force=1', {
      body: form({ version: '12', title: 'Mine' }),
    });
    expect(stale.status).toBe(409);
  });

  it('serves the edit form fresh and the stale demo variant', async () => {
    const fresh = await (await call(editConflict, 'GET', '/tickets/7/edit')).text();
    expect(fresh).toContain('value="13"');
    const stale = await (await call(editConflict, 'GET', '/tickets/7/edit?stale=1')).text();
    expect(stale).toContain('value="12"');
    expect(stale).toContain('saving will conflict');
  });

  it('ignores other paths and methods', async () => {
    expect(await call(editConflict, 'POST', '/tickets/7')).toBeNull();
    expect(await call(editConflict, 'GET', '/tickets/7')).toBeNull();
  });
});
