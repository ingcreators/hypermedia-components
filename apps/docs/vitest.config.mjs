// Vitest config for the docs app — covers the recipe demo API
// (demo-api/), which is plain web-standard Request → Response code
// and runs in a node environment. The Astro site itself is validated
// by `astro build` (docs CI job), not by unit tests.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['demo-api/test/**/*.test.mjs'],
    environment: 'node',
  },
});
