# Mino — Private archive sales

Mino builds the archive page on a label's website. The label shares one waitlist link, its verified customers shop first, and the rest of its waitlist follows. The label pays a small upfront fee plus a percentage of sales made through that event. The site is public and account-free:

- **Archive** `/`: the featured label's pieces on a WebGL sphere. Select a piece to enlarge it; open it for details at `/archive/<garment>`.
- **About** `/about`: what Mino is and how drops work. No signup: each label announces its drop and collects signups on its own website. Old signup URLs (`/invitations…`, `/waitlist…`) redirect here permanently (301).
- **For labels** `/for-labels`: the offer, how the fee works, what's included, a labelled illustrative preview (Study 001 imagery, not client work), and "Plan an archive sale", which opens the enquiry funnel.
- **Plan an archive sale** `/plan`: a three-step business enquiry for founders (never a drop signup). See below.

## No shopper signups on Mino's site

Mino's public site explains the service and takes founder enquiries only. It has no waitlist route, form, endpoint or link, even when a drop is live. The per-drop waitlist (verified first access, second round) lives in `label-site/waitlist/` for deployment on a label's own website; see its README.

## Plan an archive sale (/plan)

`src/pages/plan.ts`. Step 1 of 3 asks what the label would release (Past collections / Samples / Both / Still exploring), step 2 when (Next month / Within three months / Exploring), step 3 takes a work email (required; personal domains are fine) and an optional brand website or Instagram. Each step has one primary action: an explicit Continue (choosing an option never advances), with Back and Exit always available. Answers survive Back, browser Back/Forward (`/plan?step=2|3`, via the router's `onSameRoutePop` hook) and failed sends. A deep link to a later step without answers starts at step 1. The confirmation ("Your enquiry is with Mino.") appears only after the server confirms delivery; while sending, the button is disabled and repeat submits are ignored. Steps swap in about 150 ms out and 220 ms in, instantly with reduced motion. No intro, sound or custom cursor on this route.

`POST /api/enquiry` accepts `{ release, timing, email, brand }` and validates the two answers against the same option lists the page uses (`server/enquiry.ts`, a unit test keeps them equal). `fax` is a hidden honeypot. Enquiries are never added to a waitlist or marketing list. Without JavaScript, `index.html`'s noscript block posts the same fields from a plain form.

Funnel analytics (`src/analytics.ts`): `plan_start`, `plan_step_complete` (step number and the chosen fixed option), `plan_submit_success`, `plan_submit_failure` (reason). No email or typed text is ever sent. No analytics provider is installed: events are dispatched as a `mino:analytics` DOM event and forwarded to Vercel Web Analytics custom events (`window.va`) if that script is added later.

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

There was no existing mailing or contact integration in this project, so the enquiry goes through `server/handlers.ts` (Vercel Functions in `api/`). Until configured, it replies "Enquiries can’t be sent from this page yet" and never shows success. See `.env.example`; check with `node --env-file=.env scripts/check-config.mjs`. Tests can also run against the dev server: `E2E_DEV=1 node node_modules/@playwright/test/cli.js test`.

| Form | Needs |
|---|---|
| Plan an archive sale (/plan) | `ENQUIRY_PROVIDER=resend` + `RESEND_API_KEY` + `ENQUIRY_TO` + `ENQUIRY_FROM` (a verified sending domain), **or** `webhook` + `ENQUIRY_WEBHOOK_URL` |

Waitlist configuration belongs to the label-site deployment (`label-site/waitlist/README.md`). Also needed before launch: a production domain with a verified sender address, and a privacy notice covering the enquiry form.

## Content

The Archive shows **Mino Study 001**, "An editorial study by Mino": 18 photographs in six groups (Corduroy, Ecru denim, Nubuck boots, Invitation, Archive record, Packing). One data module feeds the intro ring, the sphere, hover captions, the enlarged view, detail pages (`/archive/<image>`), the keyboard list and the no-WebGL grid: `src/content/study.ts`. It holds the captions, alt text, sphere slot order (art-directed front cluster) and intro ring order. The detail pages state once, in the collection details, that it's an AI-generated editorial study. There are no prices or stock.

Images are built with `python3 scripts/build-study-images.py` from the original PNGs in `assets/study-001/originals/`, which are local only (not in git, never served):
- `-s` 300×400 WebP: sphere and intro textures. The 18 together are 181 KB, the only images on the Archive's first load.
- `-m` 640×853: the fallback grid and thumbnails.
- `-l` 1086×1448: loaded when a piece is enlarged or opened.

The old demo garment URLs (`/archive/chore-jacket` etc.) redirect to `/`.

## Fonts

Geist (sans) and Newsreader (serif), both SIL Open Font License, self-hosted through Fontsource. They stand in for the reference's commercial Lay Grotesk and Teodor.

## Deviations from the reference, on purpose

- Spin, inertia and the intro ring are time-based, so 120 Hz screens behave like 60 Hz ones.
- Esc collapses an enlarged piece. Navigation pills have larger invisible touch targets. Keyboard users get a visible list of pieces (Tab from the navigation).
- About and For labels have no preloader, so people arriving from Instagram or email reach the call to action immediately.
- At rest, the bottom title slot shows the event credit ("[Featured label] — Archive Sale 001 · Organized by Mino"), so the label leads.
- Not built: the sound layer, the Projects grid (it serves as the no-WebGL fallback), the About head, and the lens-glass edge shader (Mino's content pages are DOM, for native forms and accessibility).
