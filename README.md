# Mino — Private archive sales

Mino builds the archive page on a label's website. The label shares one waitlist link, its verified customers shop first, and the rest of its waitlist follows. The label pays a small upfront fee plus a percentage of sales made through that event. The site is public and account-free:

- **Archive** `/`: the featured label's pieces on a WebGL sphere. Select a piece to enlarge it; open it for details at `/archive/<garment>`.
- **About** `/about`: what Mino is and how drops work. No signup: each label announces its drop and collects signups on its own website. Old signup URLs (`/invitations…`, `/waitlist…`) redirect here permanently (301).
- **For labels** `/for-labels`: the offer, how the fee works, three steps, and "Plan an archive sale", an email-only business enquiry (never a drop signup).

## No shopper signups on Mino's site

Mino's public site explains the service and takes founder enquiries only. It has no waitlist route, form, endpoint or link, even when a drop is live. The per-drop waitlist (verified first access, second round) lives in `label-site/waitlist/` for deployment on a label's own website; see its README.

## Sound and cursor

Sound starts muted. The desktop intro offers "Click to enable audio", and the sound button (top right, every page) works everywhere. Three CC0 cues play on animation events: a paper shuffle as the images stack, a fabric sweep as the sphere opens, and a soft click when a piece is selected. Playback uses howler; the files and credits are in `public/media/sound/`, rebuilt with `python3 scripts/process-sounds.py <work-dir>`. Interface icons come from Lucide (the framework-free `lucide` package). Details: `docs/sound/README.md`.

## Brand

The name lives in one place: `src/config/brand.ts` (`name`, `descriptor`, `siteTitle`, `eventCredit`, `pageTitle()`). The wordmark, page titles, metadata and Open Graph (via `vite.config.ts`), form copy, confirmations, server answer pages and the label-site email templates (`node scripts/render-emails.mjs`) all read from it; `tests/unit/brand.test.ts` fails if the name is hardcoded anywhere else. Manual swap when the name changes: `public/favicon.svg` (a drawn letter). `node scripts/check-nav-brand.mjs "<longer name>"` checks the centred nav with other names.

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

Local form testing without real providers: `ENQUIRY_PROVIDER=mock MINO_ALLOW_MOCK=1` before the dev or preview command. An enquiry email starting with `fail` fails.

## Launch configuration (not set yet)

There was no existing mailing or contact integration in this project, so both forms go through `server/handlers.ts` (Vercel Functions in `api/`). Until configured, they reply "not open yet" and never show success. See `.env.example`; check with `node --env-file=.env scripts/check-config.mjs`. Tests can also run against the dev server: `E2E_DEV=1 node node_modules/@playwright/test/cli.js test`.

| Form | Needs |
|---|---|
| Plan an archive sale (/for-labels) | `ENQUIRY_PROVIDER=resend` + `RESEND_API_KEY` + `ENQUIRY_TO` + `ENQUIRY_FROM` (a verified sending domain), **or** `webhook` + `ENQUIRY_WEBHOOK_URL` |

Waitlist configuration belongs to the label-site deployment (`label-site/waitlist/README.md`). Also needed before launch: a production domain with a verified sender address, and a privacy notice covering the enquiry form.

## Content

`src/content/sale.ts` holds the sale. It is in **demo** state: no partner, date, city, inventory or price has been supplied, so none is shown, and a "Demo" chip appears on every page. When a label is confirmed: set `status: 'confirmed'` and `label`, then fill each garment's `season`, `size`, `condition`, `price` and `note` only with what the label approved.

The 18 images in `public/media/demo/` are illustrated demo plates (`scripts/generate-demo-plates.mjs`), each marked "Demo plate NN". Replace them with real photography: 3:4 portrait, a small file (≈300×400) for the sphere and a large one (≈960×1280) for the enlarged view and the piece page. One garment can supply a full silhouette, a detail, a sample tag and a lookbook image. Plates 1–10 form the intro ring.

## Fonts

Geist (sans) and Newsreader (serif), both SIL Open Font License, self-hosted through Fontsource. They stand in for the reference's commercial Lay Grotesk and Teodor.

## Deviations from the reference, on purpose

- Spin, inertia and the intro ring are time-based, so 120 Hz screens behave like 60 Hz ones.
- Esc collapses an enlarged piece. Navigation pills have larger invisible touch targets. Keyboard users get a visible list of pieces (Tab from the navigation).
- About and For labels have no preloader, so people arriving from Instagram or email reach the call to action immediately.
- At rest, the bottom title slot shows the event credit ("[Featured label] — Archive Sale 001 · Organized by Mino"), so the label leads.
- Not built: the sound layer, the Projects grid (it serves as the no-WebGL fallback), the About head, and the lens-glass edge shader (Mino's content pages are DOM, for native forms and accessibility).
