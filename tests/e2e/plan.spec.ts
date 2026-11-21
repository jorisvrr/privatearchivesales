// /plan: three steps, explicit Continue, Back/Exit, kept answers, honest success, no duplicates.
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, settled } from './helpers';

const Q1 = 'What would you like to release?';
const Q2 = 'When are you considering a sale?';
const Q3 = 'Let’s shape your archive sale.';
const heading = (p: Page) => p.locator('.plan__step:not([hidden]) .plan__q');
const progress = (p: Page) => p.locator('.plan__progress');
async function events(p: Page) {
  return p.evaluate(() => (window as any).__events as Record<string, unknown>[]);
}
async function capture(p: Page) {
  await p.addInitScript(() => {
    (window as any).__events = [];
    window.addEventListener('mino:analytics', (e) => (window as any).__events.push((e as CustomEvent).detail));
  });
}
async function toStep3(p: Page, release = 'Samples', timing = 'Within three months') {
  await p.getByText(release, { exact: true }).click();
  await p.locator('.plan__step[data-step="1"] .fp-button').click();
  await expect(heading(p)).toHaveText(Q2);
  await p.getByText(timing, { exact: true }).click();
  await p.locator('.plan__step[data-step="2"] .fp-button').click();
  await expect(heading(p)).toHaveText(Q3);
}

for (const [name, vp, touch] of [['desktop', DESKTOP, false], ['phone', PHONE, true]] as const) {
  test.describe(`/plan — ${name}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch });

    test('full journey: progress, explicit Continue, kept answers on Back, confirmed success', async ({ page }) => {
      await capture(page);
      await page.goto('/plan');
      await expect(page).toHaveTitle('Plan an archive sale — Mino');
      await expect(heading(page)).toHaveText(Q1);
      await expect(progress(page)).toHaveText('1 of 3');
      await page.locator('.plan__step[data-step="1"] .fp-button').click();
      await expect(page.locator('#release-error')).toBeVisible();
      await page.getByText('Both', { exact: true }).click();
      await expect(heading(page)).toHaveText(Q1); // selecting never advances
      await expect(page.locator('#release-error')).toBeHidden();
      await page.locator('.plan__step[data-step="1"] .fp-button').click();
      await expect(progress(page)).toHaveText('2 of 3');
      await expect(page).toHaveURL(/\/plan\?step=2$/);
      await page.getByText('Next month', { exact: true }).click();
      await page.locator('.plan__step[data-step="2"] .fp-button').click();
      await expect(progress(page)).toHaveText('3 of 3');
      await expect(page.locator('.plan__answers')).toHaveText('Both · Next month');
      await page.getByLabel('Work email').fill('founder@gmail.com'); // personal domains are accepted
      // Back (on-screen) keeps answers and typed input.
      await page.locator('.plan__step[data-step="3"] [data-back]').click();
      await expect(heading(page)).toHaveText(Q2);
      await expect(page.getByLabel('Next month')).toBeChecked();
      await page.locator('.plan__step[data-step="2"] [data-back]').click();
      await expect(heading(page)).toHaveText(Q1);
      await expect(page.getByLabel('Both')).toBeChecked();
      await page.goForward(); // browser Forward returns to step 2
      await expect(heading(page)).toHaveText(Q2);
      await page.locator('.plan__step[data-step="2"] .fp-button').click();
      await expect(page.getByLabel('Work email')).toHaveValue('founder@gmail.com');
      await page.getByLabel(/Brand website or Instagram/).fill('@studionorth');
      const button = page.getByRole('button', { name: 'Send my enquiry' });
      await button.click();
      await expect(page.getByRole('heading', { name: 'Your enquiry is with Mino.' })).toBeVisible();
      await expect(page.locator('.plan__done')).toContainText('We’ll review your answers and follow up at founder@gmail.com to discuss your archive and the next steps.');
      await expect(page.locator('.plan__process li')).toHaveText(['Review', 'Proposed scope and fees', 'Agreed launch plan']);
      await expect(page.locator('.plan__done')).not.toContainText(/within \d|hours|business days|book a call|calendar/i);
      // Browser Back after sending stays on the confirmation (no second submission).
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Your enquiry is with Mino.' })).toBeVisible();
      // Analytics: aggregate only, never the email or typed details.
      const ev = await events(page);
      expect(ev.map((e) => e.name)).toEqual(['plan_start', 'plan_step_complete', 'plan_step_complete', 'plan_step_complete', 'plan_submit_success']);
      expect(JSON.stringify(ev)).not.toMatch(/@|gmail|studionorth/);
    });

    test('failures keep input and allow retry; not-configured never shows success; no duplicate submissions', async ({ page }) => {
      await capture(page);
      await page.goto('/plan');
      await toStep3(page);
      const email = page.getByLabel('Work email');
      const send = page.locator('.plan__step[data-step="3"] button[type="submit"]');
      await send.click();
      await expect(page.locator('#plan-email-error')).toHaveText('Enter your work email.');
      await expect(email).toBeFocused();
      await email.fill('founder@');
      await send.click();
      await expect(page.locator('#plan-email-error')).toHaveText('Enter a valid email address, like name@example.com.');
      await page.route('**/api/enquiry', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"not_configured"}' }));
      await email.fill('founder@studio.example');
      await send.click();
      await expect(page.locator('[data-alert]')).toContainText('can’t be sent from this page yet. Nothing was sent');
      await expect(page.locator('.plan__done')).toBeHidden();
      await page.unroute('**/api/enquiry');
      await page.route('**/api/enquiry', (r) => r.abort('internetdisconnected'));
      await send.click();
      await expect(page.locator('[data-alert]')).toContainText('Your enquiry wasn’t sent.');
      await expect(email).toHaveValue('founder@studio.example');
      await page.unroute('**/api/enquiry');
      // Retry, slowly answered: double clicks send once, and success waits for the server.
      let calls = 0;
      let release: () => void = () => {};
      await page.route('**/api/enquiry', (r) => { calls++; return new Promise<void>((res) => { release = () => { void r.continue(); res(); }; }); });
      // Three submits in the same tick: click, click, Enter-style requestSubmit.
      await page.evaluate(() => {
        const b = document.querySelector('.plan__step[data-step="3"] button[type="submit"]') as HTMLButtonElement;
        b.click(); b.click(); b.form!.requestSubmit();
      });
      await page.keyboard.press('Enter');
      await expect(send).toBeDisabled();
      await expect(send).toHaveText('Sending…');
      await expect(page.locator('.plan__done')).toBeHidden();
      release();
      await expect(page.getByRole('heading', { name: 'Your enquiry is with Mino.' })).toBeVisible();
      expect(calls).toBe(1);
      const ev = await events(page);
      expect(ev.filter((e) => e.name === 'plan_submit_failure').map((e) => e.reason)).toEqual(['not_configured', 'failed']);
    });

    test('Exit returns to For labels; a deep link to a later step starts at the first question', async ({ page }) => {
      await page.goto('/plan?step=3');
      await expect(heading(page)).toHaveText(Q1);
      await expect(page).toHaveURL(/\/plan$/);
      await page.getByRole('link', { name: 'Exit' }).click();
      await settled(page);
      await expect(page).toHaveURL(/\/for-labels$/);
    });
  });
}

test.describe('/plan — keyboard and motion', () => {
  test.use({ viewport: DESKTOP });

  test('keyboard only: arrows choose without advancing, Space/Enter work, focus moves to each question', async ({ page }) => {
    await page.goto('/plan');
    await expect(heading(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Past collections')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByLabel('Samples')).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByLabel('Both')).toBeChecked();
    await page.waitForTimeout(400);
    await expect(heading(page)).toHaveText(Q1); // no auto-advance
    await page.keyboard.press('Tab');
    await expect(page.locator('.plan__step[data-step="1"] .fp-button')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText(Q2);
    await expect(heading(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(page.getByLabel('Next month')).toBeChecked();
    await page.keyboard.press('Tab'); // Back
    await page.keyboard.press('Tab'); // Continue
    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText(Q3);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Work email')).toBeFocused();
    await page.keyboard.type('founder@studio.example');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Your enquiry is with Mino.' })).toBeFocused();
  });

  test('step transition takes about 150–250 ms each way', async ({ page }) => {
    await page.goto('/plan');
    await page.getByText('Samples', { exact: true }).click();
    const ms = await page.evaluate(() => new Promise<number>((resolve) => {
      const t0 = performance.now();
      (document.querySelector('.plan__step[data-step="1"] .fp-button') as HTMLButtonElement).click();
      const check = () => {
        const s2 = document.querySelector('.plan__step[data-step="2"]') as HTMLElement;
        if (!s2.hidden && !s2.style.transform && getComputedStyle(s2).opacity === '1') resolve(performance.now() - t0);
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }));
    expect(ms).toBeGreaterThan(300); // 150 ms out + 220 ms in
    expect(ms).toBeLessThan(550);
  });
});

test.describe('/plan — reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });
  test('steps swap instantly', async ({ page }) => {
    await page.goto('/plan');
    await page.getByText('Samples', { exact: true }).click();
    await page.locator('.plan__step[data-step="1"] .fp-button').click();
    expect(await page.evaluate(() => [(document.querySelector('.plan__step[data-step="1"]') as HTMLElement).hidden, (document.querySelector('.plan__step[data-step="2"]') as HTMLElement).hidden])).toEqual([true, false]);
  });
});

test.describe('/plan — phone keyboard', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });
  test('with the keyboard open, the focused field and the send button stay visible', async ({ page }) => {
    await page.goto('/plan');
    await toStep3(page);
    await page.getByLabel('Brand website or Instagram (optional)').focus();
    await page.setViewportSize({ width: 390, height: 508 }); // ≈336 px keyboard
    await page.waitForTimeout(400);
    await page.getByLabel('Brand website or Instagram (optional)').focus();
    await page.waitForTimeout(300);
    await expect(page.getByLabel('Brand website or Instagram (optional)')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Send my enquiry' })).toBeInViewport();
  });
});
