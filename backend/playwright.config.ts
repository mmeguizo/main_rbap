import { defineConfig } from '@playwright/test';

const configuredBaseUrl =
  process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

export default defineConfig({
  testDir: './test/playwright',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [['line']],
  use: {
    baseURL: configuredBaseUrl.endsWith('/')
      ? configuredBaseUrl
      : `${configuredBaseUrl}/`,
    trace: 'off',
  },
});
