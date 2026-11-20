// Records the desktop intro with sound enabled early, a piece opened and closed, and the toggle.
// Headless Chromium cannot capture its own audio output, so the soundtrack is rebuilt from the cue log:
// each cue the page actually played is placed at its logged time, using the same files the site serves.
// Usage: node scripts/record-intro.mjs [baseURL]  → docs/sound/intro-desktop-with-sound.webm
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const tmp = resolve(root, '.cache/video');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } });
const videoStart = Date.now();
const p = await ctx.newPage();
await p.goto(BASE + '/');
await p.waitForFunction(() => window.__mino?.archive()?.scene?.snapshot().phase === 'ring', null, { timeout: 30000 });
await p.mouse.move(520, 300, { steps: 8 });
await p.mouse.move(600, 330, { steps: 8 });
await p.waitForTimeout(500);
await p.mouse.click(600, 330); // "Click to enable audio"
await p.waitForFunction(() => window.__mino.archive().scene.snapshot().phase === 'live', null, { timeout: 30000 });
await p.waitForTimeout(1200);
const s = await p.evaluate(() => window.__mino.archive().scene.snapshot());
const t = s.planes.filter((x) => x.visible).sort((a, b) => b.z - a.z)[0];
await p.mouse.move(t.cx, t.cy, { steps: 12 });
await p.waitForTimeout(700);
await p.mouse.click(t.cx, t.cy);
await p.waitForTimeout(1200);
await p.mouse.move(1250, 460, { steps: 14 });
await p.waitForTimeout(900);
await p.mouse.click(1250, 460);
await p.waitForTimeout(1300);
const cues = await p.evaluate(() => window.__mino.sound.log.filter((l) => l.result === 'played').map((l) => ({ cue: l.cue, epoch: performance.timeOrigin + l.at })));
await ctx.close();
await browser.close();
const video = resolve(tmp, readdirSync(tmp).filter((f) => f.endsWith('.webm')).sort().pop());
const files = { paper: 'paper-shuffle', fabric: 'fabric-sweep', click: 'garment-click' };
const inputs = ['-i', video];
const filters = [];
cues.forEach((c, i) => {
  inputs.push('-i', resolve(root, `public/media/sound/${files[c.cue]}.webm`));
  const ms = Math.max(0, Math.round(c.epoch - videoStart));
  filters.push(`[${i + 1}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
});
const mix = `${filters.join(';')};${cues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${cues.length}:normalize=0,volume=0.8,apad[aout]`;
const out = resolve(root, 'docs/sound/intro-desktop-with-sound.webm');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', mix, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'libopus', '-shortest', out]);
console.log('cues', cues.map((c) => `${c.cue}@${((c.epoch - videoStart) / 1000).toFixed(2)}s`).join(' '));
console.log('saved', out);
