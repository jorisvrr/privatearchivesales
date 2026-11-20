// Per-drop waitlist: POST /api/waitlist { drop, email, order? }.
//
// One entry per email per drop. Round 1 = verified past customer of the featured label (order number and
// checkout email must match the label's order records). Round 2 = everyone else who signed up for that drop.
// A round-2 entry that later verifies is upgraded to round 1 (and leaves round 2), so it only gets the
// first-round invitation. A round-1 entry is never downgraded.
//
// Storage uses the existing provider integration, with per-drop tags on one contact per email:
//   drop:<id>   drop:<id>:round-1 | drop:<id>:round-2   label:<label-slug>
// WAITLIST_PROVIDER=buttondown  BUTTONDOWN_API_KEY [WAITLIST_DOUBLE_OPT_IN=1]
// WAITLIST_PROVIDER=mailchimp   MAILCHIMP_API_KEY (…-usX), MAILCHIMP_AUDIENCE_ID [MAILCHIMP_DOUBLE_OPT_IN=1]
//
// Order verification, per drop (Drop.verification), configured with env vars keyed by the drop id
// (upper-cased, non-alphanumerics → "_"), e.g. drop "studio-archive-001" → DROP_STUDIO_ARCHIVE_001_…:
//   shopify   …_SHOPIFY_DOMAIN (shop.myshopify.com), …_SHOPIFY_TOKEN (Admin API token with read_orders)
//   webhook   …_VERIFY_URL [ …_VERIFY_SECRET ]  → POST { drop, label, orderNumber, email } ⇒ { verified: boolean }
// No verification configured ⇒ "unavailable": the visitor can still join round 2, never a verified state.
import { createHash } from 'node:crypto';
import { dropById as defaultDropById, type Drop } from '../src/content/sale.ts';
import { clean, htmlPage, isEmail, json, methodNotAllowed, mockAllowed, readBody, type Env, type Fetch } from './http.ts';

export type Round = 1 | 2;
export type DropInfo = Drop & { label: string; status: 'demo' | 'confirmed' | 'none' };
export interface WaitlistEntry { drop: string; label: string; email: string; round: Round }
export type Verification = 'verified' | 'no_match' | 'unavailable';

export const MESSAGES = {
  round1: 'Your order is verified. We’ll email you when first access opens.',
  round2: 'You’re on the waitlist. We’ll email you when the second round opens.',
  duplicate: 'This email is already on the waitlist. We’ll email you when the second round opens.',
  no_match: 'We couldn’t match that order number to this email address. Check both, or join the second round with your email alone.',
  unavailable: 'Order verification isn’t available right now. You can join the second round with your email alone.',
  preview: 'This is a preview. Sign-ups open when the drop is confirmed.',
  not_configured: 'The waitlist isn’t open yet. Your email wasn’t saved.',
  failed: 'You weren’t added to the waitlist. Please try again in a moment.',
  unknown_drop: 'This waitlist link isn’t active.',
  invalid: 'Enter a valid email address, like name@example.com.',
} as const;

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const envKey = (dropId: string) => `DROP_${dropId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
export const tags = (d: DropInfo, round: Round) => ({
  drop: `drop:${d.id}`,
  label: `label:${slug(d.label)}`,
  round: `drop:${d.id}:round-${round}`,
  other: `drop:${d.id}:round-${round === 1 ? 2 : 1}`,
});
const roundFrom = (d: DropInfo, names: string[]): Round | null =>
  names.includes(`drop:${d.id}:round-1`) ? 1 : names.includes(`drop:${d.id}:round-2`) ? 2 : null;
/** "#1001", " 1001 " → "1001" */
export const normalizeOrder = (v: string) => v.trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase();

// ---------------------------------------------------------------- stores

export interface WaitlistStore {
  get(d: DropInfo, email: string): Promise<Round | null>;
  put(d: DropInfo, email: string, round: Round): Promise<void>;
}

const mockEntries = new Map<string, WaitlistEntry>();
const mockStore: WaitlistStore = {
  async get(d, email) { return mockEntries.get(`${d.id}|${email}`)?.round ?? null; },
  async put(d, email, round) { mockEntries.set(`${d.id}|${email}`, { drop: d.id, label: d.label, email, round }); },
};

function mailchimpStore(env: Env, f: Fetch): WaitlistStore {
  const key = env.MAILCHIMP_API_KEY!;
  const base = `https://${key.split('-').pop()}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_AUDIENCE_ID}/members`;
  const headers = { authorization: `Basic ${btoa(`mino:${key}`)}`, 'content-type': 'application/json' };
  const hash = (email: string) => createHash('md5').update(email.toLowerCase()).digest('hex');
  return {
    async get(d, email) {
      const res = await f(`${base}/${hash(email)}/tags?count=1000`, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`mailchimp tags ${res.status}`);
      const body = (await res.json()) as { tags?: { name: string }[] };
      return roundFrom(d, (body.tags ?? []).map((t) => t.name));
    },
    async put(d, email, round) {
      const up = await f(`${base}/${hash(email)}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ email_address: email, status_if_new: env.MAILCHIMP_DOUBLE_OPT_IN === '1' ? 'pending' : 'subscribed' }),
      });
      if (!up.ok) throw new Error(`mailchimp upsert ${up.status}`);
      const t = tags(d, round);
      const res = await f(`${base}/${hash(email)}/tags`, {
        method: 'POST', headers,
        body: JSON.stringify({ tags: [t.drop, t.label, t.round].map((name) => ({ name, status: 'active' })).concat({ name: t.other, status: 'inactive' }) }),
      });
      if (!res.ok) throw new Error(`mailchimp tag ${res.status}`);
    },
  };
}

function buttondownStore(env: Env, f: Fetch): WaitlistStore {
  const headers = { authorization: `Token ${env.BUTTONDOWN_API_KEY}`, 'content-type': 'application/json' };
  const url = (email = '') => `https://api.buttondown.com/v1/subscribers${email ? `/${encodeURIComponent(email)}` : ''}`;
  const current = async (email: string) => {
    const res = await f(url(email), { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`buttondown get ${res.status}`);
    return ((await res.json()) as { tags?: string[] }).tags ?? [];
  };
  return {
    async get(d, email) {
      const t = await current(email);
      return t ? roundFrom(d, t) : null;
    },
    async put(d, email, round) {
      const t = tags(d, round);
      const existing = await current(email);
      const next = [...new Set([...(existing ?? []).filter((x) => x !== t.other), t.drop, t.label, t.round])];
      const res = existing
        ? await f(url(email), { method: 'PATCH', headers, body: JSON.stringify({ tags: next }) })
        : await f(url(), { method: 'POST', headers, body: JSON.stringify({ email_address: email, tags: next }) });
      if (!res.ok) throw new Error(`buttondown put ${res.status}`);
    },
  };
}

export function storeFor(env: Env, f: Fetch): WaitlistStore | null {
  switch (env.WAITLIST_PROVIDER) {
    case 'mailchimp': return env.MAILCHIMP_API_KEY && /-[a-z]+\d+$/.test(env.MAILCHIMP_API_KEY) && env.MAILCHIMP_AUDIENCE_ID ? mailchimpStore(env, f) : null;
    case 'buttondown': return env.BUTTONDOWN_API_KEY ? buttondownStore(env, f) : null;
    case 'mock': return mockAllowed(env) ? mockStore : null;
    default: return null;
  }
}

const doubleOptIn = (env: Env) => (env.WAITLIST_PROVIDER === 'mailchimp' ? env.MAILCHIMP_DOUBLE_OPT_IN === '1' : env.WAITLIST_DOUBLE_OPT_IN === '1');

// ---------------------------------------------------------------- order verification

/** Local tests only: drop → order number → checkout email. Order "0000" simulates an unavailable store. */
export const MOCK_ORDERS: Record<string, Record<string, string>> = {
  'demo-archive-001': { '1001': 'past@customer.example', '1002': 'second@customer.example' },
};

export async function verifyOrder(d: DropInfo, email: string, order: string, env: Env, f: Fetch): Promise<Verification> {
  const key = envKey(d.id);
  const method = d.verification ?? (mockAllowed(env) && env.WAITLIST_PROVIDER === 'mock' ? 'mock' : null);
  try {
    switch (method) {
      case 'shopify': {
        const domain = env[`${key}_SHOPIFY_DOMAIN`];
        const token = env[`${key}_SHOPIFY_TOKEN`];
        if (!domain || !token) return 'unavailable';
        const q = new URLSearchParams({ status: 'any', name: `#${order}`, fields: 'name,email,contact_email' });
        const res = await f(`https://${domain}/admin/api/2024-10/orders.json?${q}`, { headers: { 'X-Shopify-Access-Token': token }, signal: AbortSignal.timeout(6000) });
        if (!res.ok) return 'unavailable';
        const body = (await res.json()) as { orders?: { name?: string; email?: string; contact_email?: string }[] };
        const hit = (body.orders ?? []).some((o) => normalizeOrder(o.name ?? '') === order && [o.email, o.contact_email].some((e) => (e ?? '').toLowerCase() === email));
        return hit ? 'verified' : 'no_match';
      }
      case 'webhook': {
        const target = env[`${key}_VERIFY_URL`];
        if (!target) return 'unavailable';
        const secret = env[`${key}_VERIFY_SECRET`];
        const res = await f(target, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
          body: JSON.stringify({ drop: d.id, label: d.label, orderNumber: order, email }),
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return 'unavailable';
        const body = (await res.json().catch(() => ({}))) as { verified?: unknown };
        return body.verified === true ? 'verified' : body.verified === false ? 'no_match' : 'unavailable';
      }
      case 'mock': {
        if (order === '0000') return 'unavailable';
        return MOCK_ORDERS[d.id]?.[order] === email ? 'verified' : 'no_match';
      }
      default:
        return 'unavailable';
    }
  } catch {
    return 'unavailable';
  }
}

// ---------------------------------------------------------------- handler

type Outcome = { status: number; body: Record<string, unknown>; message: string };

export async function handleWaitlist(req: Request, env: Env, f: Fetch = fetch, lookup: (id: string) => DropInfo | null = defaultDropById): Promise<Response> {
  // Local tests can read the mock entries back to check drop and label assignment.
  if (req.method === 'GET' && mockAllowed(env) && env.WAITLIST_PROVIDER === 'mock' && new URL(req.url).searchParams.has('inspect')) {
    return json(200, { entries: [...mockEntries.values()] });
  }
  if (req.method !== 'POST') return methodNotAllowed();
  const { data, form } = await readBody(req);
  const drop = lookup(clean(data.drop, 80));
  const out = await decide(data, drop, env, f);
  if (form) return htmlPage(out.status, out.message, drop ? `/waitlist/${drop.id}` : '/about');
  return json(out.status, { ...out.body, message: out.message });
}

async function decide(data: Record<string, string>, drop: DropInfo | null, env: Env, f: Fetch): Promise<Outcome> {
  const fail = (status: number, error: keyof typeof MESSAGES, extra: Record<string, unknown> = {}): Outcome => ({ status, body: { error, ...extra }, message: MESSAGES[error] });
  if (!drop || drop.status === 'none') return fail(404, 'unknown_drop');
  const ok = (round: Round, extra: Record<string, unknown> = {}): Outcome => ({
    status: 200,
    body: { status: 'ok', round, drop: drop.id, label: drop.label, confirm: doubleOptIn(env), ...extra },
    message: round === 1 ? MESSAGES.round1 : MESSAGES.round2,
  });
  if (data.company) return ok(2); // honeypot: pretend, store nothing
  const email = clean(data.email, 254).toLowerCase();
  if (!isEmail(email)) return fail(422, 'invalid', { fields: ['email'] });
  const order = normalizeOrder(clean(data.order, 40));
  if (order && !/^[A-Z0-9-]{1,30}$/.test(order)) return fail(422, 'no_match', { fields: ['order'] });
  if (drop.status === 'demo' && !mockAllowed(env)) return fail(403, 'preview');
  const store = storeFor(env, f);
  if (!store) {
    console.warn('[mino] waitlist not configured: set WAITLIST_PROVIDER and its keys');
    return fail(503, 'not_configured');
  }
  try {
    const existing = await store.get(drop, email);
    if (existing === 1) return ok(1, { existing: true }); // already verified for this drop
    if (!order) {
      if (existing === 2) return fail(409, 'duplicate', { round: 2, drop: drop.id });
      await store.put(drop, email, 2);
      return ok(2);
    }
    const v = await verifyOrder(drop, email, order, env, f);
    if (v === 'no_match') return fail(422, 'no_match', { fields: ['order'] });
    if (v === 'unavailable') return fail(503, 'unavailable');
    await store.put(drop, email, 1);
    return ok(1, { upgraded: existing === 2 });
  } catch (err) {
    console.error('[mino] waitlist failed', err);
    return fail(502, 'failed');
  }
}
