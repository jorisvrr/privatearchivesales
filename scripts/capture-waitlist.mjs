// Screenshots of About, For labels and the drop waitlist in each state, at 1440×900 and 390×844 (touch).
// Usage: node scripts/capture-waitlist.mjs docs/waitlist [baseURL]  (needs WAITLIST_PROVIDER=mock MINO_ALLOW_MOCK=1)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'docs/waitlist');
const BASE = process.argv[3] ?? 'http://localhost:4173';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const devices = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const drop = '/waitlist/demo-archive-001';
const states = [
  ['about', async (p) => { await p.goto(BASE + '/about'); await p.waitForTimeout(1600); }],
  ['for-labels', async (p) => { await p.goto(BASE + '/for-labels'); await p.waitForTimeout(1600); }],
  ['waitlist-1-open', async (p) => { await p.goto(BASE + drop); await p.waitForTimeout(1200); }],
  ['waitlist-2-first-access-open', async (p) => { await p.goto(BASE + drop); await p.waitForTimeout(900); await p.getByText(/Get first access/).click(); await p.waitForTimeout(400); }],
  ['waitlist-3-verified', async (p) => {
    await p.goto(BASE + drop); await p.waitForTimeout(900);
    await p.getByLabel('Email address').fill('past@customer.example'); await p.getByText(/Get first access/).click();
    await p.getByLabel('Order number').fill('1001'); await p.getByRole('button', { name: 'Join the waitlist' }).last().click(); await p.waitForTimeout(700);
  }],
  ['waitlist-4-public', async (p) => {
    await p.goto(BASE + drop); await p.waitForTimeout(900);
    await p.getByLabel('Email address').fill(`shot-${Date.now()}@example.com`); await p.getByRole('button', { name: 'Join the waitlist' }).last().click(); await p.waitForTimeout(700);
  }],
  ['waitlist-5-no-match', async (p) => {
    await p.goto(BASE + drop); await p.waitForTimeout(900);
    await p.getByLabel('Email address').fill('someone@example.com'); await p.getByText(/Get first access/).click();
    await p.getByLabel('Order number').fill('9999'); await p.getByRole('button', { name: 'Join the waitlist' }).last().click(); await p.waitForTimeout(700);
  }],
  ['waitlist-6-unavailable', async (p) => {
    await p.goto(BASE + drop); await p.waitForTimeout(900);
    await p.getByLabel('Email address').fill('someone@example.com'); await p.getByText(/Get first access/).click();
    await p.getByLabel('Order number').fill('0000'); await p.getByRole('button', { name: 'Join the waitlist' }).last().click(); await p.waitForTimeout(700);
  }],
];
for (const [device, opts] of Object.entries(devices)) {
  for (const [name, run] of states) {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    await run(p);
    await p.screenshot({ path: resolve(out, `${device}-${name}.png`) });
    await ctx.close();
  }
}
await browser.close();
console.log('saved to', out);
