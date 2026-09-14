const test = require("node:test");
const assert = require("node:assert");

// Supabase must look configured so insertRow proceeds.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";
// Leave CONTACT_NOTIFY_TO / CONTACT_EMAIL_FROM unset so no email fetch fires.

const handler = require("../api/contact.js");

// A submission from the page carries the load stamp site.js adds and the
// Origin header every browser sends on POST. Without them the spam gate
// scores the request as a direct POST.
function fromPage(body) {
  return { form_ts: (Date.now() - 30_000).toString(36), ...body };
}

function makeReq(body, headers = {}) {
  return {
    method: "POST",
    headers: { accept: "application/json", origin: "https://suedeai.org", ...headers },
    body,
  };
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

test("400 when message is missing", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq({ name: "Pat", email: "pat@example.com" }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(calls.length, 0, "should not insert when invalid");
});

test("honeypot fill returns success without inserting", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(
    makeReq({
      name: "Bot",
      email: "bot@spam.com",
      message: "hello",
      company_url: "filled",
    }),
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.length, 0, "honeypot should skip insert");
  const result = JSON.parse(res.body);
  assert.strictEqual(result.redirectTo, "/contact/thanks/");
});

test("valid message inserts into contact_inquiries", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(
    makeReq(
      fromPage({
        name: "Pat",
        email: "pat@example.com",
        topic: "General",
        message: "Hello there",
      })
    ),
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.length, 1, "exactly one insert call");
  assert.match(calls[0].url, /\/rest\/v1\/contact_inquiries$/);
  const result = JSON.parse(res.body);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.redirectTo, "/contact/thanks/");
});

test("a spam-kit template without the page stamp gets the success answer and no insert", async () => {
  const calls = stubFetch();
  const res = makeRes();
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    await handler(
      makeReq(
        {
          name: "Thomas Davis",
          email: "feroz0520@gmail.com",
          message: "Hi there! I'd like to hear more about email updates. Please let me know when I am subscribed.",
        },
        { origin: "" }
      ),
      res
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.length, 0, "dropped submissions never reach Supabase");
  assert.deepStrictEqual(JSON.parse(res.body), { ok: true, redirectTo: "/contact/thanks/" });
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(warnings[0][0], "[spam-gate] dropped");
  assert.ok(warnings[0][1].reasons.includes("template"));
});

test("a person with scripts off is still delivered", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(
    makeReq({
      name: "Pat",
      email: "pat@example.com",
      message: "Do you work with independent podcasters?",
    }),
    res
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.length, 1, "no-js alone must not block a person");
});
