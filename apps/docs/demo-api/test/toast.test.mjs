import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/toast.mjs';
import { call } from './helpers.mjs';

describe('toast demo API', () => {
  it('answers variant=success with 204 + the exact success toast header', async () => {
    const response = await call(mod, 'POST', '/save?variant=success');
    expect(response.status).toBe(204);
    expect(response.headers.get('HX-Trigger')).toBe(
      '{"hc:toast":{"message":"Saved","variant":"success"}}',
    );
  });

  it('answers variant=error with 204 + a sticky error toast, em dash \\u-escaped', async () => {
    const response = await call(mod, 'POST', '/save?variant=error');
    expect(response.status).toBe(204);
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toBe(
      '{"hc:toast":{"title":"Sync failed","message":"Could not reach the server \\u2014 try again","variant":"error","duration":0}}',
    );
    // Header values are latin-1; the payload must be pure ASCII.
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
    expect(trigger).not.toContain('—');
  });

  it('answers variant=info with 204 + the info toast header', async () => {
    const response = await call(mod, 'POST', '/save?variant=info');
    expect(response.status).toBe(204);
    expect(response.headers.get('HX-Trigger')).toBe(
      '{"hc:toast":{"message":"Working on it","variant":"info"}}',
    );
  });

  it('falls back to info for unknown or missing variants', async () => {
    for (const query of ['?variant=warning', '']) {
      const response = await call(mod, 'POST', `/save${query}`);
      expect(response.status).toBe(204);
      expect(response.headers.get('HX-Trigger')).toContain('"variant":"info"');
    }
  });

  it('returns null for unknown routes', () => {
    expect(call(mod, 'GET', '/save')).toBeNull();
    expect(call(mod, 'POST', '/other')).toBeNull();
  });
});
