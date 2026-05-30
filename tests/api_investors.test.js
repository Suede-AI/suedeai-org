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
