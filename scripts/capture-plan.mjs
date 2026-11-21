// Screenshots of For labels and each /plan screen at 1440×900 and 390×844 (touch).
// Usage: node scripts/capture-plan.mjs [outDir] [baseURL]   (needs ENQUIRY_PROVIDER=mock MINO_ALLOW_MOCK=1)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'docs/plan');
const BASE = process.argv[3] ?? 'http://localhost:4173';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const devices = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
for (const [device, opts] of Object.entries(devices)) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const shot = (name) => p.screenshot({ path: resolve(out, `${device}-${name}.png`) });
  await p.goto(BASE + '/for-labels'); await p.waitForTimeout(1500); await shot('01-for-labels');
  await p.evaluate(() => { const s = document.querySelector('.page--labels .page__scroll'); s.scrollTo(0, document.querySelector('.offer').offsetTop - 40); });
  await p.waitForTimeout(1200); await shot('02-included-and-preview');
  await p.goto(BASE + '/plan'); await p.waitForTimeout(700); await shot('03-step-1');
  await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(300); await shot('04-step-1-error');
  await p.getByText('Samples', { exact: true }).click(); await shot('05-step-1-selected');
  await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(500);
  await p.getByText('Within three months').click(); await shot('06-step-2');
  await p.locator('.plan__step[data-step="2"] .fp-button').click(); await p.waitForTimeout(500); await shot('07-step-3');
  await p.getByLabel('Work email').fill('founder@'); await p.getByRole('button', { name: 'Send my enquiry' }).click(); await p.waitForTimeout(200); await shot('08-step-3-invalid');
  await p.getByLabel('Work email').fill('fail@studio.example'); await p.getByRole('button', { name: 'Send my enquiry' }).click(); await p.waitForTimeout(500); await shot('09-step-3-failed');
  if (device === 'mobile') { await p.getByLabel('Work email').focus(); await p.setViewportSize({ width: 390, height: 508 }); await p.waitForTimeout(500); await shot('10-keyboard-open'); await p.setViewportSize({ width: 390, height: 844 }); }
  await p.getByLabel('Work email').fill('founder@studio.example'); await p.getByLabel(/Brand website/).fill('@studionorth');
  await p.getByRole('button', { name: 'Send my enquiry' }).click(); await p.waitForTimeout(600); await shot('11-confirmation');
  await ctx.close();
}
await browser.close();
console.log('saved to', out);
