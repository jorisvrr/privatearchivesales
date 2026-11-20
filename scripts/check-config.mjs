// Lists what is missing before the forms can go live. Usage: node --env-file=.env scripts/check-config.mjs
import { missingConfig } from '../server/handlers.ts';
const m = missingConfig(process.env);
const out = (name, list) => console.log(list.length ? `✗ ${name}: missing ${list.join(', ')}` : `✓ ${name}: configured`);
out('Invitation list', m.subscribe);
out('Label enquiries', m.enquiry);
process.exit(m.subscribe.length || m.enquiry.length ? 1 : 0);
