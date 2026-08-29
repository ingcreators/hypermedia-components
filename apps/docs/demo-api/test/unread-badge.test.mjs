import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/unread-badge';

function getNav(query = '') {
  return handleDemoApi(new Request(`${BASE}/nav${query}`, { headers: { 'HX-Request': 'true' } }));
}

describe('unread-badge demo API', () => {
  it('renders the self-polling nav fragment with count in badge AND accessible name', async () => {
    const body = await (await getNav()).text();
    expect(body).toContain('data-hc-unread');
    expect(body).toContain('id="unread-badge-demo-nav"');
    expect(body).toContain('aria-label="Notifications, 3 unread"');
    expect(body).toMatch(/<span class="hc-badge"[^>]*aria-hidden="true">3<\/span>/);
    // the self-swap rule: target this, outerHTML, no `load` echo
    expect(body).toContain('data-hx-target="this"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('data-hx-trigger="every 3s"');
    expect(body).not.toMatch(/data-hx-trigger="[^"]*load/);
    // never a live region
    expect(body).not.toContain('aria-live');
    expect(body).not.toContain('role="status"');
  });

  it('threads the anchor through the poll URL', async () => {
    const since = Date.now() - 8500; // 2 arrivals at 4s each
    const body = await (await getNav(`?since=${since}`)).text();
    expect(body).toContain(`/nav?since=${since}`);
    expect(body).toContain('aria-label="Notifications, 2 unread"');
  });

  it('zero renders NO badge, and the accessible name drops the count', async () => {
    const body = await (await getNav(`?since=${Date.now()}`)).text();
    expect(body).toContain('aria-label="Notifications"');
    expect(body).not.toContain('hc-badge');
  });

  it('past the cap, display and accessible name tell the same truth', async () => {
    const body = await (await getNav('?flood=1')).text();
    expect(body).toContain('>9+<');
    expect(body).toContain('aria-label="Notifications, more than 9 unread"');
  });

  it('mark-all-read ships the ZEROED nav fragment out-of-band with a fresh anchor', async () => {
    const before = Date.now();
    const response = await handleDemoApi(
      new Request(`${BASE}/read-all`, { method: 'POST', headers: { 'HX-Request': 'true' } }),
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain('aria-label="Notifications"');
    expect(body).not.toContain('hc-badge');
    const since = Number(body.match(/\/nav\?since=(\d+)/)?.[1]);
    expect(since).toBeGreaterThanOrEqual(before);
  });

  it('answers no-JS nav GETs with a full page', async () => {
    const response = await handleDemoApi(new Request(`${BASE}/nav`));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html>');
  });
});
