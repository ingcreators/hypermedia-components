import { describe, expect, it } from 'vitest';
import * as rowDetail from '../recipes/row-detail.mjs';
import { unpackSelection } from '../recipes/row-detail.mjs';
import { call, form } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/row-detail';

describe('row-detail demo API — the list', () => {
  it('the identity cell holds a real link, and the row is addressable', async () => {
    const body = await (await call(rowDetail, 'GET', '/items?page=1')).text();
    expect(body).toContain('data-hc-row-link');
    expect(body).toMatch(/<a href="[^"]*\/items\/4901\?[^"]*"/);
    expect(body).toContain('id="row-detail-demo-row-4901"');
    // The ordinal counts the result set, so the detail can say "row 4 of 6".
    expect(body).toContain('data-row-no="1"');
    expect(body).toContain('data-row-total="6"');
  });

  it('the link carries the list URL it came from', async () => {
    const body = await (await call(rowDetail, 'GET', '/items?page=2')).text();
    expect(body).toContain(`from=${encodeURIComponent(`${API}/items?page=2`)}`);
  });
});

describe('row-detail demo API — walking the result set', () => {
  it('next crosses a page boundary without the client knowing pages exist', async () => {
    // 4903 is the last row of page 1; its neighbour is the first of page 2.
    const body = await (
      await call(rowDetail, 'GET', '/items/4903?seq=list&i=3', { htmx: true })
    ).text();
    expect(body).toContain('Record 3 of 6');
    expect(body).toMatch(/href="[^"]*\/items\/4904\?[^"]*seq=list/);
  });

  it('the ends of the sequence are dead, and say so', async () => {
    const first = await (
      await call(rowDetail, 'GET', '/items/4901?seq=list&i=1', { htmx: true })
    ).text();
    expect(first).toContain('aria-disabled="true"');
  });

  it('Back to list returns to the URL the link carried', async () => {
    const from = encodeURIComponent(`${API}/items?page=2`);
    const body = await (
      await call(rowDetail, 'GET', `/items/4904?seq=list&i=4&from=${from}`, {
        htmx: true,
      })
    ).text();
    expect(body).toContain(`href="${API}/items?page=2"`);
  });
});

describe('row-detail demo API — walking the selection', () => {
  const open = (ids) =>
    call(rowDetail, 'POST', '/selections', { htmx: false, body: form({ ids }) });

  it('POSTing the ids answers a 303 to the first record of the snapshot', async () => {
    const response = await open(['4901', '4903', '4906']);
    expect(response.status).toBe(303);
    const location = response.headers.get('Location');
    expect(location).toContain('/items/4901?seq=sel-4901-4903-4906&i=1');
  });

  it('the walk stays inside the selection, in the order it was taken', async () => {
    const body = await (
      await call(rowDetail, 'GET', '/items/4903?seq=sel-4901-4903-4906&i=2', {
        htmx: true,
      })
    ).text();
    expect(body).toContain('Record 2 of 3 selected');
    // …not 4904, which is what the RESULT SET would have offered.
    expect(body).toMatch(/href="[^"]*\/items\/4906\?/);
    expect(body).not.toMatch(/href="[^"]*\/items\/4904\?/);
  });

  it('a record that vanished is a tombstone step — Next still works', async () => {
    const body = await (
      await call(rowDetail, 'GET', '/items/4999?seq=sel-4901-4999-4906&i=2', {
        htmx: true,
      })
    ).text();
    expect(body).toContain('no longer available');
    expect(body).toMatch(/href="[^"]*\/items\/4906\?/);
  });

  it('an unreadable token fails closed — never "walk everything"', async () => {
    const response = await call(rowDetail, 'GET', '/items/4901?seq=nonsense&i=1', {
      htmx: true,
    });
    expect(response.status).toBe(410);
    const body = await response.text();
    expect(body).toContain('expired');
    expect(body).toContain('Nothing was widened');
  });

  it('unpackSelection refuses what it cannot read', () => {
    expect(unpackSelection('sel-4901-4903')).toEqual([4901, 4903]);
    expect(unpackSelection('sel-4901-oops')).toBe(null);
    expect(unpackSelection('list')).toBe(null);
    expect(unpackSelection(undefined)).toBe(null);
  });

  it('an empty selection asks for one instead of opening nothing', async () => {
    const body = await (
      await call(rowDetail, 'POST', '/selections', { htmx: true, body: form({}) })
    ).text();
    expect(body).toContain('Select rows first');
  });
});
