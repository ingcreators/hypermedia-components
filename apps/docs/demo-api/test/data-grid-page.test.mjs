import { describe, expect, it } from 'vitest';
import * as app from '../recipes/data-grid-page.mjs';
import { call, form } from './helpers.mjs';

const rowsOf = (body) => [...body.matchAll(/id="template-grid-row-(\d+)"/g)].map((m) => m[1]);

describe('data-grid-page demo API — the list', () => {
  it('answers a page of rows with ordinals, links and checkboxes', async () => {
    const body = await (await call(app, 'GET', '/items', { htmx: true })).text();
    expect(rowsOf(body)).toHaveLength(8);
    expect(body).toContain('data-hc-row-link');
    expect(body).toContain('name="ids"');
    expect(body).toContain('data-row-no="1"');
  });

  it('filters, and says so in the conditions bar', async () => {
    const body = await (
      await call(app, 'GET', '/items?f-status=shipped', { htmx: true })
    ).text();
    expect(body).toContain('hc-filterbar__value">Shipped');
    // Every row on the page is shipped, so none of them can be approved.
    expect(rowsOf(body).length).toBeGreaterThan(0);
  });

  it('sorts, and paging is stable across requests', async () => {
    const first = await (
      await call(app, 'GET', '/items?sort=customer', { htmx: true })
    ).text();
    const second = await (
      await call(app, 'GET', '/items?sort=customer&page=2', { htmx: true })
    ).text();
    // A low-cardinality sort with no tiebreak repeats rows between
    // pages; the id tiebreak is what makes this assertion hold.
    expect(rowsOf(first).filter((id) => rowsOf(second).includes(id))).toEqual([]);
  });

  it('an empty result is a dead end with a way out', async () => {
    const body = await (
      await call(app, 'GET', '/items?f-customer=nobody', { htmx: true })
    ).text();
    expect(body).toContain('No orders match');
    expect(body).toContain('Clear all');
  });
});

describe('data-grid-page demo API — the record', () => {
  it('opens as a dialog carrying the exit at the start and the walk at the end', async () => {
    const body = await (
      await call(app, 'GET', '/items/4901?peek=1&from=&i=1', { htmx: true })
    ).text();
    expect(body).toContain('<dialog');
    expect(body.indexOf('Back to list')).toBeLessThan(body.indexOf('Previous record'));
    expect(body).toContain('/ 24');
  });

  it('the walk crosses a page boundary, because the server re-runs the query', async () => {
    // Row 8 is the last of page 1; its neighbour is the first of page 2.
    const eighth = await (
      await call(app, 'GET', '/items?sort=order', { htmx: true })
    ).text();
    const last = rowsOf(eighth).at(-1);
    const body = await (
      await call(app, 'GET', `/items/${last}?peek=1&from=sort%3Dorder&i=8`, { htmx: true })
    ).text();
    expect(body).toMatch(/8 \/ 24/);
    expect(body).toContain('aria-label="Next record"');
    expect(body).not.toContain('aria-disabled="true" aria-label="Next record"');
  });

  it('saving answers the row itself, so the list behind stays true', async () => {
    const body = await (
      await call(app, 'POST', '/items/4901', {
        htmx: true,
        body: form({ ship: '2026-09-09', from: '', i: '1' }),
      })
    ).text();
    expect(body).toContain('id="template-grid-row-4901"');
    expect(body).toContain('2026-09-09');
    expect(body).not.toContain('<dialog');
  });
});

describe('data-grid-page demo API — a bulk action that fails', () => {
  // from= carries the list query, so the response re-renders the page
  // the user is actually looking at. Ordered by id here, so 4901 (which
  // is already shipped, hence blocked) is on it.
  const approve = (ids) =>
    call(app, 'POST', '/bulk', { htmx: true, body: form({ ids, from: 'sort=order' }) });

  it('marks the rows, keeps the chrome to one line, and docks the breakdown', async () => {
    // 4901 is shipped (blocked), 4902 is open (fine).
    const body = await (await approve(['4901', '4902'])).text();
    expect(body).toContain('data-attention="error"');
    expect(body).toContain('could not be');
    expect(body).toContain('Show only failed (1)');
    expect(body).toContain(`id="template-grid-panel"`);
    expect(body).toContain('data-collapsed'); // opening it is the user's call
  });

  it('the failed-only filter is a real query the bar can show and remove', async () => {
    const body = await (await approve(['4901', '4902'])).text();
    // Attribute-encoded, so &amp; must come back before it is a URL —
    // the same trap any test reading an href out of HTML walks into.
    const href = body.match(/href="([^"]*f-last-result=failed[^"]*)"/)[1].replaceAll('&amp;', '&');
    const filtered = await (
      await call(app, 'GET', href.replace(/^.*\/items/, '/items'), { htmx: true })
    ).text();
    expect(rowsOf(filtered)).toEqual(['4901']);
    expect(filtered).toContain('Last result');
  });

  it('nothing selected asks for a selection instead of reporting nothing', async () => {
    const body = await (await approve([])).text();
    expect(body).toContain('Select rows first');
  });

  it('the panel opens and hides as responses', async () => {
    const open = await (await call(app, 'GET', '/report?open=1&ids=4901', { htmx: true })).text();
    expect(open).toContain('<table');
    const closed = await (
      await call(app, 'GET', '/report?close=1&ids=4901', { htmx: true })
    ).text();
    expect(closed).toContain('data-collapsed');
    expect(closed).toContain('Reasons (1)');
  });
});

describe('data-grid-page demo API — two renderings of one record', () => {
  it('the row link points at the record’s own PAGE, and peeks with ?peek=1', async () => {
    const body = await (await call(app, 'GET', '/items', { htmx: true })).text();
    // Attribute-encoded in the markup; compare them as URLs.
    const unescape = (v) => v.replaceAll('&amp;', '&');
    const href = unescape(body.match(/<a href="([^"]*items\/\d+[^"]*)" data-hc-row-link/)[1]);
    const peek = unescape(body.match(/data-hx-get="([^"]*items\/\d+[^"]*)"/)[1]);
    // The href is what a middle-click, a shared link or a JS-less
    // browser follows; the peek is layered on top of it.
    expect(href).not.toContain('peek=1');
    expect(peek).toContain('peek=1');
    expect(peek.startsWith(href)).toBe(true);
  });

  it('the bare URL answers a full page, not a dialog', async () => {
    const response = await call(app, 'GET', '/items/4901?from=&i=1', { htmx: false });
    const body = await response.text();
    expect(body).toContain('<html');
    expect(body).not.toContain('<dialog');
    expect(body).toContain('Back to list');
    expect(body).toContain('#template-grid-row-4901'); // returns to the row
  });

  it('the peek carries the way out to that page — a peek that traps is worse than none', async () => {
    const body = await (
      await call(app, 'GET', '/items/4901?peek=1&from=&i=1', { htmx: true })
    ).text();
    expect(body).toContain('<dialog');
    expect(body).toContain('Open full page');
  });

  it('both renderings agree about the walk', async () => {
    const dialog = await (
      await call(app, 'GET', '/items/4902?peek=1&from=sort%3Dorder&i=2', { htmx: true })
    ).text();
    const full = await (
      await call(app, 'GET', '/items/4902?from=sort%3Dorder&i=2', { htmx: false })
    ).text();
    for (const body of [dialog, full]) {
      expect(body).toContain('2 / 24');
      expect(body).toContain('aria-label="Previous record"');
    }
  });
});

