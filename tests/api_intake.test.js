const test = require("node:test");
const assert = require("node:assert");
const { createHmac } = require("node:crypto");

const {
  DEFAULT_INTAKE_URL,
  LIMITS,
  attributionFrom,
  buildIntakeEvent,
  forwardToIntake,
  newEventId,
  settleCapture,
  signIntakeBody,
  spamDetails,
  spamFlag,
} = require("../api/_intake.js");

const SECRET = "x".repeat(48);
const ENV = { SUEDE_INTAKE_SOURCE: "suedeai-org", SUEDE_INTAKE_SECRET: SECRET };
// The hub's id rule (src/lib/intake/contract.ts in suede-agent-studio).
const HUB_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{7,127}$/;

const EVENT = Object.freeze({
  id: "contact:6f1c2c3e-9a8b-4c1d-8e2f-0a1b2c3d4e5f",
  kind: "lead",
  property: "suedeai.org",
  occurredAt: "2026-10-23T09:14:00.000Z",
  summary: "Contact from Pat Rivera: Partnerships",
  person: { email: "pat@example.com", name: "Pat Rivera" },
});

// Each entry is a status, { status, json } or an Error to throw. The last
// entry repeats.
function hub(responses) {
  const calls = [];
  const fetcher = async (url, init) => {
    const next = responses[Math.min(calls.length, responses.length - 1)];
    calls.push({ url, init });
    if (next instanceof Error) {
      throw next;
    }
    const { status, json } = typeof next === "number" ? { status: next, json: undefined } : next;
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => {
        if (json === undefined) {
          throw new SyntaxError("Unexpected end of JSON input");
        }
        return json;
      },
    };
  };
  return { calls, fetcher };
}

function recordSleeps() {
  const delays = [];
  const sleep = async (ms) => {
    delays.push(ms);
  };
  return { delays, sleep };
}

async function captureErrors(fn) {
  const original = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    const result = await fn();
    return { result, errors };
  } finally {
    console.error = original;
  }
}

function timeoutError() {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

// ---- signing ----

test("signs v1=HMAC-SHA256(secret, `${timestamp}.${body}`) and sends the contract headers", async () => {
  const { calls, fetcher } = hub([{ status: 202, json: { accepted: true, duplicate: false } }]);
  const before = Math.floor(Date.now() / 1000);
  const result = await forwardToIntake(EVENT, ENV, fetcher);
  const after = Math.floor(Date.now() / 1000);

  assert.deepStrictEqual(result, { ok: true, duplicate: false });
  assert.strictEqual(calls.length, 1);
  const { url, init } = calls[0];
  assert.strictEqual(url, DEFAULT_INTAKE_URL);
  assert.strictEqual(url, "https://agents.suedeai.ai/api/intake/events");
  assert.strictEqual(init.method, "POST");
  assert.strictEqual(init.body, JSON.stringify(EVENT));
  assert.strictEqual(init.headers["content-type"], "application/json");
  assert.strictEqual(init.headers["x-suede-intake-source"], "suedeai-org");

  const timestamp = init.headers["x-suede-intake-timestamp"];
  assert.match(timestamp, /^\d{10}$/);
  assert.ok(Number(timestamp) >= before && Number(timestamp) <= after);

  const expected = `v1=${createHmac("sha256", SECRET).update(`${timestamp}.${init.body}`, "utf8").digest("hex")}`;
  assert.strictEqual(init.headers["x-suede-intake-signature"], expected);
  assert.strictEqual(signIntakeBody(SECRET, timestamp, init.body), expected);
  assert.ok(init.signal instanceof AbortSignal, "each attempt has a timeout signal");
});

test("a signature made with another secret does not match", () => {
  const body = JSON.stringify(EVENT);
  assert.notStrictEqual(signIntakeBody(SECRET, "1792000000", body), signIntakeBody("y".repeat(48), "1792000000", body));
  assert.notStrictEqual(signIntakeBody(SECRET, "1792000000", body), signIntakeBody(SECRET, "1792000001", body));
});

test("SUEDE_INTAKE_URL overrides the default endpoint", async () => {
  const { calls, fetcher } = hub([202]);
  await forwardToIntake(EVENT, { ...ENV, SUEDE_INTAKE_URL: " https://intake.test/api/intake/events " }, fetcher);
  assert.strictEqual(calls[0].url, "https://intake.test/api/intake/events");
});

// ---- 202 ----

test("202 duplicate:true is reported as a duplicate and not retried", async () => {
  const { calls, fetcher } = hub([{ status: 202, json: { accepted: true, duplicate: true } }]);
  const result = await forwardToIntake(EVENT, ENV, fetcher);
  assert.deepStrictEqual(result, { ok: true, duplicate: true });
  assert.strictEqual(calls.length, 1);
});

test("202 with an unreadable body still counts as stored", async () => {
  const { calls, fetcher } = hub([202]);
  const result = await forwardToIntake(EVENT, ENV, fetcher);
  assert.deepStrictEqual(result, { ok: true, duplicate: false });
  assert.strictEqual(calls.length, 1);
});

// ---- retries ----

test("a 5xx is retried after 400 ms, with the same body and id", async () => {
  const { calls, fetcher } = hub([503, { status: 202, json: { accepted: true, duplicate: false } }]);
  const { delays, sleep } = recordSleeps();
  const result = await forwardToIntake(EVENT, ENV, fetcher, sleep);
  assert.deepStrictEqual(result, { ok: true, duplicate: false });
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(delays, [400]);
  assert.strictEqual(calls[1].init.body, calls[0].init.body);
  assert.strictEqual(JSON.parse(calls[1].init.body).id, EVENT.id);
});

test("429 is retried", async () => {
  const { calls, fetcher } = hub([429, 202]);
  const { sleep } = recordSleeps();
  const result = await forwardToIntake(EVENT, ENV, fetcher, sleep);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(calls.length, 2);
});

test("network errors and timeouts are retried at 400 ms then 1,200 ms, each attempt freshly signed", async () => {
  const { calls, fetcher } = hub([new TypeError("fetch failed"), timeoutError(), 202]);
  const { delays, sleep } = recordSleeps();
  const result = await forwardToIntake(EVENT, ENV, fetcher, sleep);
  assert.deepStrictEqual(result, { ok: true, duplicate: false });
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(delays, [400, 1200]);
  for (const { init } of calls) {
    const timestamp = init.headers["x-suede-intake-timestamp"];
    assert.strictEqual(init.headers["x-suede-intake-signature"], signIntakeBody(SECRET, timestamp, init.body));
  }
});

test("gives up as unreachable after three attempts and logs it", async () => {
  const { calls, fetcher } = hub([500, 502, 503]);
  const { delays, sleep } = recordSleeps();
  const { result, errors } = await captureErrors(() => forwardToIntake(EVENT, ENV, fetcher, sleep));
  assert.deepStrictEqual(result, { ok: false, reason: "unreachable" });
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(delays, [400, 1200]);
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0][0], "[intake] unreachable after retries");
  assert.strictEqual(errors[0][1].id, EVENT.id);
});

test("the default sleep really waits between attempts", async () => {
  const { calls, fetcher } = hub([503, 202]);
  const started = Date.now();
  const result = await forwardToIntake(EVENT, ENV, fetcher);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(calls.length, 2);
  assert.ok(Date.now() - started >= 350, "waited about 400 ms before the retry");
});

// ---- no retry ----

for (const status of [400, 401, 413]) {
  test(`${status} is logged as rejected and never retried`, async () => {
    const { calls, fetcher } = hub([status, 202]);
    const { delays, sleep } = recordSleeps();
    const { result, errors } = await captureErrors(() => forwardToIntake(EVENT, ENV, fetcher, sleep));
    assert.deepStrictEqual(result, { ok: false, reason: "rejected" });
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(delays, []);
    assert.strictEqual(errors[0][0], "[intake] rejected");
    assert.deepStrictEqual(errors[0][1], { id: EVENT.id, status });
  });
}

// ---- not configured ----

for (const [label, env] of [
  ["no source", { SUEDE_INTAKE_SECRET: SECRET }],
  ["a blank source", { SUEDE_INTAKE_SOURCE: "  ", SUEDE_INTAKE_SECRET: SECRET }],
  ["no secret", { SUEDE_INTAKE_SOURCE: "suedeai-org" }],
  ["a secret under 32 bytes", { SUEDE_INTAKE_SOURCE: "suedeai-org", SUEDE_INTAKE_SECRET: "x".repeat(31) }],
  ["nothing set", {}],
]) {
  test(`${label}: not-configured, nothing sent, logged`, async () => {
    const { calls, fetcher } = hub([202]);
    const { result, errors } = await captureErrors(() => forwardToIntake(EVENT, env, fetcher));
    assert.deepStrictEqual(result, { ok: false, reason: "not-configured" });
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0][0], /not configured/);
    assert.ok(!JSON.stringify(errors).includes(SECRET.slice(0, 31)), "the secret is never logged");
  });
}

test("a 32-byte secret is enough", async () => {
  const { calls, fetcher } = hub([202]);
  const result = await forwardToIntake(EVENT, { ...ENV, SUEDE_INTAKE_SECRET: "z".repeat(32) }, fetcher);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(calls.length, 1);
});

// ---- event shaping ----

test("newEventId is a prefixed uuid the hub accepts, new per call", () => {
  const a = newEventId("contact");
  const b = newEventId("contact");
  assert.match(a, /^contact:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(a, HUB_ID);
  assert.match(newEventId("book-call"), HUB_ID);
  assert.notStrictEqual(a, b);
});

test("buildIntakeEvent keeps only contract fields and drops empty values", () => {
  const event = buildIntakeEvent({
    id: "contact:abc12345",
    kind: "lead",
    property: "SuedeAI.org",
    occurredAt: "2026-10-23T09:14:00.000Z",
    summary: "  Contact   from\nPat  ",
    email: " Pat@Example.com ",
    name: "  Pat   Rivera ",
    details: { topic: "", message: "Hello", stored_in_supabase: true, score: 3, nothing: null, gone: undefined, nan: NaN },
    attribution: { utm_source: "x" },
  });
  assert.deepStrictEqual(event, {
    id: "contact:abc12345",
    kind: "lead",
    property: "suedeai.org",
    occurredAt: "2026-10-23T09:14:00.000Z",
    summary: "Contact from Pat",
    person: { email: "pat@example.com", name: "Pat Rivera" },
    details: { message: "Hello", stored_in_supabase: true, score: 3, nothing: null },
    attribution: { utm_source: "x" },
  });
});

test("buildIntakeEvent trims every field to the hub's limits", () => {
  const details = { message: "m".repeat(5000), "bad key!": "dropped" };
  for (let i = 0; i < 60; i += 1) {
    details[`k${i}`] = "v";
  }
  const event = buildIntakeEvent({
    id: "book:abc12345",
    kind: "lead",
    property: "suedeai.org",
    occurredAt: "2026-10-23T09:14:00.000Z",
    summary: "s".repeat(500),
    email: "pat@example.com",
    name: "n".repeat(300),
    details,
    suspectedSpam: { reason: "r".repeat(400) },
  });
  assert.strictEqual(event.summary.length, LIMITS.summary);
  assert.strictEqual(event.person.name.length, LIMITS.name);
  assert.strictEqual(event.details.message.length, LIMITS.detailValue);
  assert.strictEqual(Object.keys(event.details).length, LIMITS.detailKeys);
  assert.ok(!("bad key!" in event.details));
  assert.strictEqual(event.suspectedSpam.reason.length, LIMITS.spamReason);
});

test("an email the hub would refuse moves to details.email_raw", () => {
  for (const email of ["pat@localhost", "pat..x@example.com", "not an email", "pat@example.c"]) {
    const event = buildIntakeEvent({
      id: "contact:abc12345",
      kind: "lead",
      property: "suedeai.org",
      occurredAt: "2026-10-23T09:14:00.000Z",
      summary: "Contact",
      email,
      name: "Pat",
    });
    assert.deepStrictEqual(event.person, { name: "Pat" }, email);
    assert.strictEqual(event.details.email_raw, email);
  }
});

test("an empty summary falls back to one naming the kind and host", () => {
  const event = buildIntakeEvent({
    id: "book:abc12345",
    kind: "lead",
    property: "suedeai.org",
    occurredAt: "2026-10-23T09:14:00.000Z",
    summary: "   ",
  });
  assert.strictEqual(event.summary, "New lead on suedeai.org");
  assert.strictEqual(event.person, undefined);
  assert.strictEqual(event.details, undefined);
});

test("attributionFrom picks UTM fields only", () => {
  assert.deepStrictEqual(attributionFrom({ utm_source: " x ", utm_campaign: "investors-sept", email: "a@b.co" }), {
    utm_source: "x",
    utm_campaign: "investors-sept",
  });
  assert.strictEqual(attributionFrom({ name: "Pat" }), undefined);
  assert.strictEqual(attributionFrom({}), undefined);
});

// ---- spam flags ----

test("spamFlag names the honeypot or the gate score", () => {
  const gate = { score: 7, reasons: ["no-js", "origin", "gibberish-name"], verdict: "drop" };
  assert.deepStrictEqual(spamFlag(true, gate), { reason: "honeypot" });
  assert.deepStrictEqual(spamFlag(false, gate), { reason: "spam-gate:7" });
});

test("spamDetails is empty for a clean submission and lists signals otherwise", () => {
  assert.deepStrictEqual(spamDetails(false, { score: 2, reasons: ["no-js"], verdict: "deliver" }), {});
  assert.deepStrictEqual(spamDetails(false, { score: 4, reasons: ["no-js", "origin"], verdict: "review" }), {
    spam_verdict: "review",
    spam_score: 4,
    spam_reasons: "no-js, origin",
  });
  assert.deepStrictEqual(spamDetails(true, { score: 0, reasons: [], verdict: "deliver" }), {
    spam_verdict: "honeypot",
    spam_score: 0,
    spam_reasons: "none",
  });
});

// ---- capture outcome ----

test("settleCapture: either copy is enough, both failing is logged as lost", async () => {
  const ok = { ok: true, duplicate: false };
  const down = { ok: false, reason: "unreachable" };

  let outcome = await captureErrors(() => settleCapture("contact", "contact:abc12345", { ok: true }, down));
  assert.strictEqual(outcome.result, true);
  assert.strictEqual(outcome.errors.length, 0);

  outcome = await captureErrors(() => settleCapture("contact", "contact:abc12345", { ok: false, status: 500 }, ok));
  assert.strictEqual(outcome.result, true);
  assert.match(outcome.errors[0][0], /^\[contact\] Supabase insert failed; the intake hub holds the submission/);

  outcome = await captureErrors(() => settleCapture("contact", "contact:abc12345", { ok: false, status: 500 }, down));
  assert.strictEqual(outcome.result, false);
  assert.match(outcome.errors[0][0], /^\[contact\] submission lost/);
  assert.deepStrictEqual(outcome.errors[0][1], { id: "contact:abc12345", status: 500, intake: "unreachable" });
});

// ---- body size ----

const { MAX_BODY_BYTES, fitBody } = require("../api/_intake.js");

function quietWarn(fn) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = original;
  }
}

function bigEvent(fill) {
  const details = { form: "investors", topic: "Seed round", stored_in_supabase: true };
  for (let i = 0; i < 9; i += 1) {
    details[`field_${i}`] = fill;
  }
  return buildIntakeEvent({
    id: "investors:abc12345",
    kind: "lead",
    property: "suedeai.org",
    occurredAt: "2026-10-23T09:14:00.000Z",
    summary: "Investor inquiry",
    email: "pat@fund.com",
    name: "Pat",
    details,
  });
}

test("the hub's body limit is 32 KB", () => {
  assert.strictEqual(MAX_BODY_BYTES, 32768);
});

test("an event under the limit is sent byte for byte", () => {
  const { result, warnings } = quietWarn(() => fitBody(EVENT));
  assert.strictEqual(result, JSON.stringify(EVENT));
  assert.strictEqual(warnings.length, 0);
});

test("nine 2,000-char multibyte fields are trimmed, longest first, to fit 32 KB", () => {
  const event = bigEvent("漢字".repeat(1000));
  assert.ok(Buffer.byteLength(JSON.stringify(event), "utf8") > 50_000, "the fixture really is over the limit");

  const { result, warnings } = quietWarn(() => fitBody(event));
  const bytes = Buffer.byteLength(result, "utf8");
  assert.ok(bytes <= MAX_BODY_BYTES, `${bytes} bytes`);
  assert.ok(bytes > MAX_BODY_BYTES - 64, "trims only what it has to");

  const sent = JSON.parse(result);
  assert.strictEqual(sent.details.topic, "Seed round", "short fields come through whole");
  assert.strictEqual(sent.details.form, "investors");
  assert.strictEqual(sent.details.stored_in_supabase, true);
  const lengths = Object.keys(sent.details)
    .filter((key) => key.startsWith("field_"))
    .map((key) => sent.details[key].length);
  assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 1, `cut to one shared length: ${lengths}`);
  assert.ok(lengths.every((length) => length > 0));
  for (const key of ["id", "kind", "property", "occurredAt", "summary", "person"]) {
    assert.deepStrictEqual(sent[key], event[key]);
  }
  assert.strictEqual(warnings[0][0], "[intake] details trimmed to fit the hub's body limit");
  assert.strictEqual(warnings[0][1].id, event.id);
});

test("trimming never splits a surrogate pair", () => {
  const event = bigEvent("🎤".repeat(1000));
  const { result } = quietWarn(() => fitBody(event));
  assert.ok(Buffer.byteLength(result, "utf8") <= MAX_BODY_BYTES);
  for (const value of Object.values(JSON.parse(result).details)) {
    if (typeof value === "string") {
      assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?:^|[^\ud800-\udbff])[\udc00-\udfff]/.test(value));
    }
  }
});

test("characters JSON escapes are counted at their escaped size", () => {
  const event = bigEvent("\u0001\"".repeat(1000));
  const { result } = quietWarn(() => fitBody(event));
  assert.ok(Buffer.byteLength(result, "utf8") <= MAX_BODY_BYTES);
});

test("forwardToIntake sends and signs the trimmed body", async () => {
  const event = bigEvent("漢字".repeat(1000));
  const { calls, fetcher } = hub([202]);
  const original = console.warn;
  console.warn = () => {};
  try {
    const result = await forwardToIntake(event, ENV, fetcher);
    assert.deepStrictEqual(result, { ok: true, duplicate: false });
  } finally {
    console.warn = original;
  }
  const { init } = calls[0];
  assert.ok(Buffer.byteLength(init.body, "utf8") <= MAX_BODY_BYTES);
  const timestamp = init.headers["x-suede-intake-timestamp"];
  assert.strictEqual(init.headers["x-suede-intake-signature"], signIntakeBody(SECRET, timestamp, init.body));
});
