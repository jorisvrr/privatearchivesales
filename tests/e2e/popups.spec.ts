// The two form popups: geometry, states, keyboard and modal behaviour.
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE } from './helpers';

const rect = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON());
const controls = (p: Page, scope: string) =>
  p.locator(scope).evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>('input:not(.hp), select, textarea, button')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.id, h: el.getBoundingClientRect().height })),
  );

const POPUPS = [
  { name: 'enquiry', path: '/for-labels', cta: 'Plan an archive sale', title: 'Plan an archive sale', field: 'Work email', submit: 'Contact Mino', busy: 'Sending…', endpoint: '**/api/enquiry', fieldId: 'enq-email' },
] as const;

async function open(page: Page, pop: (typeof POPUPS)[number]) {
  await page.goto(pop.path);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: pop.cta }).click();
  await page.waitForTimeout(300);
}

for (const pop of POPUPS) {
  test.describe(`${pop.name} — desktop 1440×900`, () => {
    test.use({ viewport: DESKTOP });

    test('nonmodal card at the nav inset, header row, compact, first field focused', async ({ page }) => {
      await open(page, pop);
      const dialog = page.getByRole('dialog', { name: pop.title });
      await expect(dialog).toHaveAttribute('aria-modal', 'false');
      await expect(page.getByLabel(pop.field)).toBeFocused();
      const box = await rect(page, '.fp-panel');
      expect([box.x, box.y]).toEqual([8, 8]);
      expect(box.width).toBeGreaterThanOrEqual(440);
      expect(box.width).toBeLessThanOrEqual(470);
      expect(box.height).toBeLessThanOrEqual(320);
      const title = await rect(page, '.fp-title');
      const close = await rect(page, '.fp-close');
      expect(title.y - box.y).toBeCloseTo(25, 0);
      expect(Math.abs((close.y + close.height / 2) - (title.y + title.height / 2))).toBeLessThan(3);
      const input = await rect(page, `#${pop.fieldId}`);
      const btn = await rect(page, '.fp-form .fp-button');
      expect(Math.abs(input.y - btn.y)).toBeLessThan(1); // field and button share a row
      for (const c of await controls(page, '.fp-panel')) expect(c.h, c.name).toBeGreaterThanOrEqual(44);
    });

    test('no trap, outside click keeps it, Esc and × return focus to the CTA', async ({ page }) => {
      await open(page, pop);
      const field = page.getByLabel(pop.field);
      await field.fill('typed@example.com');
      await page.mouse.click(1100, 700);
      await expect(page.locator('.fp-panel')).toBeVisible();
      await field.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.fp-panel'))).toBe(false);
      await field.focus();
      await page.keyboard.press('Escape');
      const cta = page.getByRole('button', { name: pop.cta });
      await expect(cta).toBeFocused();
      await expect(cta).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(field).toBeFocused();
      await expect(field).toHaveValue('typed@example.com');
      await expect(cta).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(cta).toBeFocused();
    });

    test('states: field error, submitting, server error above the button keeps the email, success', async ({ page }) => {
      await open(page, pop);
      const field = page.getByLabel(pop.field);
      const submit = page.locator('.fp-form .fp-button');
      await submit.click();
      await expect(field).toHaveAttribute('aria-describedby', `${pop.fieldId}-error`);
      await expect(field).toBeFocused();
      let release: () => void = () => {};
      await page.route(pop.endpoint, (r) => new Promise<void>((res) => { release = () => { void r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"failed"}' }); res(); }; }));
      await field.fill('person@example.com');
      await submit.click();
      await expect(submit).toHaveText(pop.busy);
      await expect(submit).toBeDisabled();
      await expect(page.locator('.fp-form')).toHaveAttribute('aria-busy', 'true');
      release();
      const alert = page.locator('[data-alert]');
      await expect(alert).toBeVisible();
      await expect(alert).toHaveAttribute('role', 'alert');
      expect((await alert.boundingBox())!.y).toBeLessThan((await submit.boundingBox())!.y);
      await expect(field).toHaveValue('person@example.com');
      await page.unroute(pop.endpoint);
      await page.route(pop.endpoint, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }));
      await submit.click();
      await expect(page.locator('.fp-success')).toBeFocused();
    });
  });

  test.describe(`${pop.name} — phone 390×844`, () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

    test('modal bottom sheet: heading focused, page inert, focus trapped; × restores everything', async ({ page }) => {
      await page.goto(pop.path);
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: pop.cta }).tap();
      const dialog = page.getByRole('dialog', { name: pop.title });
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(page.locator('.fp-title')).toBeFocused();
      await page.waitForTimeout(300);
      const box = await rect(page, '.fp-panel');
      expect([box.x, box.width]).toEqual([0, 390]);
      expect(box.y + box.height).toBeCloseTo(844, 0);
      expect(await page.evaluate(() => [document.getElementById('pages')!.inert, document.documentElement.classList.contains('fp-locked')])).toEqual([true, true]);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => !!document.activeElement?.closest('.fp-panel'))).toBe(true);
      }
      const input = await rect(page, `#${pop.fieldId}`);
      const btn = await rect(page, '.fp-form .fp-button');
      expect(btn.y).toBeGreaterThan(input.y + input.height); // stacked when narrow
      for (const c of await controls(page, '.fp-panel')) expect(c.h, c.name).toBeGreaterThanOrEqual(44);
      await page.getByRole('button', { name: 'Close' }).tap();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: pop.cta })).toBeFocused();
      expect(await page.evaluate(() => document.getElementById('pages')!.inert)).toBe(false);
    });

    test('keyboard open: field and submit stay reachable inside the sheet', async ({ page }) => {
      await page.goto(pop.path);
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: pop.cta }).tap();
      await page.getByLabel(pop.field).focus();
      await page.setViewportSize({ width: 390, height: 508 }); // ≈336 px keyboard
      await page.waitForTimeout(400);
      const box = await rect(page, '.fp-panel');
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(508.5);
      await expect(page.getByLabel(pop.field)).toBeInViewport();
      await expect(page.getByRole('button', { name: pop.submit })).toBeInViewport();
    });
  });
}

test.describe('waitlist popup — desktop 1440×900', () => {
  test.use({ viewport: DESKTOP });
  test('opens on arrival as a nonmodal card; Esc returns focus to the corner trigger; disclosure reveals the order field', async ({ page }) => {
    await page.goto('/waitlist/demo-archive-001');
    const dialog = page.getByRole('dialog', { name: 'Join the Featured label archive waitlist' });
    await expect(dialog).toHaveAttribute('aria-modal', 'false');
    await expect(page.getByLabel('Email address')).toBeFocused();
    await expect(page.getByLabel('Order number')).toBeHidden();
    const summary = page.getByText('Bought from Featured label before? Get first access.');
    await summary.click();
    await expect(page.getByLabel('Order number')).toBeFocused();
    await expect(page.getByLabel('Order number')).toHaveAccessibleDescription('Use the email address from your original order.');
    const box = await rect(page, '.fp-panel');
    expect([box.x, box.y]).toEqual([8, 8]);
    for (const c of await controls(page, '.fp-panel')) expect(c.h, c.name).toBeGreaterThanOrEqual(44);
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');
    await expect(page.locator('.fp-trigger')).toBeFocused();
    await expect(page.locator('.fp-trigger')).toHaveAccessibleName('Join the waitlist');
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });
  test('opens with opacity only, no translate', async ({ page }) => {
    await page.goto('/for-labels');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Plan an archive sale' }).click();
    for (let i = 0; i < 6; i++) {
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(await page.locator('.fp-panel').evaluate((el) => getComputedStyle(el).transform));
      await page.waitForTimeout(30);
    }
  });
});
