import { describe, expect, it } from 'vitest';
import * as sessionExpiry from '../recipes/session-expiry.mjs';
import { call, form } from './helpers.mjs';

const COOKIE = { cookie: 'hc_demo_session=1' };

describe('session-expiry demo API', () => {
  it('answers 401 with the retargeted login dialog when no session', async () => {
    const response = await call(sessionExpiry, 'POST', '/tickets/7/approve');
    expect(response.status).toBe(401);
    expect(response.headers.get('HX-Retarget')).toBe('#session-expiry-demo-dialog');
    expect(response.headers.get('HX-Reswap')).toBe('innerHTML');
    const body = await response.text();
    expect(body).toContain('<dialog class="hc-dialog"');
    expect(body).toContain('Session expired');
    expect(body).toContain('<form method="dialog">');
  });

  it('approves with a session cookie', async () => {
    const response = await call(sessionExpiry, 'POST', '/tickets/7/approve', {
      headers: COOKIE,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(/Approved at \d{2}:\d{2}:\d{2}\./);
  });

  it('login success sets the cookie and fires hc:sessionrenewed', async () => {
    const response = await call(sessionExpiry, 'POST', '/session/login', {
      body: form({ password: 'anything' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('hc_demo_session=1');
    expect(response.headers.get('HX-Trigger')).toContain('hc:sessionrenewed');
  });

  it('login failure re-renders the dialog with an inline error (422)', async () => {
    const response = await call(sessionExpiry, 'POST', '/session/login', {
      body: form({ password: 'wrong' }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('hc-field__error');
    expect(body).toContain('aria-invalid="true"');
  });

  it('expire clears the cookie', async () => {
    const response = await call(sessionExpiry, 'POST', '/session/expire');
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('ignores other paths and methods', async () => {
    expect(await call(sessionExpiry, 'GET', '/tickets/7/approve')).toBeNull();
    expect(await call(sessionExpiry, 'POST', '/other')).toBeNull();
  });
});
