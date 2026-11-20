import { defineConfig } from '@playwright/test';

// E2E_DEV=1 runs the suite against the Vite dev server instead of the production build.
const dev = process.env.E2E_DEV === '1';
const port = dev ? 5174 : 4174;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: dev
      ? `node node_modules/vite/bin/vite.js --port ${port} --strictPort`
      : `node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ENQUIRY_PROVIDER: 'mock', MINO_ALLOW_MOCK: '1' },
  },
});
