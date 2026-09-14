const test = require("node:test");
const assert = require("node:assert");

// Supabase must look configured so insertRow proceeds. No email env is set, so
// the only fetch a handler can make is the Supabase insert.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";

const handlers = {
  "book-call": { handler: require("../api/book-call.js"), table: "call_requests", redirectTo: "/book-a-call/thanks/" },
  book: { handler: require("../api/book.js"), table: "book_leads", redirectTo: "/book/thanks/" },
  investors: { handler: require("../api/investors.js"), table: "investor_leads", redirectTo: "/investors/thanks/" },
};

const soup = {
  name: "ZwkbyIpqcWOdJFetxjbMzHG",
  email: "martin_adams@comcast.net",
  firm: "qHgHlUTfgXWGSigOEeCdlzVN",
  topic: "qHgHlUTfgXWGSigOEeCdlzVN",
  message: "MoqtvgLooxOrAQXRm kBXmYylxNZwJKsIoTN",
  context: "MoqtvgLooxOrAQXRm kBXmYylxNZwJKsIoTN",
};

const person = {
  name: "Pat Rivera",
  email: "pat@example.com",
  firm: "Rivera Capital",
  topic: "Partnerships",
  message: "We run a small label and want to talk about proof of creation.",
  context: "Read the sharp excerpt, want the rest.",
  form_ts: (Date.now() - 30_000).toString(36),
};

function makeReq(body, headers = {}) {
  return { method: "POST", headers: { accept: "application/json", ...headers }, body };
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

function silenceWarn(fn) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  return fn().finally(() => { console.warn = original; }).then(() => warnings);
}

for (const [name, { handler, table, redirectTo }] of Object.entries(handlers)) {
  test(`${name}: letter soup from a direct POST is answered with success and never stored`, async () => {
    const calls = stubFetch();
    const res = makeRes();
    const warnings = await silenceWarn(() => handler(makeReq(soup), res));
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), { ok: true, redirectTo });
    assert.strictEqual(calls.length, 0, "no Supabase insert for a dropped submission");
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0][1].form, name);
  });

  test(`${name}: a page visit still inserts into ${table}`, async () => {
    const calls = stubFetch();
    const res = makeRes();
    await handler(makeReq(person, { origin: "https://suedeai.org" }), res);
    assert.strictEqual(res.statusCode, 200, res.body);
    assert.strictEqual(calls.length, 1, "exactly one insert call");
    assert.match(calls[0].url, new RegExp(`/rest/v1/${table}$`));
  });
}

test("the honeypot still short-circuits and is logged as such", async () => {
  const calls = stubFetch();
  const res = makeRes();
  const warnings = await silenceWarn(() =>
    handlers.book.handler(makeReq({ ...person, company_url: "filled" }, { origin: "https://suedeai.org" }), res)
  );
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(warnings[0][1].reasons[0], "honeypot");
});
