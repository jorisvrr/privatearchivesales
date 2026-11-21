import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, expectNoReferenceBranding, frontPlane, PHONE, settled, snap, waitLive } from './helpers';

const ENQUIRED = /Your enquiry is with Mino\./;
const SIGNUP_WORDS = /join the waitlist|preview the waitlist|mailing list|subscribe|sign up for|get first access|next waitlist link/i;
const OUTDATED = /booking|book a place|arrival|\bvenue|in person|in-person|place at the sale|reserve|Orvel/i;
const ABOUT = 'works with independent labels to bring past collections and samples back for a limited sale on the label’s own website. When a drop is announced, the label shares its waitlist link. Past customers can verify a previous order for first access. Everyone else who signs up is invited in the second round.';

const visibleText = (page: Page) => page.evaluate(() => document.title + '\n' + document.body.innerText);
/** Every way a shopper could sign up: forms, email fields, links and buttons. */
const signupSurface = (page: Page) => page.evaluate(() => ({
  forms: [...document.querySelectorAll('form')].filter((f) => !f.closest('noscript')).map((f) => f.getAttribute('action')),
  emailInputs: [...document.querySelectorAll('input[type=email]')].map((i) => (i as HTMLInputElement).labels?.[0]?.textContent ?? i.id),
  signupLinks: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!).filter((h) => /waitlist|invitations|subscribe/.test(h)),
}));

for (const [label, vp, touch] of [['1440×900', DESKTOP, false], ['390×844', PHONE, true]] as const) {
  test.describe(`no shopper signup on Mino — ${label}`, () => {
    test.use({ viewport: vp, hasTouch: touch, isMobile: touch });

    test('About: headline and paragraph only; the section ends after the paragraph', async ({ page }) => {
      await page.goto('/about');
      await expect(page).toHaveTitle('About — Mino');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private archive sales for independent labels.');
      const para = page.locator('.lede__copy');
      await expect(para).toHaveText(`Mino ${ABOUT}`);
      await expect(para).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => [...document.querySelector('.lede')!.children].map((c) => c.tagName))).toEqual(['H1', 'P']);
      await expect(page.locator('.page--about a, .page--about button')).toHaveCount(0);
      expect(await signupSurface(page)).toEqual({ forms: [], emailInputs: [], signupLinks: [] });
      expect(await visibleText(page)).not.toMatch(SIGNUP_WORDS);
    });

    test('Archive, piece details, For labels and the nav: no signup anywhere; only the founder enquiry', async ({ page }) => {
      const requests: string[] = [];
      page.on('request', (r) => { if (r.url().includes('/api/')) requests.push(new URL(r.url()).pathname); });
      await page.goto('/');
      await waitLive(page);
      expect(await signupSurface(page)).toEqual({ forms: [], emailInputs: [], signupLinks: [] });
      // Enlarge a piece (touch shows "View piece") and open it.
      const t = await frontPlane(page);
      if (touch) await page.touchscreen.tap(t.cx, t.cy);
      else await page.mouse.click(t.cx, t.cy);
      await page.waitForTimeout(900);
      expect(await visibleText(page)).not.toMatch(SIGNUP_WORDS);
      if (touch) await page.locator('.title-action').tap();
      else await page.mouse.click(vp.width / 2, vp.height / 2);
      await settled(page);
      await expect(page).toHaveURL(/\/archive\//);
      await page.getByRole('button', { name: 'Details' }).click();
      await expect(page.getByText('An AI-generated editorial study.')).toBeVisible();
      expect(await signupSurface(page)).toEqual({ forms: [], emailInputs: [], signupLinks: [] });
      expect(await visibleText(page)).not.toMatch(SIGNUP_WORDS);
      // Through the nav, on every destination.
      for (const href of ['/about', '/for-labels', '/']) {
        await page.locator(`.pill[href="${href}"]`).click();
        await settled(page);
        await page.waitForTimeout(300);
        const s = await signupSurface(page);
        expect(s.signupLinks, href).toEqual([]);
        expect(s.forms.filter((a) => a !== '/api/enquiry'), href).toEqual([]);
        expect(await visibleText(page), href).not.toMatch(SIGNUP_WORDS);
        await expectNoReferenceBranding(page);
      }
      expect(requests.filter((p) => p !== '/api/enquiry')).toEqual([]);
    });

    test('a label can still send an enquiry through /plan, and only to /api/enquiry', async ({ page }) => {
      await page.goto('/for-labels');
      const cta = page.getByRole('link', { name: 'Plan an archive sale' });
      await expect(cta).toBeInViewport({ ratio: 1 });
      await cta.click();
      await settled(page);
      await expect(page).toHaveURL(/\/plan$/);
      expect(await visibleText(page)).not.toMatch(SIGNUP_WORDS);
      const sent: { path: string; body: Record<string, string> }[] = [];
      page.on('request', (r) => { if (r.url().includes('/api/')) sent.push({ path: new URL(r.url()).pathname, body: JSON.parse(r.postData() ?? '{}') }); });
      await page.getByText('Past collections', { exact: true }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByText('Exploring', { exact: true }).click();
      await page.locator('.plan__step[data-step="2"] .fp-button').click();
      await page.getByLabel('Work email').fill('founder@studio.example');
      await page.getByRole('button', { name: 'Send my enquiry' }).click();
      await expect(page.getByRole('heading', { name: 'Your enquiry is with Mino.' })).toBeVisible();
      expect(sent.map((s) => s.path)).toEqual(['/api/enquiry']);
      expect(Object.keys(sent[0].body).sort()).toEqual(['brand', 'email', 'fax', 'release', 'timing']);
    });
  });
}

test.describe('old signup links', () => {
  test.use({ viewport: DESKTOP });

  test('redirect permanently to /about on the server', async ({ request }) => {
    for (const path of ['/invitations', '/invitations/', '/waitlist', '/waitlist/', '/waitlist/demo-archive-001', '/waitlist/any-label-archive-002?ref=ig']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(301);
      expect(res.headers().location, path).toMatch(/^\/about(\?.*)?$/);
    }
  });

  test('land on About in the browser, with no waitlist form, also on phones', async ({ browser }) => {
    for (const opts of [{ viewport: DESKTOP }, { viewport: PHONE, hasTouch: true, isMobile: true }]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      for (const path of ['/waitlist/demo-archive-001', '/invitations']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/about$/);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private archive sales for independent labels.');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(await signupSurface(page)).toEqual({ forms: [], emailInputs: [], signupLinks: [] });
      }
      await ctx.close();
    }
  });

  test('an in-app link to an old drop page is redirected client-side too', async ({ page }) => {
    await page.goto('/for-labels');
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '/waitlist/demo-archive-001';
      a.textContent = 'old link';
      document.querySelector('main')!.append(a);
      a.click();
    });
    await settled(page);
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('nothing on Mino accepts a shopper signup', async ({ request }) => {
    for (const path of ['/api/waitlist', '/api/subscribe']) {
      const post = await request.post(path, { data: { drop: 'demo-archive-001', email: 'shopper@example.com', order: '1001' } });
      expect(post.ok(), path).toBe(false);
      const inspect = await request.get(`${path}?inspect=1`);
      expect(await inspect.text(), path).not.toContain('entries');
    }
  });
});

test.describe('content checks', () => {
  test.use({ viewport: DESKTOP });

  test('no outdated claims; /for-labels states no fee figures', async ({ page }) => {
    for (const path of ['/about', '/for-labels', '/archive/side-profile']) {
      await page.goto(path);
      await page.waitForTimeout(500);
      expect(await visibleText(page), path).not.toMatch(OUTDATED);
    }
    expect(await visibleText(page)).not.toMatch(/\d\s?%|€|\$|£/);
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
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });
  test('no intro, no slides, still usable', async ({ page }) => {
    await page.goto('/');
    await waitLive(page);
    await expect(page.locator('.intro')).toHaveCount(0);
    const a = (await snap(page)).q;
    await page.waitForTimeout(600);
    expect((await snap(page)).q).toEqual(a);
    await page.locator('.pill[href="/about"]').click();
    await expect(page.locator('.track')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private archive sales for independent labels.');
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
    await expect(page).toHaveURL(/\/archive\/sealed-envelope$/);
  });
});

test.describe('no JavaScript', () => {
  test.use({ viewport: DESKTOP, javaScriptEnabled: false });
  test('the fallback has the founder enquiry only, and it works', async ({ page }) => {
    await page.goto('/about');
    expect(await page.locator('.noscript form').evaluateAll((fs) => fs.map((f) => f.getAttribute('action')))).toEqual(['/api/enquiry']);
    await expect(page.locator('.noscript')).not.toContainText(/join the waitlist|order number/i);
    await page.locator('#ns-release').selectOption('Samples');
    await page.locator('#ns-timing').selectOption('Exploring');
    await page.locator('#ns-work').fill('founder@studio.example');
    await page.locator('.noscript form').getByRole('button').click();
    await expect(page.getByText(ENQUIRED)).toBeVisible();
  });
});
