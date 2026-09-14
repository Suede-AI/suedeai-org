// Spam gate for the site's form handlers.
//
// The forms had one defence, a honeypot field, and every submission that
// reached the inbox between July and September 2026 walked past it: random-
// letter names and topics, casino link drops, and two "subscribe me" bot
// templates that arrived under a different name and address each time.
//
// This module scores a submission on cheap, independent signals and returns
// one of three verdicts. "drop" answers the client with the same success
// response a real submission gets, but nothing is stored or emailed. "review"
// lets the submission through with a "[review]" subject prefix and the
// signals appended, so a borderline case still reaches a human. "deliver" is
// untouched. Nothing here blocks on a single signal except the honeypot,
// which the handlers check before calling in.
//
// The signals, and why each is safe on its own:
//   no-js      the page script stamps form_ts on every form at load; a POST
//              without it did not run the page. A human with scripts off
//              scores 2 and is still delivered.
//   too-fast   form_ts younger than the form's minimum: nobody types a name,
//              an address and a message in under three seconds.
//   origin     browsers send Origin on every POST; a request without one, or
//              from another host, did not come from the page.
//   gibberish  a name, topic or most of a message made of letter soup.
//   template   a phrase from a known form-spam kit.
//   html       markup in a message. Real people do not write <a href>.
//   links      two or more links in a message.
//   keywords   gambling and adult spam vocabulary.
//   dotted     a Gmail local part with three or more dots, the dot trick spam
//              kits use to mint addresses.

const DROP_AT = 5;
const REVIEW_AT = 3;
const DEFAULT_MIN_MS = 3000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://suedeai.org",
  "https://www.suedeai.org",
  "https://suedeai-org.vercel.app",
];

// Lowercased, apostrophes normalised, whitespace collapsed before matching.
const TEMPLATE_PHRASES = [
  "please let me know when i am subscribed",
  "please send me news and updates by email",
  "i would like more information. please contact me by email",
  "i'd like to hear more about email updates",
  "i'd like to hear more about company news",
  "i'm interested in your newsletter",
  "i'm interested in weekly updates",
  "please add me for news about special offers",
  "i am happy to receive emails",
  "i'd like to subscribe to new content",
  "i'm interested in new content",
  "i want to stay informed",
];

const SPAM_KEYWORDS =
  /\b(casino|kazino|betting|sportsbook|poker|pin-?up|1win|1xbet|bookmaker|viagra|cialis|escorts?|porn|xxx)\b/i;

const HTML_MARKUP = /<\s*a[\s>]|href\s*=|\[url[=\]]|<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i;

const EMAIL_LIKE = /\S+@\S+/g;
const LINK_LIKE =
  /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|ru|us|uk|online|site|xyz|info|biz|shop|top|club|live|me|ai|app|dev|link|store)\b/gi;

function normalizePhrase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// English spells one consonant sound with two letters often enough that a
// raw consonant count calls "strengths" and "nightclub" soup. Each of these
// pairs counts as one consonant when measuring a run.
const CONSONANT_DIGRAPHS = /th|ng|ch|sh|ph|ck|gh|wh|qu/g;

// A word is letter soup when it is long enough to judge and has no vowels
// at all, is twelve or more letters with almost none, has a run of five or
// more consonant sounds, or has three or more places where a lowercase letter
// is followed by an uppercase one. Real names clear all of these: Schwartz
// has one vowel in eight letters but is too short for the ratio rule and its
// longest run is three, McDonald and DeAngelo have one case flip.
function looksGibberish(word) {
  const letters = String(word || "").replace(/[^A-Za-z]/g, "");
  if (letters.length < 6) {
    return false;
  }

  const lower = letters.toLowerCase();
  const vowels = (lower.match(/[aeiouy]/g) || []).length;
  if (vowels === 0) {
    return true;
  }
  if (lower.length >= 12 && vowels / lower.length < 0.15) {
    return true;
  }
  if (/[^aeiouy]{5,}/.test(lower.replace(CONSONANT_DIGRAPHS, "x"))) {
    return true;
  }

  let flips = 0;
  for (let i = 1; i < letters.length; i += 1) {
    if (/[a-z]/.test(letters[i - 1]) && /[A-Z]/.test(letters[i])) {
      flips += 1;
    }
  }
  return flips >= 3;
}

function mostlyGibberish(text) {
  const words = String(text || "")
    .split(/\s+/)
    .filter((word) => word.replace(/[^A-Za-z]/g, "").length >= 6);
  if (words.length < 2) {
    return false;
  }
  const soup = words.filter(looksGibberish).length;
  return soup * 2 > words.length;
}

function countLinks(text) {
  const withoutEmails = String(text || "").replace(EMAIL_LIKE, " ");
  return (withoutEmails.match(LINK_LIKE) || []).length;
}

function parseFormTimestamp(value) {
  const raw = String(value || "").trim();
  if (!/^[0-9a-z]{6,12}$/i.test(raw)) {
    return null;
  }
  const parsed = parseInt(raw, 36);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function allowedOrigins() {
  const configured = String(process.env.FORM_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function originOf(headers) {
  const origin = String((headers && headers.origin) || "").trim().replace(/\/+$/, "");
  if (origin) {
    return origin;
  }
  const referer = String((headers && headers.referer) || "").trim();
  if (!referer) {
    return "";
  }
  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

function assessSubmission({ form, fields = {}, headers = {}, now = Date.now(), minMs = DEFAULT_MIN_MS }) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  const stamped = parseFormTimestamp(fields.form_ts);
  if (stamped === null) {
    add(2, "no-js");
  } else {
    const age = now - stamped;
    if (age < minMs) {
      add(2, "too-fast");
    } else if (age > MAX_AGE_MS) {
      add(1, "stale");
    }
  }

  const origin = originOf(headers);
  if (!origin || !allowedOrigins().includes(origin)) {
    add(2, "origin");
  }

  const name = String(fields.name || "");
  const topic = String(fields.topic || "");
  const message = String(fields.message || fields.context || "");
  const email = String(fields.email || "").trim().toLowerCase();

  if (looksGibberish(name) || mostlyGibberish(name)) {
    add(3, "gibberish-name");
  }
  if (looksGibberish(topic) || mostlyGibberish(topic)) {
    add(3, "gibberish-topic");
  }
  if (mostlyGibberish(message)) {
    add(3, "gibberish-message");
  }

  const phrase = normalizePhrase(`${topic} ${message}`);
  if (TEMPLATE_PHRASES.some((template) => phrase.includes(template))) {
    add(3, "template");
  }

  const body = `${topic} ${message}`;
  if (HTML_MARKUP.test(body)) {
    add(3, "html");
  }

  const links = countLinks(body);
  if (links >= 2) {
    add(2, "links");
  } else if (links === 1) {
    add(1, "link");
  }

  if (SPAM_KEYWORDS.test(`${name} ${body}`)) {
    add(3, "keywords");
  }

  const [local = "", domain = ""] = email.split("@");
  if (domain === "gmail.com" && (local.match(/\./g) || []).length >= 3) {
    add(1, "dotted-gmail");
  }

  const verdict = score >= DROP_AT ? "drop" : score >= REVIEW_AT ? "review" : "deliver";
  return { form, score, reasons, verdict };
}

function logDrop(assessment, fields = {}) {
  console.warn("[spam-gate] dropped", {
    form: assessment.form,
    score: assessment.score,
    reasons: assessment.reasons,
    email: String(fields.email || "").slice(0, 120),
    name: String(fields.name || "").slice(0, 80),
  });
}

function reviewPrefix(assessment) {
  return assessment.verdict === "review" ? "[review] " : "";
}

function reviewNote(assessment) {
  if (assessment.verdict !== "review") {
    return "";
  }
  return `\n\n---\nSpam signals (${assessment.score}): ${assessment.reasons.join(", ")}`;
}

module.exports = {
  DROP_AT,
  REVIEW_AT,
  assessSubmission,
  countLinks,
  logDrop,
  looksGibberish,
  mostlyGibberish,
  reviewNote,
  reviewPrefix,
};
