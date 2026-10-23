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

const SOURCE = "suedeai.org";
const SUCCESS_REDIRECT = "/contact/thanks/";

function sendSuccess(req, res) {
  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: SUCCESS_REDIRECT });
    return;
  }
  redirect(res, SUCCESS_REDIRECT);
}

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const fields = getRequestFields(req);
  // One id per submission, made before any write (see newEventId).
  const eventId = newEventId("contact");
  const submittedAt = new Date().toISOString();

  const name = normalizeText(fields.name);
  const email = normalizeText(fields.email);
  const topic = normalizeText(fields.topic);
  const message = normalizeText(fields.message);

  const honeypot = Boolean(normalizeText(fields.company_url));
  const gate = assessSubmission({ form: "contact", fields, headers: req.headers });

  const intakeEvent = ({ stored, suspectedSpam }) =>
    buildIntakeEvent({
      id: eventId,
      kind: "lead",
      property: SOURCE,
      occurredAt: submittedAt,
      summary: `${reviewPrefix(gate)}Contact from ${name || email || "unknown"}${topic ? `: ${topic}` : ""}`,
      email,
      name,
      details: {
        form: "contact",
        topic,
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
    sendSuccess(req, res);
    return;
  }

  if (!name || !message || !email || !isValidEmail(email)) {
    if (wantsJson(req)) {
      sendJson(res, 400, { error: "Name, email, and message are required." });
      return;
    }

    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Name, email, and message are required.");
    return;
  }

  const table = process.env.SUPABASE_CONTACT_TABLE || "contact_inquiries";
  const result = await insertRow(table, {
    name,
    email,
    topic,
    message,
    source: SOURCE,
    submitted_at: submittedAt,
  });
  const forwarded = await forwardToIntake(intakeEvent({ stored: result.ok }));

  if (!settleCapture("contact", eventId, result, forwarded)) {
    if (wantsJson(req)) {
      sendJson(res, result.status, result.payload);
      return;
    }

    res.statusCode = result.status;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(result.payload.error || "Submission failed.");
    return;
  }

  const notifyTo = getEnv("CONTACT_NOTIFY_TO");
  const sender = getEnv("CONTACT_EMAIL_FROM");

  if (notifyTo && sender) {
    const emailResult = await sendEmail({
      from: sender,
      to: [notifyTo],
      subject: `${reviewPrefix(gate)}New suedeai.org contact${topic ? `: ${topic}` : ""}`,
      text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic || "(none)"}\n\n${message}${reviewNote(gate)}`,
      reply_to: email,
    });

    if (!emailResult || !emailResult.ok) {
      console.error("[contact] email notification failed", {
        status: emailResult && emailResult.status,
        payload: emailResult && emailResult.payload,
      });
    }
  }

  sendSuccess(req, res);
};
