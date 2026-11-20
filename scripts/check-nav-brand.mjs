// Builds the site with temporary brand names and checks the centred nav at 1440×900 and 390×844.
// Restores src/config/brand.ts afterwards. Usage: node scripts/check-nav-brand.mjs Minoan "Mino Studios"
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, 'src/config/brand.ts');
const original = readFileSync(file, 'utf8');
const current = original.match(/export const name = '([^']+)'/)[1];
const names = [current, ...process.argv.slice(2)];
const out = resolve(root, 'docs/brand/nav-check');
mkdirSync(out, { recursive: true });
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
const rows = [];
try {
  for (const n of names) {
    writeFileSync(file, original.replace(`export const name = '${current}'`, `export const name = '${n}'`));
    execFileSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'ignore' });
    const server = spawn(process.execPath, [vite, 'preview', '--port', '4180', '--strictPort'], { cwd: root, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 1500));
    const browser = await chromium.launch();
    for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
      for (const path of ['/about', '/for-labels']) {
        const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
        await page.goto(`http://localhost:4180${path}`);
        await page.waitForTimeout(1500);
        const m = await page.evaluate(() => {
          const r = window.__mino.nav.pillRects();
          const demo = document.querySelector('.demo-chip')?.getBoundingClientRect();
          const logo = document.querySelector('.logo');
          return { left: r.logo.left, right: r.pills[2].right, logoW: r.logo.width, text: logo.textContent, demoLeft: demo?.left ?? null, title: document.title };
        });
        const centre = (m.left + m.right) / 2;
        rows.push({ name: n, viewport: `${w}`, path, wordmark: m.text, logoW: Math.round(m.logoW), offCentre: +(centre - w / 2).toFixed(2), leftGap: Math.round(m.left), gapToDemo: m.demoLeft == null ? null : Math.round(m.demoLeft - m.right), title: m.title });
        await page.screenshot({ path: resolve(out, `${n.replace(/\s+/g, '-')}-${w}${path.replace('/', '-')}.png`), clip: { x: 0, y: 0, width: w, height: 48 } });
        await page.close();
      }
    }
    await browser.close();
    server.kill();
  }
} finally {
  writeFileSync(file, original);
  execFileSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'ignore' });
}
console.table(rows);
