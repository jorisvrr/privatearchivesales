import { expect, test } from '@playwright/test';
import { DESKTOP, expectNoReferenceBranding, PHONE, settled, snap, waitLive } from './helpers';

const SUCCESS = 'Orvel will email you when booking opens.';
const NOJS_SUCCESS = 'You’re on Orvel’s list. We’ll email you when booking opens.';

test.describe('direct links and transitions', () => {
  test.use({ viewport: DESKTOP });

  test('/invitations opens with the form ready, no intro', async ({ page }) => {
    await page.goto('/invitations');
    await expect(page).toHaveTitle('Join the invitation list — Orvel');
    await expect(page.locator('#signup-email')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Join the invitation list' })).toBeVisible();
    await expect(page.getByText('The featured label invites past customers first. Join Orvel’s list for the second invitation.')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join the list' })).toBeVisible();
    await page.waitForTimeout(400);
    const panel = (await page.locator('.fp-panel').boundingBox())!;
    expect(panel.width).toBe(460);
    expect(panel.x).toBe(8);
    await expect(page.locator('.intro')).toHaveCount(0);
    await expectNoReferenceBranding(page);
  });

  test('/for-labels leads with the onboarding copy and three steps', async ({ page }) => {
    await page.goto('/for-labels');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Host a private archive sale.');
    await expect(page.getByText('You choose the pieces and approve the prices. Orvel organizes the invitations, bookings, and event.')).toBeVisible();
    for (const s of ['Stock review', 'Sale proposal', 'Final approval']) await expect(page.getByRole('heading', { name: s })).toBeAttached();
    await expectNoReferenceBranding(page);
  });

  test('piece page direct link, Details panel with Esc; unknown slug is a not-found page', async ({ page }) => {
    await page.goto('/archive/long-coat');
    await expect(page).toHaveTitle('Long coat — Featured label — Orvel');
    await expect(page.locator('.block img')).toHaveCount(3);
    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByText('To be confirmed by the label')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'false');
    await expectNoReferenceBranding(page);
    await page.goto('/archive/not-a-piece');
    await expect(page.locator('h1')).toHaveText('This page isn’t part of the sale.');
  });

  test('nav slides horizontally by route order; Back/Forward swap instantly', async ({ page }) => {
    await page.goto('/invitations');
    await page.locator('.pill[href="/for-labels"]').click();
    await expect(page.locator('.track--x')).toHaveCount(1);
    await page.waitForTimeout(700);
    const mid = await page.evaluate(() => getComputedStyle(document.querySelector('.track')!).transform);
    expect(mid).not.toBe('none');
    await settled(page);
    await expect(page).toHaveURL(/\/for-labels$/);
    await page.goBack();
    await expect(page.locator('.track')).toHaveCount(0);
    await expect(page).toHaveURL(/\/invitations$/);
    await expect(page.locator('#signup-email')).toBeVisible();
    await page.goForward();
    await expect(page.locator('.track')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Host a private archive sale.');
  });

  test('a nav click mid-slide cuts to a fresh slide', async ({ page }) => {
    await page.goto('/invitations');
    await page.locator('.pill[href="/for-labels"]').click();
    await page.waitForTimeout(500);
    await page.locator('.pill[href="/"]').click();
    await settled(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.page')).toHaveCount(1);
    await waitLive(page);
    // In-app arrival: no intro, settled sphere.
    await expect(page.locator('.intro')).toHaveCount(0);
  });
});

test.describe('invitation signup', () => {
  test.use({ viewport: DESKTOP });

  test('invalid, success, repeat signup', async ({ page }) => {
    await page.goto('/invitations');
    const email = page.getByLabel('Email address');
    await email.fill('not-an-email');
    await page.getByRole('button', { name: 'Join the list' }).click();
    await expect(page.locator('#signup-email-error')).toHaveText('Enter a valid email address, like name@example.com.');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(SUCCESS)).toHaveCount(0);
    const addr = `guest-${Date.now()}@example.com`;
    await email.fill(addr);
    await page.getByRole('button', { name: 'Join the list' }).click();
    await expect(page.getByText(SUCCESS)).toBeVisible();
    await page.reload();
    await page.getByLabel('Email address').fill(addr);
    await page.getByRole('button', { name: 'Join the list' }).click();
    await expect(page.locator('[data-alert]')).toHaveText('This address is already on Orvel’s list. We’ll email you when booking opens.');
    await expect(page.getByText(SUCCESS)).toHaveCount(0);
  });

  test('provider failure, missing configuration and network errors never show success', async ({ page }) => {
    await page.goto('/invitations');
    const email = page.getByLabel('Email address');
    const submit = page.getByRole('button', { name: 'Join the list' });
    await email.fill('fail@example.com');
    await submit.click();
    await expect(page.locator('[data-alert]')).toHaveText('Your address wasn’t added. Please try again in a moment.');
    await page.route('/api/subscribe', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"not_configured"}' }));
    await email.fill('someone@example.com');
    await submit.click();
    await expect(page.locator('[data-alert]')).toContainText('The invitation list isn’t open yet.');
    await page.unroute('/api/subscribe');
    await page.route('/api/subscribe', (r) => r.abort('internetdisconnected'));
    await submit.click();
    await expect(page.locator('[data-alert]')).toHaveText('Your address wasn’t added. Please try again in a moment.');
    await expect(email).toHaveValue('someone@example.com');
    await expect(page.getByText(SUCCESS)).toHaveCount(0);
  });

  test('keyboard only', async ({ page }) => {
    await page.goto('/invitations');
    await page.getByLabel('Email address').focus();
    await page.keyboard.type(`kb-${Date.now()}@example.com`);
    await page.keyboard.press('Enter');
    await expect(page.getByText(SUCCESS)).toBeVisible();
    await expect(page.locator('.fp-success')).toBeFocused();
    await expect(page.locator('.fp-success')).toContainText('You’re on the list');
  });
});

test.describe('label enquiry', () => {
  test.use({ viewport: DESKTOP });

  test('required fields, delivery failure, success', async ({ page }) => {
    await page.goto('/for-labels');
    await page.locator('.cta--lede').click();
    await expect(page.getByLabel('Label name')).toBeFocused();
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.locator('#enq-label-error')).toHaveText('Enter your label’s name.');
    await expect(page.getByLabel('Label name')).toBeFocused();
    await page.getByLabel('Label name').fill('Fail Studio');
    await page.getByLabel('Contact email').fill('founder@example.com');
    await page.getByLabel('City', { exact: true }).fill('Rotterdam');
    await page.getByLabel('Approximate quantity').selectOption('50 to 150 pieces');
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.locator('[data-alert]')).toHaveText('Your enquiry wasn’t sent. Please try again in a moment.');
    await page.getByLabel('Label name').fill('Studio North');
    await page.getByLabel('Note (optional)').fill('Mostly outerwear from 2019–2022.');
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.getByText('Thank you. Orvel has received your enquiry and will reply by email to arrange the stock review.')).toBeVisible();
  });
});

test.describe('phone 390×844', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  test('invitation form is an inset bottom sheet', async ({ page }) => {
    await page.goto('/invitations');
    await page.waitForTimeout(1500);
    const b = (await page.locator('.fp-panel').boundingBox())!;
    expect(b.x).toBe(0);
    expect(b.width).toBe(390);
    expect(b.y + b.height).toBeCloseTo(844, 0);
    await expect(page.getByLabel('Email address')).toBeInViewport();
  });

  test('nav fits and pills are tappable', async ({ page }) => {
    await page.goto('/for-labels');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => (window as any).__orvel.nav.pillRects());
    expect(r.logo.left).toBeGreaterThan(16);
    expect(r.pills[2].right).toBeLessThan(390 - 60);
    await page.locator('.pill[href="/invitations"]').tap();
    await settled(page);
    await expect(page).toHaveURL(/\/invitations$/);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });
  test('no intro, no slides, still fully usable', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await expect(page.locator('.intro')).toHaveCount(0);
    await expect(page.locator('.nav')).toBeVisible();
    const a = (await snap(page)).q;
    await page.waitForTimeout(600);
    expect((await snap(page)).q).toEqual(a); // no ambient drift
    await page.locator('.pill[href="/invitations"]').click();
    await expect(page.locator('.track')).toHaveCount(0);
    await expect(page.getByLabel('Email address')).toBeVisible();
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
    await expect(page.locator('.nav')).toBeVisible();
    await page.locator('.fallback .tile a').nth(1).click();
    await settled(page);
    await expect(page).toHaveURL(/\/archive\/long-coat/);
    await page.locator('.pill[href="/invitations"]').click();
    await settled(page);
    await expect(page.getByLabel('Email address')).toBeVisible();
  });
});

test.describe('no JavaScript', () => {
  test.use({ viewport: DESKTOP, javaScriptEnabled: false });
  test('both native forms post and get an answer page', async ({ page }) => {
    await page.goto('/invitations');
    await page.locator('#ns-email').fill(`nojs-${Date.now()}@example.com`);
    await page.locator('.noscript form').first().getByRole('button').click();
    await expect(page.getByText(NOJS_SUCCESS)).toBeVisible();
  });
});
