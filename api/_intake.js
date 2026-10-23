// Lead intake forwarding for the site's form handlers.
//
// Every submission a handler receives is also sent, signed, to the Agent
// Studio intake hub. The hub stores it before answering, opens a sales_lead
// ticket in the CRM and emails info@suedeai.ai, retrying from its own outbox
// until both land. The wire format, signing and sender rules are the lead
// intake contract: docs/intake/CONTRACT.md in the suede-agent-studio repo.
// forwardToIntake below is that contract's reference sender ported to
// CommonJS; the rest shapes events so they pass the hub's validator.
//
// Sender rules the handlers follow:
//   - Keep our own copy first: insert into Supabase, then forward.
//   - Await the forward before responding. Vercel stops work after the
//     response is sent.
//   - The visitor sees success when Supabase or the hub holds the submission,
//     and an error only when both failed.
//   - Forward what the honeypot or spam gate drops, flagged suspectedSpam, so a
//     real person caught by a filter can be rescued from the daily digest.
//   - Never put secrets, card data, tokens or anything about a child in an
//     event.

const { createHmac, randomUUID } = require("node:crypto");

const DEFAULT_INTAKE_URL = "https://agents.suedeai.ai/api/intake/events";
// One immediate attempt, then two retries. 429, 5xx and network errors retry;
// 400, 401 and 413 never do.
const BACKOFF_MS = [0, 400, 1200];
const ATTEMPT_TIMEOUT_MS = 4000;
const MIN_SECRET_BYTES = 32;
const NO_RETRY_STATUSES = [400, 401, 413];

// Limits the hub validates. One value over a limit fails the whole event with
// a 400, so events are trimmed to fit rather than lost.
const LIMITS = {
  summary: 200,
  name: 120,
  email: 320,
  detailKeys: 40,
  detailValue: 2000,
  attributionKeys: 12,
  attributionValue: 300,
  spamReason: 120,
};

// The pattern the hub's validator applies to person.email. The forms accept a
// looser one, so an address that passes the form but not this goes into
// details as email_raw instead of failing the event.
const HUB_EMAIL = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
const FIELD_KEY = /^[A-Za-z0-9_.-]{1,64}$/;
const ATTRIBUTION_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/** @typedef {"signup" | "login" | "lead" | "booking" | "purchase" | "application" | "waitlist"} IntakeKind */
/** @typedef {string | number | boolean | null} IntakeDetailValue */

/**
 * @typedef {object} IntakeEvent
 * @property {string} id Idempotency key, 8 to 128 chars of A-Z a-z 0-9 : _ . -
 * @property {IntakeKind} kind
 * @property {string} property Host the person used, lowercase.
 * @property {string} occurredAt ISO 8601 with offset.
 * @property {string} summary One line, 200 chars max. The hub's email subject.
 * @property {{ email?: string, name?: string, phone?: string }} [person]
 * @property {Record<string, IntakeDetailValue>} [details]
 * @property {Record<string, string>} [attribution]
 * @property {boolean} [canary]
 * @property {{ reason: string }} [suspectedSpam]
 */

/**
 * @typedef {{ ok: true, duplicate: boolean }
 *   | { ok: false, reason: "not-configured" | "rejected" | "unreachable" }} IntakeForwardResult
 */

/**
 * `v1=` + hex HMAC-SHA256 of `${timestamp}.${rawBody}`.
 * @param {string} secret
 * @param {string} timestamp Unix seconds.
 * @param {string} rawBody The exact bytes sent.
 * @returns {string}
 */
function signIntakeBody(secret, timestamp, rawBody) {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
}

/** @param {number} ms @returns {Promise<void>} */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends one event to the hub. Never throws; the result says what happened and
 * every failure is logged with console.error.
 *
 * @param {IntakeEvent} event
 * @param {Readonly<Record<string, string | undefined>>} [env]
 * @param {typeof fetch} [fetcher]
 * @param {(ms: number) => Promise<void>} [sleep] Injectable for tests.
 * @returns {Promise<IntakeForwardResult>}
 */
async function forwardToIntake(event, env = process.env, fetcher = globalThis.fetch, sleep = wait) {
  const source = String(env.SUEDE_INTAKE_SOURCE || "").trim();
  const secret = env.SUEDE_INTAKE_SECRET;
  if (!source || !secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    console.error("[intake] not configured: set SUEDE_INTAKE_SOURCE and SUEDE_INTAKE_SECRET", { id: event.id });
    return { ok: false, reason: "not-configured" };
  }

  const url = String(env.SUEDE_INTAKE_URL || "").trim() || DEFAULT_INTAKE_URL;
  const body = JSON.stringify(event);
  let lastFailure = "";

  for (const delay of BACKOFF_MS) {
    if (delay > 0) {
      await sleep(delay);
    }
    // Signed per attempt so a retry after a slow timeout is not refused as stale.
    const timestamp = String(Math.floor(Date.now() / 1000));
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-suede-intake-source": source,
          "x-suede-intake-timestamp": timestamp,
          "x-suede-intake-signature": signIntakeBody(secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });

      if (response.status === 202) {
        let json = null;
        try {
          json = await response.json();
        } catch {
          json = null;
        }
        return { ok: true, duplicate: Boolean(json && json.duplicate === true) };
      }

      if (NO_RETRY_STATUSES.includes(response.status)) {
        console.error("[intake] rejected", { id: event.id, status: response.status });
        return { ok: false, reason: "rejected" };
      }

      lastFailure = `status ${response.status}`;
    } catch (error) {
      // Network error or timeout: retry.
      lastFailure = error && error.name ? error.name : "network error";
    }
  }

  console.error("[intake] unreachable after retries", { id: event.id, last: lastFailure });
  return { ok: false, reason: "unreachable" };
}

/**
 * A stable id for one submission, made once per request before any write so
 * every attempt to forward it carries the same key. The Supabase inserts use
 * `Prefer: return=minimal` and the anon role cannot read rows back, so there
 * is no row id to reuse.
 *
 * @param {string} prefix The handler, e.g. "contact".
 * @returns {string}
 */
function newEventId(prefix) {
  return `${prefix}:${randomUUID()}`;
}

/** @param {unknown} value @returns {string} */
function oneLine(value) {
  return String(value === undefined || value === null ? "" : value).replace(/\s+/g, " ").trim();
}

/** Cuts to `max` UTF-16 units without leaving half a surrogate pair. */
function clip(value, max) {
  if (value.length <= max) {
    return value;
  }
  const cut = value.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/**
 * Keeps valid keys and contract-legal values, drops empty strings, and trims
 * long strings to the hub's limit.
 *
 * @param {Record<string, unknown> | undefined} details
 * @returns {Record<string, IntakeDetailValue> | undefined}
 */
function shapeDetails(details) {
  /** @type {Record<string, IntakeDetailValue>} */
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(details || {})) {
    if (count >= LIMITS.detailKeys) {
      break;
    }
    if (!FIELD_KEY.test(key)) {
      continue;
    }
    if (typeof value === "string") {
      if (!value.trim()) {
        continue;
      }
      out[key] = clip(value, LIMITS.detailValue);
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        continue;
      }
      out[key] = value;
    } else if (typeof value === "boolean" || value === null) {
      out[key] = value;
    } else {
      continue;
    }
    count += 1;
  }
  return count ? out : undefined;
}

/**
 * UTM values the form posted, if any.
 *
 * @param {Record<string, unknown>} fields
 * @returns {Record<string, string> | undefined}
 */
function attributionFrom(fields) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of ATTRIBUTION_FIELDS) {
    const value = oneLine(fields && Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : "");
    if (value && Object.keys(out).length < LIMITS.attributionKeys) {
      out[key] = clip(value, LIMITS.attributionValue);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Builds an event the hub will accept from what a handler has. Empty fields
 * are left out; an email the hub would refuse moves to details.email_raw.
 *
 * @param {object} input
 * @param {string} input.id
 * @param {IntakeKind} input.kind
 * @param {string} input.property
 * @param {string} input.occurredAt
 * @param {string} input.summary
 * @param {string} [input.email]
 * @param {string} [input.name]
 * @param {Record<string, unknown>} [input.details]
 * @param {Record<string, string>} [input.attribution]
 * @param {{ reason: string }} [input.suspectedSpam]
 * @returns {IntakeEvent}
 */
function buildIntakeEvent({ id, kind, property, occurredAt, summary, email, name, details, attribution, suspectedSpam }) {
  /** @type {IntakeEvent["person"]} */
  const person = {};
  /** @type {Record<string, unknown>} */
  const extra = {};

  const typedEmail = oneLine(email);
  const cleanEmail = typedEmail.toLowerCase();
  if (cleanEmail) {
    if (cleanEmail.length <= LIMITS.email && HUB_EMAIL.test(cleanEmail)) {
      person.email = cleanEmail;
    } else {
      extra.email_raw = clip(typedEmail, LIMITS.attributionValue);
    }
  }

  const cleanName = clip(oneLine(name), LIMITS.name);
  if (cleanName) {
    person.name = cleanName;
  }

  const host = oneLine(property).toLowerCase();
  /** @type {IntakeEvent} */
  const event = {
    id,
    kind,
    property: host,
    occurredAt,
    summary: clip(oneLine(summary), LIMITS.summary) || `New ${kind} on ${host}`,
  };

  if (Object.keys(person).length) {
    event.person = person;
  }
  const shaped = shapeDetails({ ...details, ...extra });
  if (shaped) {
    event.details = shaped;
  }
  if (attribution && Object.keys(attribution).length) {
    event.attribution = attribution;
  }
  if (suspectedSpam) {
    event.suspectedSpam = { reason: clip(oneLine(suspectedSpam.reason), LIMITS.spamReason) || "filtered" };
  }
  return event;
}

/**
 * The flag a dropped submission is forwarded with.
 *
 * @param {boolean} honeypot
 * @param {{ score: number }} gate The spam gate's assessment.
 * @returns {{ reason: string }}
 */
function spamFlag(honeypot, gate) {
  return { reason: honeypot ? "honeypot" : `spam-gate:${gate.score}` };
}

/**
 * Spam-gate context for details: present for honeypot hits, drops and
 * review-level deliveries, empty for a clean submission.
 *
 * @param {boolean} honeypot
 * @param {{ score: number, reasons: string[], verdict: string }} gate
 * @returns {Record<string, string | number>}
 */
function spamDetails(honeypot, gate) {
  if (!honeypot && gate.verdict === "deliver") {
    return {};
  }
  return {
    spam_verdict: honeypot ? "honeypot" : gate.verdict,
    spam_score: gate.score,
    spam_reasons: gate.reasons.join(", ") || "none",
  };
}

/**
 * Whether the submission is held anywhere. Logs the two failure shapes:
 * Supabase down but the hub has it, and both down (the submission is lost and
 * the visitor sees an error).
 *
 * @param {string} label Log prefix, e.g. "contact".
 * @param {string} eventId
 * @param {{ ok: boolean, status?: number }} insertResult
 * @param {IntakeForwardResult} forwardResult
 * @returns {boolean}
 */
function settleCapture(label, eventId, insertResult, forwardResult) {
  if (insertResult.ok) {
    return true;
  }
  if (forwardResult.ok) {
    console.error(`[${label}] Supabase insert failed; the intake hub holds the submission`, {
      id: eventId,
      status: insertResult.status,
    });
    return true;
  }
  console.error(`[${label}] submission lost: Supabase insert and intake forward both failed`, {
    id: eventId,
    status: insertResult.status,
    intake: forwardResult.reason,
  });
  return false;
}

module.exports = {
  ATTEMPT_TIMEOUT_MS,
  BACKOFF_MS,
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
};
