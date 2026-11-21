const test = require("node:test");
const assert = require("node:assert");

// A lead is kept when either the Supabase row or the team notification email
// lands. These tests drive each handler with one or both of those failing.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";

const handlers = {
  contact: { path: "../api/contact.js", env: { CONTACT_NOTIFY_TO: "team@example.com", CONTACT_EMAIL_FROM: "site@example.com" }, body: { name: "Pat Lee", email: "pat@example.com", message: "Do you work with podcasters?" } },
  "book-call": { path: "../api/book-call.js", env: { CONTACT_NOTIFY_TO: "team@example.com", CONTACT_EMAIL_FROM: "site@example.com" }, body: { name: "Pat Lee", email: "pat@example.com", message: "Talk about the book" } },
  investors: { path: "../api/investors.js", env: { INVESTOR_NOTIFY_TO: "team@example.com", INVESTOR_EMAIL_FROM: "site@example.com" }, body: { name: "Pat Lee", email: "pat@example.com", firm: "Acme Ventures" } },
};

const EMAIL_ENV = ["CONTACT_NOTIFY_TO", "CONTACT_EMAIL_FROM", "INVESTOR_NOTIFY_TO", "INVESTOR_EMAIL_FROM", "BOOK_EMAIL_FROM", "RESEND_API_KEY"];

function setEnv(env) {
  for (const key of EMAIL_ENV) delete process.env[key];
  Object.assign(process.env, { RESEND_API_KEY: "re_test" }, env);
}

function makeReq(body) {
  return {
    method: "POST",
    headers: { accept: "application/json", origin: "https://suedeai.org" },
    body: { form_ts: (Date.now() - 30_000).toString(36), ...body },
  };
}

function makeRes() {
  return { statusCode: 0, headers: {}, body: "", setHeader(k, v) { this.headers[k] = v; }, end(p) { this.body = p || ""; } };
}

// supabase / resend: "ok", "fail" (HTTP error) or "throw" (network error).
function stubFetch({ supabase, resend }) {
  const calls = [];
  global.fetch = async (url, opts) => {
    const kind = String(url).includes("supabase") ? supabase : resend;
    calls.push({ url: String(url), body: opts && opts.body });
    if (kind === "throw") throw new TypeError("fetch failed");
    if (kind === "fail") return { ok: false, status: 500, text: async () => "relation does not exist" };
    return { ok: true, status: 200, text: async () => "" };
  };
  return calls;
}

async function run(name, outcome) {
  const { path, env, body } = handlers[name];
  setEnv(env);
  const calls = stubFetch(outcome);
  const handler = require(path);
  const res = makeRes();
  const errors = console.error;
  console.error = () => {};
  try {
    await handler(makeReq(body), res);
  } finally {
    console.error = errors;
  }
  return { res, calls };
}

for (const name of Object.keys(handlers)) {
  test(`${name}: a failed insert still succeeds when the team email lands`, async () => {
    const { res, calls } = await run(name, { supabase: "fail", resend: "ok" });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(JSON.parse(res.body).ok, true);
    assert.ok(calls.some((c) => c.url.includes("resend")), "the notification carries the lead");
  });

  test(`${name}: an unreachable database still succeeds when the team email lands`, async () => {
    const { res } = await run(name, { supabase: "throw", resend: "ok" });
    assert.strictEqual(res.statusCode, 200);
  });

  test(`${name}: losing both copies answers 503 without database details`, async () => {
    const { res, calls } = await run(name, { supabase: "fail", resend: "fail" });
    assert.strictEqual(res.statusCode, 503);
    const payload = JSON.parse(res.body);
    assert.ok(payload.error);
    assert.strictEqual(payload.details, undefined, "database text never reaches the visitor");
    assert.doesNotMatch(res.body, /supabase|relation/i);
    assert.strictEqual(calls.filter((c) => c.url.includes("resend")).length, 1, "no autoresponder after a lost lead");
  });

  test(`${name}: a stored row succeeds even when the email fails`, async () => {
    const { res } = await run(name, { supabase: "ok", resend: "throw" });
    assert.strictEqual(res.statusCode, 200);
  });
}

test("book: a failed insert still sends the preview and reaches the thanks page", async () => {
  setEnv({ CONTACT_EMAIL_FROM: "site@example.com" });
  const calls = stubFetch({ supabase: "fail", resend: "ok" });
  const handler = require("../api/book.js");
  const res = makeRes();
  const errors = console.error;
  console.error = () => {};
  try {
    await handler(makeReq({ email: "pat@example.com" }), res);
  } finally {
    console.error = errors;
  }
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).redirectTo, "/book/thanks/");
  assert.ok(calls.some((c) => c.url.includes("resend")));
});

test("site.js keeps the visitor on the form after a server error instead of resubmitting", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../assets/js/site.js"), "utf8");
  const afterResponse = source.slice(source.indexOf("const result = await response.json()"));
  assert.doesNotMatch(afterResponse, /submitNatively\(\)/, "a server answer must not trigger a native resubmit");
  assert.match(afterResponse, /data-fallback-email/);
});
