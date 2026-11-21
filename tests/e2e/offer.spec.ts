// For labels: the offer before the funnel, what's included, and an honestly labelled preview.
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, settled } from './helpers';

const text = (p: Page) => p.evaluate(() => document.body.innerText);

for (const [name, vp, touch] of [['1440×900', DESKTOP, false], ['390×844', PHONE, true]] as const) {
  test.describe(`For labels — ${name}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch });

    test('first screen: the offer, pricing model, CTA and its supporting line', async ({ page }) => {
      await page.goto('/for-labels');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Give your archive its next release.');
      for (const line of [
        'A limited sale on your own website, with first access for your past customers.',
        'Mino builds the page and coordinates the launch. You choose the pieces, approve the prices, and fulfil the orders.',
        'A small setup fee, plus an agreed percentage of archive-sale revenue.',
        'Two quick questions and your email. No commitment.',
      ]) await expect(page.getByText(line, { exact: true })).toBeInViewport({ ratio: 1 });
      const cta = page.getByRole('link', { name: 'Plan an archive sale' });
      await expect(cta).toBeInViewport({ ratio: 1 });
      await expect(cta).toHaveAttribute('href', '/plan');
      await expect(page.locator('.cta')).toHaveCount(1);
      await cta.click();
      await settled(page);
      await expect(page).toHaveURL(/\/plan$/);
      await expect(page.getByRole('heading', { name: 'What would you like to release?' })).toBeVisible();
    });

    test('what’s included, a labelled illustrative preview, no invented claims', async ({ page }) => {
      await page.goto('/for-labels');
      await expect(page.locator('.offer__list li')).toHaveText([
        /Temporary archive page on your existing website/, /Brand-specific waitlist and two access rounds/, /Launch coordination/,
        /Announcement and invitation copy/, /Launch schedule/, /Sales reporting and page removal after the drop/,
      ]);
      await expect(page.locator('.preview__tag')).toHaveText('Illustration');
      await expect(page.locator('.preview__cap')).toContainText('Illustrative preview');
      await expect(page.locator('.preview__cap')).toContainText('Not client work.');
      const t = await text(page);
      expect(t).not.toMatch(/risk[- ]free|guarantee|refund|testimonial|countdown|days left|only \d+|limited places|spots? left|\d+\s?%|€|\$|£|per cent|clients? (say|love)/i);
      expect(t).not.toMatch(/join the waitlist|mailing list|subscribe|sign up|create an account/i);
      await expect(page.locator('.page--labels form, .page--labels input')).toHaveCount(0);
    });
  });
}

test('About stays concise and explanatory', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/about');
  await expect(page.locator('.lede').locator('p')).toHaveCount(1);
  await expect(page.locator('.page--about button, .page--about form')).toHaveCount(0);
});
