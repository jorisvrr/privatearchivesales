// Lists what Mino's site still needs before the enquiry form can go live.
// Usage: node --env-file=.env scripts/check-config.mjs
// (Label-site waitlists: see label-site/waitlist/README.md.)
import { missingConfig } from '../server/handlers.ts';
const m = missingConfig(process.env);
console.log(m.enquiry.length ? `✗ Archive-sale enquiries: missing ${m.enquiry.join(', ')}` : '✓ Archive-sale enquiries: configured');
process.exit(m.enquiry.length ? 1 : 0);
