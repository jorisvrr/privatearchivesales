// Mino Study 001 on the Archive: sphere, intro, captions, detail pages, keyboard list, fallback grid, weight.
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, settled, snap, waitLive } from './helpers';

const GROUP_PICKS = ['bomber-on-plaster', 'hem-over-boot', 'side-profile', 'mino-study-001', 'corduroy-swatch-card', 'tied-parcel'];
const NO_SHOP = /add to (cart|bag)|buy now|shop now|in stock|sold out|€|\$|£|price|join the waitlist|mailing list|subscribe/i;
// Old demo titles are matched case-sensitively: the contact-prints alt rightly mentions a “corduroy chore jacket”.
const OLD = /Featured label|Archive Sale 001|Chore jacket|Long coat|Poplin shirt|Ribbed jumper|Wide-leg trouser|Demo plate|[Ii]llustrat|Organized by/;
const text = (p: Page) => p.evaluate(() => document.title + '\n' + document.body.innerText + [...document.querySelectorAll('[alt],[aria-label]')].map((e) => ' ' + (e.getAttribute('alt') ?? '') + ' ' + (e.getAttribute('aria-label') ?? '')).join(''));

test.describe('desktop 1440×900', () => {
  test.use({ viewport: DESKTOP });

  test('first visit loads only the light textures; all 18 arrive; no old illustration is requested', async ({ page }) => {
    const reqs: { url: string; bytes: number }[] = [];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    const urls = new Map<string, string>();
    cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url));
    cdp.on('Network.loadingFinished', (e) => { const u = urls.get(e.requestId); if (u) reqs.push({ url: u, bytes: e.encodedDataLength }); });
    await page.goto('/');
    await waitLive(page);
    await page.waitForTimeout(800);
    const s = await snap(page);
    expect(s.planes.filter((p) => p.loaded)).toHaveLength(18);
    const imgs = reqs.filter((r) => /\.(webp|png|jpe?g)(\?|$)/.test(r.url));
    expect(imgs.every((r) => /study-001\/[a-z0-9-]+-s\.webp$/.test(new URL(r.url).pathname))).toBe(true);
    expect(new Set(imgs.map((r) => r.url)).size).toBe(18);
    expect(reqs.some((r) => /media\/demo|originals|\.png$/.test(r.url))).toBe(false);
    const total = imgs.reduce((a, r) => a + r.bytes, 0);
    console.log(`initial image transfer: ${(total / 1024).toFixed(0)} KB for ${imgs.length} textures`);
    expect(total).toBeLessThan(260 * 1024);
    // The ring used ten of these same planes: textures are reused, never fetched twice.
    expect(s.planes.filter((p) => p.ring >= 0)).toHaveLength(10);
  });

  test('one image from each group: hover caption, expand, close, details page, back', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    for (const id of GROUP_PICKS) {
      const s = await snap(page);
      const i = s.planes.find((p) => p.id === id)!.i;
      await page.evaluate((n) => (window as any).__mino.archive().scene.expandIndex(n), i);
      await page.waitForTimeout(900);
      const e = (await snap(page)).planes.find((p) => p.id === id)!;
      expect(e.h, id).toBeCloseTo(630, 0);
      const caption = await page.locator('.title-row').last().innerText();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
      expect((await snap(page)).expanded).toBeNull();
      await page.goto(`/archive/${id}`);
      await expect(page.locator('h1')).toHaveText(caption.split('\n')[0].trim());
      const hero = page.locator('.blocks--hero img');
      await expect(hero).toHaveAttribute('src', `/media/study-001/${id}-l.webp`);
      await expect.poll(() => hero.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0)).toBe(true);
      await expect(page.locator('.blocks:not(.blocks--hero) img')).toHaveCount(2);
      await page.getByRole('button', { name: 'Details' }).click();
      await expect(page.getByText('An AI-generated editorial study.')).toHaveCount(1);
      await expect(page.getByText('An editorial study by Mino').first()).toBeVisible();
      expect(await text(page)).not.toMatch(NO_SHOP);
      expect(await text(page)).not.toMatch(OLD);
      await page.goto('/');
      await waitLive(page);
    }
  });

  test('keyboard list: 18 links, caption and group, each to its own photograph', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    const links = await page.locator('.kb-list a').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), a.textContent]));
    expect(links).toHaveLength(18);
    expect(new Set(links.map((l) => l[0])).size).toBe(18);
    const target = page.locator('.kb-list a[href="/archive/brass-eyelets"]');
    await expect(target).toHaveText('Brass eyelets, Nubuck boots');
    await target.focus();
    await expect(page.locator('.title-row').last()).toContainText('Brass eyelets');
    await page.keyboard.press('Enter');
    await settled(page);
    await expect(page.locator('h1')).toHaveText('Brass eyelets');
    await expect(page.locator('.head__sub')).toHaveText('Nubuck boots · Mino Study 001');
  });

  test('old garment slugs redirect to the Archive', async ({ page, request }) => {
    for (const slug of ['chore-jacket', 'long-coat', 'poplin-shirt', 'ribbed-jumper', 'wide-leg-trouser']) {
      const r = await request.get(`/archive/${slug}`, { maxRedirects: 0 });
      expect(r.status(), slug).toBe(301);
      expect(r.headers().location, slug).toBe('/');
    }
    await page.goto('/archive/chore-jacket');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.page--archive')).toBeAttached();
  });

  test('Archive text: the study, never the old demo; no shopping', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await expect(page.locator('.title-row')).toContainText('Mino Study 001');
    await expect(page.locator('.title-row')).toContainText('An editorial study by Mino');
    expect(await text(page)).not.toMatch(OLD);
    expect(await text(page)).not.toMatch(NO_SHOP);
    await expect(page.locator('.demo-chip')).toHaveCount(0);
  });
});

for (const [name, vp, touch] of [['desktop', DESKTOP, false], ['phone', PHONE, true]] as const) {
  test.describe(`without WebGL — ${name}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
    test('the grid shows all 18 photographs with captions, sized for the grid', async ({ page }) => {
      await page.addInitScript(() => {
        const orig = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
          if (/webgl/.test(type)) return null;
          return (orig as any).call(this, type, ...rest);
        } as any;
      });
      await page.goto('/');
      const tiles = page.locator('.fallback .tile');
      await expect(tiles).toHaveCount(18);
      await expect(page.locator('.fallback__head')).toContainText('Mino Study 001');
      for (let i = 0; i < 18; i++) {
        const img = tiles.nth(i).locator('img');
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0)).toBe(true);
        expect(await img.evaluate((im: HTMLImageElement) => /-(m|l)\.webp$/.test(im.currentSrc))).toBe(true);
      }
      await expect(tiles.first().locator('.tile__title')).toHaveText('Empty hanger');
      await expect(tiles.first().locator('.tile__sub')).toHaveText('Packing');
    });
  });
}
