// Form endpoints shared by the Vercel functions (api/*.ts) and the local dev/preview server.
// Success is returned only once the provider has accepted the request.
import { drops } from '../src/content/sale.ts';
import { enquiryConfigured } from './enquiry.ts';
import { mockAllowed, type Env } from './http.ts';
import { envKey } from './waitlist.ts';

export { handleEnquiry, enquiryText } from './enquiry.ts';
export { handleWaitlist, verifyOrder, normalizeOrder, envKey, MESSAGES as WAITLIST_MESSAGES, MOCK_ORDERS } from './waitlist.ts';
export { isEmail, type Env } from './http.ts';

/** What is missing before launch: waitlist storage, enquiry delivery, and order verification per drop. */
export function missingConfig(env: Env): { waitlist: string[]; enquiry: string[]; verification: string[] } {
  const waitlist: string[] = [];
  const wp = env.WAITLIST_PROVIDER;
  if (!wp) waitlist.push('WAITLIST_PROVIDER (buttondown | mailchimp)');
  else if (wp === 'buttondown') { if (!env.BUTTONDOWN_API_KEY) waitlist.push('BUTTONDOWN_API_KEY'); }
  else if (wp === 'mailchimp') {
    if (!env.MAILCHIMP_API_KEY || !/-[a-z]+\d+$/.test(env.MAILCHIMP_API_KEY)) waitlist.push('MAILCHIMP_API_KEY (format key-usX)');
    if (!env.MAILCHIMP_AUDIENCE_ID) waitlist.push('MAILCHIMP_AUDIENCE_ID');
  } else if (wp === 'mock') { if (!mockAllowed(env)) waitlist.push('WAITLIST_PROVIDER=mock is for local tests only'); }
  else waitlist.push(`WAITLIST_PROVIDER "${wp}" is not supported`);

  const verification: string[] = [];
  for (const d of drops()) {
    if (d.status === 'none') continue;
    const k = envKey(d.id);
    if (!d.verification) verification.push(`${d.id}: no order verification set (Drop.verification = 'shopify' | 'webhook')`);
    else if (d.verification === 'shopify') {
      for (const v of ['SHOPIFY_DOMAIN', 'SHOPIFY_TOKEN']) if (!env[`${k}_${v}`]) verification.push(`${k}_${v}`);
    } else if (d.verification === 'webhook' && !env[`${k}_VERIFY_URL`]) verification.push(`${k}_VERIFY_URL`);
  }
  return { waitlist, enquiry: enquiryConfigured(env), verification };
}
