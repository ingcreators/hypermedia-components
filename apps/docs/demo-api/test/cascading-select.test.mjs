import { describe, expect, it } from 'vitest';
import * as cascadingSelect from '../recipes/cascading-select.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/cascading-select';

describe('cascading-select demo API', () => {
  it('returns Tokyo cities wired to load the ward level, plus the OOB ward reset', async () => {
    const response = await call(cascadingSelect, 'GET', '/areas/cities?prefecture=13');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="cascading-select-demo-city" name="city"');
    expect(body).toContain(`data-hx-get="${API}/areas/wards"`);
    expect(body).toContain('data-hx-include="this"');
    expect(body).toContain('data-hx-target="#cascading-select-demo-ward"');
    expect(body).toContain('data-hx-swap="outerHTML"');
    expect(body).toContain('<option value="13101">Chiyoda</option>');
    expect(body).toContain('<option value="13102">Chuo</option>');
    expect(body).toContain('<option value="13103">Minato</option>');
    // Deeper level reset out of band in the same response.
    expect(body).toContain('data-hx-swap-oob="true"');
    expect(body).toContain('Select a city first');
  });

  it('returns Osaka cities for prefecture=27', async () => {
    const body = await (await call(cascadingSelect, 'GET', '/areas/cities?prefecture=27')).text();
    expect(body).toContain('<option value="27102">Kita</option>');
    expect(body).toContain('<option value="27103">Fukushima</option>');
    expect(body).toContain('<option value="27104">Konohana</option>');
    expect(body).not.toContain('Chiyoda');
  });

  it('empty prefecture unwinds to the disabled placeholder city + OOB ward reset (still 200)', async () => {
    const response = await call(cascadingSelect, 'GET', '/areas/cities?prefecture=');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('name="city" disabled');
    expect(body).toContain('Select a prefecture first');
    expect(body).not.toContain('Chiyoda');
    expect(body).toContain('data-hx-swap-oob="true"');
    expect(body).toContain('Select a city first');
  });

  it('unknown prefecture behaves exactly like the empty value (not an error)', async () => {
    const response = await call(cascadingSelect, 'GET', '/areas/cities?prefecture=99');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('name="city" disabled');
    expect(body).toContain('Select a prefecture first');
  });

  it('returns the ward select for a city, enabled and without OOB', async () => {
    const response = await call(cascadingSelect, 'GET', '/areas/wards?city=13101');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="cascading-select-demo-ward" name="ward"');
    expect(body).toContain('<option value="13101-1">North</option>');
    expect(body).toContain('<option value="13101-2">Central</option>');
    expect(body).toContain('<option value="13101-3">South</option>');
    // Deepest level: no further wiring, no OOB.
    expect(body).not.toContain('data-hx-swap-oob');
    expect(body).not.toContain('data-hx-get');
  });

  it('empty or unknown city returns the disabled ward placeholder (200, no OOB)', async () => {
    for (const query of ['?city=', '?city=99999']) {
      const response = await call(cascadingSelect, 'GET', `/areas/wards${query}`);
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('name="ward" disabled');
      expect(body).toContain('Select a city first');
      expect(body).not.toContain('data-hx-swap-oob');
    }
  });

  it('returns null for unknown routes and non-GET methods', async () => {
    expect(await call(cascadingSelect, 'GET', '/areas/nope')).toBeNull();
    expect(
      await call(cascadingSelect, 'POST', '/areas/cities?prefecture=13', { body: 'x=1' }),
    ).toBeNull();
  });
});
