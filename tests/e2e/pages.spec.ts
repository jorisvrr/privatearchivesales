import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, expectNoReferenceBranding, PHONE, settled, snap, waitLive } from './helpers';

const VERIFIED = 'Your order is verified. We’ll email you when first access opens.';
const PUBLIC = 'You’re on the waitlist. We’ll email you when the second round opens.';
const ENQUIRED = 'Thanks. Mino will follow up personally about stock, timing and terms.';
const DROP = 'demo-archive-001';
const OUTDATED = /booking|book a place|arrival|venue|in person|in-person|place at the sale|date and city|reserve|mailing list|Orvel/i;
const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

const visibleText = (page: Page) => page.evaluate(() => document.title + '\n' + document.body.innerText);
/** Reads the local mock waitlist (tests only) to check which drop and label an entry belongs to. */
const entriesFor = async (page: Page, email: string) => {
  const res = await page.request.get('/api/waitlist?inspect=1');
  return ((await res.json()).entries as { drop: string; label: string; email: string; round: number }[]).filter((e) => e.email === email);
};
async function openWaitlist(page: Page) {
  await page.goto(`/waitlist/${DROP}`);
  await expect(page.getByRole('dialog', { name: 'Join the Featured label archive waitlist' })).toBeVisible();
}

for (const [label, vp, touch] of [['1440×900', DESKTOP, false], ['390×844', PHONE, true]] as const) {
  test.describe(`first screen ${label}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch });

    test('About: new copy; demo CTA “Preview the waitlist” above the fold, linking to the drop page', async ({ page }) => {
      await page.goto('/about');
      await expect(page).toHaveTitle('About — Mino');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private archive sales for independent labels.');
      await expect(page.getByText('Mino helps independent labels open their archives for a limited time. Each label shares a waitlist link for its sale. Bought from the label before? Verify a previous order for first access. Everyone else on the waitlist receives the second invitation.')).toBeVisible();
      const cta = page.getByRole('link', { name: 'Preview the waitlist' });
      await expect(cta).toBeInViewport({ ratio: 1 });
      await expect(cta).toHaveAttribute('href', `/waitlist/${DROP}`);
      await expect(page.locator('.cta')).toHaveCount(1);
      expect(await visibleText(page)).not.toMatch(OUTDATED);
      await cta.click();
      await settled(page);
      await expect(page).toHaveURL(new RegExp(`/waitlist/${DROP}$`));
      await expect(page.getByRole('dialog', { name: 'Join the Featured label archive waitlist' })).toBeVisible();
    });

    test('For labels: the one-sentence offer, pricing above the CTA, email-only enquiry', async ({ page }) => {
      await page.goto('/for-labels');
      await expect(page).toHaveTitle('For labels — Mino');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Open your archive on your own site.');
      await expect(page.getByText('Mino builds the archive page on your website. You share one waitlist link, your verified customers shop first, and the rest of your waitlist follows.')).toBeVisible();
      const cta = page.getByRole('button', { name: 'Plan an archive sale' });
      await expect(page.getByText('A small upfront fee covers setup. Mino then earns a percentage of sales made through the archive event.')).toBeInViewport({ ratio: 1 });
      await expect(cta).toBeInViewport({ ratio: 1 });
      for (const step of ['Select the archive', 'Share one link', 'Open in two rounds']) await expect(page.getByRole('heading', { name: step })).toBeAttached();
      const text = await visibleText(page);
      expect(text).not.toMatch(/\d\s?%|€|\$|£|\bpercent\b/i);
      expect(text).not.toMatch(OUTDATED);
      await cta.click();
      const dialog = page.getByRole('dialog', { name: 'Plan an archive sale' });
      await expect(dialog.getByRole('textbox')).toHaveCount(1);
      await expect(dialog.getByRole('button', { name: 'Contact Mino' })).toBeVisible();
    });

    test('drop page: heading, email, disclosure and button; the form fits the screen', async ({ page }) => {
      await openWaitlist(page);
      await expect(page).toHaveTitle('Join the Featured label archive waitlist — Mino');
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByText('Bought from Featured label before? Get first access.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Join the waitlist' })).toBeInViewport();
      expect(await visibleText(page)).not.toMatch(OUTDATED);
    });

    test('nav: Archive · About · For labels, centred, with the Mino wordmark', async ({ page }) => {
      await page.goto('/for-labels');
      await page.waitForTimeout(1500);
      await expect(page.locator('.logo')).toHaveText('Mino');
      await expect(page.locator('.pill')).toHaveText(['Archive1', 'About2', 'For labels3']);
      const r = await page.evaluate(() => (window as any).__mino.nav.pillRects());
      expect(Math.abs((r.logo.left + r.pills[2].right) / 2 - vp.width / 2)).toBeLessThan(1);
    });
  });
}

test.describe('waitlist signup paths (drop demo-archive-001, mock order records)', () => {
  test.use({ viewport: DESKTOP });

  test('public signup → round 2 for this drop and label; a repeat is not a second entry', async ({ page }) => {
    await openWaitlist(page);
    const email = uniq('public');
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(page.locator('#wl-email-error')).toHaveText('Enter your email address.');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(page.locator('.fp-success')).toHaveText(PUBLIC);
    await expect(page.getByText(VERIFIED)).toHaveCount(0);
    expect(await entriesFor(page, email)).toEqual([{ drop: DROP, label: 'Featured label', email, round: 2 }]);
    await openWaitlist(page);
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(page.locator('[data-alert]')).toHaveText('This email is already on the waitlist. We’ll email you when the second round opens.');
    expect(await entriesFor(page, email)).toHaveLength(1);
  });

  test('verified past customer → round 1 with the verified confirmation', async ({ page }) => {
    await openWaitlist(page);
    await page.getByLabel('Email address').fill('past@customer.example');
    await page.getByText('Bought from Featured label before? Get first access.').click();
    await page.getByLabel('Order number').fill('#1001');
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(page.locator('.fp-success')).toHaveText(VERIFIED);
    expect(await entriesFor(page, 'past@customer.example')).toEqual([{ drop: DROP, label: 'Featured label', email: 'past@customer.example', round: 1 }]);
  });

  test('public first, then verified → the same entry is upgraded to round 1', async ({ page }) => {
    await openWaitlist(page);
    await page.getByLabel('Email address').fill('second@customer.example');
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(page.locator('.fp-success')).toBeVisible(); // public, or verified if a previous run upgraded it
    await openWaitlist(page);
    await page.getByLabel('Email address').fill('second@customer.example');
    await page.getByText('Bought from Featured label before? Get first access.').click();
    await page.getByLabel('Order number').fill('1002');
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(page.locator('.fp-success')).toHaveText(VERIFIED);
    expect(await entriesFor(page, 'second@customer.example')).toEqual([{ drop: DROP, label: 'Featured label', email: 'second@customer.example', round: 1 }]);
  });

  test('no match: details stay editable; “email only” joins round 2 — never a verified state', async ({ page }) => {
    await openWaitlist(page);
    const email = uniq('nomatch');
    await page.getByLabel('Email address').fill(email);
    await page.getByText('Bought from Featured label before? Get first access.').click();
    await page.getByLabel('Order number').fill('9999');
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    const alert = page.locator('[data-alert]');
    await expect(alert).toContainText('We couldn’t match that order number to this email address.');
    await expect(page.getByLabel('Order number')).toBeFocused();
    await expect(page.getByLabel('Order number')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Email address')).toHaveValue(email);
    expect(await entriesFor(page, email)).toEqual([]);
    await alert.getByRole('button', { name: 'Join the second round with email only' }).click();
    await expect(page.locator('.fp-success')).toHaveText(PUBLIC);
    expect(await entriesFor(page, email)).toEqual([{ drop: DROP, label: 'Featured label', email, round: 2 }]);
  });

  test('verification unavailable: same email-only option, no verified state, nothing stored', async ({ page }) => {
    await openWaitlist(page);
    const email = uniq('down');
    await page.getByLabel('Email address').fill(email);
    await page.getByText('Bought from Featured label before? Get first access.').click();
    await page.getByLabel('Order number').fill('0000');
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    const alert = page.locator('[data-alert]');
    await expect(alert).toContainText('Order verification isn’t available right now.');
    await expect(page.getByText(VERIFIED)).toHaveCount(0);
    expect(await entriesFor(page, email)).toEqual([]);
    await alert.getByRole('button', { name: 'Join the second round with email only' }).click();
    await expect(page.locator('.fp-success')).toHaveText(PUBLIC);
  });

  test('submitting state, server failure keeps the email', async ({ page }) => {
    await openWaitlist(page);
    let release: () => void = () => {};
    await page.route('**/api/waitlist', (r) => new Promise<void>((res) => { release = () => { void r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"failed"}' }); res(); }; }));
    await page.getByLabel('Email address').fill('kept@example.com');
    const submit = page.locator('.fp-form .fp-button');
    await submit.click();
    await expect(submit).toHaveText('Joining…');
    await expect(submit).toBeDisabled();
    release();
    await expect(page.locator('[data-alert]')).toHaveText('You weren’t added to the waitlist. Please try again in a moment.');
    await expect(page.getByLabel('Email address')).toHaveValue('kept@example.com');
  });
});

test.describe('routes and branding', () => {
  test.use({ viewport: DESKTOP });

  test('/invitations still redirects permanently to /about', async ({ page, request }) => {
    const res = await request.get('/invitations', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toBe('/about');
    await page.goto('/invitations');
    await expect(page).toHaveURL(/\/about$/);
  });

  test('no visible “Orvel” or general mailing list on any page or popup', async ({ page }) => {
    for (const path of ['/', '/about', '/for-labels', `/waitlist/${DROP}`, '/archive/chore-jacket']) {
      await page.goto(path);
      if (path === '/') await waitLive(page);
      else await page.waitForTimeout(600);
      await expectNoReferenceBranding(page);
      expect(await page.locator('a[href*="invitations"]').count(), path).toBe(0);
    }
    await page.goto('/archive/long-coat');
    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('link', { name: 'Preview the waitlist' })).toHaveAttribute('href', `/waitlist/${DROP}`);
    expect(await visibleText(page)).not.toMatch(OUTDATED);
    const favicon = await (await page.request.get('/favicon.svg')).text();
    expect(favicon).toContain('<path'); // the M mark, not the old O ring
  });

  test('enquiry: email only, separate from the waitlist', async ({ page }) => {
    await page.goto('/for-labels');
    await page.getByRole('button', { name: 'Plan an archive sale' }).click();
    const sent: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/')) sent.push(new URL(r.url()).pathname); });
    await page.getByLabel('Work email').fill('fail@studio.example');
    await page.getByRole('button', { name: 'Contact Mino' }).click();
    await expect(page.locator('[data-alert]')).toHaveText('Your enquiry wasn’t sent. Please try again in a moment.');
    await expect(page.getByLabel('Work email')).toHaveValue('fail@studio.example');
    await page.getByLabel('Work email').fill('founder@studio.example');
    await page.getByRole('button', { name: 'Contact Mino' }).click();
    await expect(page.getByText(ENQUIRED)).toBeVisible();
    expect([...new Set(sent)]).toEqual(['/api/enquiry']);
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
    await expect(page.getByRole('link', { name: 'Preview the waitlist' })).toBeVisible();
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
  });
});

test.describe('no JavaScript', () => {
  test.use({ viewport: DESKTOP, javaScriptEnabled: false });
  test('the waitlist and enquiry forms post natively and get an answer page', async ({ page }) => {
    await page.goto(`/waitlist/${DROP}`);
    await page.locator('#ns-email').fill(uniq('nojs'));
    await page.locator('.noscript form').first().getByRole('button').click();
    await expect(page.getByText(PUBLIC)).toBeVisible();
    await page.goto('/for-labels');
    await page.locator('#ns-work').fill('founder@studio.example');
    await page.locator('.noscript form').nth(1).getByRole('button').click();
    await expect(page.getByText(ENQUIRED)).toBeVisible();
  });
});

test.describe('phone 390×844', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  test('waitlist is a bottom sheet on the drop page; verified path works by touch', async ({ page }) => {
    await page.goto(`/waitlist/${DROP}`);
    await page.waitForTimeout(500);
    const b = (await page.locator('.fp-panel').boundingBox())!;
    expect([b.x, b.width]).toEqual([0, 390]);
    expect(b.y + b.height).toBeCloseTo(844, 0);
    await page.getByLabel('Email address').fill('past@customer.example');
    await page.getByText('Bought from Featured label before? Get first access.').tap();
    await page.getByLabel('Order number').fill('1001');
    await page.getByRole('button', { name: 'Join the waitlist' }).tap();
    await expect(page.locator('.fp-success')).toHaveText(VERIFIED);
  });
});
