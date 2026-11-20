// Screenshots of the two form popups in every state, at 1440×900 and 390×844 (touch).
// Usage: node scripts/capture-popups.mjs <outDir> [baseURL]   e.g. docs/popups/after
// "Keyboard open" on mobile is simulated by shrinking the viewport to 390×508 (a ≈336 px keyboard)
// after focusing a field; headless Chromium has no on-screen keyboard.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'docs/popups/after');
const BASE = process.argv[3] ?? 'http://localhost:4173';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};

const POPUPS = {
  invitation: {
    path: '/invitations',
    endpoint: '/api/subscribe',
    open: async (p) => { await p.waitForTimeout(1600); },
    fill: async (p) => { await p.getByLabel('Email address').fill('guest@example.com'); },
    invalid: async (p) => { await p.getByLabel('Email address').fill('guest@example'); },
    submit: (p) => p.getByRole('button', { name: /Join the list|Joining/ }),
    firstField: (p) => p.getByLabel('Email address'),
  },
  enquiry: {
    path: '/for-labels',
    endpoint: '/api/enquiry',
    open: async (p) => { await p.waitForTimeout(900); await p.locator('.cta--lede').click(); await p.waitForTimeout(900); },
    fill: async (p) => {
      await p.getByLabel('Label name').fill('Studio North');
      await p.getByLabel('Contact email').fill('founder@studio-north.example');
      await p.getByLabel('City', { exact: true }).fill('Rotterdam');
      await p.getByLabel('Approximate quantity').selectOption({ index: 2 });
      await p.getByLabel(/Note/).fill('Mostly outerwear, 2019–2022.');
    },
    invalid: async (p) => {
      await p.getByLabel('Label name').fill('');
      await p.getByLabel('Contact email').fill('founder@');
    },
    submit: (p) => p.getByRole('button', { name: /Send enquiry|Sending/ }),
    firstField: (p) => p.getByLabel('Label name'),
  },
};

for (const [device, opts] of Object.entries(DEVICES)) {
  for (const [name, pop] of Object.entries(POPUPS)) {
    const shoot = async (state, setup) => {
      const ctx = await browser.newContext(opts);
      const p = await ctx.newPage();
      await p.goto(BASE + pop.path);
      await pop.open(p);
      await setup?.(p);
      await p.screenshot({ path: resolve(out, `${device}-${name}-${state}.png`) });
      await ctx.close();
    };
    await shoot('1-open');
    if (device === 'mobile') {
      await shoot('2-keyboard-open', async (p) => {
        await pop.firstField(p).focus();
        await p.setViewportSize({ width: 390, height: 508 });
        await p.waitForTimeout(500);
      });
    }
    await shoot('3-validation-error', async (p) => {
      await pop.invalid(p);
      await pop.submit(p).click();
      await p.waitForTimeout(500);
    });
    await shoot('4-submitting', async (p) => {
      await p.route("**" + pop.endpoint, () => { /* never answers: stays submitting */ });
      await pop.fill(p);
      await pop.submit(p).click();
      await p.waitForTimeout(300);
    });
    await shoot('5-success', async (p) => {
      await p.route("**" + pop.endpoint, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }));
      await pop.fill(p);
      await pop.submit(p).click();
      await p.waitForTimeout(900);
    });
    await shoot('6-server-error', async (p) => {
      await p.route("**" + pop.endpoint, (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"failed"}' }));
      await pop.fill(p);
      await pop.submit(p).click();
      await p.waitForTimeout(700);
    });
    console.log(device, name, 'done');
  }
}
await browser.close();
