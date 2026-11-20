// First-screen screenshots of the About/Invitations and For labels pages, plus their open forms.
// Usage: node scripts/capture-pages.mjs <outDir> <aboutPath> [baseURL]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2]);
const aboutPath = process.argv[3] ?? '/about';
const BASE = process.argv[4] ?? 'http://localhost:4173';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const devices = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
for (const [device, opts] of Object.entries(devices)) {
  for (const [name, path] of [['about', aboutPath], ['for-labels', '/for-labels']]) {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    await p.goto(BASE + path);
    await p.waitForTimeout(1800);
    await p.screenshot({ path: resolve(out, `${device}-${name}-1-first-screen.png`) });
    const cta = p.locator('.cta').first();
    if (await cta.count() && !(await p.locator('.fp-panel:visible').count())) {
      await cta.click();
      await p.waitForTimeout(500);
      await p.screenshot({ path: resolve(out, `${device}-${name}-2-form-open.png`) });
    }
    await ctx.close();
  }
}
await browser.close();
console.log('saved to', out);
