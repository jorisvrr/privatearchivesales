# Visual verification — Orvel vs. reference

Each sheet pairs a reference capture (left) with Orvel (right) at the same viewport, DPR and timestamp. Orvel frames come from a 60 fps CDP screencast; the intro is aligned on the reference's intro start (637 ms after navigation). Regenerate with `node scripts/verify-visual.mjs` (preview server on :4173) and `python3 scripts/compose-sheets.py`.

**Timing caveat:** screencast frames arrive a few frames (≈50–100 ms) after the state they show, so Orvel can look slightly *behind* in sheets. Timing was checked numerically in-page instead: the expanded plane is 533 px tall at +221 ms (audit: 491 px at +237 ms) and reaches 630 px by ≈620 ms (audit: 630 by +695 ms).

| Sheet | Covers |
|---|---|
| `1440-intro.jpg` | First visit 300–7500 ms: wordmark, counter, side words, ring, spin-up, stack, explode, nav drop-in |
| `1440-settled.jpg` | Settled sphere at explode +1.5 s / +6.0 s |
| `1440-hover.jpg`, `1440-expand.jpg` | Hover title; expand +100/200/400 ms, settled; cursor label View / Close / hidden over title; collapse |
| `1440-open.jpg` | Open a piece (vertical slide) +150…1600 ms; Back (instant, same orientation) |
| `1440-nav.jpg` | Horizontal slides between the three destinations at +100…1300 ms; Back |
| `1440-panel.jpg` | Details panel open/close; Invitations direct link; For labels |
| `1280.jpg`, `tablet-768.jpg`, `mobile-390.jpg` | Intro, settled, tap-expand, "View piece", piece, Back, swipe, bottom sheets |

Numerical checks (Playwright, `tests/e2e`): sphere placement against the audit table at +1.5 s and +6.0 s (max error < 1 px), expanded sizes 472.5×630 / 420×560 / 538×717 / 374×499, nav geometry and re-centring, inertia, wheel, touch, Back/Forward, direct links, both forms, reduced motion, no-WebGL and no-JavaScript fallbacks, and no reference branding in any visitor-facing text.
