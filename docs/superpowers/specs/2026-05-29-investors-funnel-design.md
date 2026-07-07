# Design Spec — `suedeai.org/investors` Investor & VC Lead Funnel

- **Date:** 2026-05-29
- **Status:** Approved (design), ready for implementation plan
- **Repo:** `Suede-AI/suedeai-org` (static site + Vercel serverless `/api`)
- **Owner:** Jason Colapietro (Johnny Suede), Founder & CEO, Suede Labs AI

## 1. Goal

Build a conversion-focused investor/VC lead funnel at `https://suedeai.org/investors/` that:

1. Tells the Suede Labs investment thesis using only claims already published on the site.
2. Captures qualified investor leads (name, firm, role, check size, timeline, intent).
3. Routes each lead to Supabase **and** an instant email alert (reusing the live `api/contact.js` pipeline).
4. Delivers a tiered post-submit experience: interest captured → deck/data-room link unlocked → intro call bookable.

This is a lead-generation funnel, not a data room with authentication. Hard gating is explicitly out of scope for v1 (see §13).

## 2. Confirmed decisions

| Decision | Choice |
|---|---|
| Conversion goal | Tiered: express interest → unlock deck → book call |
| Funnel structure | Single landing page + form |
| Lead routing | Supabase row + Resend email alert to founder |
| Host | `suedeai.org/investors` (indexable / listed) |
| Tier mechanic | One capture form; intent expressed as a field; deck + scheduler revealed on `/investors/thanks/` and in the autoresponder email |

## 3. Scope

**In scope (v1):**
- New page `investors/index.html`
- New thank-you page `investors/thanks/index.html`
- New serverless handler `api/investors.js` (reuses `api/_shared.js` unchanged)
- New serverless redirect helper `api/investor-link.js` (env-driven deck/call URLs)
- New Supabase table `investor_leads` + RLS in `supabase/schema.sql`
- Scoped CSS additions for the premium investor sections (in `assets/css/site.css` or a dedicated `assets/css/investors.css`)
- `sitemap.xml` entry for `/investors/`
- `tests/verify_site.py` coverage for the two new pages
- New env vars (documented in `.env.example`)

**Out of scope (v1):**
- Authenticated/token-gated data room
- CRM sync beyond Supabase + email
- Editing `index.html` nav (held until open SEO PRs #3/#5/#6 merge — see §12)
- Any change to `api/_shared.js`, `api/contact.js`, or `api/book.js`

## 4. Architecture overview

```
Visitor → /investors/ (static HTML, assets/js/site.js progressive enhancement)
   │  submit form (fetch POST → /api/investors/, native-POST fallback)
   ▼
api/investors.js
   ├─ validate (name, email, firm required; email regex; honeypot)
   ├─ insertRow("investor_leads", {...}) via Supabase REST  (_shared.insertRow)
   ├─ sendEmail → INVESTOR_NOTIFY_TO  (_shared.sendEmail / Resend), reply_to = lead
   ├─ optional autoresponder → lead email (deck + call links from env)
   └─ 303 redirect → /investors/thanks/   (or JSON {ok, redirectTo} for fetch)
   ▼
/investors/thanks/ (static, noindex)
   ├─ "Book an intro call" → /api/investor-link?target=call → 302 INVESTOR_CALENDAR_URL
   └─ "View the materials" → /api/investor-link?target=deck → 302 INVESTOR_DECK_URL
        (both fall back to /contact/ if env unset)
```

The page mirrors the existing `contact/` form contract exactly:
`data-api-endpoint="/api/investors/"`, `data-fallback-action="/api/investors/"`,
`data-success-redirect="/investors/thanks/"`, plus a `[data-form-status]` note element.

## 5. Page narrative — `investors/index.html`

All copy is sourced from the site's published thesis (`llms.txt`, `llms-full.txt`, topical pages). No invented metrics.

1. **Hero** — H1 thesis line ("The ownership layer for the AI media era"), lede, primary CTA *Request investor materials* (anchors to form), secondary *Read the thesis* (anchors to thesis section / links `/proof-of-creation/`). Credibility strip: "Live on Base mainnet · 3 paid x402 resources · iOS apps shipped · Featured in TechBullion." Each strip item links to its source.
2. **Why now** — verbatim-aligned framing: creation became abundant; the scarce layer is proof, identity, ownership, distribution, payment, licensing, repeatable income. "The question is who owns the rails."
3. **The four stages** — CREATE → PROVE → LAUNCH → EARN, terminal/ledger styling.
4. **Proof of execution** — the real ecosystem table (Suede AI, Suede App, Strumly + iOS, Launchpad, Vaults + x402, Distribution) with live URLs. Registry-Cyan ledger treatment.
5. **Traction signals** — verifiable only: ERC-8004 contracts live on Base mainnet; 3 paid x402 resources (`app.suedeai.ai/.well-known/x402.json`); Producer ACP agent (Virtuals, ID `019e3991-374d-75f3-a6b8-17ff309b4cd2`); iOS line (8 live App Store apps, including Suede: AI Music Generator, Suede Guitar Tuner & Studio, and Suede Studio Voice); TechBullion coverage. Every figure links to its source endpoint/article.
6. **Founder** — concise Jason Colapietro / Johnny Suede block; links `/jason-colapietro/`, `/book/`, LinkedIn, X, GitHub.
7. **The ask (teaser)** — one soft line that materials/deck cover the round; no raise terms on the public page.
8. **Capture block** — the form (§6).
9. **Footer** — reuse `.site-footer`; cross-link thesis pages + `/contact/`. Legal: "© 2026 JC Investment Group LLC."

**Banned/required language:** lead with creator ownership, programmable IP, rights, provenance, registry-backed media, royalty routing, agent commerce. Never reduce to "AI music app." Never use the phrase "Story Protocol." Describe the ERC-8004 stack in its own terms. Organization schema name stays **"Suede Labs"**; body copy may use **"Suede Labs AI"** for the company.

## 6. Form spec

Posts to `/api/investors/`. Fields:

| Field | Name | Required | Notes |
|---|---|---|---|
| Full name | `name` | yes | |
| Email | `email` | yes | regex `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
| Firm / organization | `firm` | yes | |
| Role / title | `role` | no | |
| Investor type | `investor_type` | no | select: Angel / Pre-seed–Seed / Multi-stage / Family office / Strategic / Other |
| Check size | `check_size` | no | select: <$25k / $25–100k / $100–250k / $250k–1M / $1M+ |
| Timeline | `timeline` | no | select: Active now / 1–3 months / Exploratory |
| Intent | `intent` | no | checkboxes: Intro / Send deck / Book a call (serialized comma-joined) |
| Website or LinkedIn | `website` | no | |
| Note | `message` | no | textarea |
| Consent | `consent` | no | checkbox, marketing follow-up |
| Honeypot | `company_url` | n/a | hidden; if filled, silently 200 without insert |
| Source | `source` | hidden | server sets `suedeai.org/investors` |
| UTM | `utm_source`, `utm_campaign` | hidden | populated from query string by `site.js` if present |

Accessibility: every field labeled; `[data-form-status]` is `aria-live="polite"`; visible focus states; submit disabled→re-enabled around fetch.

## 7. Data model — `supabase/schema.sql` (append)

```sql
create table if not exists public.investor_leads (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  firm text not null,
  role text,
  investor_type text,
  check_size text,
  timeline text,
  intent text,
  website text,
  message text,
  consent_marketing boolean default false,
  source text default 'suedeai.org/investors',
  utm_source text,
  utm_campaign text,
  status text not null default 'new',
  submitted_at timestamptz not null default now()
);

create index if not exists investor_leads_submitted_at_idx
  on public.investor_leads (submitted_at desc);

alter table public.investor_leads enable row level security;

drop policy if exists "investor_leads_insert_anon" on public.investor_leads;
create policy "investor_leads_insert_anon"
  on public.investor_leads
  for insert
  to anon, authenticated
  with check (
    source = 'suedeai.org/investors'   -- MUST equal the value api/investors.js writes
    and name is not null
    and email is not null
    and firm is not null
    and submitted_at is not null
  );

revoke all on public.investor_leads from anon, authenticated;
grant insert on public.investor_leads to anon, authenticated;
```

`status` workflow (manual, in Supabase): `new → contacted → meeting → diligence → committed → passed`.

**Critical:** the RLS `with check (source = 'suedeai.org/investors')` must match the exact `source` string `api/investors.js` writes, or inserts 403. Do not write `'suedeai.org'` from the API for this table.

## 8. API — `api/investors.js`

Mirror `api/contact.js`; reuse `_shared.js` (`allowPostOnly`, `getRequestFields`, `normalizeText`, `insertRow`, `sendEmail`, `getEnv`, `sendJson`, `redirect`, `wantsJson`) **unchanged**.

Behavior:
1. `allowPostOnly`.
2. Read + normalize fields. Honeypot `company_url`: if non-empty → return success (`{ok:true, redirectTo:"/investors/thanks/"}` / 303) without DB write.
3. Validate `name`, `email` (regex), `firm`. On failure → 400 (JSON or text per `wantsJson`).
4. `insertRow(process.env.SUPABASE_INVESTOR_TABLE || "investor_leads", { ...fields, source: "suedeai.org/investors", submitted_at: new Date().toISOString() })`.
5. On insert failure → propagate status/payload like `contact.js`.
6. Notify email: if `INVESTOR_NOTIFY_TO` and `INVESTOR_EMAIL_FROM` set → `sendEmail` with subject `New investor lead: <firm> [<check_size>]`, body listing all fields + intent, `reply_to` = lead email.
7. Optional autoresponder: if `INVESTOR_AUTORESPONDER=true` and `INVESTOR_EMAIL_FROM` set → `sendEmail` to lead with thesis + deck (`INVESTOR_DECK_URL`) and call (`INVESTOR_CALENDAR_URL`) links. Best-effort; never block success on email.
8. Success → `{ok:true, redirectTo:"/investors/thanks/"}` (fetch) or `303 → /investors/thanks/`.

Failures in email are non-fatal (lead already stored). Never log PII to stdout beyond what `contact.js` does.

## 9. Redirect helper — `api/investor-link.js`

GET handler. Reads `?target=`:
- `deck` → 302 to `INVESTOR_DECK_URL`
- `call` → 302 to `INVESTOR_CALENDAR_URL`
- unset/unknown env → 302 to `/contact/`

Keeps deck/scheduler URLs in env (static HTML can't read env at runtime), so no placeholder links ship in HTML. Cache-Control: `no-store`.

## 10. Thank-you page — `investors/thanks/index.html`

`meta robots: noindex, follow` (matches `contact/thanks/`). Confirmation copy. Two buttons:
- `.button--primary` → `/api/investor-link?target=call` ("Book an intro call")
- `.button--secondary` → `/api/investor-link?target=deck` ("View the materials")
Plus links to `/proof-of-creation/`, `/programmable-ip/`, `/book/`. Reuse `.success-hero`, `.panel`, `.button-row`.

## 11. Design, a11y, SEO

- **Visual:** Suede palette layered onto `site.css` idiom — Deep Ink sections, **Registry Cyan** accents, **Rights Red** primary CTA, **Verified Emerald** "live" states. Editorial + terminal/ledger hybrid; hairlines; 4–6px radius; uppercase command/eyebrow labels; sentence-case body. Reuse existing classes (`.site-header`, `.page-hero`, `.eyebrow`, `.lede`, `.panel`, `.form-card`, `.button*`, `.site-footer`) and add scoped `.investor-*` classes for hero strip, stages, and ledger table.
- **Responsive:** 320 / 375 / 768 / 1024 / 1440; no overflow; touch targets ≥44px.
- **Motion:** compositor-only (transform/opacity); honor `prefers-reduced-motion`.
- **SEO:** indexable. `<title>` "Invest in Suede Labs AI | Ownership Infrastructure for the AI Media Era" (or similar), description, canonical `https://suedeai.org/investors/`, OG/Twitter tags (reuse `og-suede.png`), `WebPage` JSON-LD referencing the existing Organization (name "Suede Labs"). Add `<url><loc>https://suedeai.org/investors/</loc></url>` to `sitemap.xml`. Thanks page stays `noindex`.

## 12. Conflict-avoidance with open PRs

Open PRs #3/#5/#6 touch `index.html` and `jason-colapietro/index.html`. This work creates **only new files** plus an append to `supabase/schema.sql` and one `<url>` entry in `sitemap.xml`. **Do not edit `index.html`** in this change — the homepage nav link to `/investors/` is deferred until those PRs merge (tracked as a follow-up). If `sitemap.xml` is also touched by PR #6, add the `/investors/` entry after merge to avoid a conflict; otherwise add it here.

## 13. Env vars (add to `.env.example`)

```
SUPABASE_INVESTOR_TABLE=investor_leads
INVESTOR_EMAIL_FROM=info@suedeai.org
INVESTOR_NOTIFY_TO=info@suedeai.org
INVESTOR_AUTORESPONDER=false
INVESTOR_DECK_URL=
INVESTOR_CALENDAR_URL=
```

Defaults chosen so the funnel ships and captures leads even with deck/calendar URLs unset (buttons fall back to `/contact/`). `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `RESEND_API_KEY` already exist for the contact flow.

## 14. Testing

- Extend `tests/verify_site.py`: assert `investors/index.html` and `investors/thanks/index.html` exist; assert required markup (canonical, title, form `action="/api/investors/"`, thanks `noindex`).
- Add a focused Node test for `api/investors.js`: missing required field → 400; honeypot filled → success-without-insert; valid payload → insert call shape + `source === 'suedeai.org/investors'`. Mock `_shared` insert/email.
- Manual E2E (in plan): `curl -X POST /api/investors/` happy path + validation; load `/investors/` at 320/768/1440; submit → `/investors/thanks/`; verify Supabase row + Resend email in a staging/preview env.

## 15. Deployment steps (do not deploy without explicit approval)

1. Run the `investor_leads` migration against the Supabase project (append to `schema.sql`, apply).
2. Set new env vars in the Vercel `suedeai-org` project (`vercel whoami` must be `suede-ai`).
3. Deploy preview, verify capture end-to-end, then promote.

## 16. Future (not v1)

- Token/signed-link gating for the deck (hard data room).
- Per-intent routing (e.g., auto-send Cal.com invite when "Book a call" checked).
- CRM sync; analytics events on form view/submit.
- Homepage nav link once SEO PRs merge.

## 17. File manifest

| Action | Path |
|---|---|
| add | `investors/index.html` |
| add | `investors/thanks/index.html` |
| add | `api/investors.js` |
| add | `api/investor-link.js` |
| edit | `supabase/schema.sql` (append `investor_leads`) |
| edit | `sitemap.xml` (add `/investors/`) |
| edit | `.env.example` (add investor vars) |
| edit | `assets/css/site.css` or add `assets/css/investors.css` (scoped styles) |
| edit | `tests/verify_site.py` (coverage) |
| add | `tests/test_api_investors.*` (handler validation test) |
| not touched | `index.html`, `api/_shared.js`, `api/contact.js`, `api/book.js` |
