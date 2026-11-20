import { describe, expect, it } from 'vitest';
import placement from '../fixtures/placement.json';
import { ambientQuat, fibonacciSlots, project, slotWorld, sphereLayout } from '../../src/scene/sphere-math';

describe('Fibonacci sphere', () => {
  it('uses max(items, 18) slots on the unit sphere', () => {
    expect(fibonacciSlots(10)).toHaveLength(18);
    expect(fibonacciSlots(24)).toHaveLength(24);
    for (const s of fibonacciSlots(18)) expect(Math.hypot(...s)).toBeCloseTo(1, 10);
  });

  it('is deterministic', () => {
    expect(fibonacciSlots(18)).toEqual(fibonacciSlots(18));
  });
});

describe('responsive layout (AUDIT §9)', () => {
  it.each([
    [1920, 1080, 250, 82],
    [1440, 900, 200, 65.6],
    [1280, 800, 200, 65.6],
    [768, 1024, 250, 82],
    [390, 844, 141, 60],
  ])('%i×%i → radius %f, planes %f', (w, h, r, p) => {
    const L = sphereLayout(w, h);
    expect(L.radiusPx).toBeCloseTo(r, 5);
    expect(L.planePx).toBeCloseTo(p, 5);
  });

  it('expands to 70 % of the height, width-limited on phones', () => {
    expect(sphereLayout(1440, 900)).toMatchObject({ expandedH: 630, expandedW: 472.5 });
    expect(sphereLayout(1280, 800)).toMatchObject({ expandedH: 560, expandedW: 420 });
    const t = sphereLayout(768, 1024);
    expect(t.expandedW).toBeCloseTo(537.6, 1);
    expect(t.expandedH).toBeCloseTo(716.8, 1);
    const m = sphereLayout(390, 844);
    expect(m.expandedW).toBe(374);
    expect(m.expandedH).toBeCloseTo(498.7, 1);
  });
});

describe('placement matches the audit table at 1440×900', () => {
  const L = sphereLayout(1440, 900);
  const slots = fibonacciSlots(18);
  for (const [key, table] of Object.entries(placement as Record<string, { actualMs: number; rows: { i: number; cx: number; cy: number; h: number; z: number; layer: number }[] }>)) {
    it(`${key} (t = ${table.actualMs} ms after explode)`, () => {
      const q = ambientQuat(table.actualMs / 1000);
      const errors = table.rows.map((r) => {
        const w = slotWorld(slots[r.i], q, L);
        const p = project(w, L.planePx * L.wpp, L);
        expect(Math.abs(p.h - r.h)).toBeLessThan(0.6);
        expect(Math.abs(p.z - r.z)).toBeLessThan(0.02);
        return Math.hypot(p.x - (r.cx / 100) * 1440, p.y - (r.cy / 100) * 900);
      });
      // Table values are rounded to 0.1 % of the viewport (≈1.4 px / 0.9 px).
      expect(Math.max(...errors)).toBeLessThan(2);
      expect(errors.reduce((a, b) => a + b) / errors.length).toBeLessThan(0.8);
    });
  }
});
