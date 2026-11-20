import { describe, expect, it, vi } from 'vitest';
import { handleEnquiry, handleWaitlist, isEmail, missingConfig, normalizeOrder, verifyOrder } from '../../server/handlers';
import type { DropInfo } from '../../server/waitlist';

const json = (url: string, body: unknown, method = 'POST') => new Request(`http://x${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const form = (url: string, body: Record<string, string>) => new Request(`http://x${url}`, { method: 'POST', body: new URLSearchParams(body) });
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const uniq = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}@example.com`;

// Two confirmed drops from two labels, verified through a webhook; entries kept by the local mock store.
const DROPS: Record<string, DropInfo> = {
  'north-archive-001': { id: 'north-archive-001', label: 'Studio North', status: 'confirmed', waitlistUrl: 'https://north.example/archive', verification: 'webhook' },
  'south-archive-002': { id: 'south-archive-002', label: 'South Atelier', status: 'confirmed', waitlistUrl: 'https://south.example/archive', verification: 'webhook' },
  'demo-archive-001': { id: 'demo-archive-001', label: 'Featured label', status: 'demo', waitlistUrl: null, verification: null },
};
const lookup = (id: string) => DROPS[id] ?? null;
const ENV = {
  WAITLIST_PROVIDER: 'mock', MINO_ALLOW_MOCK: '1',
  DROP_NORTH_ARCHIVE_001_VERIFY_URL: 'https://verify.example/north',
  DROP_SOUTH_ARCHIVE_002_VERIFY_URL: 'https://verify.example/south',
};
/** Fake order records: north order 5001 belongs to `owner`. */
const orders = (owner: string) => vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const b = JSON.parse(String(init?.body ?? '{}'));
  if (String(url).includes('/south')) return new Response(JSON.stringify({ verified: false }));
  return new Response(JSON.stringify({ verified: b.orderNumber === '5001' && b.email === owner }));
});
const join = (body: Record<string, string>, f: typeof fetch = reply(500, '')) => handleWaitlist(json('/api/waitlist', body), ENV, f, lookup);
const entries = async () => ((await (await handleWaitlist(new Request('http://x/api/waitlist?inspect=1'), ENV, fetch, lookup)).json()) as { entries: { drop: string; label: string; email: string; round: number }[] }).entries;

describe('waitlist: public signup (round 2)', () => {
  it('creates one entry for that drop and label', async () => {
    const email = uniq('public');
    const r = await join({ drop: 'north-archive-001', email });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ round: 2, drop: 'north-archive-001', label: 'Studio North', message: 'You’re on the waitlist. We’ll email you when the second round opens.' });
    expect((await entries()).filter((e) => e.email === email)).toEqual([{ drop: 'north-archive-001', label: 'Studio North', email, round: 2 }]);
  });
  it('one entry per email per drop: a repeat is a duplicate; another drop is a separate entry', async () => {
    const email = uniq('twice');
    await join({ drop: 'north-archive-001', email });
    const again = await join({ drop: 'north-archive-001', email });
    expect(again.status).toBe(409);
    expect((await join({ drop: 'south-archive-002', email })).status).toBe(200);
    const mine = (await entries()).filter((e) => e.email === email).map((e) => [e.drop, e.label, e.round]);
    expect(mine.sort()).toEqual([['north-archive-001', 'Studio North', 2], ['south-archive-002', 'South Atelier', 2]]);
  });
  it('validates the email and the drop', async () => {
    expect((await join({ drop: 'north-archive-001', email: 'nope' })).status).toBe(422);
    expect((await join({ drop: 'unknown-drop', email: uniq('x') })).status).toBe(404);
  });
});

describe('waitlist: verified past customer (round 1)', () => {
  it('verifies order number + checkout email together, then assigns round 1', async () => {
    const email = uniq('owner');
    const f = orders(email);
    const r = await join({ drop: 'north-archive-001', email, order: '#5001' }, f);
    expect(await r.json()).toMatchObject({ round: 1, drop: 'north-archive-001', message: 'Your order is verified. We’ll email you when first access opens.' });
    const call = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('https://verify.example/north');
    expect(JSON.parse(String(call[1].body))).toMatchObject({ drop: 'north-archive-001', label: 'Studio North', orderNumber: '5001', email });
    expect((await entries()).filter((e) => e.email === email)).toEqual([{ drop: 'north-archive-001', label: 'Studio North', email, round: 1 }]);
  });
  it('upgrades an existing public entry instead of adding a second one, and never downgrades', async () => {
    const email = uniq('upgrade');
    await join({ drop: 'north-archive-001', email });
    const r = await join({ drop: 'north-archive-001', email, order: '5001' }, orders(email));
    expect(await r.json()).toMatchObject({ round: 1, upgraded: true });
    expect((await entries()).filter((e) => e.email === email)).toEqual([{ drop: 'north-archive-001', label: 'Studio North', email, round: 1 }]);
    const later = await join({ drop: 'north-archive-001', email });
    expect(await later.json()).toMatchObject({ round: 1, existing: true });
  });
  it('a failed match stores nothing and offers round 2; the order of one label does not verify for another', async () => {
    const email = uniq('wrong');
    const wrongEmail = await join({ drop: 'north-archive-001', email, order: '5001' }, orders('someone-else@example.com'));
    expect(wrongEmail.status).toBe(422);
    expect(await wrongEmail.json()).toMatchObject({ error: 'no_match', fields: ['order'] });
    const otherLabel = await join({ drop: 'south-archive-002', email, order: '5001' }, orders(email));
    expect(otherLabel.status).toBe(422);
    expect((await entries()).filter((e) => e.email === email)).toEqual([]);
  });
  it('verification unavailable (error, timeout, not configured) never verifies and stores nothing', async () => {
    const email = uniq('down');
    expect((await join({ drop: 'north-archive-001', email, order: '5001' }, reply(500, 'down'))).status).toBe(503);
    expect((await join({ drop: 'north-archive-001', email, order: '5001' }, vi.fn(async () => { throw new Error('timeout'); }))).status).toBe(503);
    const noVerify = await handleWaitlist(json('/api/waitlist', { drop: 'north-archive-001', email, order: '5001' }), { WAITLIST_PROVIDER: 'mock', MINO_ALLOW_MOCK: '1' }, orders(email), lookup);
    expect(await noVerify.json()).toMatchObject({ error: 'unavailable' });
    expect((await entries()).filter((e) => e.email === email)).toEqual([]);
  });
});

describe('waitlist: configuration and preview', () => {
  it('demo drops are previews outside local tests; missing storage is not_configured', async () => {
    const preview = await handleWaitlist(json('/api/waitlist', { drop: 'demo-archive-001', email: uniq('p') }), {}, fetch, lookup);
    expect(preview.status).toBe(403);
    expect(await preview.json()).toMatchObject({ error: 'preview' });
    const none = await handleWaitlist(json('/api/waitlist', { drop: 'north-archive-001', email: uniq('n') }), {}, fetch, lookup);
    expect(await none.json()).toMatchObject({ error: 'not_configured' });
  });
  it('no-JavaScript posts get an answer page linking back to the drop', async () => {
    const r = await handleWaitlist(form('/api/waitlist', { drop: 'north-archive-001', email: uniq('nojs') }), ENV, fetch, lookup);
    const html = await r.text();
    expect(html).toContain('You’re on the waitlist. We’ll email you when the second round opens.');
    expect(html).toContain('href="/waitlist/north-archive-001"');
  });
  it('names what is missing', () => {
    const m = missingConfig({});
    expect(m.waitlist).toEqual(['WAITLIST_PROVIDER (buttondown | mailchimp)']);
    expect(m.enquiry).toEqual(['ENQUIRY_PROVIDER (resend | webhook)']);
    expect(m.verification[0]).toContain('demo-archive-001');
    expect(missingConfig({ WAITLIST_PROVIDER: 'mock', MINO_ALLOW_MOCK: '1', VERCEL: '1' }).waitlist).toHaveLength(1);
  });
});

describe('order verification adapters', () => {
  const shop: DropInfo = { id: 'north-archive-001', label: 'Studio North', status: 'confirmed', waitlistUrl: null, verification: 'shopify' };
  const env = { DROP_NORTH_ARCHIVE_001_SHOPIFY_DOMAIN: 'north.myshopify.com', DROP_NORTH_ARCHIVE_001_SHOPIFY_TOKEN: 'shpat_x' };
  it('Shopify: matches the order name and the checkout email', async () => {
    const f = reply(200, { orders: [{ name: '#5001', email: 'Owner@Example.com', contact_email: null }] });
    expect(await verifyOrder(shop, 'owner@example.com', '5001', env, f)).toBe('verified');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('https://north.myshopify.com/admin/api/2024-10/orders.json');
    expect(url).toContain('name=%235001');
    expect((init.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe('shpat_x');
    expect(await verifyOrder(shop, 'other@example.com', '5001', env, f)).toBe('no_match');
    expect(await verifyOrder(shop, 'owner@example.com', '5001', env, reply(401, 'bad token'))).toBe('unavailable');
    expect(await verifyOrder(shop, 'owner@example.com', '5001', {}, f)).toBe('unavailable');
  });
  it('normalises order numbers', () => {
    expect(normalizeOrder(' #1001 ')).toBe('1001');
    expect(normalizeOrder('ab-12')).toBe('AB-12');
  });
});

describe('waitlist storage through the existing providers', () => {
  const drop: DropInfo = { id: 'north-archive-001', label: 'Studio North', status: 'confirmed', waitlistUrl: null, verification: 'webhook' };
  const look = () => drop;
  it('Mailchimp: upsert the contact, tag drop + label + round, untag the other round', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/tags?count=1000')) return new Response(JSON.stringify({ tags: [{ name: 'drop:north-archive-001:round-2' }] }));
      if (String(url).includes('verify')) return new Response(JSON.stringify({ verified: true }));
      return String(url).endsWith('/tags') ? new Response(null, { status: 204 }) : new Response('{}', { status: 200 });
    });
    const env = { WAITLIST_PROVIDER: 'mailchimp', MAILCHIMP_API_KEY: 'abc-us21', MAILCHIMP_AUDIENCE_ID: 'list1', DROP_NORTH_ARCHIVE_001_VERIFY_URL: 'https://verify.example' };
    const r = await handleWaitlist(json('/api/waitlist', { drop: drop.id, email: 'a@b.co', order: '9' }), env, f, look);
    expect(await r.json()).toMatchObject({ round: 1, upgraded: true });
    const tagCall = calls.find((c) => c.url.endsWith('/tags') && c.init?.method === 'POST')!;
    expect(tagCall.url).toContain('https://us21.api.mailchimp.com/3.0/lists/list1/members/');
    expect(JSON.parse(String(tagCall.init!.body)).tags).toEqual([
      { name: 'drop:north-archive-001', status: 'active' },
      { name: 'label:studio-north', status: 'active' },
      { name: 'drop:north-archive-001:round-1', status: 'active' },
      { name: 'drop:north-archive-001:round-2', status: 'inactive' },
    ]);
  });
  it('Buttondown: new public entry posts the drop tags; an upgrade patches out the round-2 tag', async () => {
    const env = { WAITLIST_PROVIDER: 'buttondown', BUTTONDOWN_API_KEY: 'k', DROP_NORTH_ARCHIVE_001_VERIFY_URL: 'https://verify.example' };
    const created = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => (init?.method ? new Response('{}', { status: 201 }) : new Response('', { status: 404 })));
    expect((await handleWaitlist(json('/api/waitlist', { drop: drop.id, email: 'n@b.co' }), env, created, look)).status).toBe(200);
    const post = created.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ email_address: 'n@b.co', tags: ['drop:north-archive-001', 'label:studio-north', 'drop:north-archive-001:round-2'] });
    const existing = ['other-tag', 'drop:north-archive-001', 'label:studio-north', 'drop:north-archive-001:round-2'];
    const upgrade = vi.fn(async (u: string | URL | Request, init?: RequestInit) =>
      String(u).includes('verify') ? new Response(JSON.stringify({ verified: true })) : init?.method ? new Response('{}') : new Response(JSON.stringify({ tags: existing })));
    expect(await (await handleWaitlist(json('/api/waitlist', { drop: drop.id, email: 'n@b.co', order: '1' }), env, upgrade, look)).json()).toMatchObject({ round: 1 });
    const patch = upgrade.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')!;
    expect(JSON.parse(String((patch[1] as RequestInit).body)).tags).toEqual(['other-tag', 'drop:north-archive-001', 'label:studio-north', 'drop:north-archive-001:round-1']);
  });
});

describe('POST /api/enquiry (work email only)', () => {
  const RS = { ENQUIRY_PROVIDER: 'resend', RESEND_API_KEY: 'k', ENQUIRY_TO: 'inbox@example.com', ENQUIRY_FROM: 'Mino <sender@example.com>' };
  it('validates, is not_configured without a provider, and delivers through Resend', async () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect((await handleEnquiry(json('/api/enquiry', { email: 'x' }), RS, reply(200, { id: '1' }))).status).toBe(422);
    expect((await handleEnquiry(json('/api/enquiry', { email: 'f@s.co' }), {})).status).toBe(503);
    const f = reply(200, { id: 'msg_1' });
    const r = await handleEnquiry(json('/api/enquiry', { email: 'founder@studio.example' }), RS, f);
    expect(await r.json()).toMatchObject({ message: 'Thanks. Mino will follow up personally about stock, timing and terms.' });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ reply_to: 'founder@studio.example', subject: 'Archive sale enquiry: founder@studio.example' });
    expect((await handleEnquiry(json('/api/enquiry', { email: 'founder@studio.example' }), RS, reply(403, 'no'))).status).toBe(502);
  });
});
