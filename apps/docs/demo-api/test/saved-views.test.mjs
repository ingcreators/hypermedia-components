import { describe, expect, it } from 'vitest';
import * as savedViews from '../recipes/saved-views.mjs';
import { call, form } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/saved-views';
const QUARTERLY = 'Quarterly|q=beans&status=active';

describe('saved-views demo API', () => {
  it('lists everything and fills an empty filter form out of band', async () => {
    const response = await call(savedViews, 'GET', '/items');
    expect(response.status).toBe(200);
    const body = await response.text();
    for (const name of [
      'Quarterly revenue',
      'Churn cohorts',
      'Signup funnel',
      'Legacy exports',
      'Beans forecast',
    ]) {
      expect(body).toContain(name);
    }
    expect(body).toContain('id="saved-views-demo-filters"');
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain('value=""');
    expect(body).toContain('<option value="" selected>All</option>');
  });

  it('applies filters and re-renders the form with the values filled', async () => {
    const body = await (
      await call(savedViews, 'GET', '/items?q=beans&status=active')
    ).text();
    expect(body).toContain('Beans forecast');
    expect(body).not.toContain('Churn cohorts');
    expect(body).not.toContain('Legacy exports');
    // A view is never opaque: the controls carry the querystring.
    expect(body).toContain('value="beans"');
    expect(body).toContain('<option value="active" selected>');
  });

  it('answers an empty result with a message, not an empty list', async () => {
    const body = await (await call(savedViews, 'GET', '/items?q=zzz')).text();
    expect(body).toContain('No items match the current filters.');
    expect(body).not.toContain('<ul class="hc-list">');
  });

  it('answers a plain navigation with a full page (no-JS apply link)', async () => {
    const response = await call(savedViews, 'GET', '/items?q=beans', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('Beans forecast');
    expect(body).not.toContain('data-hx-swap-oob');
  });

  it('saves a view: the strip fragment with the new chip current', async () => {
    const response = await call(savedViews, 'POST', '/views', {
      body: form({ name: 'Quarterly', q: 'beans', status: 'active' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    // The chip: apply link = the view's full querystring, marked current.
    expect(body).toContain(`data-hx-get="${API}/items?q=beans&amp;status=active"`);
    expect(body).toMatch(/aria-current="true"[^>]*>Quarterly<\/a>/);
    expect(body).toContain('aria-label="Delete view Quarterly"');
    // The threaded state: one hidden view= input for the next save.
    expect(body).toContain('value="Quarterly|q=beans&amp;status=active"');
    // Nothing else to thread through the delete URL yet.
    expect(body).toContain(`data-hx-delete="${API}/views/Quarterly"`);
  });

  it('threads existing views through the strip and the delete URLs', async () => {
    const body = await (
      await call(savedViews, 'POST', '/views', {
        body: form({ name: 'Failures', q: '', status: 'failed', view: QUARTERLY }),
      })
    ).text();
    expect(body).toContain('>Quarterly</a>');
    expect(body).toMatch(/aria-current="true"[^>]*>Failures<\/a>/);
    expect(body.match(/aria-current="true"/g)).toHaveLength(1);
    // Each chip's × carries the OTHER chips as view= params.
    expect(body).toContain(`${API}/views/Quarterly?view=Failures%7C`);
    expect(body).toContain(`${API}/views/Failures?view=Quarterly%7C`);
    expect(body.match(/<input type="hidden" name="view"/g)).toHaveLength(2);
  });

  it('rejects a duplicate name with 422 and the field-errors shape', async () => {
    const response = await call(savedViews, 'POST', '/views', {
      body: form({ name: 'Quarterly', q: 'x', status: '', view: QUARTERLY }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('data-hc-field-errors');
    expect(body).toContain('data-field="name" data-code="duplicate"');
    // The strip survives the error, nothing marked current.
    expect(body).toContain('>Quarterly</a>');
    expect(body).not.toContain('aria-current');
  });

  it('rejects a blank name with 422 required', async () => {
    const response = await call(savedViews, 'POST', '/views', {
      body: form({ name: '   ', q: '', status: '' }),
    });
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('data-field="name" data-code="required"');
  });

  it('answers a native save with a full page (no-JS post)', async () => {
    const response = await call(savedViews, 'POST', '/views', {
      htmx: false,
      body: form({ name: 'Quarterly', q: 'beans', status: 'active' }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html>');
  });

  it('deletes a view: the strip re-rendered from the threaded params, minus it', async () => {
    const failures = 'Failures|q=&status=failed';
    const body = await (
      await call(
        savedViews,
        'DELETE',
        `/views/Quarterly?view=${encodeURIComponent(QUARTERLY)}&view=${encodeURIComponent(failures)}`,
      )
    ).text();
    expect(body).toContain('>Failures</a>');
    expect(body).not.toContain('>Quarterly</a>');
  });

  it('deleting the last view answers the empty-state line', async () => {
    const body = await (
      await call(
        savedViews,
        'DELETE',
        `/views/Quarterly?view=${encodeURIComponent(QUARTERLY)}`,
      )
    ).text();
    expect(body).toContain('No saved views yet');
    expect(body).not.toContain('hc-chip');
  });

  it('ignores other paths and methods', async () => {
    expect(await call(savedViews, 'PUT', '/views')).toBeNull();
    expect(await call(savedViews, 'GET', '/other')).toBeNull();
  });
});
