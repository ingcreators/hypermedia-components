import { describe, expect, it } from 'vitest';
import { handleDemoApi } from '../index.mjs';

function req(path, init) {
  return new Request(`http://demo.test${path}`, init);
}

describe('handleDemoApi routing', () => {
  it('returns null for paths outside /api/recipes/', async () => {
    expect(await handleDemoApi(req('/recipes/live-search/'))).toBeNull();
    expect(await handleDemoApi(req('/api/manifest.json'))).toBeNull();
  });

  it('404s unknown recipes and unknown routes within a recipe', async () => {
    const unknownRecipe = await handleDemoApi(req('/api/recipes/no-such-recipe/items'));
    expect(unknownRecipe.status).toBe(404);

    const unknownRoute = await handleDemoApi(req('/api/recipes/live-search/no-such-route'));
    expect(unknownRoute.status).toBe(404);
  });

  it('marks every response uncacheable', async () => {
    const response = await handleDemoApi(req('/api/recipes/live-search/items'));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
