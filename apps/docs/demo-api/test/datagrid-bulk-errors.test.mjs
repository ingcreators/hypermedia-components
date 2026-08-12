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

describe('datagrid-bulk-errors demo API — acting on everything that matches', () => {
  // The token pins the count the user was shown. The demo derives it
  // from the conditions, so a token minted for one query never
  // validates for another.
  async function tokenFor(status) {
    const body = await (
      await call(bulkErrors, 'POST', '/bulk', {
        body: form({ action: 'archive', scope: 'matching', 'f-status': status }),
      })
    ).text();
    return /name="count-token" value="(ct_[a-z0-9]+)"/.exec(body)?.[1];
  }

  it('a first attempt without a valid token asks for confirmation with the count', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ action: 'archive', scope: 'matching', 'f-status': 'open' }),
    });
    expect(response.status).toBe(409);
    const body = await response.text();
    expect(body).toContain('The number of matching rows changed');
    // The offer names the number it will act on.
    expect(body).toMatch(/Archive all \d+ matching/);
    // And it did NOT act.
    expect(body).not.toContain('rows archived');
  });

  it('executes once the token matches the conditions it was minted for', async () => {
    const token = await tokenFor('open');
    expect(token).toBeTruthy();
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({
        action: 'archive',
        scope: 'matching',
        'f-status': 'open',
        'count-token': token,
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('rows archived');
  });

  it("a token from a different query does not authorise this one", async () => {
    const token = await tokenFor('open');
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({
        action: 'archive',
        scope: 'matching',
        'f-status': 'blocked',
        'count-token': token,
      }),
    });
    // Silently acting here would run the operation against a set the
    // user never saw a count for.
    expect(response.status).toBe(409);
  });

  it('refuses a request that names both ids and a query', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({
        action: 'archive',
        scope: 'matching',
        ids: ['101'],
        'f-status': 'open',
      }),
    });
    expect(response.status).toBe(400);
  });
});

describe('datagrid-bulk-errors demo API — the summary is the navigator', () => {
  it('carries prev / next as real fragment links, with a counter', async () => {
    const body = await (
      await call(bulkErrors, 'POST', '/bulk', {
        htmx: true,
        body: form({ action: 'archive', ids: ['101', '102', '104', '105'] }),
      })
    ).text();
    // Real hrefs naming rows by ID: Back works, the keyboard works, and
    // installDatagrid lands the active cell on the row a fragment names.
    expect(body).toMatch(/href="#bulk-errors-demo-row-\d+">Previous</);
    expect(body).toMatch(/href="#bulk-errors-demo-row-\d+">Next</);
    expect(body).toMatch(/Error 1 of \d+ — row \d+/);
  });

  it('says nothing about moving when there is nowhere to move', async () => {
    const body = await (
      await call(bulkErrors, 'POST', '/bulk', {
        htmx: true,
        body: form({ action: 'archive', ids: ['101'] }),
      })
    ).text();
    expect(body).not.toContain('>Next<');
  });
});

describe('datagrid-bulk-errors demo API — the docked panel', () => {
  it('best-effort splits the report: one line in the chrome, the table beside the grid', async () => {
    const body = await (
      await call(bulkErrors, 'POST', '/bulk', {
        htmx: true,
        body: form({ action: 'archive', ids: ['101', '102', '104', '105'] }),
      })
    ).text();
    // The chrome's line stays O(1): a count, the moves, and the filter.
    expect(body).toContain('succeeded /');
    expect(body).toContain('Show only failed');
    // …and the grouped table rides to the DOCKED panel instead.
    expect(body).toContain('id="bulk-errors-demo-detail"');
    expect(body).toContain('hc-splitter__panel');
    const summary = body.slice(body.indexOf('id="bulk-errors-demo-report"'));
    expect(summary.slice(0, summary.indexOf('bulk-errors-demo-detail'))).not.toContain(
      '<table',
    );
  });

  it('the panel is a server-owned region: hiding it is a response', async () => {
    const closed = await (
      await call(bulkErrors, 'GET', '/report?close=1', { htmx: true })
    ).text();
    expect(closed).toContain('hidden');
    expect(closed).not.toContain('<table');

    const open = await (
      await call(bulkErrors, 'GET', '/report?ids=102&ids=105', { htmx: true })
    ).text();
    expect(open).toContain('<table');
    expect(open).not.toContain(' hidden');
  });

  it('nothing to report collapses the panel rather than showing an empty one', async () => {
    const body = await (
      await call(bulkErrors, 'GET', '/report?ids=101&ids=103', { htmx: true })
    ).text();
    expect(body).toContain('hidden');
    expect(body).toContain('No failures to review');
  });
});

