const test = require("node:test");
const assert = require("node:assert");

const {
  assessSubmission,
  looksGibberish,
  mostlyGibberish,
  countLinks,
  reviewNote,
  reviewPrefix,
} = require("../api/_spam-gate.js");

const NOW = 1_800_000_000_000;
const stamp = (msAgo) => (NOW - msAgo).toString(36);
const fromPage = { origin: "https://suedeai.org" };

function assess(fields, headers = fromPage, extra = {}) {
  return assessSubmission({ form: "contact", fields, headers, now: NOW, ...extra });
}

test("a person on the page with a normal message is delivered with no signals", () => {
  const result = assess({
    name: "Pat Rivera",
    email: "pat@example.com",
    topic: "Licensing",
    message: "We run a small label and want to talk about proof of creation for our catalog.",
    form_ts: stamp(45_000),
  });
  assert.strictEqual(result.verdict, "deliver");
  assert.strictEqual(result.score, 0);
  assert.deepStrictEqual(result.reasons, []);
});

test("scripts off but a real message is still delivered", () => {
  const result = assess({
    name: "Pat Rivera",
    email: "pat@example.com",
    message: "Do you work with independent podcasters?",
  });
  assert.strictEqual(result.verdict, "deliver");
  assert.deepStrictEqual(result.reasons, ["no-js"]);
});

test("the July letter-soup bot is dropped", () => {
  const result = assess(
    {
      name: "ZwkbyIpqcWOdJFetxjbMzHG",
      email: "martin_adams@comcast.net",
      topic: "qHgHlUTfgXWGSigOEeCdlzVN",
      message: "MoqtvgLooxOrAQXRm",
    },
    {}
  );
  assert.strictEqual(result.verdict, "drop");
  assert.ok(result.reasons.includes("gibberish-name"));
  assert.ok(result.reasons.includes("gibberish-topic"));
  assert.ok(result.reasons.includes("no-js"));
  assert.ok(result.reasons.includes("origin"));
});

test("the consonant-soup message bot is dropped", () => {
  const result = assess(
    {
      name: "Bobbybab",
      email: "dylan-wood32pjfj@gmx.us",
      topic: "Gfdhwuwfeeu fhefuwhdwijduwfeu huwhfduewfhuwijdwuhfwu",
      message:
        "Gfdhwuwfeeu fhefuwhdwijduwfeu huwhfduewfhuwijdwuhfwu Egjnjmfnefjwdifj fkmdkdwdwkdwjj fkmfkengjkfmsdnfejfk mkfmkdmwjefnejfem suedeai.org",
    },
    {}
  );
  assert.strictEqual(result.verdict, "drop");
  assert.ok(result.reasons.includes("gibberish-message"));
});

test("casino link drops are dropped", () => {
  const result = assess(
    {
      name: "Danielbic",
      email: "100@waterpalm.online",
      topic: "casino",
      message:
        'Dive into our complete casino game library <a href="https://kazino-aviatorstar.ru">https://kazino-aviatorstar.ru</a>',
    },
    {}
  );
  assert.strictEqual(result.verdict, "drop");
  assert.ok(result.reasons.includes("keywords"));
  assert.ok(result.reasons.includes("html"));
});

test("the subscribe-me template without page script is dropped", () => {
  const result = assess(
    {
      name: "Thomas Davis",
      email: "feroz0520@gmail.com",
      message: "Hi there! I'd like to hear more about email updates. Please let me know when I am subscribed.",
    },
    {}
  );
  assert.strictEqual(result.verdict, "drop");
  assert.ok(result.reasons.includes("template"));
});

test("the more-information template with a faked origin but no page script is dropped", () => {
  const result = assess({
    name: "William Jones",
    email: "phatpat10@me.com",
    message: "I would like more information. Please contact me by email — talk to suede.",
  });
  assert.strictEqual(result.verdict, "drop");
  assert.deepStrictEqual(result.reasons, ["no-js", "template"]);
});

test("a template phrase alone from a real browser session goes to review, not the floor", () => {
  const result = assess({
    name: "Sam Ortiz",
    email: "sam@example.com",
    message: "I'm interested in your newsletter and the book.",
    form_ts: stamp(30_000),
  });
  assert.strictEqual(result.verdict, "review");
  assert.deepStrictEqual(result.reasons, ["template"]);
});

test("submitting under three seconds after load counts against the sender", () => {
  const result = assess({
    name: "Fast Bot",
    email: "fast@example.com",
    message: "Please send me news and updates by email.",
    form_ts: stamp(400),
  });
  assert.strictEqual(result.verdict, "drop");
  assert.ok(result.reasons.includes("too-fast"));
});

test("a shorter minimum applies to the one-field book form", () => {
  const result = assess(
    { name: "", email: "reader@example.com", form_ts: stamp(1_600) },
    fromPage,
    { form: "book", minMs: 1_500 }
  );
  assert.strictEqual(result.verdict, "deliver");
  assert.deepStrictEqual(result.reasons, []);
});

test("a stale form stamp is a mild signal only", () => {
  const result = assess({
    name: "Pat Rivera",
    email: "pat@example.com",
    message: "Left the tab open overnight, sorry.",
    form_ts: stamp(30 * 60 * 60 * 1000),
  });
  assert.strictEqual(result.verdict, "deliver");
  assert.deepStrictEqual(result.reasons, ["stale"]);
});

test("a message with two links from the page is delivered, three signals go to review", () => {
  const twoLinks = assess({
    name: "Pat Rivera",
    email: "pat@example.com",
    message: "Our site is https://example.com and the catalog lives at example.org/catalog.",
    form_ts: stamp(60_000),
  });
  assert.strictEqual(twoLinks.verdict, "deliver");
  assert.deepStrictEqual(twoLinks.reasons, ["links"]);

  const markup = assess({
    name: "Pat Rivera",
    email: "pat@example.com",
    message: 'See <a href="https://example.com">our site</a>.',
    form_ts: stamp(60_000),
  });
  assert.strictEqual(markup.verdict, "review");
  assert.strictEqual(reviewPrefix(markup), "[review] ");
  assert.match(reviewNote(markup), /Spam signals \(\d+\): html, link/);
});

test("delivered submissions get no prefix and no note", () => {
  const result = assess({
    name: "Pat Rivera",
    email: "pat@example.com",
    message: "Hello.",
    form_ts: stamp(20_000),
  });
  assert.strictEqual(reviewPrefix(result), "");
  assert.strictEqual(reviewNote(result), "");
});

test("an email address in the message is not counted as a link", () => {
  assert.strictEqual(countLinks("Reach me at pat@example.com any time."), 0);
  assert.strictEqual(countLinks("Reach me at pat@example.com or via example.com/contact."), 1);
});

test("real names with internal capitals are not gibberish", () => {
  for (const name of [
    "McDonald",
    "DeAngelo",
    "Jean-Luc O'Neil",
    "MacIntyre",
    "Strengths",
    "Krzysztof",
    "Schwartz",
    "Przybylski",
    "Nightingale",
    "Thornbrugh",
  ]) {
    assert.strictEqual(looksGibberish(name), false, name);
  }
  for (const soup of ["ZwkbyIpqcWOdJFetxjbMzHG", "qeTGpkpNRxigUGKf", "fkmdkdwdwkdwjj", "Egjnjmfnefjwdifj"]) {
    assert.strictEqual(looksGibberish(soup), true, soup);
  }
  assert.strictEqual(mostlyGibberish("We build tools for independent creators and small labels."), false);
  assert.strictEqual(
    mostlyGibberish("Postscript: the nightclub's catchphrase strengths were a birthplace of northstar branding."),
    false
  );
});

test("the Origin header is required and can be widened by env", () => {
  const fields = { name: "Pat Rivera", email: "pat@example.com", message: "Hello there.", form_ts: stamp(20_000) };

  assert.deepStrictEqual(assess(fields, {}).reasons, ["origin"]);
  assert.deepStrictEqual(assess(fields, { origin: "https://evil.example" }).reasons, ["origin"]);
  assert.deepStrictEqual(assess(fields, { referer: "https://www.suedeai.org/contact/" }).reasons, []);

  process.env.FORM_ALLOWED_ORIGINS = "https://staging.example/, https://suedeai.org";
  try {
    assert.deepStrictEqual(assess(fields, { origin: "https://staging.example" }).reasons, []);
  } finally {
    delete process.env.FORM_ALLOWED_ORIGINS;
  }
});

test("the dotted-gmail trick is a mild signal", () => {
  const result = assess({
    name: "Pat Rivera",
    email: "a.mu.bame.re.vup62@gmail.com",
    message: "Hello there.",
    form_ts: stamp(20_000),
  });
  assert.deepStrictEqual(result.reasons, ["dotted-gmail"]);
  assert.strictEqual(result.verdict, "deliver");
});
