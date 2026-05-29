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
