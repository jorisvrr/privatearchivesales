// Mino's public endpoints: the founder enquiry only.
import { describe, expect, it, vi } from 'vitest';
import * as handlers from '../../server/handlers';
import { handleEnquiry, isEmail, missingConfig } from '../../server/handlers';

const json = (url: string, body: unknown) => new Request(`http://x${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const RS = { ENQUIRY_PROVIDER: 'resend', RESEND_API_KEY: 'k', ENQUIRY_TO: 'inbox@example.com', ENQUIRY_FROM: 'Sender <sender@example.com>' };

describe("Mino's server", () => {
  it('exposes no waitlist or subscribe handler', () => {
    expect(Object.keys(handlers).sort()).toEqual(['enquiryText', 'handleEnquiry', 'isEmail', 'missingConfig']);
    expect(missingConfig({})).toEqual({ enquiry: ['ENQUIRY_PROVIDER (resend | webhook)'] });
  });
});

describe('POST /api/enquiry (founder business enquiry, work email only)', () => {
  it('validates, is not_configured without a provider, and delivers through Resend', async () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect((await handleEnquiry(json('/api/enquiry', { email: 'x' }), RS, reply(200, { id: '1' }))).status).toBe(422);
    expect((await handleEnquiry(json('/api/enquiry', { email: 'f@s.co' }), {})).status).toBe(503);
    const f = reply(200, { id: 'msg_1' });
    const r = await handleEnquiry(json('/api/enquiry', { email: 'founder@studio.example' }), RS, f);
    expect((await r.json()).message).toMatch(/will follow up personally about stock, timing and terms\.$/);
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ reply_to: 'founder@studio.example', subject: 'Archive sale enquiry: founder@studio.example' });
    expect((await handleEnquiry(json('/api/enquiry', { email: 'founder@studio.example' }), RS, reply(403, 'no'))).status).toBe(502);
  });

  it('never subscribes the founder to a drop, even if a drop or order is posted', async () => {
    const f = reply(200, { id: 'msg_2' });
    const env = { ...RS, WAITLIST_PROVIDER: 'mailchimp', MAILCHIMP_API_KEY: 'abc-us21', MAILCHIMP_AUDIENCE_ID: 'list1' };
    const r = await handleEnquiry(json('/api/enquiry', { email: 'founder@studio.example', drop: 'demo-archive-001', order: '1001' }), env, f);
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://api.resend.com/emails');
    const res = await r.json();
    expect(res).not.toHaveProperty('round');
    expect(res).not.toHaveProperty('drop');
  });
});
