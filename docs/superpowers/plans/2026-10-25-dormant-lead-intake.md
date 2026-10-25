# Dormant org lead intake implementation plan

> **For agentic workers:** Use superpowers:executing-plans or subagent-driven-development for the remaining tasks.

**Goal:** Safely prepare org form senders while keeping activation on hold.
**Architecture:** Existing capture handlers remain authoritative; a future durable adapter supplies replayable identity and state to a bounded worker using an owner-approved protocol adapter.
**Tech stack:** CommonJS, node:test, existing Supabase REST capture.
**Spec:** `docs/superpowers/specs/2026-10-25-dormant-lead-intake-design.md`.

## Global constraints
No migrations, RLS, credentials, triggers, forwarding activation or real sends.
No stale branch merge; no Studio edits. Retain genuine signup/payment behavior.

## Review focus
- Wrong secret must remain pending until repaired.
- Unexpected transport acknowledgement must never complete work.
- Spam and canary volume must not consume genuine capacity.
- Disabled or missing prerequisites must avoid admission.
- A pure policy is not a persistence adapter or durability implementation.

## Task 1: Contract-neutral policy (prepared)
Files: `scripts/lib/intake-policy.cjs`, `tests/intake_policy.test.js`.
Interface: `intakeDisposition(options = {})` returns disabled, discard, enqueue,
retain with reason, or complete. Requires strict boolean readiness. No env reads,
network, persistence, payload shaping or handler imports.
- [x] Write tests for disabled gates, isolated traffic and retained failures.
- [x] Run failing test before introducing module.
- [x] Implement pure policy and run focused tests.
- [ ] Independent review and current-head verification before merge.

## Task 2: Owner contract and durable adapter (blocked)
- [ ] Obtain new versioned hub artifacts and pin fixtures by commit.
- [ ] Establish an approved durable adapter and atomic identity/recovery semantics.
- [ ] Specify exact event schemas/allowlists and free-text minimization.
- [ ] Add tests for owner contract, identity, process-loss replay and failure injection.
- [ ] Implement protocol/queue adapter without enabling it.

## Task 3: Dormant handler integration (blocked by task 2)
Files: `api/contact.js`, `api/book-call.js`, `api/book.js`, `api/investors.js`,
`api/_shared.js`, respective handler tests.
- [ ] Prove disabled flow has identical capture/notification behavior.
- [ ] Add stable logical identity and persisted retry/repair bookkeeping.
- [ ] Gate all enqueueing; bounded protocol worker uses persisted leases.
- [ ] Run `node --test tests/*.test.js` and `python3 tests/verify_site.py`.
- [ ] Review independently, rebase onto current main and rerun before PR merge.

Activation remains a separate hold even after dormant code merges.
