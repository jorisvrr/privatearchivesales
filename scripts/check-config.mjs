// Lists what is missing before the forms can go live. Usage: node --env-file=.env scripts/check-config.mjs
import { missingConfig } from '../server/handlers.ts';
const m = missingConfig(process.env);
const out = (name, list) => console.log(list.length ? `✗ ${name}: missing ${list.join(', ')}` : `✓ ${name}: configured`);
out('Waitlist storage', m.waitlist);
out('Order verification', m.verification);
out('Archive-sale enquiries', m.enquiry);
process.exit(m.waitlist.length || m.enquiry.length || m.verification.length ? 1 : 0);
