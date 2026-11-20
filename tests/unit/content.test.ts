import { describe, expect, it } from 'vitest';
import { EVENT_CREDIT, eventTitle, isDemo, plateSubtitle, sale, SITE_TITLE } from '../../src/content/sale';

describe('sale content', () => {
  it('uses the agreed naming', () => {
    expect(SITE_TITLE).toBe('Orvel — Private archive sales');
    expect(EVENT_CREDIT).toBe('Organized by Orvel');
    expect(eventTitle()).toBe(`${sale.label ?? 'Featured label'} — Archive Sale 001`);
  });
  it('has 18 plates, each a 3:4 demo plate with small and large files', () => {
    expect(sale.plates).toHaveLength(18);
    for (const p of sale.plates) expect(p.small).toMatch(/-s\.jpg$/);
  });
  it('publishes no partner, date, inventory or price that was not supplied', () => {
    expect(isDemo()).toBe(true);
    expect(sale.label).toBeNull();
    expect(sale.date).toBeNull();
    for (const g of sale.garments) expect([g.price, g.size, g.season, g.condition, g.note]).toEqual([null, null, null, null, null]);
    for (const p of sale.plates) expect(plateSubtitle(p)).not.toMatch(/€|\$|size/i);
  });
});
