import { describe, expect, it } from 'vitest';
import * as datagridSort from '../recipes/datagrid-sort.mjs';
import { readSort } from '../recipes/datagrid-sort.mjs';
import { call } from './helpers.mjs';

const rows = (body) => [...body.matchAll(/>(SO-\d+)</g)].map((m) => m[1]);

describe('datagrid-sort demo API — reading the instruction', () => {
  it('reads the joined param', () => {
    expect(readSort(new URLSearchParams('sort=-ship,order'))).toEqual([
      { key: 'ship', desc: true },
      { key: 'order', desc: false },
    ]);
  });

  it('reads the per-key params a no-JS submit sends, in arrival order', () => {
    // Form entries arrive in DOM order, so the pair carries the ORDER
    // as well as the directions — which is why each row names its own
    // control instead of sharing one.
    expect(readSort(new URLSearchParams('dir-ship=desc&dir-order=asc'))).toEqual([
      { key: 'ship', desc: true },
      { key: 'order', desc: false },
    ]);
    expect(readSort(new URLSearchParams('dir-order=asc&dir-ship=desc'))).toEqual([
      { key: 'order', desc: false },
      { key: 'ship', desc: true },
    ]);
  });

  it('drops an unknown key but keeps the rest of the set', () => {
    expect(readSort(new URLSearchParams('sort=-ship,nonsense,order'))).toEqual([
      { key: 'ship', desc: true },
      { key: 'order', desc: false },
    ]);
  });

  it('ignores a key repeated with two directions', () => {
    expect(readSort(new URLSearchParams('sort=ship,-ship'))).toEqual([
      { key: 'ship', desc: false },
    ]);
  });
});

describe('datagrid-sort demo API — the sorted page', () => {
  it('sorts by the set, in order', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/items?sort=ship,customer', { htmx: true })
    ).text();
    // Two rows share 2026-08-02; customer breaks the tie.
    expect(rows(body)).toEqual(['SO-4902', 'SO-4903', 'SO-4901', 'SO-4904']);
  });

  it('answers the two wire shapes identically', async () => {
    const joined = await (
      await call(datagridSort, 'GET', '/items?sort=-ship,order', { htmx: true })
    ).text();
    const perKey = await (
      await call(datagridSort, 'GET', '/items?dir-ship=desc&dir-order=asc', {
        htmx: true,
      })
    ).text();
    expect(perKey).toBe(joined);
  });

  it('the header cells carry the same instruction as the panel', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/items?sort=-ship,order', { htmx: true })
    ).text();
    expect(body).toContain('data-col="ship" scope="col" aria-sort="descending" data-sort-index="1"');
    expect(body).toContain('data-col="order" scope="col" aria-sort="ascending" data-sort-index="2"');
  });

  it('a single key carries no ordinal — the arrow says everything', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/items?sort=-ship', { htmx: true })
    ).text();
    expect(body).toContain('aria-sort="descending"');
    expect(body).not.toContain('data-sort-index');
  });

  it('the trigger IS the read-out, and says so out of band', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/items?sort=-ship,order', { htmx: true })
    ).text();
    expect(body).toContain('Sort (2): Ship date ↓, Order ↑');
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
  });

  it('no sort at all says so rather than pretending', async () => {
    const body = await (await call(datagridSort, 'GET', '/items', { htmx: true })).text();
    expect(body).toContain('Sort: default');
    expect(body).toContain("No sort — the server's default ordering.");
  });

  it('ties break on the primary key, so paging cannot repeat or drop rows', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/items?sort=customer', { htmx: true })
    ).text();
    // Northwind twice — 4901 before 4903, deterministically.
    expect(rows(body).indexOf('SO-4901')).toBeLessThan(rows(body).indexOf('SO-4903'));
  });
});

describe('datagrid-sort demo API — editing the set', () => {
  it('adds a key at the end, including one whose column is not shown', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/sort?sort=-ship&add=warehouse', { htmx: true })
    ).text();
    expect(body).toContain('data-hc-sort-key="ship"');
    expect(body).toContain('data-hc-sort-key="warehouse"');
    expect(body.indexOf('data-hc-sort-key="ship"')).toBeLessThan(
      body.indexOf('data-hc-sort-key="warehouse"'),
    );
  });

  it('a column already in the set is not offered again', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/sort?sort=-ship', { htmx: true })
    ).text();
    expect(body).not.toContain('<option value="ship">');
    expect(body).toContain('<option value="customer">');
  });

  it('removing a key keeps the others and offers the column back', async () => {
    const body = await (
      await call(datagridSort, 'GET', '/sort?sort=-ship,order&drop=ship', { htmx: true })
    ).text();
    expect(body).not.toContain('data-hc-sort-key="ship"');
    expect(body).toContain('data-hc-sort-key="order"');
    expect(body).toContain('<option value="ship">');
  });

  it('the panel region opts out of the close-on-success glue', async () => {
    // Add and remove succeed; without the opt-out each one would
    // dismiss the panel the user is still working in.
    const body = await (
      await call(datagridSort, 'GET', '/sort?sort=-ship&add=order', { htmx: true })
    ).text();
    expect(body).toContain('data-hc-close-popover-on-success="false"');
  });
});
