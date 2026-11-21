// Screenshots of Mino Study 001 and the For labels offer at 1440×900 and 390×844 (touch).
// Usage: node scripts/capture-study.mjs [outDir] [baseURL]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'docs/study-001');
const BASE = process.argv[3] ?? 'http://localhost:4173';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const live = (p) => p.waitForFunction(() => window.__mino?.archive()?.scene?.snapshot().phase === 'live', null, { timeout: 30000 });
for (const [device, opts] of Object.entries(devices)) {
  const shot = async (name, fn) => {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    await fn(p);
    await p.screenshot({ path: resolve(out, `${device}-${name}.png`) });
    await ctx.close();
  };
  await shot('01-archive-first-frame', async (p) => {
    await p.goto(BASE + '/');
    await p.waitForFunction(() => (window.__mino.archive().scene.snapshot().sinceExplode ?? 0) > 1.05, null, { timeout: 30000, polling: 'raf' });
  });
  for (const [n, id] of [['02', 'mino-study-001'], ['03', 'side-profile'], ['04', 'bomber-on-plaster'], ['05', 'empty-hanger']]) {
    await shot(`${n}-expanded-${id}`, async (p) => {
      await p.goto(BASE + '/');
      await live(p);
      await p.waitForTimeout(600);
      const i = await p.evaluate((x) => window.__mino.archive().scene.snapshot().planes.find((q) => q.id === x).i, id);
      await p.evaluate((n) => window.__mino.archive().scene.expandIndex(n), i);
      await p.waitForTimeout(1600); // large texture swaps in
    });
  }
  await shot('06-detail-turned-cuff', async (p) => {
    await p.goto(BASE + '/archive/turned-cuff');
    await p.waitForTimeout(900);
    await p.getByRole('button', { name: 'Details' }).click();
    await p.waitForTimeout(1300);
  });
  await shot('07-fallback-grid', async (p) => {
    await p.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/.test(t) ? null : o.call(this, t, ...r); }; });
    await p.goto(BASE + '/');
    await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('.fallback').scrollTo(0, 260));
    await p.waitForTimeout(1200);
  });
  await shot('08-for-labels', async (p) => { await p.goto(BASE + '/for-labels'); await p.waitForTimeout(1600); });
  await shot('09-for-labels-included', async (p) => {
    await p.goto(BASE + '/for-labels');
    await p.waitForTimeout(800);
    await p.evaluate(() => { const s = document.querySelector('.page--labels .page__scroll'); s.scrollTo(0, document.querySelector('.offer').offsetTop - 60); });
    await p.waitForTimeout(1200);
  });
  await shot('10-for-labels-process-pricing', async (p) => {
    await p.goto(BASE + '/for-labels');
    await p.waitForTimeout(800);
    await p.evaluate(() => { const s = document.querySelector('.page--labels .page__scroll'); s.scrollTo(0, document.querySelector('.chapter:nth-child(3)').offsetTop - 80); });
    await p.waitForTimeout(1200);
  });
  await shot('11-about', async (p) => { await p.goto(BASE + '/about'); await p.waitForTimeout(1500); });
}
await browser.close();
console.log('saved to', out);
