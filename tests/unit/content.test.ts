import { afterEach, describe, expect, it } from 'vitest';
import { dropById, EVENT_CREDIT, eventTitle, isDemo, plateSubtitle, sale, SITE_TITLE, waitlistHref } from '../../src/content/sale';

describe('sale content', () => {
  const original = { status: sale.status, url: sale.drop.waitlistUrl };
  afterEach(() => { sale.status = original.status; sale.drop.waitlistUrl = original.url; });

  it('uses the Mino naming', () => {
    expect(SITE_TITLE).toBe('Mino — Private archive sales');
    expect(EVENT_CREDIT).toBe('Organized by Mino');
    expect(eventTitle()).toBe(`${sale.label ?? 'Featured label'} — Archive Sale 001`);
  });
  it('has 18 plates and one drop', () => {
    expect(sale.plates).toHaveLength(18);
    expect(dropById(sale.drop.id)).toMatchObject({ id: 'demo-archive-001', label: 'Featured label', status: 'demo' });
    expect(dropById('nope')).toBeNull();
  });
  it('publishes no partner, date, inventory or price that was not supplied', () => {
    expect(isDemo()).toBe(true);
    expect(sale.label).toBeNull();
    for (const g of sale.garments) expect([g.price, g.size, g.season, g.condition, g.note]).toEqual([null, null, null, null, null]);
    for (const p of sale.plates) expect(plateSubtitle(p)).not.toMatch(/€|\$|size/i);
  });
  it('waitlist link: demo → preview page; confirmed → the label’s own link; none → no link', () => {
    expect(waitlistHref()).toBe('/waitlist/demo-archive-001');
    sale.status = 'confirmed';
    sale.drop.waitlistUrl = 'https://label.example/pages/archive';
    expect(waitlistHref()).toBe('https://label.example/pages/archive');
    sale.status = 'none';
    expect(waitlistHref()).toBeNull();
  });
});
