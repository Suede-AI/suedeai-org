# Dormant org lead intake

Status: partial preparation; wire integration and activation blocked.

## Intent and constraints
Prepare selective replacement for `feat/lead-intake-forwarding` at
`babc3179e9229c8e7de3a6872a23d7b25cde8e1c` against main `e14879c`.
Preserve legitimate form completion and existing email behavior. Do not create
credentials, configure secrets, add live auth triggers, modify RLS, apply
migrations, enable forwarding, or send customer data. Do not alter Studio.

## Evidence and approach
The stale branch adds immediate forwarding to four handlers, uses generated
per-request IDs, and relies on three in-memory network attempts. It has no
sender durable delivery ledger. Current main stores accepted submissions using
`api/_shared.js:insertRow` with `Prefer: return=minimal`, so callers cannot
recover a canonical inserted row ID. Existing credentials are publishable/anon
insert credentials, not authorization for an outbox recovery worker.

Prefer explicit narrow adapters plus a durable delivery ledger over merging the
stale branch. Inline retries alone cannot survive process termination. Retrying
from an ephemeral local file does not satisfy serverless durability. Current
scope implements only a pure dormant admission/recovery policy with synthetic
tests, and leaves all handlers untouched.

## Current contract dependency
Read-only historical hub artifact:
`JasonColapietro/suede-agent-studio@7caec4e5b13ff593ca1e4addf372d6ac8ee635c7`,
`docs/intake/CONTRACT.md` and `src/lib/intake/contract.ts`.
It is the October 23 unversioned contract. A new versioned owner contract is
required for durable acknowledgement, failure-alert/lifecycle semantics,
source permissions, spam/canary isolation, and cross-repository fixtures. Do
not claim historical shape compatibility as acceptance of the reviewed design.

## Payload specification to finalize with the owner contract
Project only validated, accepted submissions after existing spam gate:

| Form | Candidate allowlist |
| --- | --- |
| contact | name, email, topic, message |
| book-call | name, email, company, topic, message, timeframe |
| book | name, email, context |
| investors | name, email, firm, role, investor_type, check_size, timeline, website, message, consent_marketing |

Candidate fields are an upper bound; do not add request-body spreads, arbitrary
keys, headers, cookies, tokens, passwords, payment data or infrastructure errors.
Free text requires a reviewed minimization/redaction policy before inclusion;
allowlisting keys alone cannot guarantee that free-text values contain no
secrets. Only preserve the investor form's existing marketing-consent value;
a requested book or call does not grant marketing consent. Ignore extra fields.
No org auth flow exists here; do not add auth records or triggers.

## Persistence and lifecycle prerequisites
Require a separately approved durable adapter with canonical submission identity,
atomic capture/outbox creation or a recoverable reconciliation cursor, unique
logical-event key, lease/CAS worker claims, persisted retry schedule, and
observable configuration/validation failures. Existing form rows are not proof
that an intake event can be replayed. No migration or policy is included here.
Transport is bounded by an explicit timeout per attempt and worker run budget;
network timeouts, 429, server failures, wrong secret, invalid config and invalid
events all retain durable pending state. A verified durable hub acknowledgement
is the only completion boundary. Repairs requeue the same event identity.
Accepted lead capture must not depend on successful hub notification. Existing
notification wording must not be expanded to assure a notification that failed.

Default policy is disabled unless boolean enablement, owner-contract readiness,
and durable-store readiness are explicitly established. Genuine lead capacity
never admits spam, canary, or unknown traffic; any future quarantine gets its own
bounded capacity and expiry. Disabled policy neither sends nor stores new data.

## Required future verification
Cross-repo fixtures must be copied from and pinned to the owner contract commit.
Test body/schema limits, unknown keys, prototype keys, nested secrets, consent,
replay after process loss, duplicate requests, concurrent claims, wrong secret
then repair, stalled fetch, malformed success acknowledgement, 429/server faults,
spam/canary floods, persistence failure and unchanged form success behavior.
All network and persistence are local fakes; no external messages or customers.
