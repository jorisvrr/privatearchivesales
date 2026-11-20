// Visual verification: records Orvel with a 60 fps CDP screencast (the same method as the audit) and pairs
// frames with the reference captures at matching viewports and timestamps.
// Usage: start a preview server (see README), then: node scripts/verify-visual.mjs [baseURL]
// Output: verification/frames/*.jpg and verification/pairs.json (composed by scripts/compose-sheets.py).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const REF = 'gionatan-nese/captures';
const OUT = resolve(root, 'verification');
rmSync(resolve(OUT, 'frames'), { recursive: true, force: true });
mkdirSync(resolve(OUT, 'frames'), { recursive: true });
const pairs = [];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function session(viewport, { touch = false, dpr = 1 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const mark = (e) => { window.__lastInput = performance.timeOrigin + e.timeStamp; };
    window.addEventListener('pointerup', mark, true);
    window.addEventListener('click', mark, true);
    window.addEventListener('keydown', mark, true);
  });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
  });
  const start = () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1, maxWidth: viewport.width * dpr, maxHeight: viewport.height * dpr });
  const stop = () => cdp.send('Page.stopScreencast');
  /** Frame on screen at epoch time t (the latest frame at or before t). */
  const at = (t) => {
    let best = null;
    for (const f of frames) if (f.t <= t + 4) best = f;
    return best ?? frames[0];
  };
  let n = 0;
  const save = (frame, name) => {
    const file = `frames/${name}-${String(n++).padStart(3, '0')}.jpg`;
    writeFileSync(resolve(OUT, file), Buffer.from(frame.data, 'base64'));
    return file;
  };
  const pair = (group, label, ref, t) => pairs.push({ group, label, ref: ref && `${REF}/${ref}`, mine: save(at(t), group), viewport: `${viewport.width}×${viewport.height}` });
  const lastInput = () => page.evaluate(() => window.__lastInput);
  const now = () => page.evaluate(() => performance.timeOrigin + performance.now());
  const live = () => page.waitForFunction(() => window.__orvel?.archive()?.scene?.snapshot().phase === 'live', null, { timeout: 30000 });
  const front = async () => {
    const s = await page.evaluate(() => window.__orvel.archive().scene.snapshot());
    return s.planes.filter((p) => p.visible).sort((a, b) => b.z - a.z)[0];
  };
  return { ctx, page, start, stop, at, pair, lastInput, now, live, front, wait: (ms) => page.waitForTimeout(ms) };
}

// ------------------------------------------------------------- 1440×900: intro and settled
{
  const s = await session({ width: 1440, height: 900 });
  await s.start();
  await s.page.goto(BASE + '/');
  await s.live();
  await s.page.waitForFunction(() => window.__orvel.archive().scene.snapshot().sinceExplode > 6.2);
  await s.stop();
  const { introAt, explodeAt } = await s.page.evaluate(() => ({
    introAt: performance.timeOrigin + window.__orvel.archive().introAt,
    explodeAt: performance.timeOrigin + window.__orvel.archive().scene.explodeAt,
  }));
  // The reference's intro canvas starts at 637 ms after navigation; align on that.
  for (const ms of [300, 640, 900, 1300, 1600, 2000, 2400, 2700, 3100, 3500, 4300, 4700, 5100, 5500, 5900, 6250, 6450, 6600, 6800, 7100, 7500]) {
    const ref = `desktop-1440/home/intro-frames/t${String(ms).padStart(5, '0')}ms.jpg`;
    s.pair('1440-intro', `t = ${ms} ms`, ref, introAt + ms - 637);
  }
  s.pair('1440-settled', 'explode + 1.5 s', 'desktop-1440/home/settled-explode+1500-load1.png', explodeAt + 1556);
  s.pair('1440-settled', 'explode + 6.0 s', 'desktop-1440/home/settled-explode+6000-load1.png', explodeAt + 6056);
  await s.ctx.close();
}

// ------------------------------------------------------------- 1440×900: hover, expand, open, back
{
  const s = await session({ width: 1440, height: 900 });
  await s.page.goto(BASE + '/');
  await s.live();
  await s.wait(1500);
  await s.start();
  const t = await s.front();
  await s.page.mouse.move(t.cx, t.cy, { steps: 4 });
  const hoverAt = await s.now();
  await s.wait(1300);
  s.pair('1440-hover', 'hover settled', 'desktop-1440/home/hover-02-hover-settled.png', hoverAt + 1250);
  await s.page.mouse.down();
  await s.page.mouse.up();
  const c = await s.lastInput();
  await s.wait(1300);
  for (const [ms, ref] of [[100, 'expand-01-expand-100ms'], [200, 'expand-01-expand-200ms'], [400, 'expand-01-expand-400ms'], [1200, 'expand-02-expanded-settled']]) s.pair('1440-expand', ms < 1200 ? `expand + ${ms} ms` : 'expanded, settled', `desktop-1440/home/${ref}.png`, c + ms);
  await s.page.mouse.move(380, 450, { steps: 6 });
  await s.wait(900);
  s.pair('1440-expand', 'pointer off plane: “Close”', 'desktop-1440/home/expand-03-pointer-off-plane.png', await s.now());
  await s.page.mouse.move(720, 870, { steps: 6 });
  await s.wait(900);
  s.pair('1440-expand', 'pointer over title: label hidden', 'desktop-1440/home/expand-04-pointer-over-title.png', await s.now());
  await s.page.mouse.move(720, 420, { steps: 6 });
  await s.wait(900);
  s.pair('1440-expand', 'pointer on plane: “View”', 'desktop-1440/home/expand-05-pointer-on-plane.png', await s.now());
  await s.page.mouse.down();
  await s.page.mouse.up();
  const o = await s.lastInput();
  await s.wait(2000);
  for (const ms of [150, 300, 600, 900, 1200, 1600]) s.pair('1440-open', `open piece + ${ms} ms`, `desktop-1440/home/open-case-08-open-${ms}ms.png`, o + ms);
  s.pair('1440-open', 'piece settled', 'desktop-1440/home/open-case-09-case-settled.png', o + 1950);
  await s.page.goBack();
  const b = await s.now();
  await s.wait(1500);
  s.pair('1440-open', 'Back + 150 ms', 'desktop-1440/home/open-case-10-back-150ms.png', b + 150);
  s.pair('1440-open', 'Back, settled', 'desktop-1440/home/open-case-11-back-settled.png', b + 1400);
  // collapse
  const t2 = await s.front();
  await s.page.mouse.click(t2.cx, t2.cy);
  await s.wait(1100);
  await s.page.mouse.click(1300, 150);
  const k = await s.lastInput();
  await s.wait(1200);
  s.pair('1440-expand', 'collapse + 200 ms', 'desktop-1440/home/expand-06-collapse-200ms.png', k + 200);
  s.pair('1440-expand', 'collapsed', 'desktop-1440/home/expand-07-collapsed.png', k + 1100);
  await s.stop();
  await s.ctx.close();
}

// ------------------------------------------------------------- 1440×900: nav transitions and panels
{
  const s = await session({ width: 1440, height: 900 });
  await s.page.goto(BASE + '/');
  await s.live();
  await s.wait(1500);
  await s.start();
  const legs = [['/invitations', '1-to-projects', 'Archive → Invitations'], ['/for-labels', '2-to-about', 'Invitations → For labels'], ['/', '3-to-home', 'For labels → Archive']];
  for (const [href, ref, name] of legs) {
    await s.page.locator(`.pill[href="${href}"]`).click();
    const c = await s.lastInput();
    await s.wait(2000);
    for (const ms of [100, 300, 600, 900, 1300]) s.pair('1440-nav', `${name} + ${ms} ms`, `desktop-1440/nav/${ref}-${String(ms).padStart(4, '0')}ms.png`, c + ms);
    s.pair('1440-nav', `${name}, settled`, `desktop-1440/nav/${ref}-settled.png`, c + 1950);
  }
  await s.page.goBack();
  const b = await s.now();
  await s.wait(1200);
  s.pair('1440-nav', 'Back + 150 ms (instant)', 'desktop-1440/nav/4-back-150ms.png', b + 150);
  await s.page.goto(BASE + '/archive/chore-jacket');
  await s.wait(1500);
  await s.page.getByRole('button', { name: 'Details' }).click();
  const d = await s.lastInput();
  await s.wait(1400);
  s.pair('1440-panel', 'Details + 200 ms', 'desktop-1440/projects/interact-11-info-200ms.png', d + 200);
  s.pair('1440-panel', 'Details open', 'desktop-1440/projects/interact-12-info-open.png', d + 1300);
  await s.page.keyboard.press('Escape');
  const e = await s.lastInput();
  await s.wait(1000);
  s.pair('1440-panel', 'Esc + 250 ms', 'desktop-1440/projects/interact-13-info-esc-250ms.png', e + 250);
  await s.page.goto(BASE + '/invitations');
  await s.wait(2200);
  s.pair('1440-panel', 'Invitations (direct link)', 'desktop-1440/projects/interact-12-info-open.png', await s.now());
  await s.page.goto(BASE + '/for-labels');
  await s.wait(2000);
  s.pair('1440-panel', 'For labels', 'desktop-1440/about/b-settled.png', await s.now());
  await s.stop();
  await s.ctx.close();
}

// ------------------------------------------------------------- 1280×800 @2x
{
  const s = await session({ width: 1280, height: 800 }, { dpr: 2 });
  await s.start();
  await s.page.goto(BASE + '/');
  await s.live();
  await s.page.waitForFunction(() => window.__orvel.archive().scene.snapshot().sinceExplode > 6.1);
  const ex = await s.page.evaluate(() => performance.timeOrigin + window.__orvel.archive().scene.explodeAt);
  const ia = await s.page.evaluate(() => performance.timeOrigin + window.__orvel.archive().introAt);
  s.pair('1280', 'intro t = 2000 ms', 'desktop-1280/home-intro-2000ms.png', ia + 2000 - 637);
  s.pair('1280', 'settled (explode + 6 s)', 'desktop-1280/home-settled.png', ex + 6000);
  await s.page.goto(BASE + '/invitations');
  await s.wait(2200);
  s.pair('1280', 'Invitations', 'desktop-1280/case-erica-basile-settled.png', await s.now());
  await s.stop();
  await s.ctx.close();
}

// ------------------------------------------------------------- touch: 768×1024 @2x and 390×844 @3x
for (const [dir, vp, dpr] of [['tablet-768', { width: 768, height: 1024 }, 2], ['mobile-390', { width: 390, height: 844 }, 3]]) {
  const s = await session(vp, { touch: true, dpr });
  await s.start();
  await s.page.goto(BASE + '/');
  await s.live();
  await s.page.waitForFunction(() => window.__orvel.archive().scene.snapshot().sinceExplode > 6.1);
  const ex = await s.page.evaluate(() => performance.timeOrigin + window.__orvel.archive().scene.explodeAt);
  const ia = await s.page.evaluate(() => performance.timeOrigin + window.__orvel.archive().introAt);
  s.pair(dir, 'intro t = 2000 ms', `${dir}/home-intro-2000ms.png`, ia + 2000 - 637);
  s.pair(dir, 'settled', `${dir}/touch-00-settled.png`, ex + 6000);
  const t = await s.front();
  await s.page.touchscreen.tap(t.cx, t.cy);
  const c = await s.lastInput();
  await s.wait(1300);
  s.pair(dir, 'tap + 250 ms', `${dir}/touch-01-tap-250ms.png`, c + 250);
  s.pair(dir, 'tap, expanded', `${dir}/touch-02-tap-expanded.png`, c + 1200);
  await s.page.locator('.title-action').tap();
  const v = await s.lastInput();
  await s.wait(2000);
  for (const ms of [200, 600, 1000]) s.pair(dir, `View piece + ${ms} ms`, `${dir}/touch-03-viewcase-${ms}ms.png`, v + ms);
  s.pair(dir, 'piece', `${dir}/touch-04-case.png`, v + 1900);
  await s.page.goBack();
  const b = await s.now();
  await s.wait(800);
  s.pair(dir, 'Back', `${dir}/touch-05-back.png`, b + 700);
  const cdp = await s.ctx.newCDPSession(s.page);
  const pt = (x) => [{ x, y: vp.height / 2, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(vp.width * 0.25) });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(vp.width * 0.25 + i * (vp.width * 0.5) / 8) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const sw = await s.now();
  await s.wait(2200);
  s.pair(dir, 'swipe + 100 ms', `${dir}/touch-06-swipe-100ms.png`, sw + 100);
  s.pair(dir, 'swipe + 2 s', `${dir}/touch-07-swipe-2s.png`, sw + 2000);
  await s.page.goto(BASE + '/invitations');
  await s.wait(2200);
  s.pair(dir, 'Invitations sheet (direct link)', `${dir}/case-erica-basile-settled.png`, await s.now());
  await s.page.goto(BASE + '/for-labels');
  await s.wait(2000);
  s.pair(dir, 'For labels', `${dir}/about-settled.png`, await s.now());
  await s.stop();
  await s.ctx.close();
}

await browser.close();
writeFileSync(resolve(OUT, 'pairs.json'), JSON.stringify(pairs, null, 1));
console.log(`${pairs.length} pairs`);
