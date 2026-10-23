const {
  allowPostOnly,
  getEnv,
  getRequestFields,
  insertRow,
  isValidEmail,
  normalizeText,
  redirect,
  sendEmail,
  sendJson,
  wantsJson,
} = require("./_shared");
const { assessSubmission, logDrop, reviewNote, reviewPrefix } = require("./_spam-gate");
const {
  attributionFrom,
  buildIntakeEvent,
  forwardToIntake,
  newEventId,
  settleCapture,
  spamDetails,
  spamFlag,
} = require("./_intake");

const SOURCE = "suedeai.org/book-a-call";
const SUCCESS_REDIRECT = "/book-a-call/thanks/";

function buildAutoresponder({ name, topic }) {
  const hi = name ? ` ${name}` : "";
  const lines = [
    `Hi${hi},`,
    "",
    "Thanks for the call request — I read these personally.",
    "",
    topic
      ? `I'll reply from this address within 1-2 business days with times that work to talk about ${topic.toLowerCase()}.`
      : "I'll reply from this address within 1-2 business days with times that work.",
    "",
    "In the meantime, the full preview of Stake Your Claim is here: https://suedeai.org/full-preview/",
    "",
    "— Jason",
    "https://suedeai.org/",
  ];
  return { subject: "Got your call request — Suede AI", text: lines.join("\n") };
}

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const fields = getRequestFields(req);
  // One id per submission, made before any write (see newEventId).
  const eventId = newEventId("book-call");
  const submittedAt = new Date().toISOString();

  const name = normalizeText(fields.name);
  const email = normalizeText(fields.email);
  const topic = normalizeText(fields.topic);
  const company = normalizeText(fields.company);
  const message = normalizeText(fields.message);
  const timeframe = normalizeText(fields.timeframe);

  const honeypot = Boolean(normalizeText(fields.company_url));
  const gate = assessSubmission({ form: "book-call", fields, headers: req.headers });

  const intakeEvent = ({ stored, suspectedSpam }) =>
    buildIntakeEvent({
      id: eventId,
      kind: "booking",
      property: "suedeai.org",
      occurredAt: submittedAt,
      summary: `${reviewPrefix(gate)}Call request from ${name || email || "unknown"}${topic ? `: ${topic}` : ""}`,
      email,
      name,
      details: {
        form: "book-call",
        topic,
        company,
        timeframe,
        message,
        source: SOURCE,
        stored_in_supabase: stored,
        ...spamDetails(honeypot, gate),
      },
      attribution: attributionFrom(fields),
      suspectedSpam,
    });

  // Honeypot: a hidden field humans never fill. Everything else is scored by
  // the spam gate. Either way a bot gets the same success answer a person
  // gets and nothing is stored or emailed here; the submission goes to the
  // intake hub flagged as suspected spam, for its daily digest.
  if (honeypot || gate.verdict === "drop") {
    logDrop(honeypot ? { ...gate, reasons: ["honeypot", ...gate.reasons] } : gate, fields);
    await forwardToIntake(intakeEvent({ stored: false, suspectedSpam: spamFlag(honeypot, gate) }));
    if (wantsJson(req)) {
      sendJson(res, 200, { ok: true, redirectTo: SUCCESS_REDIRECT });
      return;
    }
    redirect(res, SUCCESS_REDIRECT);
    return;
  }

  if (!name || !message || !email || !isValidEmail(email)) {
    const errorMessage = "Name, email, and message are required.";
    if (wantsJson(req)) {
      sendJson(res, 400, { error: errorMessage });
      return;
    }
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(errorMessage);
    return;
  }

  const table = process.env.SUPABASE_CALL_TABLE || "call_requests";
  const result = await insertRow(table, {
    name,
    email,
    topic,
    company,
    message,
    timeframe,
    source: SOURCE,
    submitted_at: submittedAt,
  });
  const forwarded = await forwardToIntake(intakeEvent({ stored: result.ok }));

  if (!settleCapture("book-call", eventId, result, forwarded)) {
    if (wantsJson(req)) {
      sendJson(res, result.status, result.payload);
      return;
    }
    res.statusCode = result.status;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(result.payload.error || "Submission failed.");
    return;
  }

  const sender = getEnv("BOOK_EMAIL_FROM") || getEnv("CONTACT_EMAIL_FROM");
  const notifyTo = getEnv("CALL_NOTIFY_TO") || getEnv("CONTACT_NOTIFY_TO");

  if (sender && notifyTo) {
    const summary = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${topic || "(none)"}`,
      `Company: ${company || "(none)"}`,
      `Timeframe: ${timeframe || "(none)"}`,
      "",
      message,
    ].join("\n");

    const notifyResult = await sendEmail({
      from: sender,
      to: [notifyTo],
      subject: `${reviewPrefix(gate)}New call request${topic ? `: ${topic}` : ""}`,
      text: summary + reviewNote(gate),
      reply_to: email,
    });

    if (!notifyResult || !notifyResult.ok) {
      console.error("[book-call] email notification failed", {
        status: notifyResult && notifyResult.status,
        payload: notifyResult && notifyResult.payload,
      });
    }
  }

  if (sender) {
    const auto = buildAutoresponder({ name, topic });
    const autoResult = await sendEmail({
      from: sender,
      to: [email],
      subject: auto.subject,
      text: auto.text,
      reply_to: notifyTo || sender,
    });

    if (!autoResult || !autoResult.ok) {
      console.error("[book-call] autoresponder failed", {
        status: autoResult && autoResult.status,
        payload: autoResult && autoResult.payload,
      });
    }
  }

  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: SUCCESS_REDIRECT });
    return;
  }

  redirect(res, SUCCESS_REDIRECT);
};
