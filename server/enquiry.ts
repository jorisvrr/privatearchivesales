// Archive-sale enquiries from founders: POST /api/enquiry { release, timing, email, brand? }.
// A business enquiry only: never a drop waitlist, never a marketing list. Routed separately.
// ENQUIRY_PROVIDER=resend   RESEND_API_KEY, ENQUIRY_TO, ENQUIRY_FROM (a sender on a domain verified in Resend)
// ENQUIRY_PROVIDER=webhook  ENQUIRY_WEBHOOK_URL [ENQUIRY_WEBHOOK_SECRET]
import { name } from '../src/config/brand.ts';
import { clean, htmlPage, isEmail, json, methodNotAllowed, mockAllowed, readBody, type Env, type Fetch } from './http.ts';

/** The /plan questions. The server accepts only these answers. */
export const RELEASE_OPTIONS = ['Past collections', 'Samples', 'Both', 'Still exploring'] as const;
export const TIMING_OPTIONS = ['Next month', 'Within three months', 'Exploring'] as const;

export interface Enquiry { release: string; timing: string; email: string; brand: string }

type Result = 'ok' | 'invalid' | 'not_configured' | 'failed';
const MESSAGES: Record<Result, string> = {
  ok: `Your enquiry is with ${name}. We’ll review your answers and follow up by email to discuss your archive and the next steps.`,
  invalid: 'Some answers are missing or invalid. Go back and check them.',
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

export function enquiryText(e: Enquiry) {
  return [
    `New archive-sale enquiry for ${name}`,
    '',
    `Wants to release: ${e.release}`,
    `Considering a sale: ${e.timing}`,
    `Work email: ${e.email}`,
    `Brand website or Instagram: ${e.brand || '(not given)'}`,
    '',
    'Next step: review, then reply by email to discuss the sale structure, scope and fees.',
  ].join('\n');
}

export async function handleEnquiry(req: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const { data, form } = await readBody(req);
  const send = (r: Result, extra: Record<string, unknown> = {}) =>
    form ? htmlPage(STATUS[r], MESSAGES[r], '/plan') : json(STATUS[r], r === 'ok' ? { status: 'ok', message: MESSAGES.ok } : { error: r, message: MESSAGES[r], ...extra });
  if (data.fax) return send('ok'); // honeypot: bots fill every field; nothing is sent
  const e: Enquiry = {
    release: clean(data.release, 40),
    timing: clean(data.timing, 40),
    email: clean(data.email, 254).toLowerCase(),
    brand: clean(data.brand, 200),
  };
  const bad = [
    !(RELEASE_OPTIONS as readonly string[]).includes(e.release) && 'release',
    !(TIMING_OPTIONS as readonly string[]).includes(e.timing) && 'timing',
    !isEmail(e.email) && 'email',
  ].filter(Boolean) as string[];
  if (bad.length) return send('invalid', { fields: bad });
  const missing = enquiryConfigured(env);
  if (missing.length) {
    console.warn('[mino] enquiry not configured:', missing.join(', '));
    return send('not_configured');
  }
  try {
    return send(await deliver(env, e, f));
  } catch (err) {
    console.error('[mino] enquiry failed', err);
    return send('failed');
  }
}

async function deliver(env: Env, e: Enquiry, f: Fetch): Promise<Result> {
  switch (env.ENQUIRY_PROVIDER) {
    case 'resend': {
      const res = await f('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.ENQUIRY_FROM, to: [env.ENQUIRY_TO], reply_to: e.email, subject: `Archive sale enquiry: ${e.release}, ${e.timing.toLowerCase()} (${e.email})`, text: enquiryText(e) }),
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
        body: JSON.stringify({ type: 'mino.archive_enquiry', ...e, receivedAt: new Date().toISOString() }),
      });
      return res.ok ? 'ok' : 'failed';
    }
    case 'mock':
      return e.email.startsWith('fail') ? 'failed' : 'ok';
    default:
      return 'failed';
  }
}
