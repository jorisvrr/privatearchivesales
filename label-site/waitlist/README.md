# Label-site waitlist kit

**Not part of Mino's public website.** Mino's site takes no shopper signups: it has no waitlist route, form or endpoint, and old signup URLs redirect to `/about`. This folder keeps the drop waitlist implementation for deployment on a **label's own website**, where the label announces its drop and posts its waitlist link. Nothing here is imported by `src/` or deployed by `api/`.

| File | What it is |
|---|---|
| `server.ts` | `handleWaitlist(request, env)`: POST `{ drop, email, order? }`. Also `missingWaitlistConfig(env)` |
| `drops.ts` | The drops this deployment accepts (id, the label's waitlist URL, order verification) |
| `client.ts` | `wireWaitlist(form, …)`: field errors, verification outcomes, confirmations |
| `form.ts` | `mountWaitlist(container, drop)`: builds the form (email, the "Bought from [Label] before?" disclosure with order number, "Join the waitlist") |
| `emails/` | First-access (round 1) and second-round templates; render with `node scripts/render-emails.mjs` |

## Rules it implements

- One entry per email per drop, stored in the waitlist provider as tags: `drop:<id>`, `label:<label>`, and `drop:<id>:round-1` or `drop:<id>:round-2`.
- **Round 1:** order number and checkout email verified together against the label's order records. **Round 2:** everyone else who signed up for that drop.
- A public signup that later verifies is upgraded in place (round 2 → round 1). Round 1 is never downgraded.
- No match: the visitor corrects the details or joins round 2 with email only. Verification unavailable: the same round-2 option, never a verified state.

## Configuration (on the label-site deployment)

```
WAITLIST_PROVIDER=buttondown | mailchimp
BUTTONDOWN_API_KEY=            # buttondown; WAITLIST_DOUBLE_OPT_IN=1 if the newsletter confirms first
MAILCHIMP_API_KEY=             # mailchimp (…-usX); MAILCHIMP_AUDIENCE_ID=; MAILCHIMP_DOUBLE_OPT_IN=1
# Order verification per drop. Key = DROP_ + drop id upper-cased, "-" → "_":
DROP_<ID>_SHOPIFY_DOMAIN= / DROP_<ID>_SHOPIFY_TOKEN=     # Drop.verification = 'shopify' (read_orders)
DROP_<ID>_VERIFY_URL= / DROP_<ID>_VERIFY_SECRET=         # Drop.verification = 'webhook' → { "verified": true | false }
```

Local tests use `WAITLIST_PROVIDER=mock MINO_ALLOW_MOCK=1` (refused on Vercel); mock orders for the demo drop are `1001` → `past@customer.example` and `1002` → `second@customer.example`, and `0000` simulates verification being unavailable. Tests: `tests/unit/label-site-waitlist.test.ts`.
