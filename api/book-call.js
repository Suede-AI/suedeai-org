const {
  allowPostOnly,
  getEnv,
  getRequestFields,
  insertRow,
  normalizeText,
  redirect,
  sendEmail,
  sendJson,
  wantsJson,
} = require("./_shared");

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
  return { subject: "Got your call request — Suede Labs", text: lines.join("\n") };
}

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const fields = getRequestFields(req);

  // Honeypot: a hidden field humans never fill. If present, succeed without storing.
  if (normalizeText(fields.company_url)) {
    if (wantsJson(req)) {
      sendJson(res, 200, { ok: true, redirectTo: SUCCESS_REDIRECT });
      return;
    }
    redirect(res, SUCCESS_REDIRECT);
    return;
  }

  const name = normalizeText(fields.name);
  const email = normalizeText(fields.email);
  const topic = normalizeText(fields.topic);
  const company = normalizeText(fields.company);
  const message = normalizeText(fields.message);
  const timeframe = normalizeText(fields.timeframe);

  if (!name || !message || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
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
    submitted_at: new Date().toISOString(),
  });

  if (!result.ok) {
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

    await sendEmail({
      from: sender,
      to: [notifyTo],
      subject: `New call request${topic ? `: ${topic}` : ""}`,
      text: summary,
      reply_to: email,
    });
  }

  if (sender) {
    const auto = buildAutoresponder({ name, topic });
    await sendEmail({
      from: sender,
      to: [email],
      subject: auto.subject,
      text: auto.text,
      reply_to: notifyTo || sender,
    });
  }

  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: SUCCESS_REDIRECT });
    return;
  }

  redirect(res, SUCCESS_REDIRECT);
};
