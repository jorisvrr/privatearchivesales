// Renders emails/*.html with the brand from src/config/brand.ts into emails/rendered/.
// Usage: node scripts/render-emails.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brand } from '../src/config/brand.ts';

const dir = resolve(import.meta.dirname, '../emails');
const out = resolve(dir, 'rendered');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(dir).filter((x) => x.endsWith('.html'))) {
  const html = readFileSync(resolve(dir, f), 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => (typeof brand[k] === 'string' ? brand[k] : m));
  writeFileSync(resolve(out, f), html);
  console.log('rendered', f);
}
