# Org intake v1 draft implementation

This supersedes the absence-of-contract dependency in the earlier design. Hub
artifact `0b33f45a0bdde87b8e7746666d6200c17d0c4b82`,
`docs/intake/CONTRACT-v1.md` and unchanged `src/lib/intake/contract.ts`,
are pinned for this draft only. Official `docs/intake/CONFORMANCE-v1.md` and
`fixtures/v1-signing.json` are published at that commit; signature reproduction
is tested with the unchanged official vector. Activation
is on hold. Fixture SHA256:
`2c234a33b0b6d8e42bae8a4aba9f7fcce12580ee9f7816d98b9ea4315047b734`.

## Implemented preparation
`scripts/lib/intake-sender.cjs` provides explicit projection, durable-adapter
capture, and bounded signed worker. No handler or environment reads import it;
`.vercelignore` excludes scripts from the deployed site. This is real locally
executable transport/adapter code, not a deployed sender or claim of provisioned
durability. The independently disabled gate requires literal boolean enabled,
the exact draft pin, fixed org-site source, fixed hub URL and a 32-byte secret.
No credential is included or created. Source allocation needs hub-owner approval.

Allowlisted org events contain only email, fixed form/service, fixed summary,
trusted capture timestamp and stable hash of form plus canonical submission ID.
Only investor events include the existing boolean marketing consent. There is
no marketing-consent inference for other forms. Names, original message bodies,
URLs, arbitrary body keys and attribution never leave the existing capture store.
Transport rejects extra fields even if the generic hub schema approves them.
Only genuine traffic enters this adapter: spam and canary are excluded entirely.
This narrows the historical spec's candidate upper bound deliberately.

Worker refreshes signing time but preserves exact original event content. It
claims at most ten rows, bounds each network/body/settlement operation to four
seconds, blocks 400/401/413 for explicit repair, retains unknown/malformed ACKs
and network failures, uses exponential jitter and respects Retry-After on 429.
Only exact 202 accepted/duplicate-boolean acknowledgements complete a record.
Failure response bodies are never stored or logged. Failed settlements throw;
the persisted lease must expire and release the same original event for retry.

## Unprovisioned storage contract and concrete integration gap
`intake-rpc-store.cjs` is disabled until separately supplied an approved storage
URL and credential. It never falls back to existing site publishable/anon keys.
Expected restricted RPCs:
- `org_intake_capture_v1(event)` commits an immutable event under unique id and
  returns `{durable:true,id}` only after commit. It must reject conflicting
  content under an existing id and impose a bounded genuine-only backlog.
- `org_intake_claim_v1(limit)` atomically leases due genuine rows using
  concurrent-safe claims; returns `{event,lease,attempts}[]`, maximum ten. Blocked
  rows are excluded until explicit repair. Expired leases are reclaimable.
- `org_intake_settle_v1(lease,state)` performs compare-and-swap against the active
  lease, persists retry schedule/status and returns `{updated:true}`. Completion
  is durable; blocks preserve all original event content for operator repair.

No such RPC definitions exist in current repository schema or live readback.
The main handlers use `return=minimal` source inserts. Although schema.sql
contains bigint identity columns, it is not live schema evidence. A durable
canonical source-row identity and transactional source-capture/outbox creation
(or approved reconciliation cursor over existing source rows) are prerequisites
to safely wiring `insertRow` to this adapter. Attaching a non-atomic after-insert
send would create precisely the process-loss window this change must avoid.
No speculative source-table SQL, RLS, triggers, credentials or migrations are
applied or included here. Live schema/readback and storage access are pending,
not denied. Existing legitimate submission and notification behavior is intact.

No failure/lifecycle kind exists in the draft. Such records must remain local
and blocked for contract review; never hide them in approved message/note fields.
No auth capture is introduced. Real notification delivery is not asserted by
202 ingress acceptance, and no customer assurance is changed.

## Verification and remaining work
Tests cover stable projection/privacy, disabled admission, spam/canary isolation,
shared draft valid/invalid/HMAC/ACK fixtures, malformed/false ACK, 401 repair with
same immutable content, unknown HTTP success, 429/503, stalled fetch, invalid
stored content, and missing durable/CAS acknowledgements.
These use local fake persistence/network only; they do not prove actual database
transactionality, production RPC concurrency, or live grants. Those require
separate schema approval and adapter integration tests before handler wiring.
No forwarding activation, purchases/refunds or external messages occurred.
