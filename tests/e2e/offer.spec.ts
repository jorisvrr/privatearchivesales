// For labels: the offer, inclusions, process and pricing; honest scarcity, urgency and risk language.
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE } from './helpers';

const text = (p: Page) => p.evaluate(() => document.body.innerText);

for (const [name, vp, touch] of [['1440×900', DESKTOP, false], ['390×844', PHONE, true]] as const) {
  test.describe(`For labels — ${name}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch });

    test('first screen: outcome, how it works, access, pricing and the one CTA', async ({ page }) => {
      await page.goto('/for-labels');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your archive. A new source of revenue.');
      for (const line of [
        'Turn past collections and samples into a limited sale on your own website. Mino builds the experience and manages the launch. You choose the pieces, approve the prices, and fulfil the orders.',
        'Your past customers shop first. Your wider audience follows.',
      ]) await expect(page.getByText(line)).toBeInViewport({ ratio: 1 });
      const price = page.locator('.lede__price');
      await expect(price).toHaveText('A small upfront fee covers setup. Mino then earns an agreed percentage of sales generated through the archive sale.');
      const cta = page.getByRole('button', { name: 'Plan an archive sale' });
      await expect(cta).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.querySelector('.lede__price')!.nextElementSibling!.classList.contains('cta'))).toBe(true);
      await expect(page.locator('.cta')).toHaveCount(1);
    });

    test('inclusions, extras, process and pricing; no invented figures, deadlines or guarantees', async ({ page }) => {
      await page.goto('/for-labels');
      const included = page.locator('.offer__col').nth(0).locator('li');
      await expect(included).toHaveText([/A temporary archive page designed for your label/, /A brand-specific waitlist and two access rounds/, /Launch coordination/, /Reporting on sales attributed to the drop/, /Page removal after the sale/]);
      const extras = page.locator('.offer__col').nth(1).locator('li');
      await expect(extras).toHaveText([/Ready-to-use announcement and invitation copy/, /A simple launch schedule/, /A post-sale review with recommendations for the next drop/]);
      await expect(page.getByText('Together we agree the drop’s opening and closing dates.', { exact: false })).toBeAttached();
      await expect(page.locator('.pricing__text')).toContainText('The percentage applies only to sales attributed to the drop.');
      const t = await text(page);
      expect(t).not.toMatch(/risk[- ]free|guarantee|refund|countdown|days left|hours left|only \d+|limited places|spots? left|\d+\s?%|€|\$|£|per cent/i);
      expect(t).not.toMatch(/join the waitlist|mailing list|subscribe|sign up|create an account/i);
      // The two-column inclusions stack on phones.
      const [a, b] = await page.locator('.offer__col').evaluateAll((cs) => cs.map((c) => c.getBoundingClientRect().toJSON()));
      if (vp.width > 640) expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      else expect(b.y).toBeGreaterThan(a.y + a.height - 1);
    });

    test('the CTA opens the email-only business enquiry', async ({ page }) => {
      await page.goto('/for-labels');
      await page.getByRole('button', { name: 'Plan an archive sale' }).click();
      const dialog = page.getByRole('dialog', { name: 'Plan an archive sale' });
      await expect(dialog.locator('input:not(.hp), select, textarea')).toHaveCount(1);
      await expect(dialog.getByLabel('Work email')).toBeVisible();
    });
  });
}

test('About stays concise and explanatory', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/about');
  await expect(page.locator('.lede').locator('p')).toHaveCount(1);
  await expect(page.locator('.page--about button, .page--about form')).toHaveCount(0);
});
