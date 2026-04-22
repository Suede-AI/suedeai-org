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

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const fields = getRequestFields(req);
  const name = normalizeText(fields.name);
  const email = normalizeText(fields.email);
  const topic = normalizeText(fields.topic);
  const message = normalizeText(fields.message);

  if (!name || !message || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
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
    source: "suedeai.org",
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

  const notifyTo = getEnv("CONTACT_NOTIFY_TO");
  const sender = getEnv("CONTACT_EMAIL_FROM");

  if (notifyTo && sender) {
    await sendEmail({
      from: sender,
      to: [notifyTo],
      subject: `New suedeai.org contact${topic ? `: ${topic}` : ""}`,
      text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic || "(none)"}\n\n${message}`,
      reply_to: email,
    });
  }

  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: "/contact/thanks/" });
    return;
  }

  redirect(res, "/contact/thanks/");
};
