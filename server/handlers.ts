// Endpoints served by Mino's public website. Only the founder enquiry: Mino's site takes no shopper signups.
// (Drop waitlists run on each label's own website; see label-site/waitlist/.)
import { enquiryConfigured } from './enquiry.ts';
import type { Env } from './http.ts';

export { handleEnquiry, enquiryText } from './enquiry.ts';
export { isEmail, type Env } from './http.ts';

/** What Mino's site still needs before launch. */
export function missingConfig(env: Env): { enquiry: string[] } {
  return { enquiry: enquiryConfigured(env) };
}
