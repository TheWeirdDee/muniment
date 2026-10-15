# Threat model, data policy and provenance

## What Muniment claims, and what it does not

Muniment claims that a record, once published as a sealed, read-only, permissionless-extension Arkiv entity:

- cannot be edited by anyone (tested: P3a, P3b);
- cannot be deleted or transferred while the burn-address assumption holds (P3d);
- can have its storage renewed by any wallet without gaining edit rights (P2a, P3e);
- can be read by tools other than this website (the standalone reader and the dashboard).

It does **not** claim that records are permanent, that the named authority issued them, that their contents are true, that Arkiv endpoints are always reachable, or that wallets correspond to people.

## Threats

| Threat | Handling | Residual risk |
|---|---|---|
| Fabricated authority document | The claimed issuer is shown separately from the on-chain publisher; source status and review limits are shown on every record | A trusted publisher can still publish something false; reviews are signed statements, not proof |
| Copied namespace (spam, look-alike records) | Every list filters by trusted `$creator`; "any wallet" mode labels untrusted records; decoders reject malformed entities | Readers who widen the view must judge untrusted publishers themselves |
| Forged renewal activity | Receipts are verified against the creating transaction (same tx extended the named reply to the stated block, sent by the receipt's creator); otherwise "claim, unverified" and not counted (P5) | Expired receipts drop out of counts; the count says so |
| Owner deletion or mutation | Read-only stops edits. Sealing transfers ownership to `0x…dEaD` in the creating batch. Unsealed records are labelled "publisher can still delete" (P3f demonstrates the escape) | Depends on nobody holding a key for `0x…dEaD` |
| Sybil wallets inflating renewal counts | Counts are of distinct verified wallets and labelled "wallets, not people"; team wallets are labelled | Gas cost is the only friction; counts are not credibility |
| Malicious payloads or URLs | Payloads are validated (size ≤ 64 KiB, typed fields) and rendered as text, never HTML; only credential-free `https:` links are shown, with `rel="noopener noreferrer"` | — |
| Lost funding, neglected records | Expiry is shown from chain state; the preserve queue orders by expiry; collections export | No background reminders exist; expiry is real |
| RPC outage, rate limiting or blocked website | Configurable endpoint, standalone reader, polite transport (backs off on 429 using `Retry-After`) with honest error messages | One public provider was tested; the public endpoint's per-IP query budget can be exhausted |
| Testnet reset | Manifest of every seeded entity and transaction; seed script reproduces the corpus | A reset breaks continuity; reseeding would be disclosed |
| Missing entity | The UI distinguishes invalid key, not found, malformed, unsupported version and read failure; "expired" only with a prior observation showing the expiry block has passed | Absence alone never proves expiry or deletion |
| Wallet phishing / accidental signing | Reading never requests a wallet; signing happens only on explicit buttons inside dialogs that show the plan, cost estimate and target block; double submission is blocked | The user's wallet shows the final transaction |
| Leaking private notes | Notes stay in localStorage; exports exclude them unless the user ticks a box; nothing private goes in URLs | Anyone with access to the browser profile can read them |
| Secret exposure | No keys in the frontend or repository; `.env` is gitignored; the browser uses the keyless public endpoint | — |

## Data policy

- Arkiv holds only synthetic records: invented authorities, figures and dates. There is no real personal data, in plaintext or hashed.
- The publish page accepts only templated synthetic content. Its one free-text field is scanned for email, phone, Aadhaar-like, PAN-like, postal-code, address and URL patterns, and publishing is blocked on a match. The scanner is defence in depth, not a privacy guarantee.
- Collections, notes, settings and theme live only in the visitor's browser.
- Off Arkiv on purpose: keys, credentials, personal data, collections, notes, saved searches, full-text indexes and source fixtures.

## Provenance model

```
claimed issuer      ← what the record says (payload.authorityName); not verified
on-chain publisher  ← $creator, set by Arkiv at creation; cannot change
content             ← read-only since creation (creation flag)
ownership           ← $owner; 0x…dEaD means sealed
reviews             ← separate entities; each is a statement by its own $creator
corrections         ← new reply with corrects = old key; supersedes only if same creator
renewals            ← receipt entities, verified against the creating transaction
```

A status badge is derived from reviews by reviewer wallets the reader trusts (default: the team's labelled test reviewer). Disputes and other wallets' reviews remain visible.
