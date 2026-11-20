import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4174',
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { MAILING_PROVIDER: 'mock', ENQUIRY_PROVIDER: 'mock', ORVEL_ALLOW_MOCK: '1' },
  },
});
