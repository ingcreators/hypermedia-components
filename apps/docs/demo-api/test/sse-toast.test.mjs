import { describe, expect, it } from 'vitest';
import * as sseToast from '../recipes/sse-toast.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/sse-toast';

/** Split an SSE body into `{ event, dataLines }` blocks (in order). */
function parseEvents(body) {
  return body
    .split('\n\n')
    .filter((block) => block.includes('event:'))
    .map((block) => {
      const lines = block.split('\n');
      const event = lines
        .find((line) => line.startsWith('event:'))
        .slice('event:'.length)
        .trim();
      const dataLines = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim());
      return { event, dataLines };
    });
}

// The stream sleeps ~15 s at demo pace; `?fast=1` divides every sleep
// by 50 so the whole body reads in well under a second.
async function fastStream() {
  const response = await call(sseToast, 'GET', '/events?fast=1', { htmx: false });
  return { response, body: await response.text() };
}

describe('sse-toast demo API', () => {
  it('GET /events answers an uncacheable event stream with a gentle retry hint', async () => {
    const { response, body } = await fastStream();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-store');
    // A LARGE retry so a finished demo stream does not hammer reconnects.
    expect(body.startsWith('retry: 30000\n\n')).toBe(true);
  });

  it('GET /events plays the scripted sequence in order and every payload is one JSON object line', async () => {
    const { body } = await fastStream();
    const events = parseEvents(body);
    expect(events.map((e) => e.event)).toEqual([
      'hc:toast',
      'hc:toast',
      'items:changed',
      'hc:toast',
      'demo:done',
    ]);
    for (const { dataLines } of events) {
      // Single-line data: exactly one `data:` field per event.
      expect(dataLines).toHaveLength(1);
      // Object payloads only — the sse-dispatch bridge drops anything else.
      const parsed = JSON.parse(dataLines[0]);
      expect(parsed).toBeTypeOf('object');
      expect(Array.isArray(parsed)).toBe(false);
    }
  });

  it('GET /events uses the update-by-id pattern: both build toasts share one id', async () => {
    const { body } = await fastStream();
    const toasts = parseEvents(body)
      .filter((e) => e.event === 'hc:toast')
      .map((e) => JSON.parse(e.dataLines[0]));
    expect(toasts[0]).toMatchObject({
      id: 'sse-toast-demo-build',
      message: 'Build #42 started',
      variant: 'info',
      duration: 0, // sticky, so the in-place update stays visible
    });
    expect(toasts[1]).toMatchObject({
      id: 'sse-toast-demo-build',
      message: 'Build #42 finished',
      variant: 'success',
      duration: 4000,
    });
    expect(toasts[2]).toMatchObject({
      message: 'Nightly export completed',
      variant: 'info',
    });
    expect(toasts[2].id).toBeUndefined();
  });

  it('GET /events terminates itself right after demo:done', async () => {
    const { body } = await fastStream();
    // The close event is the last block; the stream then ends — no
    // trailing events, no dangling bytes. (`await response.text()`
    // resolving at all already proves the stream closed server-side.)
    expect(body.endsWith('event: demo:done\ndata: {}\n\n')).toBe(true);
  });

  it('GET /items renders the complete region for htmx (idempotent swap unit)', async () => {
    const response = await call(sseToast, 'GET', '/items');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="sse-toast-demo-items"');
    expect(body).toContain('class="hc-data-region"');
    expect(body).toContain(`data-hx-get="${API}/items"`);
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('aria-busy="false"');
    expect(body).toContain('<li>Export bundle</li>');
    expect(body).toMatch(
      /<p class="hc-field__message">Rendered at \d{2}:\d{2}:\d{2} UTC<\/p>/,
    );
    // The id appears exactly once — the outerHTML swap stays idempotent.
    expect(body.match(/id="sse-toast-demo-items"/g)).toHaveLength(1);
    expect(body).not.toContain('<!doctype');
  });

  it('GET /items re-renders with an event-only trigger (no `load` — no refetch loop)', async () => {
    const response = await call(sseToast, 'GET', '/items');
    const body = await response.text();
    expect(body).toContain('data-hx-trigger="items:changed from:body"');
    expect(body).not.toContain('load,');
  });

  it('GET /items without HX-Request renders the full-page fallback', async () => {
    const response = await call(sseToast, 'GET', '/items', { htmx: false });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<li>Export bundle</li>');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(sseToast, 'POST', '/events')).toBeNull();
    expect(await call(sseToast, 'GET', '/nope')).toBeNull();
  });
});
