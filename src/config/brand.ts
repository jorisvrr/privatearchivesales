// Single source of truth for the brand. Every visitor-facing use of the name reads from here:
// wordmark, page titles, metadata and Open Graph (index.html via vite.config.ts), form copy,
// confirmations, server answer pages, email templates (scripts/render-emails.mjs), alt and aria labels.
// Changing `name` here changes the site; the favicon is the one manual swap (public/favicon.svg).

export const name = 'Mino';
export const descriptor = 'Private archive sales';
export const siteTitle = `${name} — ${descriptor}`;
export const eventCredit = `Organized by ${name}`;
/** "About — Mino" */
export const pageTitle = (page: string) => `${page} — ${name}`;

export const brand = { name, descriptor, siteTitle, eventCredit, pageTitle } as const;
