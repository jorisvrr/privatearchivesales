// Archive-sale enquiries from founders: POST /api/enquiry { email }. Routed separately from the waitlist.
// ENQUIRY_PROVIDER=resend   RESEND_API_KEY, ENQUIRY_TO, ENQUIRY_FROM (a sender on a domain verified in Resend)
// ENQUIRY_PROVIDER=webhook  ENQUIRY_WEBHOOK_URL [ENQUIRY_WEBHOOK_SECRET]
import { clean, htmlPage, isEmail, json, methodNotAllowed, mockAllowed, readBody, type Env, type Fetch } from './http.ts';

type Result = 'ok' | 'invalid' | 'not_configured' | 'failed';
const MESSAGES: Record<Result, string> = {
  ok: 'Thanks. Mino will follow up personally about stock, timing and terms.',
  invalid: 'Enter a valid work email, like name@label.com.',
  not_configured: 'Enquiries can’t be sent from this page yet. Nothing was sent.',
  failed: 'Your enquiry wasn’t sent. Please try again in a moment.',
};
const STATUS: Record<Result, number> = { ok: 200, invalid: 422, not_configured: 503, failed: 502 };

export function enquiryConfigured(env: Env): string[] {
  const missing: string[] = [];
  const ep = env.ENQUIRY_PROVIDER;
  if (!ep) missing.push('ENQUIRY_PROVIDER (resend | webhook)');
  else if (ep === 'resend') {
    if (!env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
    if (!env.ENQUIRY_TO || !isEmail(env.ENQUIRY_TO)) missing.push('ENQUIRY_TO');
    if (!env.ENQUIRY_FROM) missing.push('ENQUIRY_FROM');
  } else if (ep === 'webhook') { if (!env.ENQUIRY_WEBHOOK_URL) missing.push('ENQUIRY_WEBHOOK_URL'); }
  else if (ep === 'mock') { if (!mockAllowed(env)) missing.push('ENQUIRY_PROVIDER=mock is for local tests only'); }
  else missing.push(`ENQUIRY_PROVIDER "${ep}" is not supported`);
  return missing;
}

export function enquiryText(email: string) {
  return ['New archive-sale enquiry for Mino', '', `Work email: ${email}`, '', 'Next step: reply personally about stock, timing and terms.'].join('\n');
}

export async function handleEnquiry(req: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const { data, form } = await readBody(req);
  const send = (r: Result, extra: Record<string, unknown> = {}) =>
    form ? htmlPage(STATUS[r], MESSAGES[r], '/for-labels') : json(STATUS[r], r === 'ok' ? { status: 'ok', message: MESSAGES.ok } : { error: r, message: MESSAGES[r], ...extra });
  if (data.website) return send('ok'); // honeypot
  const email = clean(data.email, 254).toLowerCase();
  if (!isEmail(email)) return send('invalid', { fields: ['email'] });
  const missing = enquiryConfigured(env);
  if (missing.length) {
    console.warn('[mino] enquiry not configured:', missing.join(', '));
    return send('not_configured');
  }
  try {
    return send(await deliver(env, email, f));
  } catch (err) {
    console.error('[mino] enquiry failed', err);
    return send('failed');
  }
}

async function deliver(env: Env, email: string, f: Fetch): Promise<Result> {
  switch (env.ENQUIRY_PROVIDER) {
    case 'resend': {
      const res = await f('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.ENQUIRY_FROM, to: [env.ENQUIRY_TO], reply_to: email, subject: `Archive sale enquiry: ${email}`, text: enquiryText(email) }),
      });
      if (!res.ok) {
        console.error('[mino] resend', res.status, (await res.text()).slice(0, 300));
        return 'failed';
      }
      return ((await res.json().catch(() => ({}))) as { id?: string }).id ? 'ok' : 'failed';
    }
    case 'webhook': {
      const res = await f(env.ENQUIRY_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(env.ENQUIRY_WEBHOOK_SECRET ? { authorization: `Bearer ${env.ENQUIRY_WEBHOOK_SECRET}` } : {}) },
        body: JSON.stringify({ type: 'mino.archive_enquiry', email, receivedAt: new Date().toISOString() }),
      });
      return res.ok ? 'ok' : 'failed';
    }
    case 'mock':
      return email.startsWith('fail') ? 'failed' : 'ok';
    default:
      return 'failed';
  }
}
