import { describe, expect, it } from 'vitest';
import * as datagridTree from '../recipes/datagrid-tree.mjs';
import { call } from './helpers.mjs';

describe('datagrid-tree demo API', () => {
  it('answers the child batch one level deeper, dirs carrying their own wiring', async () => {
    const response = await call(datagridTree, 'GET', '/items/docs/children');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('aria-level="2"');
    expect(body).not.toContain('aria-level="1"');
    // The sub-directory is expandable + lazy; the files are leaves.
    expect(body).toContain('data-hc-datagrid-tree');
    expect(body).toContain('data-hx-trigger="hc:datagridtreeload"');
    expect(body).toContain('data-hx-swap="afterend"');
    expect(body).toContain('guide');
    expect(body).toContain('api.md');
    const expandable = body.match(/aria-expanded="false"/g)?.length ?? 0;
    expect(expandable).toBe(1);
  });

  it('answers grandchildren at level 3 from the sub-directory', async () => {
    const body = await (
      await call(datagridTree, 'GET', '/items/docs-guide/children')
    ).text();
    expect(body).toContain('aria-level="3"');
    expect(body).toContain('intro.md');
    expect(body).not.toContain('data-hc-datagrid-tree'); // leaves only
  });

  it('renders an empty-state row for a dir without entries', async () => {
    const body = await (await call(datagridTree, 'GET', '/items/src/children')).text();
    expect(body).toContain('No entries');
    expect(body).toContain('colspan="2"');
    expect(body).toContain('aria-level="2"');
  });

  it('404s an unknown id', async () => {
    const response = await call(datagridTree, 'GET', '/items/bogus/children');
    expect(response.status).toBe(404);
  });
});
