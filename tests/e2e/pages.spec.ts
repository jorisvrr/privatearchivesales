import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, expectNoReferenceBranding, PHONE, settled, snap, waitLive } from './helpers';

const SUBSCRIBED = /You’re on the list\.\s*We’ll email you when the next archive opens\./;
const ENQUIRED = 'Thanks. Orvel will follow up personally about stock, timing and terms.';
const OUTDATED = /booking|book a place|arrival|venue|in person|in-person|place at the sale|date and city|reserve/i;

async function visibleText(page: Page) {
  return page.evaluate(() => document.title + '\n' + document.body.innerText);
}

for (const [label, vp, touch] of [['1440×900', DESKTOP, false], ['390×844', PHONE, true]] as const) {
  test.describe(`first screen ${label}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch });

    test('About: headline, body and the one CTA above the fold; the CTA opens the form', async ({ page }) => {
      await page.goto('/about');
      await expect(page).toHaveTitle('About — Orvel');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private archive sales for independent labels.');
      await expect(page.getByText('Orvel works with independent labels to bring past collections and samples back for a limited sale. Each archive opens on the label’s own website. The label invites its past customers first, then Orvel sends the second invitation to its mailing list.')).toBeVisible();
      const cta = page.getByRole('button', { name: 'Join the mailing list' });
      await expect(cta).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.cta')).toHaveCount(1);
      await expect(page.locator('.fp-trigger:visible')).toHaveCount(0);
      const colors = await cta.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
      expect(colors).toEqual(['rgb(10, 10, 10)', 'rgb(255, 255, 255)']);
      await cta.click();
      await expect(page.getByRole('dialog', { name: 'Join the mailing list' })).toBeVisible();
      await expect(page.getByLabel('Email address')).toBeVisible();
      expect(await visibleText(page)).not.toMatch(OUTDATED);
    });

    test('For labels: offer, pricing line directly above the CTA, CTA opens the email-only enquiry', async ({ page }) => {
      await page.goto('/for-labels');
      await expect(page).toHaveTitle('For labels — Orvel');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open your archive on your own site.');
      await expect(page.getByText('Give past collections and samples a dedicated sale on the website your customers already know. You choose the pieces and approve the prices. Orvel builds the page, coordinates the invitations, and removes the page when the drop ends.')).toBeVisible();
      const price = page.getByText('A small upfront fee covers setup. Orvel then earns a percentage of sales made through the archive event.');
      const cta = page.getByRole('button', { name: 'Plan an archive sale' });
      await expect(price).toBeInViewport({ ratio: 1 });
      await expect(cta).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.querySelector('.lede__price')!.nextElementSibling!.classList.contains('cta'))).toBe(true);
      await expect(page.locator('.cta')).toHaveCount(1);
      for (const step of ['Select the archive', 'Open the page', 'Close the sale']) await expect(page.getByRole('heading', { name: step })).toBeAttached();
      const text = await visibleText(page);
      expect(text).not.toMatch(/\d\s?%|€|\$|£|\bpercent\b/i); // no exact fees or percentages
      expect(text).not.toMatch(OUTDATED);
      await cta.click();
      const dialog = page.getByRole('dialog', { name: 'Plan an archive sale' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox')).toHaveCount(1);
      await expect(page.getByLabel('Work email')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Contact Orvel' })).toBeVisible();
      await expect(dialog.locator('select, textarea')).toHaveCount(0);
    });

    test('nav: Archive · About · For labels, centred', async ({ page }) => {
      await page.goto('/for-labels');
      await page.waitForTimeout(1500);
      await expect(page.locator('.pill')).toHaveText(['Archive1', 'About2', 'For labels3']);
      await expect(page.locator('.pill[aria-current="page"]')).toHaveAttribute('href', '/for-labels');
      const r = await page.evaluate(() => (window as any).__orvel.nav.pillRects());
      const center = (r.logo.left + r.pills[2].right) / 2;
      expect(Math.abs(center - vp.width / 2)).toBeLessThan(1);
      expect(r.logo.left).toBeGreaterThan(8);
      await page.locator('.pill[href="/about"]').click();
      await settled(page);
      await page.waitForTimeout(700);
      const r2 = await page.evaluate(() => (window as any).__orvel.nav.pillRects());
      expect(Math.abs((r2.logo.left + r2.pills[2].right) / 2 - vp.width / 2)).toBeLessThan(1);
      await expect(page).toHaveURL(/\/about$/);
    });
  });
}

test.describe('routes', () => {
  test.use({ viewport: DESKTOP });

  test('/invitations is permanently redirected to /about', async ({ page, request }) => {
    const res = await request.get('/invitations', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toBe('/about');
    await page.goto('/invitations');
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private archive sales for independent labels.');
  });

  test('no in-site link points at /invitations', async ({ page }) => {
    for (const path of ['/', '/about', '/for-labels', '/archive/chore-jacket']) {
      await page.goto(path);
      await page.waitForTimeout(400);
      expect(await page.locator('a[href*="invitations"]').count(), path).toBe(0);
    }
  });

  test('piece page: no in-person claims; links to the mailing list', async ({ page }) => {
    await page.goto('/archive/long-coat');
    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByText('Sold on the label’s own website while its archive is open.')).toBeVisible();
    expect(await visibleText(page)).not.toMatch(OUTDATED);
    await page.getByRole('link', { name: 'Join the mailing list' }).click();
    await settled(page);
    await expect(page).toHaveURL(/\/about$/);
    await expectNoReferenceBranding(page);
  });

  test('Back/Forward swap instantly; a click mid-slide cuts to a fresh slide', async ({ page }) => {
    await page.goto('/about');
    await page.locator('.pill[href="/for-labels"]').click();
    await expect(page.locator('.track--x')).toHaveCount(1);
    await settled(page);
    await page.goBack();
    await expect(page.locator('.track')).toHaveCount(0);
    await expect(page).toHaveURL(/\/about$/);
    await page.goForward();
    await expect(page.locator('.track')).toHaveCount(0);
    await page.locator('.pill[href="/about"]').click();
    await page.waitForTimeout(400);
    await page.locator('.pill[href="/"]').click();
    await settled(page);
    await expect(page.locator('.page')).toHaveCount(1);
    await waitLive(page);
    await expect(page.locator('.intro')).toHaveCount(0);
  });
});

test.describe('mailing list form', () => {
  test.use({ viewport: DESKTOP });

  test('validation, success, repeat signup', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'Join the mailing list' }).click();
    const email = page.getByLabel('Email address');
    const submit = page.getByRole('button', { name: 'Join the list' });
    await submit.click();
    await expect(page.locator('#signup-email-error')).toHaveText('Enter your email address.');
    await email.fill('not-an-email');
    await submit.click();
    await expect(page.locator('#signup-email-error')).toHaveText('Enter a valid email address, like name@example.com.');
    await expect(page.locator('.fp-success')).toHaveCount(0);
    const addr = `guest-${Date.now()}@example.com`;
    await email.fill(addr);
    await submit.click();
    await expect(page.locator('.fp-success')).toHaveText(SUBSCRIBED);
    await page.reload();
    await page.getByRole('button', { name: 'Join the mailing list' }).click();
    await page.getByLabel('Email address').fill(addr);
    await page.getByRole('button', { name: 'Join the list' }).click();
    await expect(page.locator('[data-alert]')).toHaveText('This address is already on Orvel’s list. We’ll email you when the next archive opens.');
    await expect(page.locator('.fp-success')).toHaveCount(0);
  });

  test('provider failure, missing configuration and network errors keep the email and never show success', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'Join the mailing list' }).click();
    const email = page.getByLabel('Email address');
    const submit = page.getByRole('button', { name: 'Join the list' });
    await email.fill('fail@example.com');
    await submit.click();
    await expect(page.locator('[data-alert]')).toHaveText('Your address wasn’t added. Please try again in a moment.');
    await expect(email).toHaveValue('fail@example.com');
    await page.route('**/api/subscribe', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"not_configured"}' }));
    await email.fill('someone@example.com');
    await submit.click();
    await expect(page.locator('[data-alert]')).toContainText('The mailing list isn’t open yet.');
    await page.unroute('**/api/subscribe');
    await page.route('**/api/subscribe', (r) => r.abort('internetdisconnected'));
    await submit.click();
    await expect(page.locator('[data-alert]')).toHaveText('Your address wasn’t added. Please try again in a moment.');
    await expect(email).toHaveValue('someone@example.com');
    await expect(page.locator('.fp-success')).toHaveCount(0);
  });
});

test.describe('archive-sale enquiry', () => {
  test.use({ viewport: DESKTOP });

  test('email only, sent to /api/enquiry (not the mailing list); validation, failure keeps the email, success', async ({ page }) => {
    await page.goto('/for-labels');
    await page.getByRole('button', { name: 'Plan an archive sale' }).click();
    const email = page.getByLabel('Work email');
    await expect(email).toBeFocused();
    const submit = page.getByRole('button', { name: 'Contact Orvel' });
    await submit.click();
    await expect(page.locator('#enq-email-error')).toHaveText('Enter your work email.');
    await email.fill('founder@');
    await submit.click();
    await expect(page.locator('#enq-email-error')).toHaveText('Enter a valid email address, like name@example.com.');
    await email.fill('fail@studio.example');
    await submit.click();
    await expect(page.locator('[data-alert]')).toHaveText('Your enquiry wasn’t sent. Please try again in a moment.');
    await expect(email).toHaveValue('fail@studio.example');
    await expect(page.getByText(ENQUIRED)).toHaveCount(0);
    const sent: { url: string; body: Record<string, string> }[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/')) sent.push({ url: new URL(r.url()).pathname, body: JSON.parse(r.postData() ?? '{}') }); });
    await email.fill('founder@studio.example');
    await submit.click();
    await expect(page.getByText(ENQUIRED)).toBeVisible();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/enquiry');
    expect(Object.keys(sent[0].body).sort()).toEqual(['email', 'website']); // website = empty honeypot
  });
});

test.describe('phone 390×844', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  test('mailing list form is a bottom sheet', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'Join the mailing list' }).tap();
    await page.waitForTimeout(400);
    const b = (await page.locator('.fp-panel').boundingBox())!;
    expect(b.x).toBe(0);
    expect(b.width).toBe(390);
    expect(b.y + b.height).toBeCloseTo(844, 0);
    await expect(page.getByLabel('Email address')).toBeInViewport();
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });
  test('no intro, no slides, still fully usable', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await expect(page.locator('.intro')).toHaveCount(0);
    const a = (await snap(page)).q;
    await page.waitForTimeout(600);
    expect((await snap(page)).q).toEqual(a);
    await page.locator('.pill[href="/about"]').click();
    await expect(page.locator('.track')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Join the mailing list' })).toBeVisible();
  });
});

test.describe('without WebGL', () => {
  test.use({ viewport: DESKTOP });
  test('Archive falls back to a grid of pieces with working links', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
        if (/webgl/.test(type)) return null;
        return (orig as any).call(this, type, ...rest);
      } as any;
    });
    await page.goto('/');
    await expect(page.locator('.fallback .tile')).toHaveCount(18);
    await page.locator('.fallback .tile a').nth(1).click();
    await settled(page);
    await expect(page).toHaveURL(/\/archive\/long-coat/);
    await page.locator('.pill[href="/about"]').click();
    await settled(page);
    await expect(page.getByRole('button', { name: 'Join the mailing list' })).toBeVisible();
  });
});

test.describe('no JavaScript', () => {
  test.use({ viewport: DESKTOP, javaScriptEnabled: false });
  test('both native forms post and get an answer page', async ({ page }) => {
    await page.goto('/about');
    await page.locator('#ns-email').fill(`nojs-${Date.now()}@example.com`);
    await page.locator('.noscript form').first().getByRole('button').click();
    await expect(page.getByText('You’re on the list. We’ll email you when the next archive opens.')).toBeVisible();
    await page.goto('/for-labels');
    await page.locator('#ns-work').fill('founder@studio.example');
    await page.locator('.noscript form').nth(1).getByRole('button').click();
    await expect(page.getByText(ENQUIRED)).toBeVisible();
  });
});
