# Investor & VC Lead Funnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a conversion-focused investor/VC lead funnel at `https://suedeai.org/investors/` that captures qualified leads into Supabase, emails the founder instantly, and reveals deck + call options after submit.

**Architecture:** Static HTML page + Vercel serverless handlers, reusing the live `api/_shared.js` (Supabase REST insert + Resend email) pipeline already powering `api/contact.js`/`api/book.js`. One capture form expresses tiered intent (intro / deck / call); `/investors/thanks/` and an optional autoresponder deliver the deck/scheduler links from env. All-new files plus three small additive edits (`supabase/schema.sql`, `sitemap.xml`, `.env.example`) — no edits to `index.html` or existing handlers.

**Tech Stack:** Static HTML/CSS, Node CommonJS serverless functions (Vercel `/api`), Supabase REST, Resend, Python `tests/verify_site.py`, Node built-in `node:test` (Node ≥18).

**Spec:** `docs/superpowers/specs/2026-05-29-investors-funnel-design.md`

**Branch assumption:** Work on `feat/investors-funnel` (already created off `main`, holds the spec commit). Do NOT touch `index.html`, `jason-colapietro/index.html`, `api/_shared.js`, `api/contact.js`, `api/book.js`.

**Repo root for all paths below:** `/Users/jason/Documents/Ramboed/suedeai-org`

---

### Task 1: Supabase `investor_leads` table + RLS

SQL DDL doesn't fit RED/GREEN; verify by grep after appending. The RLS check string MUST equal the `source` the API writes (`suedeai.org/investors`) or inserts 403 silently.

**Files:**
- Modify: `supabase/schema.sql` (append at end)

- [ ] **Step 1: Append the table + RLS to `supabase/schema.sql`**

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
    source = 'suedeai.org/investors'
    and name is not null
    and email is not null
    and firm is not null
    and submitted_at is not null
  );

revoke all on public.investor_leads from anon, authenticated;
grant insert on public.investor_leads to anon, authenticated;
```

- [ ] **Step 2: Verify the critical fragments are present**

Run: `grep -n "investor_leads" supabase/schema.sql && grep -n "source = 'suedeai.org/investors'" supabase/schema.sql`
Expected: at least one match for `create table ... public.investor_leads`, the index, the policy, and exactly the RLS `source = 'suedeai.org/investors'` line.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(investors): add investor_leads table + RLS"
```

---

### Task 2: API handler `api/investors.js`

**Files:**
- Create: `api/investors.js`
- Test: `tests/api_investors.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/api_investors.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");

// Supabase must look configured so insertRow proceeds.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";
// Leave INVESTOR_NOTIFY_TO / INVESTOR_EMAIL_FROM unset so no email fetch fires.

const handler = require("../api/investors.js");

function makeReq(body) {
  return { method: "POST", headers: { accept: "application/json" }, body };
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) { this.headers[k] = v; },
    end(payload) { this.body = payload || ""; },
  };
}

function stubFetch() {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, text: async () => "" };
  };
  return calls;
}

test("400 when firm is missing", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq({ name: "Pat", email: "pat@fund.com" }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(calls.length, 0, "should not insert when invalid");
});

test("honeypot fill returns success without inserting", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(
    makeReq({ name: "Bot", email: "bot@spam.com", firm: "X", company_url: "filled" }),
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.length, 0, "honeypot should skip insert");
});

test("valid lead inserts into investor_leads with correct source", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(
    makeReq({
      name: "Pat Investor",
      email: "pat@fund.com",
      firm: "Fund Capital",
      intent_deck: "yes",
      intent_call: "yes",
    }),
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.length, 1, "exactly one insert call");
  assert.match(calls[0].url, /\/rest\/v1\/investor_leads$/);
  const sent = JSON.parse(calls[0].opts.body);
  assert.strictEqual(sent.source, "suedeai.org/investors");
  assert.strictEqual(sent.intent, "deck,call");
  const result = JSON.parse(res.body);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.redirectTo, "/investors/thanks/");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/api_investors.test.js`
Expected: FAIL — `Cannot find module '../api/investors.js'`.

- [ ] **Step 3: Write the handler**

Create `api/investors.js`:

```js
const {
  allowPostOnly,
  getEnv,
  getRequestFields,
  insertRow,
  normalizeText,
  redirect,
  sendEmail,
  sendJson,
  wantsJson,
} = require("./_shared");

const SOURCE = "suedeai.org/investors";
const SUCCESS_REDIRECT = "/investors/thanks/";

function buildIntent(fields) {
  const parts = [];
  if (normalizeText(fields.intent_intro)) parts.push("intro");
  if (normalizeText(fields.intent_deck)) parts.push("deck");
  if (normalizeText(fields.intent_call)) parts.push("call");
  return parts.join(",");
}

function buildAutoresponder({ name, deckUrl, calendarUrl }) {
  const hi = name ? ` ${name}` : "";
  const lines = [
    `Hi${hi},`,
    "",
    "Thank you for your interest in Suede Labs AI. We build the ownership and settlement layer for the AI media era: proof of creation, programmable IP, provenance, royalty routing, and agent commerce.",
    "",
  ];
  if (deckUrl) lines.push(`Investor materials: ${deckUrl}`);
  if (calendarUrl) lines.push(`Book an intro call: ${calendarUrl}`);
  if (!deckUrl && !calendarUrl) {
    lines.push("Our team will follow up shortly with materials and next steps.");
  }
  lines.push("", "Suede Labs AI", "https://suedeai.org/");
  return { subject: "Suede Labs AI — investor materials", text: lines.join("\n") };
}

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const fields = getRequestFields(req);

  // Honeypot: a hidden field humans never fill. If present, succeed without storing.
  if (normalizeText(fields.company_url)) {
    if (wantsJson(req)) {
      sendJson(res, 200, { ok: true, redirectTo: SUCCESS_REDIRECT });
      return;
    }
    redirect(res, SUCCESS_REDIRECT);
    return;
  }

  const name = normalizeText(fields.name);
  const email = normalizeText(fields.email);
  const firm = normalizeText(fields.firm);
  const role = normalizeText(fields.role);
  const investorType = normalizeText(fields.investor_type);
  const checkSize = normalizeText(fields.check_size);
  const timeline = normalizeText(fields.timeline);
  const website = normalizeText(fields.website);
  const message = normalizeText(fields.message);
  const intent = buildIntent(fields);
  const consentMarketing = Boolean(normalizeText(fields.consent));
  const utmSource = normalizeText(fields.utm_source);
  const utmCampaign = normalizeText(fields.utm_campaign);

  if (!name || !firm || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const errorMessage = "Name, email, and firm are required.";
    if (wantsJson(req)) {
      sendJson(res, 400, { error: errorMessage });
      return;
    }
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(errorMessage);
    return;
  }

  const table = process.env.SUPABASE_INVESTOR_TABLE || "investor_leads";
  const result = await insertRow(table, {
    name,
    email,
    firm,
    role,
    investor_type: investorType,
    check_size: checkSize,
    timeline,
    intent,
    website,
    message,
    consent_marketing: consentMarketing,
    source: SOURCE,
    utm_source: utmSource,
    utm_campaign: utmCampaign,
    submitted_at: new Date().toISOString(),
  });

  if (!result.ok) {
    if (wantsJson(req)) {
      sendJson(res, result.status, result.payload);
      return;
    }
    res.statusCode = result.status;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(result.payload.error || "Submission failed.");
    return;
  }

  const sender = getEnv("INVESTOR_EMAIL_FROM");
  const notifyTo = getEnv("INVESTOR_NOTIFY_TO");

  if (sender && notifyTo) {
    const summary = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Firm: ${firm}`,
      `Role: ${role || "(none)"}`,
      `Investor type: ${investorType || "(none)"}`,
      `Check size: ${checkSize || "(none)"}`,
      `Timeline: ${timeline || "(none)"}`,
      `Intent: ${intent || "(none)"}`,
      `Website: ${website || "(none)"}`,
      `UTM: ${utmSource || "-"} / ${utmCampaign || "-"}`,
      `Consent: ${consentMarketing ? "yes" : "no"}`,
      "",
      message || "(no message)",
    ].join("\n");

    await sendEmail({
      from: sender,
      to: [notifyTo],
      subject: `New investor lead: ${firm}${checkSize ? ` [${checkSize}]` : ""}`,
      text: summary,
      reply_to: email,
    });
  }

  if (sender && getEnv("INVESTOR_AUTORESPONDER") === "true") {
    const auto = buildAutoresponder({
      name,
      deckUrl: getEnv("INVESTOR_DECK_URL"),
      calendarUrl: getEnv("INVESTOR_CALENDAR_URL"),
    });
    await sendEmail({
      from: sender,
      to: [email],
      subject: auto.subject,
      text: auto.text,
      reply_to: notifyTo || sender,
    });
  }

  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: SUCCESS_REDIRECT });
    return;
  }

  redirect(res, SUCCESS_REDIRECT);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/api_investors.test.js`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/investors.js tests/api_investors.test.js
git commit -m "feat(investors): add /api/investors lead handler (Supabase + Resend)"
```

---

### Task 3: API redirect helper `api/investor-link.js`

Keeps deck/scheduler URLs in env (static HTML can't read env), reached at `/api/investor-link/?target=deck|call`. Falls back to `/contact/`.

**Files:**
- Create: `api/investor-link.js`
- Test: `tests/api_investor_link.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/api_investor_link.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");

const handler = require("../api/investor-link.js");

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end() {},
  };
}

test("target=deck redirects to INVESTOR_DECK_URL when set", async () => {
  process.env.INVESTOR_DECK_URL = "https://deck.example/suede";
  const res = makeRes();
  await handler({ method: "GET", url: "/api/investor-link?target=deck" }, res);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.Location, "https://deck.example/suede");
});

test("target=call falls back to /contact/ when env unset", async () => {
  delete process.env.INVESTOR_CALENDAR_URL;
  const res = makeRes();
  await handler({ method: "GET", url: "/api/investor-link?target=call" }, res);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.Location, "/contact/");
});

test("unknown target falls back to /contact/", async () => {
  const res = makeRes();
  await handler({ method: "GET", url: "/api/investor-link?target=bogus" }, res);
  assert.strictEqual(res.headers.Location, "/contact/");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/api_investor_link.test.js`
Expected: FAIL — `Cannot find module '../api/investor-link.js'`.

- [ ] **Step 3: Write the handler**

Create `api/investor-link.js`:

```js
const TARGET_ENV = {
  deck: "INVESTOR_DECK_URL",
  call: "INVESTOR_CALENDAR_URL",
};
const FALLBACK = "/contact/";

module.exports = async (req, res) => {
  const parsed = new URL(req.url, "https://suedeai.org");
  const target = parsed.searchParams.get("target") || "";
  const envName = TARGET_ENV[target];
  const configured = envName ? String(process.env[envName] || "").trim() : "";
  const destination = configured || FALLBACK;

  res.statusCode = 302;
  res.setHeader("Location", destination);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/api_investor_link.test.js`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/investor-link.js tests/api_investor_link.test.js
git commit -m "feat(investors): add /api/investor-link env-driven redirect helper"
```

---

### Task 4: Scoped stylesheet `assets/css/investors.css`

**Files:**
- Create: `assets/css/investors.css`
- Modify: `tests/verify_site.py` (add the file to the asset-existence list)

- [ ] **Step 1: Add the asset to `tests/verify_site.py` (failing assertion)**

In `tests/verify_site.py`, after the line `css_asset = ROOT / "assets" / "css" / "site.css"` (≈ line 211), add:

```python
    investors_css = ROOT / "assets" / "css" / "investors.css"
```

Then inside the `for asset in [ ... ]:` existence-check list (≈ lines 223-242), add `investors_css,` after `css_asset,`.

- [ ] **Step 2: Run to verify it fails**

Run: `python3 tests/verify_site.py`
Expected: FAIL — `assets/css/investors.css: file does not exist`.

- [ ] **Step 3: Create `assets/css/investors.css`**

```css
/* Investor funnel — scoped styles. Suede Institutional IP Terminal palette. */
.inv {
  --inv-ink: #050b16;
  --inv-panel: #09101b;
  --inv-control: #0d1726;
  --inv-line: rgba(34, 211, 238, 0.18);
  --inv-cyan: #22d3ee;
  --inv-red: #9f101a;
  --inv-emerald: #34d399;
  --inv-sky: #38bdf8;
  --inv-text: #eef2f7;
  --inv-muted: rgba(238, 242, 247, 0.66);
  --inv-radius: 6px;
  background: var(--inv-ink);
  color: var(--inv-text);
}
.inv__band {
  width: 100%;
  padding: clamp(3rem, 2rem + 5vw, 7rem) clamp(1rem, 0.5rem + 3vw, 4rem);
  border-bottom: 1px solid var(--inv-line);
}
.inv__inner { max-width: 1080px; margin: 0 auto; }
.inv__eyebrow {
  font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--inv-cyan); margin: 0 0 0.75rem;
}
.inv__h1 {
  font-size: clamp(2.4rem, 1.2rem + 4.6vw, 4.6rem); line-height: 1.02;
  letter-spacing: -0.02em; margin: 0 0 1rem; font-weight: 820;
}
.inv__lede { font-size: clamp(1.05rem, 0.98rem + 0.5vw, 1.3rem); color: var(--inv-muted); max-width: 48ch; }
.inv__cta-row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.75rem; }
.inv__btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 0 1.4rem; border-radius: var(--inv-radius);
  font-weight: 600; text-decoration: none; border: 1px solid transparent;
  transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1), background 150ms, border-color 150ms;
}
.inv__btn--primary { background: var(--inv-red); color: #fff; }
.inv__btn--primary:hover { transform: translateY(-1px); background: #b51420; }
.inv__btn--ghost { border-color: var(--inv-line); color: var(--inv-text); }
.inv__btn--ghost:hover { border-color: var(--inv-cyan); }
.inv__strip { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-top: 2rem; font-size: 0.82rem; }
.inv__strip a { color: var(--inv-muted); text-decoration: none; border-bottom: 1px dotted var(--inv-line); }
.inv__strip a:hover { color: var(--inv-emerald); }
.inv__h2 { font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2.4rem); letter-spacing: -0.01em; margin: 0 0 1rem; }
.inv__body { color: var(--inv-muted); max-width: 64ch; }
.inv__grid { display: grid; gap: 1px; background: var(--inv-line); border: 1px solid var(--inv-line); border-radius: var(--inv-radius); overflow: hidden; margin-top: 1.5rem; }
.inv__grid--4 { grid-template-columns: repeat(4, 1fr); }
.inv__cell { background: var(--inv-panel); padding: 1.5rem; }
.inv__cell h3 { margin: 0 0 0.4rem; font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--inv-cyan); }
.inv__cell p { margin: 0; color: var(--inv-muted); font-size: 0.95rem; }
.inv__ledger { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-top: 1.5rem; }
.inv__ledger th, .inv__ledger td { text-align: left; padding: 0.85rem 1rem; border-bottom: 1px solid var(--inv-line); vertical-align: top; }
.inv__ledger th { color: var(--inv-cyan); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.12em; }
.inv__ledger a { color: var(--inv-sky); }
.inv__live { color: var(--inv-emerald); font-weight: 600; }
.inv__signals { list-style: none; padding: 0; margin: 1.5rem 0 0; display: grid; gap: 0.75rem; }
.inv__signals li { padding-left: 1.5rem; position: relative; color: var(--inv-muted); }
.inv__signals li::before { content: "▸"; position: absolute; left: 0; color: var(--inv-cyan); }
.inv__form { display: grid; gap: 1rem; max-width: 640px; margin-top: 1.5rem; }
.inv__field { display: grid; gap: 0.35rem; }
.inv__field label, .inv__form legend { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--inv-muted); }
.inv__form input[type="text"], .inv__form input[type="email"], .inv__form input[type="url"], .inv__form select, .inv__form textarea {
  min-height: 44px; padding: 0.65rem 0.8rem; border-radius: var(--inv-radius);
  background: var(--inv-control); border: 1px solid var(--inv-line); color: var(--inv-text); font: inherit; width: 100%;
}
.inv__form textarea { min-height: 120px; resize: vertical; }
.inv__form input:focus, .inv__form select:focus, .inv__form textarea:focus { outline: 2px solid var(--inv-cyan); outline-offset: 1px; }
.inv__checks { display: grid; gap: 0.5rem; border: 0; padding: 0; margin: 0; }
.inv__checks label { display: flex; gap: 0.5rem; align-items: center; text-transform: none; letter-spacing: 0; color: var(--inv-text); }
.inv__checks input { accent-color: var(--inv-cyan); width: 18px; height: 18px; }
.inv__consent { display: flex; gap: 0.5rem; align-items: center; text-transform: none; letter-spacing: 0; color: var(--inv-text); font-size: 0.9rem; }
.inv__hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.inv__status { color: var(--inv-emerald); font-size: 0.9rem; }
.inv__cols { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
@media (max-width: 720px) {
  .inv__grid--4 { grid-template-columns: 1fr 1fr; }
  .inv__cols { grid-template-columns: 1fr; }
  .inv__ledger thead { display: none; }
  .inv__ledger td { display: block; border: 0; padding: 0.3rem 0; }
  .inv__ledger tr { display: block; padding: 0.9rem 0; border-bottom: 1px solid var(--inv-line); }
}
@media (prefers-reduced-motion: reduce) {
  .inv__btn { transition: none; }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 tests/verify_site.py`
Expected: PASS (the css existence failure is gone; pages-not-yet-created failures appear only once those pages are added to PAGES in later tasks — at this point PAGES is unchanged, so it PASSES).

- [ ] **Step 5: Commit**

```bash
git add assets/css/investors.css tests/verify_site.py
git commit -m "feat(investors): add scoped investor funnel stylesheet"
```

---

### Task 5: Landing page `investors/index.html`

**Files:**
- Create: `investors/index.html`
- Modify: `tests/verify_site.py` (register page in PAGES + form_expectations)

- [ ] **Step 1: Register the page in `tests/verify_site.py` (failing assertions)**

In the `PAGES` dict (≈ lines 22-38), add after the `contact/index.html` entry:

```python
    "investors/index.html": "/investors/",
```

In the `form_expectations` dict (≈ lines 168-195), add:

```python
        "investors/index.html": [
            'action="/api/investors/"',
            'data-api-endpoint="/api/investors/"',
            "who owns the rails",
        ],
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 tests/verify_site.py`
Expected: FAIL — `investors/index.html: file does not exist`.

- [ ] **Step 3: Create `investors/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico?v=3" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3">
  <link rel="manifest" href="/site.webmanifest">
  <title>Invest in Suede Labs AI | The Ownership Layer for the AI Media Era</title>
  <meta name="description" content="Investor brief for Suede Labs AI — the ownership and settlement layer for the AI media era. Proof of creation, programmable IP, provenance, royalty routing, and agent commerce. Request investor materials.">
  <link rel="canonical" href="https://suedeai.org/investors/">
  <meta property="og:title" content="Invest in Suede Labs AI | The Ownership Layer for the AI Media Era">
  <meta property="og:description" content="Investor brief for Suede Labs AI — ownership infrastructure for the AI media era. Request investor materials and book an intro call.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.png">
  <meta property="og:url" content="https://suedeai.org/investors/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Suede">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Invest in Suede Labs AI">
  <meta name="twitter:description" content="Ownership infrastructure for the AI media era. Request investor materials.">
  <meta name="twitter:image" content="https://suedeai.org/assets/img/og-suede.png">
  <link rel="stylesheet" href="/assets/css/site.css">
  <link rel="stylesheet" href="/assets/css/investors.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Invest in Suede Labs AI","url":"https://suedeai.org/investors/","description":"Investor brief for Suede Labs — the ownership and settlement layer for the AI media era.","isPartOf":{"@type":"Organization","name":"Suede Labs","url":"https://suedeai.org/"}}
  </script>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Investors</span></a>
      <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary">
        <a href="#thesis">Thesis</a>
        <a href="#proof">Proof</a>
        <a href="/jason-colapietro/">Founder</a>
        <a href="#request">Request access</a>
      </nav>
    </div>
  </header>
  <main class="site-shell inv">
    <section class="inv__band" aria-labelledby="inv-hero-heading">
      <div class="inv__inner">
        <p class="inv__eyebrow">Investor Brief — Suede Labs AI</p>
        <h1 class="inv__h1" id="inv-hero-heading">The ownership layer for the AI media era.</h1>
        <p class="inv__lede">AI made creative output abundant. The scarce layer is now proof, identity, ownership, distribution, payment, and repeatable income. Suede Labs builds the rails for that layer.</p>
        <div class="inv__cta-row">
          <a class="inv__btn inv__btn--primary" href="#request">Request investor materials</a>
          <a class="inv__btn inv__btn--ghost" href="#thesis">Read the thesis</a>
        </div>
        <div class="inv__strip">
          <a href="https://app.suedeai.ai/.well-known/x402.json" rel="noopener"><span class="inv__live">Live</span> on Base mainnet</a>
          <a href="https://app.suedeai.ai/.well-known/x402.json" rel="noopener">3 paid x402 resources</a>
          <a href="https://techbullion.com/jason-colapietros-suede-labs-ai-launches-ios-apps/" rel="noopener">iOS apps shipped</a>
          <a href="https://techbullion.com/jason-colapietros-suede-labs-ai-launches-ios-apps/" rel="noopener">Featured in TechBullion</a>
        </div>
      </div>
    </section>

    <section class="inv__band" id="thesis" aria-labelledby="inv-thesis-heading">
      <div class="inv__inner">
        <h2 class="inv__h2" id="inv-thesis-heading">Creation got cheap. Ownership didn't scale.</h2>
        <p class="inv__body">AI lowered the cost of making songs, images, video, campaigns, lessons, and synthetic media to near zero. That shifts value away from production and toward the layer creators, agents, platforms, and fans need to turn work into durable value: authorship, voice, likeness, consent, provenance, rights, payment, and royalties.</p>
        <p class="inv__body">The investor question is not whether another tool can generate media. The question is <strong>who owns the rails</strong> when creative work has to be proven, licensed, distributed, and paid out across humans and AI agents.</p>
      </div>
    </section>

    <section class="inv__band" aria-labelledby="inv-stages-heading">
      <div class="inv__inner">
        <h2 class="inv__h2" id="inv-stages-heading">Four stages Suede addresses</h2>
        <div class="inv__grid inv__grid--4">
          <div class="inv__cell"><h3>Create</h3><p>AI lowers the cost of making media of every kind.</p></div>
          <div class="inv__cell"><h3>Prove</h3><p>Authorship, voice, likeness, consent, provenance, and rights travel with the work.</p></div>
          <div class="inv__cell"><h3>Launch</h3><p>Projects get routes to funding, audience, and ownership participation.</p></div>
          <div class="inv__cell"><h3>Earn</h3><p>Payments, vaults, royalties, licensing, distribution, and agent commerce turn output into income.</p></div>
        </div>
      </div>
    </section>

    <section class="inv__band" id="proof" aria-labelledby="inv-proof-heading">
      <div class="inv__inner">
        <h2 class="inv__h2" id="inv-proof-heading">Proof of execution — shipped surfaces, not slideware</h2>
        <table class="inv__ledger">
          <thead>
            <tr><th scope="col">Surface</th><th scope="col">What it does</th></tr>
          </thead>
          <tbody>
            <tr><td><a href="https://suedeai.ai/" rel="noopener">Suede AI</a></td><td>Ownership infrastructure: proof-of-creation, programmable IP, creator rights, provenance.</td></tr>
            <tr><td><a href="https://app.suedeai.ai/" rel="noopener">Suede App</a></td><td>Working product: rights passports, licensing, royalties, vaults, workflows.</td></tr>
            <tr><td><a href="https://strumly.suedeai.ai/" rel="noopener">Strumly + iOS</a></td><td>Artist-growth and empowerment products; the iOS Suede Studio line.</td></tr>
            <tr><td><a href="https://launch.suedeai.ai/" rel="noopener">Launchpad</a></td><td>Demand formation, activation, and fundability for creative projects.</td></tr>
            <tr><td><a href="https://app.suedeai.ai/.well-known/x402.json" rel="noopener">Vaults + x402</a></td><td>Royalty participation and agent-native, per-call USDC payments on Base.</td></tr>
            <tr><td><a href="https://distro.suedeai.ai/" rel="noopener">Distribution</a></td><td>Bridge from registered, owned work to audience reach and revenue.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="inv__band" aria-labelledby="inv-traction-heading">
      <div class="inv__inner">
        <h2 class="inv__h2" id="inv-traction-heading">Traction signals</h2>
        <ul class="inv__signals">
          <li>ERC-8004 identity, reputation, and validation contracts <span class="inv__live">live on Base mainnet</span>.</li>
          <li>3 paid x402 resources — agents pay per call in USDC, no account or API key.</li>
          <li>Producer by Suede Labs is a hireable Virtuals ACP agent for music, video, and ACP/x402 consulting.</li>
          <li>iOS app line shipped: 8 live App Store apps, including Suede: AI Music Generator, Suede Guitar Tuner &amp; Studio, and Suede Studio Voice.</li>
          <li>Third-party press coverage in TechBullion (May 2026).</li>
        </ul>
      </div>
    </section>

    <section class="inv__band" aria-labelledby="inv-founder-heading">
      <div class="inv__inner">
        <h2 class="inv__h2" id="inv-founder-heading">Founder</h2>
        <p class="inv__body"><strong>Jason Colapietro</strong> (Johnny Suede) is the Founder and CEO of Suede Labs AI, a published author and Forbes contributor. The internet upgraded access; AI upgraded creation; the next layer has to upgrade ownership. Read the <a href="/jason-colapietro/">founder profile</a> and the thesis book <a href="/book/">Stake Your Claim</a>.</p>
      </div>
    </section>

    <section class="inv__band" aria-labelledby="inv-ask-heading">
      <div class="inv__inner">
        <h2 class="inv__h2" id="inv-ask-heading">The ask</h2>
        <p class="inv__body">We're raising to deepen the ownership and settlement rails and expand the surfaces that already ship. Round details, metrics, and use of funds are in the investor materials — request access below.</p>
      </div>
    </section>

    <section class="inv__band" id="request" aria-labelledby="inv-request-heading">
      <div class="inv__inner">
        <h2 class="inv__h2" id="inv-request-heading">Request investor materials</h2>
        <p class="inv__body">Tell us a little about your firm. We'll send the materials and a link to book an intro call.</p>
        <form class="inv__form" action="/api/investors/" method="post" data-api-endpoint="/api/investors/" data-fallback-action="/api/investors/" data-success-redirect="/investors/thanks/">
          <div class="inv__hp" aria-hidden="true">
            <label>Company URL<input type="text" name="company_url" tabindex="-1" autocomplete="off"></label>
          </div>
          <div class="inv__cols">
            <div class="inv__field"><label for="inv-name">Full name</label><input id="inv-name" type="text" name="name" required></div>
            <div class="inv__field"><label for="inv-email">Email</label><input id="inv-email" type="email" name="email" required></div>
          </div>
          <div class="inv__cols">
            <div class="inv__field"><label for="inv-firm">Firm / organization</label><input id="inv-firm" type="text" name="firm" required></div>
            <div class="inv__field"><label for="inv-role">Role / title</label><input id="inv-role" type="text" name="role"></div>
          </div>
          <div class="inv__cols">
            <div class="inv__field">
              <label for="inv-type">Investor type</label>
              <select id="inv-type" name="investor_type">
                <option value="">Select…</option>
                <option>Angel</option>
                <option>Pre-seed / Seed VC</option>
                <option>Multi-stage VC</option>
                <option>Family office</option>
                <option>Strategic</option>
                <option>Other</option>
              </select>
            </div>
            <div class="inv__field">
              <label for="inv-check">Typical check size</label>
              <select id="inv-check" name="check_size">
                <option value="">Select…</option>
                <option>&lt; $25k</option>
                <option>$25k–$100k</option>
                <option>$100k–$250k</option>
                <option>$250k–$1M</option>
                <option>$1M+</option>
              </select>
            </div>
          </div>
          <div class="inv__field">
            <label for="inv-timeline">Timeline</label>
            <select id="inv-timeline" name="timeline">
              <option value="">Select…</option>
              <option>Actively investing now</option>
              <option>Next 1–3 months</option>
              <option>Exploratory</option>
            </select>
          </div>
          <fieldset class="inv__checks">
            <legend>What would you like?</legend>
            <label><input type="checkbox" name="intent_intro" value="yes"> Just introducing myself</label>
            <label><input type="checkbox" name="intent_deck" value="yes"> Send me the deck / data room</label>
            <label><input type="checkbox" name="intent_call" value="yes"> Book an intro call</label>
          </fieldset>
          <div class="inv__field"><label for="inv-website">Website or LinkedIn</label><input id="inv-website" type="url" name="website"></div>
          <div class="inv__field"><label for="inv-message">Anything else?</label><textarea id="inv-message" name="message"></textarea></div>
          <label class="inv__consent"><input type="checkbox" name="consent" value="yes"> It's okay to follow up with occasional updates.</label>
          <input type="hidden" name="utm_source" value="">
          <input type="hidden" name="utm_campaign" value="">
          <button class="inv__btn inv__btn--primary" type="submit">Request access</button>
          <p class="inv__status" data-form-status hidden role="status" aria-live="polite">Your request is being recorded so the Suede team can follow up directly.</p>
        </form>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <p>Ownership infrastructure for the AI media era.</p>
      <a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a>
    </div>
    <div class="site-footer__legal">
      <p>&copy; 2026 JC Investment Group LLC. All rights reserved.</p>
      <nav aria-label="Legal">
        <a href="/contact/">Talk to Suede</a>
        <a href="/terms/">Terms</a>
        <a href="/privacy/">Privacy</a>
      </nav>
    </div>
  </footer>
  <script>
    (function () {
      var params = new URLSearchParams(window.location.search);
      ["utm_source", "utm_campaign"].forEach(function (key) {
        var value = params.get(key);
        if (!value) return;
        var input = document.querySelector('input[name="' + key + '"]');
        if (input) input.value = value;
      });
    })();
  </script>
</body>
</html>
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 tests/verify_site.py`
Expected: PASS — investor landing page assertions satisfied (title, description, canonical `https://suedeai.org/investors/`, favicons, og/twitter, an `<h1>`, JSON-LD, a `https://suedeai.ai/` link, the form action/endpoint, and "who owns the rails").

- [ ] **Step 5: Commit**

```bash
git add investors/index.html tests/verify_site.py
git commit -m "feat(investors): add /investors landing page"
```

---

### Task 6: Thank-you page `investors/thanks/index.html`

**Files:**
- Create: `investors/thanks/index.html`
- Modify: `tests/verify_site.py` (add to NOINDEX_PAGES + form_expectations)

- [ ] **Step 1: Register the page in `tests/verify_site.py` (failing assertions)**

In `NOINDEX_PAGES` (≈ lines 17-20), add:

```python
    "investors/thanks/index.html",
```

In `form_expectations` (≈ lines 168-195), add:

```python
        "investors/thanks/index.html": [
            "Your request is in.",
        ],
```

- [ ] **Step 2: Run to verify it fails**

Note: `verify_site.py` only checks NOINDEX_PAGES / form_expectations entries `if path.exists()`, so an absent file is skipped rather than failed. The deterministic RED for this task is a file-existence check.

Run: `test -f investors/thanks/index.html && echo EXISTS || echo MISSING`
Expected: `MISSING`.

- [ ] **Step 3: Create `investors/thanks/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico?v=3" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3">
  <link rel="manifest" href="/site.webmanifest">
  <title>Request Received | Suede Labs AI Investors</title>
  <meta name="description" content="Your investor materials request has been received. Book an intro call or view the Suede Labs AI materials.">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="https://suedeai.org/investors/thanks/">
  <meta property="og:title" content="Request Received | Suede Labs AI Investors">
  <meta property="og:description" content="Your investor materials request has been received.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <link rel="stylesheet" href="/assets/css/investors.css">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Request Received","url":"https://suedeai.org/investors/thanks/","description":"Confirmation page for Suede Labs AI investor materials requests."}
  </script>
</head>
<body>
  <main class="site-shell success-hero inv">
    <div class="inv__inner inv__band">
      <p class="inv__eyebrow">Suede Labs AI — Investors</p>
      <h1 class="inv__h1">Thank you. Your request is in.</h1>
      <p class="inv__lede">We've recorded your request and the Suede team will follow up directly. You can book an intro call or open the investor materials now.</p>
      <div class="inv__cta-row">
        <a class="inv__btn inv__btn--primary" href="/api/investor-link/?target=call">Book an intro call</a>
        <a class="inv__btn inv__btn--ghost" href="/api/investor-link/?target=deck">View the materials</a>
      </div>
      <div class="inv__strip">
        <a href="/proof-of-creation/">Proof of creation</a>
        <a href="/programmable-ip/">Programmable IP</a>
        <a href="/book/">Stake Your Claim</a>
        <a href="https://suedeai.ai/" rel="noopener">suedeai.ai</a>
      </div>
    </div>
  </main>
</body>
</html>
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 tests/verify_site.py`
Expected: PASS — the NOINDEX assertion finds the robots meta and form_expectations finds "Your request is in."

- [ ] **Step 5: Commit**

```bash
git add investors/thanks/index.html tests/verify_site.py
git commit -m "feat(investors): add /investors/thanks confirmation page"
```

---

### Task 7: Sitemap entry, `.env.example`, and `api/investors.js` content guard

**Files:**
- Modify: `sitemap.xml`
- Modify: `.env.example`
- Modify: `tests/verify_site.py` (sitemap assertion + api content guard)

- [ ] **Step 1: Add failing assertions to `tests/verify_site.py`**

In the sitemap block (≈ lines 303-308), after the `full-preview` assertion add:

```python
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/investors/</loc>", failures)
```

After the `api/book.js` content block (≈ lines 246-256), add:

```python
    investors_api = ROOT / "api" / "investors.js"
    if investors_api.exists():
        investors_api_text = read_text(investors_api)
        for fragment in [
            "investor_leads",
            "suedeai.org/investors",
            "INVESTOR_NOTIFY_TO",
        ]:
            assert_contains("api/investors.js", investors_api_text, fragment, failures)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 tests/verify_site.py`
Expected: FAIL — `sitemap.xml: missing '<loc>https://suedeai.org/investors/</loc>'`. (The `api/investors.js` guard already passes because that file exists from Task 2.)

- [ ] **Step 3: Add the sitemap entry**

In `sitemap.xml`, add this line after the `<loc>https://suedeai.org/contact/</loc>` entry:

```xml
  <url><loc>https://suedeai.org/investors/</loc></url>
```

- [ ] **Step 4: Append the env vars to `.env.example`**

Append to `.env.example`:

```
SUPABASE_INVESTOR_TABLE=investor_leads
INVESTOR_EMAIL_FROM=info@suedeai.org
INVESTOR_NOTIFY_TO=info@suedeai.org
INVESTOR_AUTORESPONDER=false
INVESTOR_DECK_URL=
INVESTOR_CALENDAR_URL=
```

- [ ] **Step 5: Run to verify it passes**

Run: `python3 tests/verify_site.py`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add sitemap.xml .env.example tests/verify_site.py
git commit -m "feat(investors): list /investors in sitemap + document env vars"
```

---

### Task 8: Full verification + manual E2E

**Files:** none (verification only)

- [ ] **Step 1: Run the full Python site verification**

Run: `python3 tests/verify_site.py`
Expected: `PASS: verified N HTML pages and core assets` (N increased by 1 for the investors page).

- [ ] **Step 2: Run all Node handler tests**

Run: `node --test tests/api_investors.test.js tests/api_investor_link.test.js`
Expected: PASS — 6 tests pass total.

- [ ] **Step 3: Static visual check at key breakpoints**

Run: `python3 -m http.server 8000`
Then open `http://localhost:8000/investors/` and verify at widths 320 / 375 / 768 / 1024 / 1440: no horizontal overflow, hero readable, the four-stage grid collapses to 2-up then 1-up, the ledger table reflows on mobile, form inputs are ≥44px and reachable by keyboard with visible focus rings. Open `http://localhost:8000/investors/thanks/` and confirm the two CTAs render. (Form POST and `/api/investor-link` redirects require `vercel dev`; static server only validates layout.)

- [ ] **Step 4: API E2E with `vercel dev` (requires local env)**

Run:
```bash
# In one shell, with SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (+ optional RESEND_API_KEY, INVESTOR_* ) exported:
vercel dev --listen 3000
```
Then in another shell:
```bash
# Happy path:
curl -i -X POST http://localhost:3000/api/investors/ \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"name":"Pat Investor","email":"pat@fund.com","firm":"Fund Capital","intent_deck":"yes"}'
# Expected: HTTP 200, body {"ok":true,"redirectTo":"/investors/thanks/"}

# Validation:
curl -i -X POST http://localhost:3000/api/investors/ \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"name":"Pat","email":"pat@fund.com"}'
# Expected: HTTP 400, {"error":"Name, email, and firm are required."}

# Redirect helper (env unset → /contact/):
curl -i "http://localhost:3000/api/investor-link/?target=deck"
# Expected: HTTP 302, Location: /contact/  (or INVESTOR_DECK_URL if set)
```
Then confirm a row appears in the Supabase `investor_leads` table and (if RESEND + INVESTOR_* set) the notification email arrives.

- [ ] **Step 5: Final review against the spec**

Confirm: no edits to `index.html`, `api/_shared.js`, `api/contact.js`, `api/book.js`; only new files + additive edits to `supabase/schema.sql`, `sitemap.xml`, `.env.example`, `tests/verify_site.py`. The `source` written by the handler (`suedeai.org/investors`) matches the RLS `with check`. Branch is `feat/investors-funnel`.

---

## Post-implementation (require explicit user approval — do NOT auto-run)

1. **Supabase migration:** apply the `investor_leads` block from `supabase/schema.sql` to the live Supabase project.
2. **Vercel env vars:** set `INVESTOR_EMAIL_FROM`, `INVESTOR_NOTIFY_TO`, and (when available) `INVESTOR_DECK_URL`, `INVESTOR_CALENDAR_URL`, `INVESTOR_AUTORESPONDER=true` on the `suedeai-org` Vercel project (`vercel whoami` must return `suede-ai`).
3. **Deploy preview → verify end-to-end → promote.**
4. **Open PR** for `feat/investors-funnel` → `main`.
5. **Deferred:** add a homepage nav link to `/investors/` only after open SEO PRs #3/#5/#6 merge (they touch `index.html`).

## Spec coverage self-review

- Tiered intent (intro/deck/call) → form checkboxes + `buildIntent` + thanks-page reveal + autoresponder (Tasks 2, 5, 6). ✓
- Single landing page → Task 5. ✓
- Supabase + Resend routing → `api/investors.js` reusing `_shared` (Task 2) + `investor_leads` table (Task 1). ✓
- Host `suedeai.org/investors`, indexable → Task 5 page + sitemap (Task 7). ✓
- RLS source-match gotcha → Task 1 SQL + Task 2 `SOURCE` constant + Step 5 review. ✓
- Env-driven deck/scheduler, no placeholders → `api/investor-link.js` (Task 3) + `.env.example` (Task 7). ✓
- Honeypot, validation → Task 2 tests + handler. ✓
- Design language / a11y / responsive → Task 4 CSS + Task 8 Step 3. ✓
- Conflict-free with open PRs → all-new files; nav link deferred (post-impl §5). ✓
- Testing (verify_site + node tests + manual E2E) → Tasks 4–8. ✓
