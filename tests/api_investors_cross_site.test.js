const test = require("node:test");
const assert = require("node:assert");

// Supabase and email look configured, so a delivered lead makes two fetches:
// the insert, then the notification. The autoresponder stays off.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";
process.env.INVESTOR_EMAIL_FROM = "Suede <info@suedeai.ai>";
process.env.INVESTOR_NOTIFY_TO = "info@suedeai.ai";
process.env.RESEND_API_KEY = "test-resend-key"; // fetch is stubbed; nothing is sent
// Production-style override that lists only suedeai.org. The investors form on
// suedeai.ai must still not be scored as a foreign origin.
process.env.FORM_ALLOWED_ORIGINS = "https://suedeai.org";

const handler = require("../api/investors.js");
const contactHandler = require("../api/contact.js");
const { assessSubmission, DEFAULT_ALLOWED_ORIGINS } = require("../api/_spam-gate.js");

const AI = "https://suedeai.ai";
const WWW_AI = "https://www.suedeai.ai";
const EVIL = "https://evil.example";

const lead = {
  name: "Pat Investor",
  email: "pat@fund.com",
  firm: "Fund Capital",
  check_size: "$25k-$100k",
  message: "Saw the post on X and would like the deck.",
  intent_deck: "yes",
  utm_source: "x",
  utm_campaign: "investors-sept",
  form_ts: (Date.now() - 30_000).toString(36),
};

function makeReq({ method = "POST", origin, body, headers = {} } = {}) {
  const h = { accept: "application/json", ...headers };
  if (origin) h.origin = origin;
  return { method, headers: h, body };
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(payload) { this.body = payload || ""; },
  };
}

// `responses` is consumed in order; the last one repeats.
function stubFetch(responses = [{ ok: true, status: 200 }]) {
  const calls = [];
  global.fetch = async (url, opts) => {
    const r = responses[Math.min(calls.length, responses.length - 1)];
    calls.push({ url, opts, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: r.ok, status: r.status, text: async () => r.text || "" };
  };
  return calls;
}

function quiet(fn) {
  const original = console.warn;
  console.warn = () => {};
  return Promise.resolve(fn()).finally(() => { console.warn = original; });
}

const inserts = (calls) => calls.filter((c) => /\/rest\/v1\//.test(c.url));
const emails = (calls) => calls.filter((c) => /api\.resend\.com/.test(c.url));

// ---- preflight ----

for (const origin of [AI, WWW_AI]) {
  test(`preflight from ${origin} is 204 with the CORS headers echoed`, async () => {
    const calls = stubFetch();
    const res = makeRes();
    await handler(makeReq({ method: "OPTIONS", origin, headers: { "access-control-request-method": "POST" } }), res);
    assert.strictEqual(res.statusCode, 204);
    assert.strictEqual(res.headers["access-control-allow-origin"], origin);
    assert.strictEqual(res.headers["access-control-allow-methods"], "POST, OPTIONS");
    assert.strictEqual(res.headers["access-control-allow-headers"], "Content-Type, Accept");
    assert.ok(Number(res.headers["access-control-max-age"]) > 0);
    assert.strictEqual(res.headers.vary, "Origin");
    assert.strictEqual(res.body, "");
    assert.strictEqual(calls.length, 0, "a preflight never touches Supabase or email");
  });
}

test("preflight from a disallowed origin gets no allow-origin header", async () => {
  const res = makeRes();
  await handler(makeReq({ method: "OPTIONS", origin: EVIL }), res);
  assert.strictEqual(res.statusCode, 204);
  assert.strictEqual(res.headers["access-control-allow-origin"], undefined);
  assert.strictEqual(res.headers["access-control-allow-methods"], undefined);
  assert.strictEqual(res.headers.vary, "Origin");
});

test("origins are matched exactly, not by prefix or suffix", async () => {
  for (const origin of ["https://suedeai.ai.evil.example", "http://suedeai.ai", "https://evilsuedeai.ai", "https://suedeai.ai/"]) {
    const res = makeRes();
    await handler(makeReq({ method: "OPTIONS", origin }), res);
    assert.strictEqual(res.headers["access-control-allow-origin"], undefined, origin);
  }
});

// ---- POST ----

test("POST from suedeai.ai is delivered clean, stored with its source, and readable cross-origin", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq({ origin: AI, body: { ...lead, source: "suedeai.ai/investors" } }), res);
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.strictEqual(res.headers["access-control-allow-origin"], AI);
  assert.strictEqual(res.headers.vary, "Origin");
  assert.deepStrictEqual(JSON.parse(res.body), { ok: true, redirectTo: "/investors/thanks/" });

  const [insert] = inserts(calls);
  assert.strictEqual(insert.body.source, "suedeai.ai/investors");

  const [email] = emails(calls);
  assert.strictEqual(email.body.subject, "New investor lead: Fund Capital [$25k-$100k]");
  const lines = email.body.text.split("\n");
  const sourceAt = lines.indexOf("Source: suedeai.ai/investors");
  assert.ok(sourceAt >= 0, email.body.text);
  assert.strictEqual(lines[sourceAt + 1], "UTM: x / investors-sept", "Source sits right before UTM");
});

test("POST from suedeai.ai is not origin-scored even with FORM_ALLOWED_ORIGINS set to suedeai.org only", async () => {
  // No form_ts: no-js alone is 2 (deliver). If the origin were also scored it
  // would be 4 and arrive with a [review] prefix.
  const { form_ts, ...unstamped } = lead;
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq({ origin: AI, body: { ...unstamped, source: "suedeai.ai/investors" } }), res);
  assert.strictEqual(res.statusCode, 200);
  const [email] = emails(calls);
  assert.ok(!email.body.subject.startsWith("[review]"), email.body.subject);
  assert.ok(!email.body.text.includes("Spam signals"), email.body.text);

  // The same request from an origin that is not on either list is reviewed.
  const calls2 = stubFetch();
  await handler(makeReq({ origin: EVIL, body: unstamped }), makeRes());
  assert.ok(emails(calls2)[0].body.subject.startsWith("[review] New investor lead: "));
  assert.match(emails(calls2)[0].body.text, /Spam signals \(4\): no-js, origin/);
});

test("POST from a disallowed origin is processed but carries no allow-origin header", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq({ origin: EVIL, body: lead }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers["access-control-allow-origin"], undefined);
  assert.strictEqual(inserts(calls).length, 1);
});

test("the 400, drop, 405 and insert-error answers all carry the allow-origin header", async () => {
  stubFetch();
  const bad = makeRes();
  await handler(makeReq({ origin: AI, body: { name: "Pat", email: "pat@fund.com" } }), bad);
  assert.strictEqual(bad.statusCode, 400);
  assert.strictEqual(bad.headers["access-control-allow-origin"], AI);

  const calls = stubFetch();
  const dropped = makeRes();
  await quiet(() => handler(makeReq({ origin: AI, body: { ...lead, company_url: "filled" } }), dropped));
  assert.strictEqual(dropped.statusCode, 200);
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(dropped.headers["access-control-allow-origin"], AI);

  const wrongMethod = makeRes();
  await handler(makeReq({ method: "GET", origin: WWW_AI }), wrongMethod);
  assert.strictEqual(wrongMethod.statusCode, 405);
  assert.strictEqual(wrongMethod.headers["access-control-allow-origin"], WWW_AI);

  stubFetch([{ ok: false, status: 500, text: "boom" }]);
  const failed = makeRes();
  await handler(makeReq({ origin: AI, body: lead }), failed);
  assert.strictEqual(failed.statusCode, 500);
  assert.strictEqual(failed.headers["access-control-allow-origin"], AI);
});

// ---- source allowlist ----

for (const [sent, stored] of [
  ["suedeai.ai/investors", "suedeai.ai/investors"],
  ["suedeai.org/investors", "suedeai.org/investors"],
  ["SUEDEAI.AI/investors", "suedeai.ai/investors"],
  ["evil.example/investors", "suedeai.org/investors"],
  ["", "suedeai.org/investors"],
  [undefined, "suedeai.org/investors"],
]) {
  test(`source ${JSON.stringify(sent)} is stored as ${stored}`, async () => {
    const calls = stubFetch();
    const body = { ...lead };
    if (sent !== undefined) body.source = sent;
    await handler(makeReq({ origin: AI, body }), makeRes());
    assert.strictEqual(inserts(calls)[0].body.source, stored);
    assert.ok(emails(calls)[0].body.text.includes(`\nSource: ${stored}\n`));
  });
}

test("a form-encoded POST from suedeai.ai is parsed the same way", async () => {
  const calls = stubFetch();
  const res = makeRes();
  const body = new URLSearchParams({ ...lead, source: "suedeai.ai/investors" }).toString();
  await handler(
    makeReq({ origin: AI, body, headers: { "content-type": "application/x-www-form-urlencoded" } }),
    res
  );
  assert.strictEqual(res.statusCode, 200, res.body);
  assert.strictEqual(inserts(calls)[0].body.source, "suedeai.ai/investors");
});

test("if the insert policy still rejects the .ai source, the lead is stored under the default", async () => {
  const calls = stubFetch([
    { ok: false, status: 401, text: '{"code":"42501","message":"new row violates row-level security policy"}' },
    { ok: true, status: 201 },
  ]);
  const res = makeRes();
  await quiet(() => handler(makeReq({ origin: AI, body: { ...lead, source: "suedeai.ai/investors" } }), res));
  assert.strictEqual(res.statusCode, 200, res.body);
  const tries = inserts(calls);
  assert.strictEqual(tries.length, 2);
  assert.strictEqual(tries[0].body.source, "suedeai.ai/investors");
  assert.strictEqual(tries[1].body.source, "suedeai.org/investors");
  assert.ok(
    emails(calls)[0].body.text.includes("Source: suedeai.ai/investors (stored as suedeai.org/investors)")
  );
});

test("a policy rejection of the default source is not retried", async () => {
  const calls = stubFetch([{ ok: false, status: 401, text: "rls" }]);
  const res = makeRes();
  await handler(makeReq({ origin: AI, body: lead }), res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(inserts(calls).length, 1);
  assert.strictEqual(emails(calls).length, 0);
});

// ---- spam gate ----

test("the gate's default origins include both suedeai.ai hosts", () => {
  assert.ok(DEFAULT_ALLOWED_ORIGINS.includes(AI));
  assert.ok(DEFAULT_ALLOWED_ORIGINS.includes(WWW_AI));
});

test("extraOrigins are accepted on top of a FORM_ALLOWED_ORIGINS override", () => {
  const fields = { name: "Pat Rivera", email: "pat@example.com", form_ts: (Date.now() - 30_000).toString(36) };
  assert.deepStrictEqual(assessSubmission({ form: "x", fields, headers: { origin: AI } }).reasons, ["origin"]);
  assert.deepStrictEqual(
    assessSubmission({ form: "x", fields, headers: { origin: AI }, extraOrigins: [AI] }).reasons,
    []
  );
  assert.deepStrictEqual(
    assessSubmission({ form: "x", fields, headers: { origin: "https://suedeai.org" }, extraOrigins: [AI] }).reasons,
    []
  );
});

// ---- other endpoints ----

test("other endpoints keep rejecting OPTIONS and never send CORS headers", async () => {
  const pre = makeRes();
  await contactHandler(makeReq({ method: "OPTIONS", origin: AI }), pre);
  assert.strictEqual(pre.statusCode, 405);
  assert.strictEqual(pre.headers["access-control-allow-origin"], undefined);

  stubFetch();
  const post = makeRes();
  await contactHandler(
    makeReq({
      origin: AI,
      body: { name: "Pat Rivera", email: "pat@example.com", message: "Hello there, a question about licensing." },
    }),
    post
  );
  assert.strictEqual(post.headers["access-control-allow-origin"], undefined);
  assert.strictEqual(post.headers.vary, undefined);
});
