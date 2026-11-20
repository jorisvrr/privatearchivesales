# Popup redesign — "Join the invitation list" and "Tell us about your stock"

> Historical report. The brand was later renamed to Mino, and the general mailing list was replaced by per-drop waitlists; screenshots show the earlier name.

Screenshots: `before/` and `after/`, named `<device>-<popup>-<n>-<state>.png`. Devices are desktop (1440×900) and mobile (390×844, touch, 2×). States: 1 open, 2 keyboard open (mobile only), 3 validation error, 4 submitting, 5 success, 6 server error. Regenerate with `node scripts/capture-popups.mjs docs/popups/after` against a preview server on :4173.

## Results against the brief

| Check | Result |
|---|---|
| Invitation panel at 1440×900 | 460 × 279 px (target ≤ ≈320) |
| Enquiry panel at 1440×900 | 460 × 555 px, no internal scroll |
| At 390×844 | Full-width bottom sheets: invitation 334 px, enquiry 634 px, no internal scroll |
| Header row | Title at the top padding (25 px from the card edge: 1 px border + 24 px); × on the same row, 44 × 44 |
| Rhythm | title → sentence 10 px · sentence → form 22 px · form → footer 16 px (measured in tests) |
| Controls | Every input, select, textarea and button in the panels, and both page triggers, ≥ 44 px tall |
| Narrow content | Email row and City + quantity stack under 360 px content width (container query) |

## What changed

- **Card.** Off-white surface (`--card #faf9f6`), 1 px fine border (`--card-border #e2dfd8`), nav radius, no shadow. On desktop it sits at the nav's 8 px inset, 460 px wide, with 24 px padding. On phones it's a full-width bottom sheet with rounded top corners and safe-area bottom padding.
- **Header.** Newsreader 30 px / 1.1 title with a 14 px × (44 × 44 hit area, `aria-label="Close"`) on the same row. The "Close" row and the empty band are gone.
- **Fields.** Geist labels above 44 px inputs: 1 px border at 50 % ink (≈3.5:1 against the card), white fill, and a 2 px ink focus ring with 2 px offset. The native select is restyled to match (`appearance: none`, same height, border, padding and font, custom chevron). One black 44 px button per form.
- **Layout.** Invitation: email label, then input and "Join the list" on one row, then the privacy line, where the panel ends. Enquiry: Label name → Contact email → City + Approximate quantity side by side → "Note (optional)" as a 3-row textarea → Send enquiry.
- **Copy.** The supporting sentences now use the brief's wording. Success: "You're on the list" / "Mino will email you when booking opens."
- **Spacing tokens** in `:root`: `--fp-pad`, `--fp-gap-copy`, `--fp-gap-form`, `--fp-gap-foot`, `--fp-gap-field`, `--fp-gap-label`, `--fp-control`.

## Files touched

- `src/ui/form-panel.ts` (new): shared panel component.
- `src/pages/invitations.ts`, `src/pages/labels.ts`: panel markup. Fields, names, options and page content are unchanged.
- `src/forms.ts`: per-field error display, busy labels, success copy.
- `src/styles.css`: tokens and popup styles. The old form CSS is removed. The in-page "Tell us about your stock" buttons get a 44 px hit area with the same visual pill.
- `server/handlers.ts`: adds `confirm` to the subscribe success response (see below). `.env.example`: `MAILING_DOUBLE_OPT_IN`.
- Tests: `tests/e2e/popups.spec.ts` (new), `tests/e2e/pages.spec.ts` and `tests/unit/handlers.test.ts` (updated). `scripts/capture-popups.mjs` (new).
- Unchanged: the piece page's "Details" panel (`src/ui/panel.ts`), page layouts, field names, quantity options, validation rules and the provider integrations.

## Beyond the second message (behaviour) — keep or revert?

The first brief asked for these; the later, shorter brief says to leave validation, submission and open/close logic as they were. They're all in place and tested. Each can be reverted on its own:

1. **Open/close.** 200 ms fade plus a 10 px slide (from below on phones), 150 ms close; opacity only with reduced motion. Previously the box grew out of the pill with masked text reveals.
2. **Focus.** Desktop focuses the first field on open; touch devices focus the heading. Escape and × return focus to whichever trigger opened the panel.
3. **Phones.** The bottom sheet is modal: `aria-modal="true"`, focus trapped, page inert, background scroll locked. It follows the on-screen keyboard and scrolls the focused field into view. Desktop stays nonmodal: no trap, and clicking outside doesn't close it.
4. **Errors.** Shown under each field and linked with `aria-describedby`; focus moves to the first invalid field. Server and network errors appear above the button. The validation rules themselves (required, email type, max lengths, the server checks) are unchanged.
5. **Double opt-in.** The subscribe API now returns `confirm: true` when the provider sends a confirmation email first (`MAILCHIMP_DOUBLE_OPT_IN=1` or `MAILING_DOUBLE_OPT_IN=1`). The panel then says "Check your email". This is the only server change.

## Deviations and decisions

- **Tablet (641–1024 px)** wasn't specified. It gets the nonmodal card under the nav (top 48 px), with the reopen trigger at the bottom centre.
- **Invitation server error position.** It sits at the top of the form, above the email label. Input and button share a row, so the only position above the button that doesn't split label from input is the top of the form. On the enquiry, it sits directly above "Send enquiry".
- **Sheet corner radius** uses the nav token (4 px), as the brief asks for existing tokens. That gives subtly rounded top corners; a larger radius would be a new value.
- **The heading** has no focus ring when focused on touch devices. It isn't an interactive control, and the ring looked like a selection box.
- **The no-JavaScript confirmation page** (served by the API) keeps its earlier wording.

## Not verified

- Real iOS/Android on-screen keyboards. "Keyboard open" was simulated by shrinking the viewport to 390×508; the `visualViewport` handling is untested on Safari.
- Screen readers (VoiceOver, TalkBack). Roles, names and `aria-*` attributes were checked in tests, not by listening.
- Firefox and Safari rendering. Everything ran in Chromium.
- Contrast was calculated from the CSS values, not measured with a tool: input border ≈3.5:1, footer line ≈8:1, error text on the card ≈7:1.
