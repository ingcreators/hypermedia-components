import { describe, expect, it } from 'vitest';
import * as sseUpdates from '../recipes/sse-updates.mjs';
import { call } from './helpers.mjs';

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

// The stream sleeps ~23.5 s at demo pace; `?fast=1` divides every
// sleep by 50 so the whole body reads in well under a second.
async function fastStream() {
  const response = await call(sseUpdates, 'GET', '/events?fast=1', { htmx: false });
  return { response, body: await response.text() };
}

describe('sse-updates demo API', () => {
  it('GET /events answers an uncacheable event stream with a gentle retry hint', async () => {
    const { response, body } = await fastStream();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.startsWith('retry: 30000\n\n')).toBe(true);
  });

  it('GET /events plays the scripted sequence in order, one data line per event', async () => {
    const { body } = await fastStream();
    const events = parseEvents(body);
    expect(events.map((e) => e.event)).toEqual([
      'activity:item',
      'activity:item',
      'status:panel',
      'products:rows',
      'activity:item',
      'activity:item',
      'status:panel',
      'activity:item',
      'products:rows',
      'activity:item',
      'status:panel',
      'stream:done',
    ]);
    // Every fragment is a SINGLE line — a second `data:` field would
    // mean the HTML leaked a newline.
    for (const { dataLines } of events) expect(dataLines).toHaveLength(1);
  });

  it('GET /events sends timestamped hc-item fragments for the afterbegin feed', async () => {
    const { body } = await fastStream();
    const items = parseEvents(body).filter((e) => e.event === 'activity:item');
    expect(items).toHaveLength(6);
    for (const { dataLines } of items) {
      expect(dataLines[0]).toMatch(
        /^<li class="hc-item">\d{2}:\d{2}:\d{2} — .+<\/li>$/,
      );
    }
    // Varied copy, not six clones.
    expect(new Set(items.map((e) => e.dataLines[0])).size).toBe(6);
  });

  it('GET /events pushes two full tbody pages of datagrid rows', async () => {
    const { body } = await fastStream();
    const pages = parseEvents(body).filter((e) => e.event === 'products:rows');
    expect(pages).toHaveLength(2);
    for (const { dataLines } of pages) {
      // A page is the tbody's innerHTML on one line: 3 compact rows
      // (id / status / timestamp), nothing outside the <tr>s — the
      // demo tbody swaps innerHTML, never outerHTML.
      const page = dataLines[0];
      expect(page.match(/<tr class="hc-datagrid__row">/g)).toHaveLength(3);
      expect(page.match(/<th class="hc-datagrid__cell" scope="row">\d+<\/th>/g)).toHaveLength(3);
      expect(page.match(/\d{2}:\d{2}:\d{2}/g)).toHaveLength(3);
      expect(page.startsWith('<tr ')).toBe(true);
      expect(page.endsWith('</tr>')).toBe(true);
      expect(page).not.toContain('tbody');
    }
    // Different ids/statuses so the swap is visible on replay.
    expect(pages[0].dataLines[0]).toContain('Queued');
    expect(pages[1].dataLines[0]).toContain('Deploying');
    expect(pages[0].dataLines[0]).not.toBe(pages[1].dataLines[0]);
  });

  it('GET /events carries the out-of-band badge inside a status:panel payload', async () => {
    const { body } = await fastStream();
    const panels = parseEvents(body).filter((e) => e.event === 'status:panel');
    expect(panels).toHaveLength(3);
    expect(panels[0].dataLines[0]).toBe('<p>Deploy #128 rolling out…</p>');
    // One event, two targets: the main fragment plus the OOB badge.
    expect(panels[1].dataLines[0]).toBe(
      '<p>All systems normal</p><span class="hc-badge" id="sse-updates-demo-alert-badge" data-hx-swap-oob="true">1</span>',
    );
  });

  it('GET /events shows a visible end marker before the close event, then terminates', async () => {
    const { body } = await fastStream();
    const events = parseEvents(body);
    // data-sse-close means the close event's payload is never swapped,
    // so the end marker rides a regular status:panel push just before.
    const [marker, done] = events.slice(-2);
    expect(marker.event).toBe('status:panel');
    expect(marker.dataLines[0]).toBe(
      '<p class="hc-field__message">Stream ended — press Replay to run it again.</p>',
    );
    expect(done.event).toBe('stream:done');
    expect(body.endsWith('event: stream:done\ndata: \n\n')).toBe(true);
  });

  it('serves a fresh SSE scope for the Replay button', async () => {
    const response = await call(sseUpdates, 'GET', '/scope');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="sse-updates-demo-scope"');
    expect(body).toContain('data-sse-connect=');
    expect(body).toContain('data-sse-close="stream:done"');
    expect(body).toContain('id="sse-updates-demo-rows"');
  });

  it('returns null for unknown routes', async () => {
    expect(await call(sseUpdates, 'POST', '/events')).toBeNull();
    expect(await call(sseUpdates, 'GET', '/items')).toBeNull();
    expect(await call(sseUpdates, 'GET', '/nope')).toBeNull();
  });
});
