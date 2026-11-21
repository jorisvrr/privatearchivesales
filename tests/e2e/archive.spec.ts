import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const placement = JSON.parse(readFileSync(new URL('../fixtures/placement.json', import.meta.url), 'utf8'));
import { DESKTOP, expectNoReferenceBranding, frontPlane, PHONE, quatAngle, settled, snap, TABLET, waitLive } from './helpers';

test.describe('desktop 1440×900', () => {
  test.use({ viewport: DESKTOP });

  test('first visit: ring of 10 → stack → explode into 18, nav drops in, input locked until settled', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.intro__logo')).toBeVisible();
    await expect(page.locator('.nav')).toBeHidden();
    await expect(page.locator('.intro__word--l')).toHaveText('Mino');
    await expect(page.locator('.intro__word--r')).toHaveText('Private archive sales');
    await page.waitForFunction(() => (window as any).__mino.archive().scene.snapshot().planes.filter((p: any) => p.visible && p.opacity > 0.5).length === 10, null, { timeout: 15_000 });
    const ring = await snap(page);
    expect(ring.phase).toBe('ring');
    // The ten ring planes are the art-directed intro selection, in ring order.
    expect(ring.planes.filter((p) => p.visible).sort((a, b) => a.ring - b.ring).map((p) => p.id)).toEqual(['sealed-envelope', 'mino-study-001', 'corduroy-swatch-card', 'bomber-on-plaster', 'jeans-laid-flat', 'side-profile', 'brass-eyelets', 'bomber-in-tissue', 'tied-parcel', 'empty-hanger']);
    await page.mouse.move(720, 450);
    await page.mouse.down();
    await page.mouse.move(900, 450, { steps: 5 });
    await page.mouse.up();
    expect((await snap(page)).ambient).toBe(true); // drag ignored during the intro
    await page.waitForFunction(() => (window as any).__mino.archive().scene.snapshot().phase === 'explode', null, { timeout: 15_000 });
    await expect(page.locator('.nav')).toBeVisible();
    await waitLive(page);
    const s = await snap(page);
    expect(s.planes.filter((p) => p.visible)).toHaveLength(18);
    await expect(page.locator('.title-row')).toContainText('Mino Study 001');
    await expect(page.locator('.title-row')).toContainText('An editorial study by Mino');
    await expect(page.locator('.intro')).toHaveCount(0);
    await expectNoReferenceBranding(page);
  });

  test('settled sphere matches the audit placement table within 2 px', async ({ page }) => {
    await page.goto('/');
    for (const key of ['load1-1500', 'load1-6000'] as const) {
      const table = (placement as any)[key];
      await page.waitForFunction((t) => ((window as any).__mino.archive()?.scene?.snapshot().sinceExplode ?? 0) >= t, table.actualMs / 1000, { polling: 'raf', timeout: 30_000 });
      const s = await snap(page);
      for (const r of table.rows) {
        const m = s.planes[r.i];
        expect(Math.hypot(m.cx - (r.cx / 100) * 1440, m.cy - (r.cy / 100) * 900), `plane ${r.i} at ${key}`).toBeLessThan(2);
        expect(Math.abs(m.h - r.h)).toBeLessThan(1);
        expect(m.w / m.h).toBeCloseTo(0.75, 3);
      }
    }
  });

  test('nav: wordmark and pills are measured and the group re-centres per route', async ({ page }) => {
    await page.goto('/about');
    await page.waitForTimeout(1400); // nav drop-in: 1.2 s power4.out
    const measure = () => page.evaluate(() => (window as any).__mino.nav.pillRects());
    for (const [path, active] of [['/about', 1], ['/for-labels', 2], ['/', 0]] as const) {
      if (path !== '/about') { await page.locator(`.pill[href="${path}"]`).click(); await settled(page); await page.waitForTimeout(700); }
      const r = await measure();
      expect(r.logo.top).toBeCloseTo(11.7, 0);
      for (const p of r.pills) { expect(p.height).toBeCloseTo(27.4, 1); expect(p.top).toBe(8); }
      expect(r.pills[0].left - r.logo.right).toBeCloseTo(14, 0);
      expect(r.pills[1].left - r.pills[0].right).toBeCloseTo(4, 0);
      r.pills.forEach((p: any, i: number) => (i === active ? expect(p.width).toBeGreaterThan(40) : expect(p.width).toBeCloseTo(20.5, 0)));
      const center = (r.logo.left + r.pills[2].right) / 2;
      expect(Math.abs(center - 720)).toBeLessThan(1);
      await expect(page.locator(`.pill[aria-current="page"]`)).toHaveCount(1);
    }
  });

  test('hover reveals the title without moving the plane; leaving clears it after 200 ms', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    // Stop the ambient drift so the plane stays under the pointer.
    await page.mouse.move(100, 100);
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(2500);
    const t = await frontPlane(page);
    await page.mouse.move(t.cx, t.cy);
    await page.waitForTimeout(40);
    await expect(page.locator('.title-row').last()).not.toContainText('An editorial study by Mino', { timeout: 1000 });
    const after = (await snap(page)).planes[t.i];
    expect(Math.abs(after.h - t.h)).toBeLessThan(0.5);
    expect(Math.hypot(after.cx - t.cx, after.cy - t.cy)).toBeLessThan(1);
    await page.mouse.move(60, 450);
    await expect(page.locator('.title-row').last()).toContainText('An editorial study by Mino');
  });

  test('click expands to 472.5×630 centred; others vanish; cursor label; open slides up; Back keeps orientation', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    const t = await frontPlane(page);
    await page.mouse.move(t.cx, t.cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(460);
    let s = await snap(page);
    let e = s.planes.find((p) => p.id === s.expanded)!;
    expect(e.h).toBeGreaterThan(0.93 * 630); // ≈95 % by 0.46 s
    await page.waitForTimeout(500);
    s = await snap(page);
    e = s.planes.find((p) => p.id === s.expanded)!;
    expect(e.w).toBeCloseTo(472.5, 1);
    expect(e.h).toBeCloseTo(630, 1);
    expect(e.cx).toBeCloseTo(720, 1);
    expect(e.cy).toBeCloseTo(450, 1);
    expect(s.planes.filter((p) => p.id !== s.expanded).every((p) => p.opacity < 0.01)).toBe(true);
    await page.mouse.move(720, 400);
    await expect(page.locator('.cursor-label')).toHaveAttribute('data-label', 'Details'); // a click opens its story
    await page.mouse.move(1200, 400);
    await expect(page.locator('.cursor-label')).toHaveAttribute('data-label', 'Close'); // shown as Lucide’s X
    const qBefore = s.q;
    await page.mouse.move(720, 400);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('.track--y')).toHaveCount(1);
    await settled(page);
    await expect(page).toHaveURL(/\/archive\/[a-z-]+$/);
    expect(await page.evaluate(() => [document.querySelector('.pages')!.scrollTop, document.querySelector('.page--piece .page__scroll')!.scrollTop])).toEqual([0, 0]);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.head__sub')).toContainText('Mino Study 001');
    await page.goBack();
    await expect(page.locator('.track')).toHaveCount(0); // Back is instant
    await expect(page.locator('.page--archive')).toBeVisible();
    s = await snap(page);
    expect(s.phase).toBe('live');
    expect(s.expanded).toBeNull();
    expect(quatAngle(s.q, qBefore)).toBeLessThan(0.02);
    await expect(page.locator('.intro')).toHaveCount(0);
  });

  test('background click mid-expand reverses smoothly; Esc collapses', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    const t = await frontPlane(page);
    await page.mouse.click(t.cx, t.cy);
    await page.waitForTimeout(250);
    const mid = (await snap(page)).e;
    await page.mouse.click(1300, 120);
    await page.waitForTimeout(50);
    const s = await snap(page);
    expect(s.expanded).toBeNull();
    expect(s.e).toBeGreaterThan(0.3); // continues from where it was, no jump
    expect(s.e).toBeLessThanOrEqual(mid + 0.05);
    await page.waitForTimeout(1000);
    await page.mouse.click(t.cx, t.cy);
    await page.waitForTimeout(900);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    expect((await snap(page)).e).toBeLessThan(0.01);
  });

  test('drag rotates with inertia, a full swipe turns the sphere, ambient stops; horizontal wheel ignored', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    const q0 = (await snap(page)).q;
    await page.mouse.move(400, 800);
    await page.mouse.wheel(300, 0);
    await page.waitForTimeout(300);
    expect((await snap(page)).ambient).toBe(true);
    await page.mouse.move(500, 450);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(500 + i * 48, 450);
    await page.mouse.up();
    const atRelease = (await snap(page)).q;
    await page.waitForTimeout(400);
    const coasting = (await snap(page)).q;
    expect(quatAngle(atRelease, coasting)).toBeGreaterThan(0.2); // still moving after release
    await page.waitForTimeout(3200);
    const a = (await snap(page)).q;
    await page.waitForTimeout(500);
    const b = (await snap(page)).q;
    expect(quatAngle(a, b)).toBeLessThan(0.003); // stopped, and the ambient spin is off
    expect((await snap(page)).ambient).toBe(false);
    // 384 px of drag ≈ 0.0167 rad/px → ≈ one full turn (AUDIT §9.1): orientation returns near the start.
    expect(quatAngle(q0, b)).toBeLessThan(0.9);
  });

  test('wheel spins about the vertical axis with ~2.5 s of inertia', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await page.mouse.move(720, 450);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 100);
    const q1 = (await snap(page)).q;
    await page.waitForTimeout(700);
    const q2 = (await snap(page)).q;
    expect(quatAngle(q1, q2)).toBeGreaterThan(0.3);
    await page.waitForTimeout(3000);
    const q3 = (await snap(page)).q;
    await page.waitForTimeout(400);
    expect(quatAngle(q3, (await snap(page)).q)).toBeLessThan(0.003);
  });

  test('keyboard: piece list is reachable and opens a piece', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    const link = page.locator('.kb-list a').first();
    await link.focus();
    await expect(link).toBeVisible();
    await expect(page.locator('.title-row').last()).toContainText('Empty hanger');
    await page.keyboard.press('Enter');
    await settled(page);
    await expect(page).toHaveURL(/\/archive\/empty-hanger$/);
    await expect(page.locator('h1')).toBeFocused();
  });
});

test.describe('1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  test('expanded plane is 420×560', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    const t = await frontPlane(page);
    await page.mouse.click(t.cx, t.cy);
    await page.waitForTimeout(1100);
    const s = await snap(page);
    const e = s.planes.find((p) => p.id === s.expanded)!;
    expect(e.w).toBeCloseTo(420, 1);
    expect(e.h).toBeCloseTo(560, 1);
  });
});

for (const [name, vp, size] of [['tablet 768×1024', TABLET, [537.6, 716.8, 384, 512]], ['phone 390×844', PHONE, [374, 498.7, 195, 422]]] as const) {
  test.describe(`touch ${name}`, () => {
    test.use({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    test('tap expands, shows the title and "View piece"; tapping it opens the piece; Back returns', async ({ page }) => {
      await page.goto('/');
      await waitLive(page);
      await expect(page.locator('.title-action')).toBeHidden();
      await page.touchscreen.tap(vp.width / 2, 120); // empty space: nothing happens
      expect((await snap(page)).expanded).toBeNull();
      const t = await frontPlane(page);
      await page.touchscreen.tap(t.cx, t.cy);
      await page.waitForTimeout(1100);
      const s = await snap(page);
      const e = s.planes.find((p) => p.id === s.expanded)!;
      expect(e.w).toBeCloseTo(size[0], 0);
      expect(e.h).toBeCloseTo(size[1], 0);
      expect(e.cx).toBeCloseTo(size[2], 0);
      expect(e.cy).toBeCloseTo(size[3], 0);
      await expect(page.locator('.cursor-label')).toHaveCSS('opacity', '0');
      const action = page.locator('.title-action');
      await expect(action).toHaveText('View piece');
      await expect(action).toBeVisible();
      const box = (await action.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
      await action.tap();
      await settled(page);
      await expect(page).toHaveURL(/\/archive\//);
      await page.goBack();
      await expect(page.locator('.page--archive')).toBeVisible();
      expect((await snap(page)).expanded).toBeNull();
    });

    test('swipe rotates the sphere', async ({ page }) => {
      await page.goto('/');
      await waitLive(page);
      const q0 = (await snap(page)).q;
      const cdp = await page.context().newCDPSession(page);
      const pt = (x: number) => [{ x, y: vp.height / 2, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(vp.width * 0.3) });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(vp.width * 0.3 + i * 25) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(600);
      expect(quatAngle(q0, (await snap(page)).q)).toBeGreaterThan(0.5);
      expect((await snap(page)).expanded).toBeNull();
    });
  });
}
