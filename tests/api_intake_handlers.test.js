const test = require("node:test");
const assert = require("node:assert");

// Supabase, Resend and the intake hub all look configured. fetch is stubbed,
// so nothing leaves the process. Every handler reads env at request time.
const SECRET = "s".repeat(48);
const HUB_URL = "https://intake.test/api/intake/events";
const HUB_REPLY_MS = 5;
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.CONTACT_EMAIL_FROM = "Suede <info@suedeai.ai>";
process.env.CONTACT_NOTIFY_TO = "info@suedeai.ai";
process.env.BOOK_EMAIL_FROM = "Suede <info@suedeai.ai>";
process.env.CALL_NOTIFY_TO = "info@suedeai.ai";
process.env.INVESTOR_EMAIL_FROM = "Suede <info@suedeai.ai>";
process.env.INVESTOR_NOTIFY_TO = "info@suedeai.ai";
process.env.INVESTOR_AUTORESPONDER = "true";
process.env.SUEDE_INTAKE_SOURCE = "suedeai-org";
process.env.SUEDE_INTAKE_SECRET = SECRET;
process.env.SUEDE_INTAKE_URL = HUB_URL;

const { signIntakeBody } = require("../api/_intake.js");

const SITE = "https://suedeai.org";
const stamp = () => (Date.now() - 30_000).toString(36);

const FORMS = {
  contact: {
    handler: require("../api/contact.js"),
    kind: "lead",
    table: "contact_inquiries",
    redirectTo: "/contact/thanks/",
    body: { name: "Pat Rivera", email: "pat@example.com", topic: "Partnerships", message: "We run a small label and want to talk about licensing." },
    summary: "Contact from Pat Rivera: Partnerships",
  },
  "book-call": {
    handler: require("../api/book-call.js"),
    kind: "booking",
    table: "call_requests",
    redirectTo: "/book-a-call/thanks/",
    body: {
      name: "Pat Rivera",
      email: "pat@example.com",
      topic: "Partnerships",
      company: "Rivera Records",
      timeframe: "Next two weeks",
      message: "We run a small label and want to talk about proof of creation.",
    },
    summary: "Call request from Pat Rivera: Partnerships",
  },
  investors: {
    handler: require("../api/investors.js"),
    kind: "lead",
    table: "investor_leads",
    redirectTo: "/investors/thanks/",
    body: { name: "Pat Investor", email: "pat@fund.com", firm: "Fund Capital", check_size: "$25k-$100k", message: "Would like the deck." },
    summary: "Investor inquiry: Fund Capital, Pat Investor [$25k-$100k]",
  },
  book: {
    handler: require("../api/book.js"),
    kind: "lead",
    table: "book_leads",
    redirectTo: "/book/thanks/",
    body: { name: "Pat Rivera", email: "pat@example.com", context: "Read the sharp excerpt, want the rest." },
    summary: "Reader preview signup: pat@example.com (Pat Rivera)",
  },
};

// Letter soup from a direct POST: the spam gate drops it.
const SOUP = {
  name: "ZwkbyIpqcWOdJFetxjbMzHG",
  email: "martin_adams@comcast.net",
  firm: "qHgHlUTfgXWGSigOEeCdlzVN",
  topic: "qHgHlUTfgXWGSigOEeCdlzVN",
  message: "MoqtvgLooxOrAQXRm kBXmYylxNZwJKsIoTN",
  context: "MoqtvgLooxOrAQXRm kBXmYylxNZwJKsIoTN",
};

// ---- the hub's validator, mirrored (src/lib/intake/contract.ts in suede-agent-studio) ----

const HUB_EVENT_KEYS = ["id", "kind", "property", "occurredAt", "summary", "person", "details", "attribution", "canary", "suspectedSpam"];
const HUB_KINDS = ["signup", "login", "lead", "booking", "purchase", "application", "waitlist"];
const HUB_EMAIL = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
const HUB_KEY = /^[A-Za-z0-9_.-]{1,64}$/;

function assertHubAccepts(raw) {
  assert.ok(Buffer.byteLength(raw, "utf8") <= 32_768, "body under 32 KB");
  const event = JSON.parse(raw);
  for (const key of Object.keys(event)) {
    assert.ok(HUB_EVENT_KEYS.includes(key), `unknown top-level key ${key}`);
  }
  assert.match(event.id, /^[A-Za-z0-9][A-Za-z0-9:_.-]{7,127}$/);
  assert.ok(HUB_KINDS.includes(event.kind), event.kind);
  assert.match(event.property, /^[a-z0-9.-]+(?:\/[a-z0-9._/-]*)?$/);
  assert.ok(event.property.length >= 3 && event.property.length <= 120);
  assert.match(event.occurredAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  assert.ok(event.summary.length >= 1 && event.summary.length <= 200 && !/\s{2}|\n/.test(event.summary), event.summary);
  if (event.person) {
    for (const key of Object.keys(event.person)) {
      assert.ok(["email", "name", "phone"].includes(key), `unknown person key ${key}`);
    }
    if (event.person.email !== undefined) {
      assert.ok(event.person.email.length <= 320 && HUB_EMAIL.test(event.person.email), event.person.email);
    }
    if (event.person.name !== undefined) {
      assert.ok(event.person.name.length <= 120);
    }
  }
  if (event.details) {
    assert.ok(Object.keys(event.details).length <= 40);
    for (const [key, value] of Object.entries(event.details)) {
      assert.match(key, HUB_KEY);
      const okValue =
        (typeof value === "string" && value.length <= 2000) ||
        (typeof value === "number" && Number.isFinite(value)) ||
        typeof value === "boolean" ||
        value === null;
      assert.ok(okValue, `details.${key}`);
    }
  }
  if (event.attribution) {
    assert.ok(Object.keys(event.attribution).length <= 12);
    for (const [key, value] of Object.entries(event.attribution)) {
      assert.match(key, HUB_KEY);
      assert.ok(typeof value === "string" && value.length <= 300);
    }
  }
  if (event.suspectedSpam) {
    assert.deepStrictEqual(Object.keys(event.suspectedSpam), ["reason"]);
    assert.ok(event.suspectedSpam.reason.length >= 1 && event.suspectedSpam.reason.length <= 120);
  }
  return event;
}

// ---- harness ----

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(payload) {
      this.body = payload || "";
      this.ended = true;
    },
  };
}

// Each of supabase, hub and resend is a list consumed in order (the last one
// repeats). An entry is a status code, or an Error to throw.
async function submit(form, body, { supabase = [201], hub = [202], resend = [200], origin = SITE } = {}) {
  const res = makeRes();
  const calls = [];
  const counters = { supabase: 0, hub: 0, resend: 0 };
  const pick = (name, list) => list[Math.min(counters[name]++, list.length - 1)];

  global.fetch = async (url, init) => {
    const target = url.startsWith(HUB_URL) ? "hub" : url.includes("/rest/v1/") ? "supabase" : url.includes("api.resend.com") ? "resend" : "other";
    const call = { target, url, init, answeredYet: res.ended };
    calls.push(call);
    const next = target === "hub" ? pick("hub", hub) : target === "supabase" ? pick("supabase", supabase) : pick("resend", resend);
    // Reply on a later turn of the event loop, the way a real request does,
    // with the hub the slowest of the three. A handler that does not await the
    // forward has answered by the time the hub replies.
    await new Promise((resolve) => (target === "hub" ? setTimeout(resolve, HUB_REPLY_MS) : setImmediate(resolve)));
    call.answeredYet = res.ended;
    if (next instanceof Error) {
      throw next;
    }
    return {
      ok: next >= 200 && next < 300,
      status: next,
      text: async () => (next >= 400 ? "upstream said no" : ""),
      json: async () => ({ accepted: true, duplicate: false }),
    };
  };

  const errors = [];
  const warnings = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args) => errors.push(args);
  console.warn = (...args) => warnings.push(args);
  try {
    const headers = { accept: "application/json" };
    if (origin) headers.origin = origin;
    await FORMS[form].handler({ method: "POST", headers, body }, res);
    // Let any request the handler left running reach its reply, so a forward
    // that was fired but not awaited shows up as answeredYet: true.
    await new Promise((resolve) => setTimeout(resolve, HUB_REPLY_MS * 3));
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }

  const of = (target) => calls.filter((call) => call.target === target);
  const events = of("hub").map((call) => assertHubAccepts(call.init.body));
  return { res, calls, of, events, errors, warnings };
}

const fromPage = (body) => ({ form_ts: stamp(), ...body });
const json = (res) => JSON.parse(res.body);

// ---- every handler ----

for (const [form, spec] of Object.entries(FORMS)) {
  test(`${form}: stores first, then forwards one signed ${spec.kind} event before answering`, async () => {
    const run = await submit(form, fromPage(spec.body));
    assert.strictEqual(run.res.statusCode, 200, run.res.body);
    assert.deepStrictEqual(json(run.res), { ok: true, redirectTo: spec.redirectTo });

    const order = run.calls.map((call) => call.target);
    assert.strictEqual(order[0], "supabase");
    assert.strictEqual(order[1], "hub");
    assert.ok(order.slice(2).every((target) => target === "resend"), order.join(","));

    const [hubCall] = run.of("hub");
    assert.strictEqual(hubCall.answeredYet, false, "the response waits for the hub to reply");
    const timestamp = hubCall.init.headers["x-suede-intake-timestamp"];
    assert.strictEqual(hubCall.init.headers["x-suede-intake-source"], "suedeai-org");
    assert.strictEqual(hubCall.init.headers["x-suede-intake-signature"], signIntakeBody(SECRET, timestamp, hubCall.init.body));

    const [event] = run.events;
    const row = JSON.parse(run.of("supabase")[0].init.body);
    assert.match(event.id, new RegExp(`^${form}:[0-9a-f-]{36}$`));
    assert.strictEqual(event.kind, spec.kind);
    assert.strictEqual(event.property, "suedeai.org");
    assert.strictEqual(event.occurredAt, row.submitted_at);
    assert.strictEqual(event.summary, spec.summary);
    assert.strictEqual(event.person.email, spec.body.email);
    assert.strictEqual(event.person.name, spec.body.name);
    assert.strictEqual(event.details.form, form);
    assert.strictEqual(event.details.stored_in_supabase, true);
    assert.strictEqual(event.suspectedSpam, undefined);
    assert.strictEqual(run.errors.length, 0, JSON.stringify(run.errors));
  });

  test(`${form}: a failed Supabase insert still reaches the hub and the visitor sees success`, async () => {
    const run = await submit(form, fromPage(spec.body), { supabase: [500] });
    assert.strictEqual(run.res.statusCode, 200, run.res.body);
    assert.deepStrictEqual(json(run.res), { ok: true, redirectTo: spec.redirectTo });
    assert.strictEqual(run.events.length, 1);
    assert.strictEqual(run.events[0].details.stored_in_supabase, false);
    assert.ok(
      run.errors.some(([line]) => line === `[${form}] Supabase insert failed; the intake hub holds the submission`),
      JSON.stringify(run.errors)
    );
  });

  test(`${form}: Supabase unreachable is a failed insert, not a crash`, async () => {
    const run = await submit(form, fromPage(spec.body), { supabase: [new TypeError("fetch failed")] });
    assert.strictEqual(run.res.statusCode, 200, run.res.body);
    assert.strictEqual(run.events.length, 1);
    assert.strictEqual(run.events[0].details.stored_in_supabase, false);
  });

  test(`${form}: the visitor gets an error only when the insert and the forward both failed`, async () => {
    const run = await submit(form, fromPage(spec.body), { supabase: [500], hub: [401] });
    assert.strictEqual(run.res.statusCode, 500);
    assert.strictEqual(json(run.res).error, "Supabase insert failed.");
    assert.strictEqual(run.of("hub").length, 1, "a 401 is not retried");
    assert.strictEqual(run.of("resend").length, 0, "nothing is emailed for a lost submission");
    assert.ok(run.errors.some(([line]) => line === `[${form}] submission lost: Supabase insert and intake forward both failed`));
  });

  test(`${form}: a stored submission still succeeds when the hub refuses it`, async () => {
    const run = await submit(form, fromPage(spec.body), { hub: [400] });
    assert.strictEqual(run.res.statusCode, 200);
    assert.ok(run.errors.some(([line]) => line === "[intake] rejected"));
  });

  test(`${form}: a honeypot hit is forwarded flagged and answered exactly as before`, async () => {
    const run = await submit(form, fromPage({ ...spec.body, company_url: "https://spam.example" }));
    assert.strictEqual(run.res.statusCode, 200);
    assert.deepStrictEqual(json(run.res), { ok: true, redirectTo: spec.redirectTo });
    assert.strictEqual(run.of("supabase").length, 0, "nothing stored");
    assert.strictEqual(run.of("resend").length, 0, "nothing emailed");
    assert.strictEqual(run.events.length, 1);
    assert.strictEqual(run.of("hub")[0].answeredYet, false);
    assert.deepStrictEqual(run.events[0].suspectedSpam, { reason: "honeypot" });
    assert.strictEqual(run.events[0].details.spam_verdict, "honeypot");
    assert.strictEqual(run.events[0].details.stored_in_supabase, false);
    assert.strictEqual(run.warnings[0][0], "[spam-gate] dropped");
  });

  test(`${form}: a spam-gate drop is forwarded with its score and answered exactly as before`, async () => {
    const run = await submit(form, SOUP, { origin: "" });
    assert.strictEqual(run.res.statusCode, 200);
    assert.deepStrictEqual(json(run.res), { ok: true, redirectTo: spec.redirectTo });
    assert.strictEqual(run.of("supabase").length, 0);
    assert.strictEqual(run.of("resend").length, 0);
    assert.strictEqual(run.events.length, 1);
    const [event] = run.events;
    assert.match(event.suspectedSpam.reason, /^spam-gate:\d+$/);
    assert.strictEqual(event.details.spam_verdict, "drop");
    assert.match(event.details.spam_reasons, /no-js/);
    assert.strictEqual(event.person.email, "martin_adams@comcast.net");
  });

  test(`${form}: a hub that is down does not change a dropped submission's answer`, async () => {
    const run = await submit(form, SOUP, { origin: "", hub: [401] });
    assert.strictEqual(run.res.statusCode, 200);
    assert.deepStrictEqual(json(run.res), { ok: true, redirectTo: spec.redirectTo });
  });
}

// ---- event content ----

test("the event id is stable across hub retries and new for each submission", async () => {
  const first = await submit("contact", fromPage(FORMS.contact.body), { hub: [503, 202] });
  assert.strictEqual(first.res.statusCode, 200);
  assert.strictEqual(first.events.length, 2);
  assert.strictEqual(first.events[0].id, first.events[1].id);
  assert.strictEqual(first.of("hub")[0].init.body, first.of("hub")[1].init.body);

  const second = await submit("contact", fromPage(FORMS.contact.body));
  assert.notStrictEqual(second.events[0].id, first.events[0].id);
});

test("long fields are cut to 2,000 characters for the hub; Supabase keeps the full text", async () => {
  const message = "We license our catalog to studios and want proof of creation on every master. ".repeat(60).trim();
  assert.ok(message.length > 4000);
  const run = await submit("book-call", fromPage({ ...FORMS["book-call"].body, message }));
  assert.strictEqual(run.res.statusCode, 200);
  assert.strictEqual(run.events[0].details.message.length, 2000);
  assert.strictEqual(run.events[0].details.message, message.slice(0, 2000));
  assert.strictEqual(JSON.parse(run.of("supabase")[0].init.body).message, message);
});

test("only the form's own fields are forwarded: no tokens, passwords, page stamps or secrets", async () => {
  const run = await submit(
    "contact",
    fromPage({
      ...FORMS.contact.body,
      password: "hunter2-password",
      token: "tok_live_should_not_travel",
      access_token: "eyJ.should.not.travel",
      company_url: "",
    })
  );
  assert.strictEqual(run.res.statusCode, 200);
  const raw = run.of("hub")[0].init.body;
  for (const needle of ["hunter2-password", "tok_live_should_not_travel", "eyJ.should.not.travel", "form_ts", "company_url", SECRET]) {
    assert.ok(!raw.includes(needle), `${needle} must not be forwarded`);
  }
  assert.deepStrictEqual(Object.keys(run.events[0].details).sort(), ["form", "message", "source", "stored_in_supabase", "topic"]);
});

test("an email the form accepts but the hub would refuse goes to details.email_raw", async () => {
  const run = await submit("book", fromPage({ email: "reader@localhost.c", name: "Pat Rivera" }));
  assert.strictEqual(run.res.statusCode, 200);
  assert.strictEqual(run.events[0].person.email, undefined);
  assert.strictEqual(run.events[0].details.email_raw, "reader@localhost.c");
});

test("a review-level submission keeps its [review] prefix and lists the signals", async () => {
  // No page stamp and no Origin: 4 points, delivered for review.
  const run = await submit("contact", FORMS.contact.body, { origin: "" });
  assert.strictEqual(run.res.statusCode, 200);
  const [event] = run.events;
  assert.ok(event.summary.startsWith("[review] Contact from Pat Rivera"), event.summary);
  assert.strictEqual(event.suspectedSpam, undefined, "review-level submissions are real leads, not spam");
  assert.strictEqual(event.details.spam_verdict, "review");
  assert.strictEqual(event.details.spam_reasons, "no-js, origin");
});

// ---- investors ----

test("investors: a cross-site post from suedeai.ai is reported under suedeai.ai with its UTM tags", async () => {
  const run = await submit(
    "investors",
    fromPage({ ...FORMS.investors.body, source: "suedeai.ai/investors", utm_source: "x", utm_campaign: "investors-sept" }),
    { origin: "https://suedeai.ai" }
  );
  assert.strictEqual(run.res.statusCode, 200, run.res.body);
  assert.strictEqual(run.res.headers["access-control-allow-origin"], "https://suedeai.ai");
  const [event] = run.events;
  assert.strictEqual(event.property, "suedeai.ai");
  assert.strictEqual(event.summary, "Investor inquiry: Fund Capital, Pat Investor [$25k-$100k]");
  assert.strictEqual(event.details.source, "suedeai.ai/investors");
  assert.deepStrictEqual(event.attribution, { utm_source: "x", utm_campaign: "investors-sept" });
});

test("investors: the insert-policy fallback is stored under the default source and the event says so", async () => {
  const run = await submit("investors", fromPage({ ...FORMS.investors.body, source: "suedeai.ai/investors" }), {
    origin: "https://suedeai.ai",
    supabase: [401, 201],
  });
  assert.strictEqual(run.res.statusCode, 200);
  assert.strictEqual(run.of("supabase").length, 2);
  const [event] = run.events;
  assert.strictEqual(event.details.stored_in_supabase, true);
  assert.strictEqual(event.details.stored_source, "suedeai.org/investors");
  assert.ok(run.of("hub")[0].answeredYet === false);
});

// ---- book ----

test("book: the reader still gets the preview email, and the founder now hears about it through the hub", async () => {
  const run = await submit("book", fromPage(FORMS.book.body));
  assert.strictEqual(run.res.statusCode, 200);
  const sends = run.of("resend").map((call) => JSON.parse(call.init.body));
  assert.strictEqual(sends.length, 1);
  assert.deepStrictEqual(sends[0].to, ["pat@example.com"]);
  assert.strictEqual(run.events[0].kind, "lead");
  assert.strictEqual(run.events[0].details.context, "Read the sharp excerpt, want the rest.");
});

// ---- Resend results ----

for (const form of ["book-call", "investors"]) {
  test(`${form}: failed Resend sends are logged and the visitor still sees success`, async () => {
    const run = await submit(form, fromPage(FORMS[form].body), { resend: [500] });
    assert.strictEqual(run.res.statusCode, 200);
    assert.deepStrictEqual(json(run.res), { ok: true, redirectTo: FORMS[form].redirectTo });
    assert.strictEqual(run.of("resend").length, 2, "notification and autoresponder were both attempted");
    const lines = run.errors.map(([line]) => line);
    assert.ok(lines.includes(`[${form}] email notification failed`), lines.join(" | "));
    assert.ok(lines.includes(`[${form}] autoresponder failed`), lines.join(" | "));
    const logged = run.errors.find(([line]) => line === `[${form}] email notification failed`)[1];
    assert.strictEqual(logged.status, 500);
  });
}

test("a Resend network error after a stored submission is logged, not turned into a 500", async () => {
  const run = await submit("contact", fromPage(FORMS.contact.body), { resend: [new TypeError("fetch failed")] });
  assert.strictEqual(run.res.statusCode, 200);
  assert.ok(run.errors.some(([line]) => line === "[contact] email notification failed"));
});

// ---- not configured ----

test("with no intake secret the forward is skipped and logged; Supabase alone carries the submission", async () => {
  const saved = process.env.SUEDE_INTAKE_SECRET;
  delete process.env.SUEDE_INTAKE_SECRET;
  try {
    const stored = await submit("contact", fromPage(FORMS.contact.body));
    assert.strictEqual(stored.res.statusCode, 200);
    assert.strictEqual(stored.of("hub").length, 0);
    assert.ok(stored.errors.some(([line]) => /^\[intake\] not configured/.test(line)));

    const lost = await submit("contact", fromPage(FORMS.contact.body), { supabase: [500] });
    assert.strictEqual(lost.res.statusCode, 500, "neither copy exists, so the visitor is told");
  } finally {
    process.env.SUEDE_INTAKE_SECRET = saved;
  }
});
