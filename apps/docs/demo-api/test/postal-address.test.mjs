import { describe, expect, it } from 'vitest';
import * as postalAddress from '../recipes/postal-address.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/postal-address';

describe('postal-address demo API', () => {
  it('fills a single hit with OOB input re-renders', async () => {
    const response = await call(postalAddress, 'GET', '/address-by-postal?postal=123-4567');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Address filled from 123-4567.');
    expect(body).toContain('id="postal-address-demo-pref" name="pref" value="Tokyo"');
    expect(body).toContain('id="postal-address-demo-city" name="city" value="Chiyoda-ku"');
    expect(body).toContain('id="postal-address-demo-addr1" name="addr1" value="Chiyoda 1-1"');
    expect(body).toContain('autocomplete="address-level1"');
    const oobCount = body.match(/data-hx-swap-oob="outerHTML"/g)?.length ?? 0;
    expect(oobCount).toBe(3);
  });

  it('lists candidates when a code maps to several towns', async () => {
    const body = await (
      await call(postalAddress, 'GET', '/address-by-postal?postal=600-8216')
    ).text();
    expect(body).toContain('2 addresses share 600-8216');
    expect(body).toContain(`data-hx-get="${API}/address-by-postal?postal=600-8216&amp;choice=0"`);
    expect(body).toContain('data-hx-target="#postal-address-demo-result"');
    expect(body).toContain('Higashishiokoji-cho');
    expect(body).toContain('Nishishiokoji-cho');
    expect(body).not.toContain('data-hx-swap-oob');
  });

  it('resolves a choice into the single-hit shape', async () => {
    const body = await (
      await call(postalAddress, 'GET', '/address-by-postal?postal=600-8216&choice=1')
    ).text();
    expect(body).toContain('value="Nishishiokoji-cho"');
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).not.toContain('pick one');
  });

  it('answers not-found with a hint and no OOB swaps', async () => {
    const response = await call(postalAddress, 'GET', '/address-by-postal?postal=999-0000');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('No address for 999-0000');
    expect(body).not.toContain('data-hx-swap-oob');
  });

  it('rejects a malformed postal with 422', async () => {
    const response = await call(postalAddress, 'GET', '/address-by-postal?postal=12345');
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('Enter a postal code as 123-4567.');
  });

  it('ignores other paths and methods', async () => {
    expect(await call(postalAddress, 'POST', '/address-by-postal?postal=123-4567')).toBeNull();
    expect(await call(postalAddress, 'GET', '/other')).toBeNull();
  });
});
