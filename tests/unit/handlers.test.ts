import { describe, expect, it, vi } from 'vitest';
import { handleEnquiry, handleSubscribe, isEmail, missingConfig } from '../../server/handlers';

const json = (url: string, body: unknown) => new Request(`http://x${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const form = (url: string, body: Record<string, string>) => new Request(`http://x${url}`, { method: 'POST', body: new URLSearchParams(body) });
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const BD = { MAILING_PROVIDER: 'buttondown', BUTTONDOWN_API_KEY: 'k' };
const MC = { MAILING_PROVIDER: 'mailchimp', MAILCHIMP_API_KEY: 'abc-us21', MAILCHIMP_AUDIENCE_ID: 'list1' };
const RS = { ENQUIRY_PROVIDER: 'resend', RESEND_API_KEY: 'k', ENQUIRY_TO: 'hello@orvel.example', ENQUIRY_FROM: 'Orvel <site@orvel.example>' };
const enquiry = { label: 'Studio A', email: 'founder@studio.example', city: 'Amsterdam', quantity: '50 to 150 pieces', note: '' };

describe('email validation', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.nl'])('accepts %s', (e) => expect(isEmail(e)).toBe(true));
  it.each(['', 'a@b', 'a b@c.com', '@c.com', 'a@.com', 'a@b.c'])('rejects %s', (e) => expect(isEmail(e)).toBe(false));
});

describe('configuration', () => {
  it('names what is missing', () => {
    expect(missingConfig({})).toEqual({ subscribe: ['MAILING_PROVIDER (buttondown | mailchimp)'], enquiry: ['ENQUIRY_PROVIDER (resend | webhook)'] });
    expect(missingConfig({ MAILING_PROVIDER: 'mailchimp', ENQUIRY_PROVIDER: 'resend' }).enquiry).toEqual(['RESEND_API_KEY', 'ENQUIRY_TO', 'ENQUIRY_FROM']);
  });
  it('refuses the mock provider on Vercel', () => {
    expect(missingConfig({ MAILING_PROVIDER: 'mock', ORVEL_ALLOW_MOCK: '1', VERCEL: '1' }).subscribe).toHaveLength(1);
  });
});

describe('POST /api/subscribe', () => {
  it('returns 503 not_configured without a provider, never success', async () => {
    const r = await handleSubscribe(json('/api/subscribe', { email: 'a@b.co' }), {});
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('not_configured');
  });
  it('rejects invalid addresses before calling the provider', async () => {
    const f = reply(201, {});
    const r = await handleSubscribe(json('/api/subscribe', { email: 'nope' }), BD, f);
    expect(r.status).toBe(422);
    expect(f).not.toHaveBeenCalled();
  });
  it('honeypot submissions are not stored', async () => {
    const f = reply(201, {});
    expect((await handleSubscribe(json('/api/subscribe', { email: 'a@b.co', company: 'x' }), BD, f)).status).toBe(200);
    expect(f).not.toHaveBeenCalled();
  });
  it('Buttondown: accepted, duplicate, invalid, failed, network error', async () => {
    const f = reply(201, { id: '1' });
    expect((await handleSubscribe(json('/api/subscribe', { email: ' A@B.co ' }), BD, f)).status).toBe(200);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.buttondown.com/v1/subscribers');
    expect(JSON.parse(String(init.body))).toEqual({ email_address: 'a@b.co', tags: ['wave-2'] });
    expect((await handleSubscribe(json('/api/subscribe', { email: 'a@b.co' }), BD, reply(400, { code: 'email_already_exists' }))).status).toBe(409);
    expect((await handleSubscribe(json('/api/subscribe', { email: 'a@b.co' }), BD, reply(400, { code: 'email_invalid' }))).status).toBe(422);
    expect((await handleSubscribe(json('/api/subscribe', { email: 'a@b.co' }), BD, reply(500, 'boom'))).status).toBe(502);
    expect((await handleSubscribe(json('/api/subscribe', { email: 'a@b.co' }), BD, vi.fn(async () => { throw new Error('offline'); }))).status).toBe(502);
  });
  it('Mailchimp: data centre from the key, Member Exists → duplicate', async () => {
    const f = reply(200, { id: 'x' });
    expect((await handleSubscribe(json('/api/subscribe', { email: 'a@b.co' }), MC, f)).status).toBe(200);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://us21.api.mailchimp.com/3.0/lists/list1/members');
    expect((await handleSubscribe(json('/api/subscribe', { email: 'a@b.co' }), MC, reply(400, { title: 'Member Exists' }))).status).toBe(409);
  });
  it('form posts (no JavaScript) get an HTML page with the outcome', async () => {
    const r = await handleSubscribe(form('/api/subscribe', { email: 'a@b.co' }), BD, reply(201, {}));
    expect(r.headers.get('content-type')).toContain('text/html');
    expect(await r.text()).toContain('You’re on Orvel’s list. We’ll email you when booking opens.');
  });
  it('reports double opt-in so the page can ask people to confirm by email', async () => {
    const ok = async (env: Record<string, string>) => (await (await handleSubscribe(json('/api/subscribe', { email: `c${Math.random()}@b.co` }), env, reply(200, { id: 'x' }))).json()).confirm;
    expect(await ok(MC)).toBe(false);
    expect(await ok({ ...MC, MAILCHIMP_DOUBLE_OPT_IN: '1' })).toBe(true);
    expect(await ok({ ...BD, MAILING_DOUBLE_OPT_IN: '1' })).toBe(true);
  });
  it('mock provider detects repeat signups', async () => {
    const env = { MAILING_PROVIDER: 'mock', ORVEL_ALLOW_MOCK: '1' };
    expect((await handleSubscribe(json('/api/subscribe', { email: 'repeat@b.co' }), env)).status).toBe(200);
    expect((await handleSubscribe(json('/api/subscribe', { email: 'repeat@b.co' }), env)).status).toBe(409);
  });
});

describe('POST /api/enquiry', () => {
  it('requires label, email, city and quantity', async () => {
    const r = await handleEnquiry(json('/api/enquiry', { ...enquiry, label: '', email: 'x' }), RS, reply(200, { id: '1' }));
    expect(r.status).toBe(422);
    expect((await r.json()).fields).toEqual(['label', 'email']);
  });
  it('is not_configured without a provider', async () => {
    expect((await handleEnquiry(json('/api/enquiry', enquiry), {})).status).toBe(503);
  });
  it('Resend: success only with a message id; reply-to is the founder', async () => {
    const f = reply(200, { id: 'msg_1' });
    const r = await handleEnquiry(json('/api/enquiry', enquiry), RS, f);
    expect(r.status).toBe(200);
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ to: ['hello@orvel.example'], reply_to: 'founder@studio.example', subject: 'Stock enquiry: Studio A (Amsterdam)' });
    expect(body.text).toContain('Approximate quantity: 50 to 150 pieces');
    expect((await handleEnquiry(json('/api/enquiry', enquiry), RS, reply(200, {}))).status).toBe(502);
    expect((await handleEnquiry(json('/api/enquiry', enquiry), RS, reply(403, 'domain not verified'))).status).toBe(502);
  });
  it('webhook delivery', async () => {
    const f = reply(202, '');
    expect((await handleEnquiry(json('/api/enquiry', enquiry), { ENQUIRY_PROVIDER: 'webhook', ENQUIRY_WEBHOOK_URL: 'https://hook.example/x' }, f)).status).toBe(200);
  });
});
