import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/datagrid-snapshot-pager';

function search({ htmx = true } = {}) {
  return handleDemoApi(
    new Request(`${BASE}/search`, { headers: htmx ? { 'HX-Request': 'true' } : {} }),
  );
}

function post(path, params) {
  const body = new URLSearchParams(params);
  return handleDemoApi(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'HX-Request': 'true',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    }),
  );
}

/** keys=p1..p56 as [name, value] pairs for URLSearchParams. */
function freshKeys() {
  return Array.from({ length: 56 }, (_, i) => ['keys', `p${i + 1}`]);
}

describe('datagrid-snapshot-pager demo API', () => {
  it('search renders a fresh 56-key snapshot, page 1, 3 pager buttons', async () => {
    const response = await search();
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.match(/name="keys"/g)).toHaveLength(56);
    expect(body).toContain('value="p1"');
    expect(body.match(/<tr class="hc-datagrid__row">/g)).toHaveLength(20);
    expect(body).toContain('1–20 of 56 (as of search)');
    expect(body.match(/hc-pagination__item/g)).toHaveLength(3);
  });

  it('pages by the submitted keys, in order — the button page value wins over the hidden field', async () => {
    const body = await (
      await post('/page', [...freshKeys(), ['page', '1'], ['page', '2']])
    ).text();
    // Page 2 starts at item 21 (id 4021) and keeps keys order.
    expect(body).toContain('4021');
    expect(body).not.toContain('>4001<');
    expect(body).toContain('21–40 of 56 (as of search)');
    expect(body).toContain('aria-current="page"');
    // The OOB page-field records the new current page.
    expect(body).toContain('name="page" value="2" id="snapshot-pager-demo-page"');
  });

  it('act approves selected ids: rows re-render approved, keys rewritten OOB, membership intact', async () => {
    const body = await (
      await post('/act', [
        ...freshKeys(),
        ['page', '1'],
        ['ids', '4001'],
        ['ids', '4002'],
        ['action', 'approve'],
      ])
    ).text();
    expect(body).toContain('value="a1"');
    expect(body).toContain('value="a2"');
    expect(body).toContain('value="p3"');
    expect(body.match(/name="keys"/g)).toHaveLength(56); // membership frozen
    expect(body).toContain('2 approved');
    expect(body).toContain('data-variant="success"');
  });

  it('paging an edited snapshot keeps approved rows visible as approved', async () => {
    const keys = freshKeys();
    keys[0] = ['keys', 'a1'];
    const body = await (await post('/page', [...keys, ['page', '1']])).text();
    expect(body).toContain('Approved');
    expect(body).toContain('1–20 of 56 (as of search) — 1 approved');
  });

  it('renders tombstones for vanished and unparseable keys', async () => {
    const keys = freshKeys();
    keys[1] = ['keys', 'x2'];
    keys[2] = ['keys', 'garbage'];
    const body = await (await post('/page', [...keys, ['page', '1']])).text();
    expect(body.match(/data-tombstone/g)).toHaveLength(2);
    expect(body).toContain('No longer in this queue.');
    expect(body).toContain('2 gone');
  });

  it('422s a snapshot over the cap', async () => {
    const over = Array.from({ length: 101 }, (_, i) => ['keys', `p${(i % 56) + 1}`]);
    const response = await post('/page', [...over, ['page', '1']]);
    expect(response.status).toBe(422);
  });

  it('answers plain GETs (no-JS fallback) with a full page carrying the whole form', async () => {
    const response = await search({ htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<form method="post"');
    expect(body.match(/name="keys"/g)).toHaveLength(56);
  });
});
