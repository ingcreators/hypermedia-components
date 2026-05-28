import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 4400;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'test-browser',
  testMatch: '**/*.spec.mjs',
  timeout: 15_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    actionTimeout: 5_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node test-browser/serve.mjs',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 10_000,
  },
});
