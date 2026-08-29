import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/reference-lookup';

function get(path) {
  return handleDemoApi(new Request(`${BASE}${path}`, { headers: { 'HX-Request': 'true' } }));
}

describe('reference-lookup demo API', () => {
  it('resolves a known code: name in the hint, id filled, canonical code echoed', async () => {
    const response = await get('/resolve?customer_code=c-1041');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Acme Trading K.K.');
    expect(body).toContain('value="C-1041"'); // normalised case
    expect(body).toContain('name="customer_id" value="cus_9f2"');
    expect(body).not.toContain('aria-invalid');
  });

  it('422s an unknown code — and CLEARS the hidden id', async () => {
    const response = await get('/resolve?customer_code=C-9999');
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('hc-field__message');
    expect(body).toContain('name="customer_id" value=""');
    expect(body).toContain('value="C-9999"'); // raw code echoed
  });

  it('treats an empty code as cleared, not an error', async () => {
    const response = await get('/resolve?customer_code=');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('name="customer_id" value=""');
    expect(body).not.toContain('aria-invalid');
  });

  it('serves the dialog with search wiring and an inactive row rendered but refused', async () => {
    const body = await (await get('/lookup')).text();
    expect(body).toContain('<dialog');
    expect(body).toContain('data-hc-close-dialog-on-success');
    expect(body).toContain('role="search"');
    expect(body).toContain('aria-disabled="true"');
    expect(body).toContain('inactive since 2026-04');
  });

  it('filters results and escapes the term', async () => {
    const body = await (await get('/lookup/results?q=kitsune')).text();
    expect(body).toContain('Kitsune Foods');
    expect(body).not.toContain('Acme');
    const empty = await (await get('/lookup/results?q=<zzz>')).text();
    expect(empty).toContain('&lt;zzz&gt;');
  });

  it('pick re-renders the field resolved; an inactive id is refused with an empty id', async () => {
    const body = await (await get('/pick?id=cus_b3c')).text();
    expect(body).toContain('Meridian Logistics');
    expect(body).toContain('name="customer_id" value="cus_b3c"');
    const refused = await get('/pick?id=cus_a11');
    expect(refused.status).toBe(422);
    expect(await refused.text()).toContain('name="customer_id" value=""');
  });
});
