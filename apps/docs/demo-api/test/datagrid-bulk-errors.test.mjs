import { describe, expect, it } from 'vitest';
import * as bulkErrors from '../recipes/datagrid-bulk-errors.mjs';
import { call, form } from './helpers.mjs';

// Eligibility is a pure function of the id: 102 / 105 / 108 are
// "shipped", 107 is "no permission", 104 is "locked by another job"
// (the one retryable failure), everything else is executable.

describe('datagrid-bulk-errors demo API — best-effort', () => {
  it('reports success and failure counts, groups by reason, marks failed rows', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '103', '102', '107'], action: 'archive' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    // 101/103 archived; 102 shipped; 107 no permission.
    expect(body).toContain('<strong>2 succeeded / 2 failed</strong>');
    expect(body).toContain('Already shipped');
    expect(body).toContain('Not permitted');
    // Failed rows are marked and point at their reason.
    expect(body).toContain('id="bulk-errors-demo-row-102" data-attention="error"');
    expect(body).toContain('aria-describedby="bulk-errors-demo-why-102"');
    // Succeeded rows are not.
    expect(body).toContain('id="bulk-errors-demo-row-103"');
    expect(body).not.toContain('id="bulk-errors-demo-row-103" data-attention');
    // The report rides out of band and offers the failed-only filter.
    expect(body).toContain('data-hx-swap-oob="innerHTML"');
    expect(body).toContain('f-last-result=failed');
  });

  it('a non-dismissing warning toast carries the headline', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['102'], action: 'archive' }),
    });
    const trigger = JSON.parse(response.headers.get('HX-Trigger'));
    expect(trigger['hc:toast'].variant).toBe('warning');
    expect(trigger['hc:toast'].message).toContain('1 failed');
  });

  it('full success answers a success toast and no reason table', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '103'], action: 'archive' }),
    });
    const body = await response.text();
    expect(body).toContain('2 rows archived');
    expect(body).not.toContain('<table');
    expect(JSON.parse(response.headers.get('HX-Trigger'))['hc:toast'].variant).toBe('success');
  });

  it('a partial failure leaves the retry set — and only it — selected', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '104', '102'], action: 'archive' }),
    });
    const body = await response.text();
    // 104 failed transiently: still selected, so one press retries it.
    expect(body).toContain('value="104" checked');
    // 101 succeeded and 102 cannot succeed — re-submitting either is
    // pointless, so neither comes back checked.
    expect(body).not.toContain('value="101" checked');
    expect(body).not.toContain('value="102" checked');
    // A partially-checked grid needs saying out loud.
    expect(body).toContain('<strong>1 can be retried</strong>');
    expect(body).toContain('The other 1 needs a change first.');
  });

  it('permanent-only failures leave nothing selected', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '102', '107'], action: 'archive' }),
    });
    const body = await response.text();
    expect(body).not.toContain('checked');
    expect(body).not.toContain('can be retried');
  });

  it('the retry copy is singular for one row', async () => {
    const body = await (
      await call(bulkErrors, 'POST', '/bulk', {
        body: form({ ids: ['104', '102'], action: 'archive' }),
      })
    ).text();
    expect(body).toContain('The other 1 needs a change first.');
  });

  it('caps the named rows per reason and says how many are left', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '102', '105'], action: 'archive' }),
    });
    const body = await response.text();
    expect(body).toContain('bulk-errors-demo-row-102');
    // Only two shipped rows here, so no overflow marker yet.
    expect(body).not.toContain('and 0 more');
  });
});

describe('datagrid-bulk-errors demo API — atomic', () => {
  it('pre-flight reports executability and offers to exclude the blockers', async () => {
    const response = await call(
      bulkErrors,
      'GET',
      '/preflight?ids=101&ids=103&ids=102&action=post',
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<strong>2 of 3 rows are executable</strong>');
    expect(body).toContain('Already shipped');
    // The escape hatch submits ONLY the executable ids. Assert on the
    // form's hidden inputs: the response also carries the blocked rows
    // as OOB updates, whose checkboxes share the `ids` name.
    expect(body).toContain('Exclude 1 and run 2');
    expect(body).toContain('<input type="hidden" name="ids" value="101">');
    expect(body).toContain('<input type="hidden" name="ids" value="103">');
    expect(body).not.toContain('<input type="hidden" name="ids" value="102">');
  });

  it('pre-flight marks the blocked rows out of band', async () => {
    const body = await (
      await call(bulkErrors, 'GET', '/preflight?ids=101&ids=102&action=post')
    ).text();
    // Marked because the row cannot proceed — true before the action
    // runs as much as after. Wrapped in <template>: a bare <tr> in a
    // div-targeted response is dropped by the parser.
    expect(body).toContain('<template>');
    expect(body).toContain('id="bulk-errors-demo-row-102" data-attention="error" data-hx-swap-oob="outerHTML"');
    // Nothing claims a failure: no status changed…
    expect(body).toContain('Active');
    // …and the executable row is not marked.
    expect(body).not.toContain('id="bulk-errors-demo-row-101" data-attention');
    // The selection the user is about to act on survives the OOB swap.
    expect(body).toContain('value="102" checked');
  });

  it('pre-flight with nothing executable renders reasons and no submit', async () => {
    const body = await (
      await call(bulkErrors, 'GET', '/preflight?ids=102&ids=105&action=post')
    ).text();
    expect(body).toContain('No executable rows');
    expect(body).not.toContain('<button');
  });

  it('a blocked atomic run refuses with 409, unchanged rows and the selection kept', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '102'], action: 'post' }),
    });
    expect(response.status).toBe(409);
    const body = await response.text();
    // Refusal framing, not partial completion.
    expect(body).toContain('<strong>Nothing was executed.</strong>');
    expect(body).not.toContain('succeeded');
    // Rows unchanged: nothing Posted, so no FAILURE is claimed…
    expect(body).not.toContain('Posted');
    // …but the blocked row is why nothing ran, and saying so is true.
    expect(body).toContain('id="bulk-errors-demo-row-102" data-attention="error"');
    expect(body).not.toContain('id="bulk-errors-demo-row-101" data-attention');
    // Selection preserved: both submitted ids come back checked.
    expect(body).toContain('value="101" checked');
    expect(body).toContain('value="102" checked');
    expect(body).not.toContain('value="103" checked');
    expect(JSON.parse(response.headers.get('HX-Trigger'))['hc:toast'].variant).toBe('error');
  });

  it('an executable atomic run posts every row', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '103'], action: 'post' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Posted');
    expect(body).toContain('2 rows posted');
  });
});
