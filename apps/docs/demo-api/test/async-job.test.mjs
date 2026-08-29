import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/async-job';

function req(path, { method = 'GET', htmx = true, body } = {}) {
  return handleDemoApi(
    new Request(`${BASE}${path}`, {
      method,
      headers: htmx ? { 'HX-Request': 'true' } : {},
      body,
    }),
  );
}

describe('async-job demo API', () => {
  it('kick-off answers 202 with a self-polling running card', async () => {
    const response = await req('/exports', { method: 'POST' });
    expect(response.status).toBe(202);
    const body = await response.text();
    expect(body).toContain('data-hc-job');
    expect(body).toContain('data-hx-trigger="every 1s"');
    expect(body).toContain('data-hx-target="this"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('aria-live="polite"');
  });

  it('a young job polls as running with progress', async () => {
    const id = `j_${Date.now() - 2000}`;
    const body = await (await req(`/exports/${id}`)).text();
    expect(body).toContain('data-hx-trigger');
    expect(body).toMatch(/value="\d+" max="100"/);
  });

  it('a finished job renders the done card — no trigger, a download link', async () => {
    const id = `j_${Date.now() - 20000}`;
    const body = await (await req(`/exports/${id}`)).text();
    expect(body).toContain('data-state="done"');
    expect(body).not.toContain('data-hx-trigger');
    expect(body).toContain(`/exports/${id}/result`);
    expect(body).toContain('download');
  });

  it('the failing flavour fails terminally — reason, retry, no trigger', async () => {
    const id = `jf_${Date.now() - 20000}`;
    const body = await (await req(`/exports/${id}`)).text();
    expect(body).toContain('data-state="failed"');
    expect(body).toContain('role="status"');
    expect(body).not.toContain('data-hx-trigger');
    expect(body).toContain('Retry');
  });

  it('an unknown or ancient id renders the expired tombstone, 200, no trigger', async () => {
    const gone = await req('/exports/j_1');
    expect(gone.status).toBe(200);
    const body = await gone.text();
    expect(body).toContain('data-state="expired"');
    expect(body).not.toContain('data-hx-trigger');
    const garbage = await (await req('/exports/nonsense')).text();
    expect(garbage).toContain('data-state="expired"');
  });

  it('cancel stops a running job and is a no-op on a finished one', async () => {
    const running = await (
      await req(`/exports/j_${Date.now() - 1000}/cancel`, { method: 'POST' })
    ).text();
    expect(running).toContain('data-state="cancelled"');
    const finished = await (
      await req(`/exports/j_${Date.now() - 20000}/cancel`, { method: 'POST' })
    ).text();
    expect(finished).toContain('data-state="done"');
  });

  it('serves the artifact for a done job and 404s a failed or running one', async () => {
    const ok = await req(`/exports/j_${Date.now() - 20000}/result`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('text/csv');
    expect(ok.headers.get('content-disposition')).toContain('attachment');
    expect((await req(`/exports/jf_${Date.now() - 20000}/result`)).status).toBe(404);
    expect((await req(`/exports/j_${Date.now() - 1000}/result`)).status).toBe(404);
  });

  it('answers a no-JS kick-off with a full page and a status link', async () => {
    const response = await req('/exports', { method: 'POST', htmx: false });
    expect(response.status).toBe(202);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('Check status');
  });
});
