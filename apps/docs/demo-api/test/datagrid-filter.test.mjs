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

describe('datagrid-filter demo API — relative date conditions', () => {
  it('resolves a relative expression and shows both forms in the bar', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-due-from=@today', { htmx: true })
    ).text();
    // The chip carries the wording AND the date it resolved to — either
    // alone leaves the condition a guess.
    expect(body).toMatch(/hc-filterbar__value">today \(\d{4}-\d{2}-\d{2}\)/);
    // Overdue rows are gone; today's and later remain.
    expect(body).not.toContain('Ingest pipeline'); // due 3 days ago
    expect(body).toContain('Nightly backup'); // due today
  });

  it('takes an absolute date unchanged', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-due-from=2099-01-01', { htmx: true })
    ).text();
    expect(body).toContain('hc-filterbar__value">2099-01-01<');
    // Nothing is due that far out.
    expect(body).not.toContain('Legacy sync');
  });

  it('refuses an expression it does not understand rather than failing open', async () => {
    const response = await call(
      datagridFilter,
      'GET',
      '/items?f-due-from=@next-fiscal-quarter',
      { htmx: true },
    );
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('Unknown date expression');
    // Crucially: it did not answer with the unfiltered list.
    expect(body).not.toContain('Legacy sync');
  });

  it('a remove control drops only its own condition', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-status=active&f-due-from=@today', {
        htmx: true,
      })
    ).text();
    // Removing Status keeps the due condition, and vice versa.
    expect(body).toContain('f-due-from=%40today" data-hx-get');
    expect(body).toMatch(/aria-label="Remove Status filter"/);
    expect(body).toMatch(/f-status=active[^"]*"[^>]*aria-label="Remove Due filter"/);
  });
});

describe('datagrid-filter demo API — entering a relative date', () => {
  it('offers presets whose values are the expressions', async () => {
    const body = await (await call(datagridFilter, 'GET', '/items', { htmx: true })).text();
    // Nobody types @today-7d: the option value is the wire format, the
    // label is what a person reads.
    expect(body).toContain('<option value="@today">Today</option>');
    expect(body).toContain('<option value="@today-7d">Last 7 days</option>');
    expect(body).toContain('<option value="custom-relative">Custom — N days ago…</option>');
    expect(body).toContain('<option value="custom-date">Custom — a date…</option>');
  });

  it('marks the applied preset selected, so a saved view reopens readable', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-due-from=@week-start', { htmx: true })
    ).text();
    expect(body).toContain('<option value="@week-start" selected>This week</option>');
  });

  it('custom is a re-render, and only ever one control carries the name', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/filters/due?f-due-from=custom-date', {
        htmx: true,
      })
    ).text();
    expect(body).toContain('type="date"');
    // Hidden controls keep submitting, so the select must be GONE, not
    // hidden — otherwise f-due-from would arrive twice.
    expect(body).not.toContain('<select');
    expect((body.match(/name="f-due-from"/g) ?? []).length).toBe(1);
  });

  it('an absolute date reopens in the date input, not as an unknown preset', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-due-from=2099-01-01', { htmx: true })
    ).text();
    expect(body).toContain('type="date"');
    expect(body).toContain('value="2099-01-01"');
  });
});

describe('datagrid-filter demo API — arbitrary offsets', () => {
  it('composes N + unit into one expression, server-side', async () => {
    const body = await (
      await call(
        datagridFilter,
        'GET',
        '/filters/due?compose=1&due-n=45&due-unit=d',
        { htmx: true },
      )
    ).text();
    // One control, holding the finished expression, labelled readably.
    expect(body).toContain('<option value="@today-45d" selected>45 days ago');
    expect((body.match(/name="f-due-from"/g) ?? []).length).toBe(1);
  });

  it('a composed expression survives a round trip instead of vanishing', async () => {
    // The bug this replaced: a relative expression that is not a preset
    // landed in <input type="date">, where the browser shows nothing and
    // the condition is lost on the next submit.
    const body = await (
      await call(datagridFilter, 'GET', '/items?f-due-from=@today-45d', {
        htmx: true,
      })
    ).text();
    expect(body).toContain('<option value="@today-45d" selected>');
    expect(body).not.toContain('type="date"');
  });

  it('the composer does not name the condition while it is being built', async () => {
    const body = await (
      await call(datagridFilter, 'GET', '/filters/due?f-due-from=custom-relative', {
        htmx: true,
      })
    ).text();
    expect(body).toContain('name="due-n"');
    // Nothing is chosen yet, so nothing claims the condition's name.
    expect(body).not.toContain('name="f-due-from"');
  });
});
