# Waitlist emails

Each archive sale (drop) has its own waitlist, behind one shareable link the label posts on its website. Every signup is one entry per email per drop, tagged in the waitlist provider:

| Round | Who | Tag | Template | Subject |
|---|---|---|---|---|
| 1 — first access | Signed up and verified a previous order (order number + checkout email) | `drop:<id>:round-1` | `first-access.html` | First access: the [Label] archive |
| 2 — second round | Everyone else who signed up for that drop | `drop:<id>:round-2` | `second-round.html` | The [Label] archive is open |

An entry that verifies after signing up publicly moves from round 2 to round 1 (the round-2 tag is removed), so it receives only the first-access email. Send each as a campaign to its tag segment, with the label's approval. Before launch, both need a real Mino sender address on a verified domain.
