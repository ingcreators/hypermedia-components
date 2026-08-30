import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

const BASE = 'http://demo.test/api/recipes/line-items';

function getQuote() {
  return handleDemoApi(new Request(`${BASE}/quote`, { headers: { 'HX-Request': 'true' } }));
}

function recalc(params) {
  return handleDemoApi(
    new Request(`${BASE}/recalc`, {
      method: 'POST',
      headers: {
        'HX-Request': 'true',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    }),
  );
}

const TWO_ROWS = [
  ['item', 'Widget'], ['qty', '3'], ['price', '1200'],
  ['item', 'Gasket'], ['qty', '5'], ['price', '800'],
];

describe('line-items demo API', () => {
  it('serves a fresh quote with server-computed totals', async () => {
    const response = await getQuote();
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-hc-line-items');
    expect(body).toContain('¥3,600'); // 3 × 1200
    expect(body).toContain('¥7,600'); // subtotal
    expect(body).toContain('¥760'); // tax, floored
    expect(body).toContain('¥8,360'); // total
  });

  it('recalculates on changed values — the server is the calculator', async () => {
    const body = await (
      await recalc([
        ...TWO_ROWS.slice(0, 3),
        ['item', 'Bolt'], ['qty', '10'], ['price', '80'],
      ])
    ).text();
    // Rows align positionally: Widget 3×1200 + Bolt 10×80.
    expect(body).toContain('¥800');
    expect(body).toContain('¥4,400'); // subtotal 3600+800
  });

  it('add appends an empty row', async () => {
    const body = await (await recalc([...TWO_ROWS, ['add', '1']])).text();
    expect(body.match(/name="item"/g)).toHaveLength(3);
    expect(body).toContain('¥7,600'); // empty row is qty 1 × ¥0
  });

  it('remove drops the addressed row and renumbers implicitly', async () => {
    const body = await (await recalc([...TWO_ROWS, ['remove-row', '1']])).text();
    expect(body.match(/name="item"/g)).toHaveLength(1);
    expect(body).not.toContain('Widget');
    expect(body).toContain('Gasket');
    expect(body).toContain('¥4,000'); // 5 × 800
  });

  it('422s a bad quantity: raw value echoed, aria-invalid, totals dashed', async () => {
    const response = await recalc([
      ['item', 'Widget'], ['qty', '3..5'], ['price', '1200'],
    ]);
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('value="3..5"');
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('hc-field__message');
    expect(body).toContain('—');
    expect(body).not.toContain('Subtotal</th><td>¥');
  });

  it('escapes hostile item names', async () => {
    const body = await (
      await recalc([['item', '<img src=x>'], ['qty', '1'], ['price', '100']])
    ).text();
    expect(body).toContain('&lt;img');
    expect(body).not.toContain('<img src=x>');
  });

  it('answers plain form POSTs (no-JS fallback) with a full page', async () => {
    const response = await handleDemoApi(
      new Request(`${BASE}/recalc`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(TWO_ROWS),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('data-hc-line-items');
  });
});
