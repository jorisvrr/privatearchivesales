// Mino's public endpoints: the founder enquiry from /plan, nothing else.
import { describe, expect, it, vi } from 'vitest';
import * as handlers from '../../server/handlers';
import { handleEnquiry, isEmail, missingConfig } from '../../server/handlers';
import { RELEASE_OPTIONS, TIMING_OPTIONS } from '../../server/enquiry';
import { RELEASE_OPTIONS as PLAN_RELEASE, TIMING_OPTIONS as PLAN_TIMING } from '../../src/pages/plan';

const json = (url: string, body: unknown) => new Request(`http://x${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
const RS = { ENQUIRY_PROVIDER: 'resend', RESEND_API_KEY: 'k', ENQUIRY_TO: 'inbox@example.com', ENQUIRY_FROM: 'Sender <sender@example.com>' };
const good = { release: 'Samples', timing: 'Within three months', email: 'founder@gmail.com', brand: '@studionorth', fax: '' };

describe("Mino's server", () => {
  it('exposes no waitlist or subscribe handler', () => {
    expect(Object.keys(handlers).sort()).toEqual(['enquiryText', 'handleEnquiry', 'isEmail', 'missingConfig']);
    expect(missingConfig({})).toEqual({ enquiry: ['ENQUIRY_PROVIDER (resend | webhook)'] });
  });
  it('the /plan options match what the server accepts', () => {
    expect(PLAN_RELEASE).toEqual([...RELEASE_OPTIONS]);
    expect(PLAN_TIMING).toEqual([...TIMING_OPTIONS]);
  });
});

describe('POST /api/enquiry (founder business enquiry)', () => {
  it('validates the two answers and the email; personal email domains are fine; brand link optional', async () => {
    expect(isEmail('founder@gmail.com')).toBe(true);
    const bad = await handleEnquiry(json('/api/enquiry', { release: 'Everything', timing: 'Tomorrow', email: 'x' }), RS, reply(200, { id: '1' }));
    expect(bad.status).toBe(422);
    expect((await bad.json()).fields).toEqual(['release', 'timing', 'email']);
    const ok = await handleEnquiry(json('/api/enquiry', { ...good, brand: '' }), RS, reply(200, { id: '1' }));
    expect(ok.status).toBe(200);
  });

  it('is not_configured without a provider and never reports success then', async () => {
    const r = await handleEnquiry(json('/api/enquiry', good), {});
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ error: 'not_configured' });
  });

  it('Resend: success only with a message id; carries the answers; reply-to is the founder', async () => {
    const f = reply(200, { id: 'msg_1' });
    expect((await handleEnquiry(json('/api/enquiry', good), RS, f)).status).toBe(200);
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ reply_to: 'founder@gmail.com', subject: 'Archive sale enquiry: Samples, within three months (founder@gmail.com)' });
    expect(body.text).toContain('Wants to release: Samples');
    expect(body.text).toContain('Considering a sale: Within three months');
    expect(body.text).toContain('Brand website or Instagram: @studionorth');
    expect((await handleEnquiry(json('/api/enquiry', good), RS, reply(200, {}))).status).toBe(502);
    expect((await handleEnquiry(json('/api/enquiry', good), RS, reply(403, 'no'))).status).toBe(502);
  });

  it('webhook gets the answers; a honeypot submission sends nothing', async () => {
    const f = reply(202, '');
    expect((await handleEnquiry(json('/api/enquiry', good), { ENQUIRY_PROVIDER: 'webhook', ENQUIRY_WEBHOOK_URL: 'https://hook.example/x' }, f)).status).toBe(200);
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(Object.keys(body).sort()).toEqual(['brand', 'email', 'receivedAt', 'release', 'timing', 'type']);
    const trap = reply(200, { id: 'x' });
    expect((await handleEnquiry(json('/api/enquiry', { ...good, fax: 'bot' }), RS, trap)).status).toBe(200);
    expect(trap).not.toHaveBeenCalled();
  });

  it('never subscribes the founder to a drop or a list, even if extra fields are posted', async () => {
    const f = reply(200, { id: 'msg_2' });
    const env = { ...RS, WAITLIST_PROVIDER: 'mailchimp', MAILCHIMP_API_KEY: 'abc-us21', MAILCHIMP_AUDIENCE_ID: 'list1' };
    const r = await handleEnquiry(json('/api/enquiry', { ...good, drop: 'demo-archive-001', order: '1001', subscribe: 'yes' }), env, f);
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://api.resend.com/emails');
  });
});
