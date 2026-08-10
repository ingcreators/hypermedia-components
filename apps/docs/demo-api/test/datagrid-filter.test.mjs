import { describe, expect, it } from 'vitest';
import * as datagridFilter from '../recipes/datagrid-filter.mjs';
import { call } from './helpers.mjs';

describe('datagrid-filter demo API', () => {
  it('renders the unfiltered grid with a plain trigger when f-status is absent', async () => {
    const response = await call(datagridFilter, 'GET', '/items');
    expect(response.status).toBe(200);
    const body = await response.text();
    for (const name of ['Ingest pipeline', 'Nightly backup', 'Billing export', 'Legacy sync']) {
      expect(body).toContain(name);
    }
    expect(body).not.toContain('data-filtered');
    expect(body).toContain('aria-label="Filter Status"');
    // The fieldset rides along out-of-band, nothing checked (never the
    // form — it carries the close-popover attribute).
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain('id="datagrid-filter-demo-fields"');
    expect(body).not.toContain('<form');
    expect(body).not.toContain(' checked>');
  });

  it('filters rows and marks the trigger with the active values', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-status=active')
    ).text();
    expect(body).toContain('Ingest pipeline');
    expect(body).toContain('Nightly backup');
    expect(body).not.toContain('Billing export');
    expect(body).not.toContain('Legacy sync');
    expect(body).toContain('data-filtered');
    expect(body).toContain('aria-label="Filter Status — active: Active"');
    expect(body).toContain('value="active" checked');
    expect(body).not.toContain('value="pending" checked');
  });

  it('composes multiple values of the same param', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-status=active&f-status=failed')
    ).text();
    expect(body).toContain('Ingest pipeline');
    expect(body).toContain('Legacy sync');
    expect(body).not.toContain('Billing export');
    expect(body).toContain('aria-label="Filter Status — active: Active, Failed"');
  });

  it('ignores unknown values and falls back to unfiltered', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-status=bogus')
    ).text();
    expect(body).toContain('Billing export');
    expect(body).not.toContain('data-filtered');
  });

  it('answers a full page on the no-JS path', async () => {
    const response = await call(datagridFilter, 'GET', '/items?f-status=pending', {
      htmx: false,
    });
    const body = await response.text();
    expect(body).toContain('<form');
    expect(body).toContain('value="pending" checked');
    expect(body).toContain('Billing export');
    expect(body).not.toContain('Ingest pipeline');
  });
});

describe('datagrid-filter demo API — the applied-conditions bar', () => {
  it('renders one condition, with a remove link to the unfiltered URL', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-status=active', { htmx: true })
    ).text();
    expect(body).toContain('class="hc-filterbar"');
    expect(body).toContain('<span class="hc-filterbar__value">Active</span>');
    // Removing is navigation: a real href, and it names the condition.
    expect(body).toContain('aria-label="Remove Status filter"');
    expect(body).toMatch(/hc-filterbar__remove" href="[^"]*\/items"/);
  });

  it('summarises rather than listing when a condition holds several values', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-status=active&f-status=pending', {
        htmx: true,
      })
    ).text();
    expect(body).toContain('<span class="hc-filterbar__value">2 values</span>');
    // One chip, not one per value.
    expect(body.match(/hc-filterbar__item/g)).toHaveLength(1);
  });

  it('comes back empty when nothing is filtered', async () => {
    const body = await (await call(datagridFilter, 'GET', '/items', { htmx: true })).text();
    expect(body).toContain('class="hc-filterbar"');
    expect(body).not.toContain('hc-filterbar__item');
  });

  it('the no-JS page carries the bar too', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-status=failed', { htmx: false })
    ).text();
    expect(body).toContain('hc-filterbar__item');
  });
});
