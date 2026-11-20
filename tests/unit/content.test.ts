import { describe, expect, it } from 'vitest';
import * as content from '../../src/content/sale';
import { EVENT_CREDIT, eventTitle, isDemo, plateSubtitle, sale, SITE_TITLE } from '../../src/content/sale';

describe('sale content', () => {
  it('uses the Mino naming', () => {
    expect(SITE_TITLE).toBe('Mino — Private archive sales');
    expect(EVENT_CREDIT).toBe('Organized by Mino');
    expect(eventTitle()).toBe(`${sale.label ?? 'Featured label'} — Archive Sale 001`);
  });
  it('has 18 plates and no drop waitlist links in the public content', () => {
    expect(sale.plates).toHaveLength(18);
    expect(Object.keys(content)).not.toContain('waitlistHref');
    expect(Object.keys(content)).not.toContain('dropById');
    expect(JSON.stringify(sale)).not.toMatch(/waitlist/i);
  });
  it('publishes no partner, date, inventory or price that was not supplied', () => {
    expect(isDemo()).toBe(true);
    expect(sale.label).toBeNull();
    for (const g of sale.garments) expect([g.price, g.size, g.season, g.condition, g.note]).toEqual([null, null, null, null, null]);
    for (const p of sale.plates) expect(plateSubtitle(p)).not.toMatch(/€|\$|size/i);
  });
});
