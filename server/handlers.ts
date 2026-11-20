// Form endpoints shared by the Vercel functions (api/*.ts) and the local dev/preview server.
// Web-standard Request → Response. Success is returned only once the provider has accepted the request.
//
// Mailing list (second invitation to each archive), MAILING_PROVIDER:
//   buttondown  BUTTONDOWN_API_KEY [BUTTONDOWN_TAGS="wave-2"] [MAILING_DOUBLE_OPT_IN=1 if the newsletter uses double opt-in]
//   mailchimp   MAILCHIMP_API_KEY (ends in -usX), MAILCHIMP_AUDIENCE_ID [MAILCHIMP_DOUBLE_OPT_IN=1] [MAILCHIMP_TAGS="wave-2"]
// Archive-sale enquiries (work email only), ENQUIRY_PROVIDER:
//   resend      RESEND_API_KEY, ENQUIRY_TO, ENQUIRY_FROM (a sender on a domain verified in Resend)
//   webhook     ENQUIRY_WEBHOOK_URL [ENQUIRY_WEBHOOK_SECRET]
// Local tests only: provider "mock" with ORVEL_ALLOW_MOCK=1 (refused when running on Vercel).

export type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export const isEmail = (v: string) => v.length <= 254 && EMAIL.test(v);

export type Result = 'ok' | 'duplicate' | 'invalid' | 'not_configured' | 'failed';

const MESSAGES: Record<'subscribe' | 'enquiry', Record<Result, string>> = {
  subscribe: {
    ok: 'You’re on the list. We’ll email you when the next archive opens.',
    duplicate: 'This address is already on Orvel’s list. We’ll email you when the next archive opens.',
    invalid: 'Enter a valid email address, like name@example.com.',
    not_configured: 'The mailing list isn’t open yet. Your address wasn’t saved.',
    failed: 'Your address wasn’t added. Please try again in a moment.',
  },
  enquiry: {
    ok: 'Thanks. Orvel will follow up personally about stock, timing and terms.',
    duplicate: 'Thanks. Orvel will follow up personally about stock, timing and terms.',
    invalid: 'Enter a valid work email, like name@label.com.',
    not_configured: 'Enquiries can’t be sent from this page yet. Nothing was sent.',
    failed: 'Your enquiry wasn’t sent. Please try again in a moment.',
  },
};
const STATUS: Record<Result, number> = { ok: 200, duplicate: 409, invalid: 422, not_configured: 503, failed: 502 };

// --------------------------------------------------------------- configuration

export function missingConfig(env: Env): { subscribe: string[]; enquiry: string[] } {
  const sub: string[] = [];
  const enq: string[] = [];
  const mp = env.MAILING_PROVIDER;
  if (!mp) sub.push('MAILING_PROVIDER (buttondown | mailchimp)');
  else if (mp === 'buttondown') { if (!env.BUTTONDOWN_API_KEY) sub.push('BUTTONDOWN_API_KEY'); }
  else if (mp === 'mailchimp') {
    if (!env.MAILCHIMP_API_KEY || !/-[a-z]+\d+$/.test(env.MAILCHIMP_API_KEY)) sub.push('MAILCHIMP_API_KEY (format key-usX)');
    if (!env.MAILCHIMP_AUDIENCE_ID) sub.push('MAILCHIMP_AUDIENCE_ID');
  } else if (mp === 'mock') { if (!mockAllowed(env)) sub.push('MAILING_PROVIDER=mock is for local tests only'); }
  else sub.push(`MAILING_PROVIDER "${mp}" is not supported`);
  const ep = env.ENQUIRY_PROVIDER;
  if (!ep) enq.push('ENQUIRY_PROVIDER (resend | webhook)');
  else if (ep === 'resend') {
    if (!env.RESEND_API_KEY) enq.push('RESEND_API_KEY');
    if (!env.ENQUIRY_TO || !isEmail(env.ENQUIRY_TO)) enq.push('ENQUIRY_TO');
    if (!env.ENQUIRY_FROM) enq.push('ENQUIRY_FROM');
  } else if (ep === 'webhook') { if (!env.ENQUIRY_WEBHOOK_URL) enq.push('ENQUIRY_WEBHOOK_URL'); }
  else if (ep === 'mock') { if (!mockAllowed(env)) enq.push('ENQUIRY_PROVIDER=mock is for local tests only'); }
  else enq.push(`ENQUIRY_PROVIDER "${ep}" is not supported`);
  return { subscribe: sub, enquiry: enq };
}

const mockAllowed = (env: Env) => env.ORVEL_ALLOW_MOCK === '1' && !env.VERCEL;

// --------------------------------------------------------------- request parsing

async function readBody(req: Request): Promise<{ data: Record<string, string>; form: boolean }> {
  const type = req.headers.get('content-type') ?? '';
  const data: Record<string, string> = {};
  if (type.includes('application/json')) {
    const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(json ?? {})) if (typeof v === 'string') data[k] = v;
    return { data, form: false };
  }
  const fd = await req.formData().catch(() => null);
  fd?.forEach((v, k) => { if (typeof v === 'string') data[k] = v; });
  return { data, form: true };
}

/** True when the provider sends a confirmation email before the address counts (double opt-in). */
export const doubleOptIn = (env: Env) =>
  env.MAILING_PROVIDER === 'mailchimp' ? env.MAILCHIMP_DOUBLE_OPT_IN === '1' : env.MAILING_DOUBLE_OPT_IN === '1';

function respond(kind: 'subscribe' | 'enquiry', result: Result, asForm: boolean, fields?: string[], confirm = false): Response {
  const message = result === 'ok' && confirm ? 'Check your email: confirm your address from the email Orvel just sent.' : MESSAGES[kind][result];
  if (!asForm) {
    return new Response(JSON.stringify(result === 'ok' ? { status: 'ok', message, confirm } : { error: result, message, fields }), {
      status: STATUS[result],
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  // No-JavaScript fallback: a minimal confirmation or error page.
  const back = kind === 'subscribe' ? '/about' : '/for-labels';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orvel — Private archive sales</title>
<style>body{margin:0;font:400 17px/1.45 Georgia,serif;color:#000;background:#fff}main{max-width:460px;margin:22vh auto 0;padding:0 16px}p.b{font:500 14px Arial,sans-serif;margin-bottom:40px}a{font:500 13px Arial,sans-serif;color:#000}</style></head>
<body><main><p class="b">Orvel</p><p role="status">${message}</p><p><a href="${back}">Back</a></p></main></body></html>`;
  return new Response(html, { status: STATUS[result], headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

const methodNotAllowed = () => new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });

// --------------------------------------------------------------- mailing list

const mockList = new Set<string>();

export async function handleSubscribe(req: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const { data, form } = await readBody(req);
  if (data.company) return respond('subscribe', 'ok', form); // honeypot: pretend, store nothing
  const email = (data.email ?? '').trim().toLowerCase();
  if (!isEmail(email)) return respond('subscribe', 'invalid', form, ['email']);
  if (missingConfig(env).subscribe.length) {
    console.warn('[orvel] subscribe not configured:', missingConfig(env).subscribe.join(', '));
    return respond('subscribe', 'not_configured', form);
  }
  let result: Result;
  try {
    result = await subscribeWith(env, email, f);
  } catch (err) {
    console.error('[orvel] subscribe failed', err);
    result = 'failed';
  }
  return respond('subscribe', result, form, result === 'invalid' ? ['email'] : undefined, result === 'ok' && doubleOptIn(env));
}

async function subscribeWith(env: Env, email: string, f: Fetch): Promise<Result> {
  const tags = (env.BUTTONDOWN_TAGS ?? env.MAILCHIMP_TAGS ?? 'wave-2').split(',').map((t) => t.trim()).filter(Boolean);
  switch (env.MAILING_PROVIDER) {
    case 'buttondown': {
      const res = await f('https://api.buttondown.com/v1/subscribers', {
        method: 'POST',
        headers: { authorization: `Token ${env.BUTTONDOWN_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email_address: email, tags }),
      });
      if (res.ok) return 'ok';
      const body = await res.text();
      if (res.status === 409 || /already|exists/i.test(body)) return 'duplicate';
      if (res.status === 400 && /invalid/i.test(body)) return 'invalid';
      console.error('[orvel] buttondown', res.status, body.slice(0, 300));
      return 'failed';
    }
    case 'mailchimp': {
      const key = env.MAILCHIMP_API_KEY!;
      const dc = key.split('-').pop();
      const res = await f(`https://${dc}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_AUDIENCE_ID}/members`, {
        method: 'POST',
        headers: { authorization: `Basic ${btoa(`orvel:${key}`)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email_address: email, status: env.MAILCHIMP_DOUBLE_OPT_IN === '1' ? 'pending' : 'subscribed', tags }),
      });
      if (res.ok) return 'ok';
      const body = (await res.json().catch(() => ({}))) as { title?: string; detail?: string };
      if (body.title === 'Member Exists') return 'duplicate';
      if (body.title === 'Invalid Resource' && /email/i.test(body.detail ?? '')) return 'invalid';
      console.error('[orvel] mailchimp', res.status, body.title, body.detail);
      return 'failed';
    }
    case 'mock': {
      if (email.startsWith('fail')) return 'failed';
      if (mockList.has(email)) return 'duplicate';
      mockList.add(email);
      return 'ok';
    }
    default:
      return 'failed';
  }
}

// --------------------------------------------------------------- archive-sale enquiries

const clean = (v: string | undefined, max: number) => (v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

export async function handleEnquiry(req: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const { data, form } = await readBody(req);
  if (data.website) return respond('enquiry', 'ok', form); // honeypot
  const email = clean(data.email, 254).toLowerCase();
  if (!isEmail(email)) return respond('enquiry', 'invalid', form, ['email']);
  if (missingConfig(env).enquiry.length) {
    console.warn('[orvel] enquiry not configured:', missingConfig(env).enquiry.join(', '));
    return respond('enquiry', 'not_configured', form);
  }
  let result: Result;
  try {
    result = await deliverEnquiry(env, email, f);
  } catch (err) {
    console.error('[orvel] enquiry failed', err);
    result = 'failed';
  }
  return respond('enquiry', result, form);
}

export function enquiryText(email: string) {
  return [
    'New archive-sale enquiry for Orvel',
    '',
    `Work email: ${email}`,
    '',
    'Next step: reply personally about stock, timing and terms.',
  ].join('\n');
}

async function deliverEnquiry(env: Env, email: string, f: Fetch): Promise<Result> {
  switch (env.ENQUIRY_PROVIDER) {
    case 'resend': {
      const res = await f('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: env.ENQUIRY_FROM,
          to: [env.ENQUIRY_TO],
          reply_to: email,
          subject: `Archive sale enquiry: ${email}`,
          text: enquiryText(email),
        }),
      });
      if (!res.ok) {
        console.error('[orvel] resend', res.status, (await res.text()).slice(0, 300));
        return 'failed';
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return body.id ? 'ok' : 'failed';
    }
    case 'webhook': {
      const res = await f(env.ENQUIRY_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(env.ENQUIRY_WEBHOOK_SECRET ? { authorization: `Bearer ${env.ENQUIRY_WEBHOOK_SECRET}` } : {}) },
        body: JSON.stringify({ type: 'orvel.archive_enquiry', email, receivedAt: new Date().toISOString() }),
      });
      return res.ok ? 'ok' : 'failed';
    }
    case 'mock':
      return email.startsWith('fail') ? 'failed' : 'ok';
    default:
      return 'failed';
  }
}
