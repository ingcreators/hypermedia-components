import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 4400;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'test-browser',
  testMatch: '**/*.spec.mjs',
  timeout: 15_000,
  fullyParallel: false,
  // One retry on CI only. The webkit leg intermittently hangs a single
  // `page.goto('/')` in a beforeEach mid-suite (seen on PR #364's
  // a11y.spec and PR #377's nested-theme.spec — 726/727 tests passing
  // around it, always green on manual rerun): a runner-side navigation
  // stall, not a product or test bug. A retried pass is reported as
  // "flaky" in the Playwright report, so it stays visible instead of
  // costing a 15-minute manual rerun. Locally retries stay off — a
  // deterministic failure should fail fast while developing.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    // Visual regression suites (test-browser/vrt.spec.mjs): one linux
    // baseline set (devcontainer and CI both run the pinned Chromium on
    // linux; the sheets pin fonts to DejaVu). Measured devcontainer↔CI
    // sub-pixel anti-aliasing drift peaks around ~900 px on the densest
    // sheet (~0.014% of it); 2400 absorbs that with margin while a real
    // visual break (a broken theme, an un-hidden overlay, a collapsed
    // layout) differs by tens of thousands of pixels.
    toHaveScreenshot: { maxDiffPixels: 2400 },
  },
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    actionTimeout: 5_000,
    // Fail a stalled navigation well inside the 15s test timeout so the
    // retry (above) gets a full, fresh attempt instead of inheriting a
    // nearly-exhausted budget. Normal gotos against the local static
    // server complete in tens of milliseconds.
    navigationTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Scrollbar rendering differs between environments and even
        // between successive full-page captures (viewport-width changes
        // re-wrap text and shift the page height by a pixel or two) —
        // hide them so the VRT sheets rasterize identically everywhere.
        // Chromium-only flag, so it lives on this project.
        launchOptions: { args: ['--hide-scrollbars'] },
      },
    },
    // The functional + axe suites run on all three engines; the VRT
    // sheets keep a single Chromium/linux baseline set (screenshot
    // rasterization is engine-specific, and one baseline is enough to
    // catch visual regressions in our own CSS).
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: '**/vrt.spec.mjs',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: '**/vrt.spec.mjs',
    },
  ],
  webServer: [
    {
      command: 'node test-browser/serve.mjs',
      port: PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10_000,
    },
    // The example apps live outside the pnpm workspace; serve them on
    // their own ports so the a11y specs can scan them
    // (see examples-plain-html.spec.mjs / examples-htmx.spec.mjs).
    {
      command: 'node ../../examples/plain-html/serve.mjs',
      port: 4322,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10_000,
    },
    {
      command: 'node ../../examples/htmx/server.mjs',
      port: 4323,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10_000,
    },
  ],
});
