# Mino — Private archive sales

Mino builds the archive page on a label's website. The label shares one waitlist link, its verified customers shop first, and the rest of its waitlist follows. The label pays a small upfront fee plus a percentage of sales made through that event. The site is public and account-free:

- **Archive** `/`: the featured label's pieces on a WebGL sphere. Select a piece to enlarge it; open it for details at `/archive/<garment>`.
- **About** `/about`: what Mino is. Its call to action follows the drop: a confirmed drop links to the label's own waitlist link; demo shows "Preview the waitlist"; no drop shows "The next waitlist link will be shared here." `/invitations` redirects here permanently (301).
- **Drop page** `/waitlist/<drop>`: the waitlist for one archive sale (the page behind the label's shareable link). Email is required; an optional order number gives first access after verification.
- **For labels** `/for-labels`: the offer, how the fee works, three steps, and "Plan an archive sale", an email-only enquiry.

## How the waitlist works

- One entry per email per drop, stored in the waitlist provider as tags on the contact: `drop:<id>`, `label:<label>`, and `drop:<id>:round-1` or `drop:<id>:round-2`.
- **Round 1, first access:** the order number and checkout email are verified together against the featured label's order records (Shopify Admin API or a webhook, configured per drop).
- **Round 2:** everyone else who signed up for that drop.
- Verifying after a public signup upgrades the same entry (round 2 → round 1), so it only receives the first-access email. Round 1 is never downgraded.
- If the order doesn't match, the visitor can correct the details or join round 2 with email only. If verification is unavailable, they get the same round-2 option, and never a verified confirmation.
- Emails: `emails/first-access.html` (round 1) and `emails/second-round.html` (round 2); see `emails/README.md`.

## Run

The folder name contains `::`, which breaks `npm run` on this machine, so call the tools directly:

```sh
npm install
node node_modules/vite/bin/vite.js                       # dev server, http://localhost:5173
node node_modules/vite/bin/vite.js build                 # → dist/
node node_modules/vite/bin/vite.js preview               # serves dist/ and /api locally
node node_modules/vitest/vitest.mjs run                  # unit tests
node node_modules/@playwright/test/cli.js test           # end-to-end (builds and starts its own server)
node node_modules/typescript/bin/tsc --noEmit            # types
```

Local form testing without real providers: `WAITLIST_PROVIDER=mock ENQUIRY_PROVIDER=mock MINO_ALLOW_MOCK=1` before the dev or preview command. Mock order records for the demo drop: order `1001` with `past@customer.example`, `1002` with `second@customer.example`; order `0000` simulates verification being unavailable. An enquiry email starting with `fail` fails. `GET /api/waitlist?inspect=1` lists mock entries (mock mode only).

## Launch configuration (not set yet)

There was no existing mailing or contact integration in this project, so both forms go through `server/handlers.ts` (Vercel Functions in `api/`). Until configured, they reply "not open yet" and never show success. See `.env.example`; check with `node --env-file=.env scripts/check-config.mjs`. Tests can also run against the dev server: `E2E_DEV=1 node node_modules/@playwright/test/cli.js test`.

| Form | Needs |
|---|---|
| Drop waitlists | `WAITLIST_PROVIDER=buttondown` + `BUTTONDOWN_API_KEY`, **or** `mailchimp` + `MAILCHIMP_API_KEY` + `MAILCHIMP_AUDIENCE_ID` |
| Order verification (per drop) | `Drop.verification` in `src/content/sale.ts` plus `DROP_<ID>_SHOPIFY_DOMAIN` + `DROP_<ID>_SHOPIFY_TOKEN` (read_orders), **or** `DROP_<ID>_VERIFY_URL` |
| Plan an archive sale (/for-labels) | `ENQUIRY_PROVIDER=resend` + `RESEND_API_KEY` + `ENQUIRY_TO` + `ENQUIRY_FROM` (a verified sending domain), **or** `webhook` + `ENQUIRY_WEBHOOK_URL` |

Enquiries and waitlist signups are separate endpoints and providers. Also needed before launch: a privacy notice to link from the signup form (EU signups), a decision on double opt-in, and a production domain with a verified sender address.

## Content

`src/content/sale.ts` holds the sale. It is in **demo** state: no partner, date, city, inventory or price has been supplied, so none is shown, and a "Demo" chip appears on every page. When a label is confirmed: set `status: 'confirmed'`, `label`, and the `drop` (id, the label's waitlist URL, order verification), then fill each garment's `season`, `size`, `condition`, `price` and `note` only with what the label approved.

The 18 images in `public/media/demo/` are illustrated demo plates (`scripts/generate-demo-plates.mjs`), each marked "Demo plate NN". Replace them with real photography: 3:4 portrait, a small file (≈300×400) for the sphere and a large one (≈960×1280) for the enlarged view and the piece page. One garment can supply a full silhouette, a detail, a sample tag and a lookbook image. Plates 1–10 form the intro ring.

## Fonts

Geist (sans) and Newsreader (serif), both SIL Open Font License, self-hosted through Fontsource. They stand in for the reference's commercial Lay Grotesk and Teodor.

## Deviations from the reference, on purpose

- Spin, inertia and the intro ring are time-based, so 120 Hz screens behave like 60 Hz ones.
- Esc collapses an enlarged piece. Navigation pills have larger invisible touch targets. Keyboard users get a visible list of pieces (Tab from the navigation).
- About and For labels have no preloader, so people arriving from Instagram or email reach the call to action immediately.
- At rest, the bottom title slot shows the event credit ("[Featured label] — Archive Sale 001 · Organized by Mino"), so the label leads.
- Not built: the sound layer, the Projects grid (it serves as the no-WebGL fallback), the About head, and the lens-glass edge shader (Mino's content pages are DOM, for native forms and accessibility).
