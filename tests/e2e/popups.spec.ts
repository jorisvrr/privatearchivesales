// The two form popups: geometry, rhythm, states, keyboard and modal behaviour (brief: docs/popups/REPORT.md).
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE } from './helpers';

const rect = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON());
const controlsAtLeast44 = (p: Page, scope: string) =>
  p.locator(scope).evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>('input:not(.hp), select, textarea, button')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.id, h: el.getBoundingClientRect().height })),
  );

async function openEnquiry(page: Page) {
  await page.goto('/for-labels');
  await page.waitForTimeout(600);
  await page.locator('.cta--lede').click();
  await page.waitForTimeout(300);
}

test.describe('desktop 1440×900', () => {
  test.use({ viewport: DESKTOP });

  test('invitation: nonmodal card, header row, rhythm, ≤ 320 px tall, first field focused', async ({ page }) => {
    await page.goto('/invitations');
    const dialog = page.getByRole('dialog', { name: 'Join the invitation list' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'false');
    await expect(page.getByLabel('Email address')).toBeFocused();
    await page.waitForTimeout(300);
    const box = await rect(page, '.fp-panel');
    expect(box.x).toBe(8);
    expect(box.y).toBe(8);
    expect(box.width).toBeGreaterThanOrEqual(440);
    expect(box.width).toBeLessThanOrEqual(470);
    expect(box.height).toBeLessThanOrEqual(320);
    const title = await rect(page, '.fp-title');
    const close = await rect(page, '.fp-close');
    expect(title.y - box.y).toBeCloseTo(25, 0); // 1 px border + 24 px padding: no empty band
    expect(Math.abs((close.y + close.height / 2) - (title.y + title.height / 2))).toBeLessThan(3); // same row
    expect(close.width).toBeGreaterThanOrEqual(44);
    expect(close.height).toBeGreaterThanOrEqual(44);
    const fs = await page.locator('.fp-title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThanOrEqual(28);
    expect(fs).toBeLessThanOrEqual(32);
    // Email + button on one row; rhythm tokens.
    const input = await rect(page, '#signup-email');
    const btn = await rect(page, '.fp-form .fp-button');
    expect(Math.abs(input.y - btn.y)).toBeLessThan(1);
    const copy = await rect(page, '.fp-copy');
    const form = await rect(page, '.fp-form');
    const foot = await rect(page, '.fp-foot');
    expect(copy.y - (title.y + title.height)).toBeCloseTo(10, 0);
    expect(form.y - (copy.y + copy.height)).toBeCloseTo(22, 0);
    expect(foot.y - (form.y + form.height)).toBeCloseTo(16, 0);
    expect(box.y + box.height - (foot.y + foot.height)).toBeCloseTo(25, 0); // panel ends after the footer line
    const footStyle = await page.locator('.fp-foot').evaluate((el) => ({ size: parseFloat(getComputedStyle(el).fontSize) }));
    expect(footStyle.size).toBeGreaterThanOrEqual(13);
    for (const c of await controlsAtLeast44(page, '.fp-panel')) expect(c.h, c.name).toBeGreaterThanOrEqual(44);
  });

  test('invitation: no focus trap, outside click keeps it open, Esc closes and returns focus to the trigger', async ({ page }) => {
    await page.goto('/invitations');
    await page.waitForTimeout(400);
    const email = page.getByLabel('Email address');
    await email.fill('typed@example.com');
    await page.mouse.click(900, 600);
    await expect(page.locator('.fp-panel')).toBeVisible();
    await expect(email).toHaveValue('typed@example.com');
    await email.focus();
    await page.keyboard.press('Tab'); // → Join the list
    await expect(page.getByRole('button', { name: 'Join the list' })).toBeFocused();
    await page.keyboard.press('Tab'); // → leaves the card (nonmodal)
    expect(await page.evaluate(() => !!document.activeElement?.closest('.fp-panel'))).toBe(false);
    await email.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fp-panel')).toBeHidden();
    const trigger = page.getByRole('button', { name: 'Invitation list' });
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Enter');
    await expect(page.locator('.fp-panel')).toBeVisible();
    await expect(email).toBeFocused();
    await expect(email).toHaveValue('typed@example.com');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(trigger).toBeFocused();
  });

  test('invitation states: field error, submitting, server error keeps the email, success, double opt-in', async ({ page }) => {
    await page.goto('/invitations');
    const email = page.getByLabel('Email address');
    const submit = page.locator('.fp-form .fp-button');
    await submit.click();
    await expect(page.locator('#signup-email-error')).toHaveText('Enter your email address.');
    await expect(email).toHaveAttribute('aria-describedby', 'signup-email-error');
    await expect(email).toBeFocused();
    let release: () => void = () => {};
    await page.route('**/api/subscribe', (r) => new Promise<void>((res) => { release = () => { void r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"failed"}' }); res(); }; }));
    await email.fill('person@example.com');
    await submit.click();
    await expect(submit).toHaveText('Joining…');
    await expect(submit).toBeDisabled();
    await expect(page.locator('.fp-form')).toHaveAttribute('aria-busy', 'true');
    release();
    const alert = page.locator('[data-alert]');
    await expect(alert).toHaveText('Your address wasn’t added. Please try again in a moment.');
    await expect(alert).toHaveAttribute('role', 'alert');
    expect((await alert.boundingBox())!.y).toBeLessThan((await submit.boundingBox())!.y); // above the button
    await expect(email).toHaveValue('person@example.com');
    await page.unroute('**/api/subscribe');
    await page.route('**/api/subscribe', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok","confirm":true}' }));
    await submit.click();
    await expect(page.locator('.fp-success')).toContainText('Check your email');
    await expect(page.locator('.fp-success')).toContainText('Confirm your address');
    await expect(page.locator('.fp-panel')).not.toContainText(/reserved|your place/i);
    await page.reload();
    await page.route('**/api/subscribe', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok","confirm":false}' }));
    await page.getByLabel('Email address').fill('person@example.com');
    await page.locator('.fp-form .fp-button').click();
    await expect(page.locator('.fp-success__title')).toHaveText('You’re on the list');
    await expect(page.locator('.fp-success__text')).toHaveText('Orvel will email you when booking opens.');
  });

  test('enquiry: fits within 900 px without scrolling; City + quantity share a row; custom select', async ({ page }) => {
    await openEnquiry(page);
    const dialog = page.getByRole('dialog', { name: 'Tell us about your stock' });
    await expect(dialog).toHaveAttribute('aria-modal', 'false');
    await expect(page.getByLabel('Label name')).toBeFocused();
    const box = await rect(page, '.fp-panel');
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    expect(await page.locator('.fp-body').evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    const city = await rect(page, '#enq-city');
    const qty = await rect(page, '#enq-quantity');
    expect(city.y).toBe(qty.y);
    const sel = await page.locator('#enq-quantity').evaluate((el) => { const c = getComputedStyle(el); return { app: c.appearance, h: el.getBoundingClientRect().height, bg: c.backgroundImage }; });
    expect(sel.app).toBe('none');
    expect(sel.h).toBe(44);
    expect(sel.bg).toContain('svg');
    await expect(page.locator('#enq-note')).toHaveAttribute('rows', '3');
    for (const c of await controlsAtLeast44(page, '.fp-panel')) expect(c.h, c.name).toBeGreaterThanOrEqual(44);
    for (const c of await controlsAtLeast44(page, '.page--labels')) expect(c.h, c.name).toBeGreaterThanOrEqual(44);
  });

  test('enquiry: errors under each field, focus on the first, values kept; server error above the button; Esc returns focus to the CTA', async ({ page }) => {
    await openEnquiry(page);
    await page.getByLabel('Contact email').fill('founder@');
    await page.getByLabel('Note (optional)').fill('Keep me');
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    for (const [id, msg] of [['enq-label', 'Enter your label’s name.'], ['enq-email', 'Enter a valid email address, like name@example.com.'], ['enq-city', 'Enter a city.'], ['enq-quantity', 'Choose an approximate quantity.']]) {
      await expect(page.locator(`#${id}-error`)).toHaveText(msg);
      await expect(page.locator(`#${id}`)).toHaveAttribute('aria-describedby', `${id}-error`);
      const f = await rect(page, `#${id}`);
      const e = await rect(page, `#${id}-error`);
      expect(e.y).toBeGreaterThan(f.y + f.height - 1);
    }
    await expect(page.getByLabel('Label name')).toBeFocused();
    await expect(page.getByLabel('Note (optional)')).toHaveValue('Keep me');
    await page.getByLabel('Label name').fill('Studio North');
    await page.getByLabel('Contact email').fill('founder@north.example');
    await page.getByLabel('City', { exact: true }).fill('Utrecht');
    await page.getByLabel('Approximate quantity').selectOption('More than 400 pieces');
    await page.route('**/api/enquiry', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"failed"}' }));
    const send = page.getByRole('button', { name: 'Send enquiry' });
    await send.click();
    const alert = page.locator('[data-alert]');
    await expect(alert).toHaveText('Your enquiry wasn’t sent. Please try again in a moment.');
    expect((await alert.boundingBox())!.y).toBeLessThan((await send.boundingBox())!.y);
    await expect(page.getByLabel('City', { exact: true })).toHaveValue('Utrecht');
    await page.keyboard.press('Escape');
    await expect(page.locator('.cta--lede')).toBeFocused();
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });
  test('opens with opacity only, no translate', async ({ page }) => {
    await page.goto('/for-labels');
    await page.waitForTimeout(400);
    await page.locator('.cta--lede').click();
    const samples: string[] = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await page.locator('.fp-panel').evaluate((el) => getComputedStyle(el).transform));
      await page.waitForTimeout(30);
    }
    for (const t of samples) expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(t);
  });
});

test.describe('phone 390×844 (touch)', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  test('invitation: modal bottom sheet, heading focused, page inert and scroll-locked, focus trapped, × returns focus', async ({ page }) => {
    await page.goto('/invitations');
    const dialog = page.getByRole('dialog', { name: 'Join the invitation list' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('.fp-title')).toBeFocused();
    await page.waitForTimeout(400);
    const box = await rect(page, '.fp-panel');
    expect(box.x).toBe(0);
    expect(box.width).toBe(390);
    expect(box.y + box.height).toBeCloseTo(844, 0);
    expect(box.height).toBeLessThanOrEqual(0.9 * 844);
    expect(await page.evaluate(() => [document.getElementById('pages')!.inert, document.querySelector<HTMLElement>('.nav')!.inert, document.documentElement.classList.contains('fp-locked')])).toEqual([true, true, true]);
    // Stacked row: input, then the button below it.
    const input = await rect(page, '#signup-email');
    const btn = await rect(page, '.fp-form .fp-button');
    expect(btn.y).toBeGreaterThan(input.y + input.height);
    // Focus trap.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.fp-panel'))).toBe(true);
    }
    await page.getByRole('button', { name: 'Close' }).tap();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Invitation list' })).toBeFocused();
    expect(await page.evaluate(() => [document.getElementById('pages')!.inert, document.documentElement.classList.contains('fp-locked')])).toEqual([false, false]);
  });

  test('enquiry with the keyboard open: header pinned, focused field and submit reachable inside the sheet', async ({ page }) => {
    await page.goto('/for-labels');
    await page.waitForTimeout(600);
    await page.locator('.cta--lede').tap();
    await page.waitForTimeout(300);
    await expect(page.locator('.fp-title')).toBeFocused();
    const note = page.getByLabel('Note (optional)');
    await note.focus();
    await page.setViewportSize({ width: 390, height: 508 }); // ≈336 px keyboard
    await page.waitForTimeout(400);
    const box = await rect(page, '.fp-panel');
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(508.5);
    const head = await rect(page, '.fp-head');
    expect(head.y).toBeCloseTo(box.y + 1, 0); // header stays at the top of the sheet
    const body = await rect(page, '.fp-body');
    const n = await rect(page, '#enq-note');
    expect(n.y).toBeGreaterThanOrEqual(body.y);
    expect(n.y + n.height).toBeLessThanOrEqual(body.y + body.height);
    await page.locator('.fp-body').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeInViewport();
    for (const c of await controlsAtLeast44(page, '.fp-panel')) expect(c.h, c.name).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');
    await expect(page.locator('.cta--lede')).toBeFocused();
  });
});
