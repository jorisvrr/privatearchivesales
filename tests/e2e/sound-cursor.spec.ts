// Intro sound, the sound control, and the cursor labels.
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, frontPlane, PHONE, settled, snap, waitLive } from './helpers';

type LogEntry = { cue: 'paper' | 'fabric' | 'click'; result: string };
const log = (p: Page): Promise<LogEntry[]> => p.evaluate(() => (window as any).__mino.sound.log.map((l: any) => ({ cue: l.cue, result: l.result })));
const played = async (p: Page) => (await log(p)).filter((l) => l.result === 'played').map((l) => l.cue);
const phase = (p: Page, name: string) => p.waitForFunction((n) => (window as any).__mino?.archive()?.scene?.snapshot().phase === n, name, { timeout: 30_000, polling: 50 });
const logged = (p: Page, cue: string) => p.waitForFunction((c) => (window as any).__mino.sound.log.some((l: any) => l.cue === c), cue, { timeout: 30_000, polling: 20 });
const label = (p: Page) => p.locator('.cursor-label').getAttribute('data-label');
const toggle = (p: Page) => p.locator('.sound-toggle');

/** Wakes the prompt by moving inside the intro, then clicks there. */
async function clickPrompt(p: Page, x = 600, y = 330) {
  await p.mouse.move(x - 40, y - 30, { steps: 3 });
  await p.mouse.move(x, y, { steps: 3 });
  await expect(p.locator('.audio-prompt')).toHaveAttribute('data-visible', 'true');
  await p.mouse.click(x, y);
}

/** A point near the centre that is not over any plane. */
async function emptySpot(p: Page) {
  const s = await snap(p);
  for (let r = 60; r < 240; r += 15) for (let a = 0; a < 6.28; a += 0.25) {
    const x = 720 + r * Math.cos(a);
    const y = 450 + r * Math.sin(a);
    if (!s.planes.some((q) => q.visible && Math.abs(q.cx - x) < q.w / 2 + 14 && Math.abs(q.cy - y) < q.h / 2 + 14)) return { x, y };
  }
  throw new Error('no empty spot');
}

test.describe('desktop 1440×900: the intro and sound', () => {
  test.use({ viewport: DESKTOP });

  test('fresh visit is muted; the prompt follows the pointer; doing nothing ends silently and the prompt goes', async ({ page }) => {
    await page.goto('/');
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound on');
    await expect(toggle(page).locator('svg.lucide-volume-x')).toHaveCount(1);
    await phase(page, 'ring');
    await page.mouse.move(500, 300, { steps: 4 });
    await page.mouse.move(560, 340, { steps: 4 });
    const prompt = page.locator('.audio-prompt');
    await expect(prompt).toHaveAttribute('data-visible', 'true');
    await expect(prompt).toContainText('Click to enable audio');
    await expect(prompt.locator('svg.lucide-volume-2')).toHaveCount(1);
    await page.waitForTimeout(900); // lag settles at +14 px
    const box = (await prompt.boundingBox())!;
    expect(Math.abs(box.x - 574)).toBeLessThan(2);
    expect(Math.abs(box.y - 354)).toBeLessThan(2);
    await waitLive(page);
    await expect(page.locator('.audio-prompt')).toHaveCount(0, { timeout: 2000 });
    await expect(page.locator('.audio-layer')).toHaveCount(0);
    expect(await played(page)).toEqual([]);
    expect((await log(page)).map((l) => `${l.cue}:${l.result}`)).toEqual(['paper:muted', 'fabric:muted']);
    expect(await page.evaluate(() => (window as any).__mino.sound.enabled)).toBe(false);
  });

  test('enabling early plays both intro cues once; the toggle updates at once', async ({ page }) => {
    await page.goto('/');
    await phase(page, 'ring');
    await clickPrompt(page);
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound off');
    await expect(toggle(page).locator('svg.lucide-volume-2')).toHaveCount(1);
    await expect(page.locator('.audio-prompt')).toHaveCount(0, { timeout: 1500 });
    await waitLive(page);
    expect(await played(page)).toEqual(['paper', 'fabric']);
  });

  test('enabling between the stack and the reveal plays only the cue that follows', async ({ page }) => {
    await page.goto('/');
    await logged(page, 'paper'); // the stack has met, still muted
    await clickPrompt(page);
    await waitLive(page);
    expect((await log(page)).map((l) => `${l.cue}:${l.result}`)).toEqual(['paper:muted', 'fabric:played']);
  });

  test('a click as the intro ends enables audio and does nothing else, even over an image', async ({ page }) => {
    await page.goto('/');
    await phase(page, 'explode');
    await page.mouse.move(700, 430, { steps: 3 });
    await page.mouse.move(720, 450, { steps: 3 });
    await waitLive(page);
    // The prompt is fading; the pointer is over the sphere where pieces are. This click only enables audio.
    const t = await frontPlane(page);
    await page.mouse.move(t.cx, t.cy, { steps: 2 });
    await page.mouse.click(t.cx, t.cy);
    expect(await page.evaluate(() => (window as any).__mino.sound.enabled)).toBe(true);
    await page.waitForTimeout(900);
    expect((await snap(page)).expanded).toBeNull();
    expect(await played(page)).toEqual([]); // both intro cues had already passed
    // The next click opens the piece, with the click cue.
    const t2 = await frontPlane(page);
    await page.mouse.click(t2.cx, t2.cy);
    await page.waitForTimeout(300);
    expect((await snap(page)).expanded).not.toBeNull();
    expect(await played(page)).toEqual(['click']);
  });

  test('missed cues are skipped, not played late, and the intro still completes', async ({ page }) => {
    await page.route('**/media/sound/**', (r) => r.abort());
    await page.goto('/');
    await phase(page, 'ring');
    await clickPrompt(page);
    await waitLive(page);
    expect((await log(page)).map((l) => `${l.cue}:${l.result}`)).toEqual(['paper:not-loaded', 'fabric:not-loaded']);
  });
});

test.describe('desktop 1440×900: after the intro', () => {
  test.use({ viewport: DESKTOP });

  test('toggle after the intro, open and close a piece, rapid mute/unmute, keyboard', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await page.waitForTimeout(700);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound off');
    const t = await frontPlane(page);
    await page.mouse.click(t.cx, t.cy);
    await page.waitForTimeout(900);
    await page.mouse.click(1300, 150); // collapse
    await page.waitForTimeout(900);
    expect(await played(page)).toEqual(['click']); // collapsing is silent
    for (let i = 0; i < 7; i++) await toggle(page).click(); // odd count: ends muted
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound on');
    expect(await page.evaluate(() => (window as any).__mino.sound.enabled)).toBe(false);
    const t2 = await frontPlane(page);
    await page.mouse.click(t2.cx, t2.cy);
    await page.waitForTimeout(300);
    expect(await played(page)).toEqual(['click']); // muted: no new click
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound off');
    await page.keyboard.press('Space');
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound on');
    const b = (await toggle(page).boundingBox())!;
    expect([b.width, b.height]).toEqual([44, 44]);
  });

  test('navigating away and back: choice kept, no repeated cues, one label, no stale prompt', async ({ page }) => {
    await page.goto('/');
    await phase(page, 'ring');
    await clickPrompt(page);
    await waitLive(page);
    const before = (await log(page)).length;
    for (const href of ['/about', '/', '/for-labels', '/']) {
      await page.locator(`.pill[href="${href}"]`).click();
      await page.waitForTimeout(150); // mid-transition
    }
    await settled(page);
    await page.goBack();
    await page.goForward();
    await waitLive(page);
    await page.waitForTimeout(500);
    expect((await log(page)).length).toBe(before);
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound off');
    await expect(page.locator('.cursor-label')).toHaveCount(1);
    await expect(page.locator('.audio-prompt, .audio-layer')).toHaveCount(0);
  });

  test('cursor labels name the next click: Drag, View, Details, Close; hidden while dragging and over controls', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await page.waitForTimeout(700);
    await page.mouse.wheel(0, 1); // stop the drift so targets hold still
    await page.waitForTimeout(2600);
    const spot = await emptySpot(page);
    await page.mouse.move(spot.x, spot.y, { steps: 3 });
    await expect.poll(() => label(page)).toBe('Drag');
    const t = await frontPlane(page);
    await page.mouse.move(t.cx, t.cy, { steps: 3 });
    await expect.poll(() => label(page)).toBe('View');
    // Drag begins → label hides.
    await page.mouse.move(spot.x, spot.y, { steps: 2 });
    await page.mouse.down();
    await page.mouse.move(spot.x + 40, spot.y, { steps: 4 });
    await expect.poll(() => label(page)).toBe('');
    await page.mouse.up();
    await page.waitForTimeout(3000);
    const t2 = await frontPlane(page);
    await page.mouse.click(t2.cx, t2.cy);
    await page.waitForTimeout(900);
    await page.mouse.move(720, 450, { steps: 3 });
    await expect.poll(() => label(page)).toBe('Details');
    await page.mouse.move(1250, 450, { steps: 3 });
    await expect.poll(() => label(page)).toBe('Close');
    await expect(page.locator('.cursor-label svg.lucide-x')).toHaveCount(1);
    // The label sits beside the pointer, and flips near the edges.
    await page.waitForTimeout(800);
    let b = (await page.locator('.cursor-label').boundingBox())!;
    expect(b.x).toBeGreaterThan(1250);
    expect(b.y).toBeGreaterThan(450);
    await page.mouse.move(1425, 885, { steps: 4 });
    await page.waitForTimeout(800);
    b = (await page.locator('.cursor-label').boundingBox())!;
    expect(b.x + b.width).toBeLessThan(1425);
    expect(b.y + b.height).toBeLessThan(885);
    // Over the nav and the sound control: no label.
    await page.mouse.move(720, 20, { steps: 4 });
    await expect.poll(() => label(page)).toBe('');
    const tb = (await toggle(page).boundingBox())!;
    await page.mouse.move(tb.x + 22, tb.y + 22, { steps: 4 });
    await expect.poll(() => label(page)).toBe('');
    // A click on "Details" opens the story.
    await page.mouse.move(720, 450, { steps: 3 });
    await page.mouse.click(720, 450);
    await settled(page);
    await expect(page).toHaveURL(/\/archive\//);
  });

  test('the enquiry popup closes with Lucide’s X', async ({ page }) => {
    await page.goto('/for-labels');
    await page.getByRole('button', { name: 'Plan an archive sale' }).click();
    await expect(page.getByRole('button', { name: 'Close' }).locator('svg.lucide-x')).toHaveCount(1);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });
  test('the cursor label has no lag; no intro prompt', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await expect(page.locator('.audio-prompt')).toHaveCount(0);
    const spot = await emptySpot(page);
    await page.mouse.move(spot.x, spot.y);
    await expect.poll(() => label(page)).toBe('Drag');
    await page.mouse.move(spot.x + 6, spot.y + 4);
    await page.waitForTimeout(60);
    const b = (await page.locator('.cursor-label').boundingBox())!;
    expect(Math.abs(b.x - (spot.x + 6 + 14))).toBeLessThan(1.5);
    expect(Math.abs(b.y - (spot.y + 4 + 14))).toBeLessThan(1.5);
  });
});

test.describe('touch 390×844', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  test('no prompt or cursor labels; the sound button works directly and clears the nav', async ({ page }) => {
    await page.goto('/');
    await phase(page, 'ring');
    await page.touchscreen.tap(195, 300);
    await expect(page.locator('.audio-prompt, .audio-layer')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__mino.sound.enabled)).toBe(false);
    await waitLive(page);
    await toggle(page).tap();
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Turn sound off');
    const t = await frontPlane(page);
    await page.touchscreen.tap(t.cx, t.cy);
    await page.waitForTimeout(400);
    expect(await played(page)).toEqual(['click']);
    expect(await label(page)).toBeFalsy();
    const tb = (await toggle(page).boundingBox())!;
    const nav = await page.evaluate(() => (window as any).__mino.nav.pillRects());
    expect(tb.x).toBeGreaterThan(nav.pills[2].right);
  });
});
