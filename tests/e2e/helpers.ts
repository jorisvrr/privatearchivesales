import { expect, type Page } from '@playwright/test';

export const DESKTOP = { width: 1440, height: 900 };
export const PHONE = { width: 390, height: 844 };
export const TABLET = { width: 768, height: 1024 };

export type Snap = {
  phase: string; ambient: boolean; sinceExplode: number | null; q: number[]; expanded: string | null; e: number;
  planes: { i: number; id: string; cx: number; cy: number; w: number; h: number; z: number; opacity: number; visible: boolean; layer: number }[];
};

export const snap = (p: Page): Promise<Snap> => p.evaluate(() => (window as any).__mino.archive().scene.snapshot());

export async function waitLive(p: Page) {
  await p.waitForFunction(() => (window as any).__mino?.archive()?.scene?.snapshot().phase === 'live', null, { timeout: 30_000, polling: 100 });
}

/** The nearest fully visible plane (front of the sphere). */
export async function frontPlane(p: Page) {
  const s = await snap(p);
  return s.planes.filter((x) => x.visible).sort((a, b) => b.z - a.z)[0];
}

export async function settled(p: Page) {
  await p.waitForFunction(() => !(window as any).__mino.running(), null, { timeout: 10_000 });
}

/** Angle between two quaternions, in radians. */
export const quatAngle = (a: number[], b: number[]) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

export const REFERENCE_WORDS = /Orvel|mailing list|join the waitlist|preview the waitlist|Gionatan|Nese\b|GN \.D|GN\.D|Creative Space|Multi.?Disciplinary|Curated Selection|DashDigital|Yousuf|Soomro|Erica Basile|Ferrari|Tengile|Project Info/i;

export async function expectNoReferenceBranding(p: Page) {
  const text = await p.evaluate(() => document.title + '\n' + document.body.innerText + '\n' + [...document.querySelectorAll('[aria-label],[alt],[title]')].map((e) => e.getAttribute('aria-label') + ' ' + e.getAttribute('alt') + ' ' + e.getAttribute('title')).join(' '));
  expect(text).not.toMatch(REFERENCE_WORDS);
}
