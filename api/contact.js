const {
  allowPostOnly,
  getEnv,
  insertRow,
  normalizeText,
  sendEmail,
  sendJson,
} = require("./_shared");

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const name = normalizeText(req.body?.name);
  const email = normalizeText(req.body?.email);
  const topic = normalizeText(req.body?.topic);
  const message = normalizeText(req.body?.message);

  if (!name || !message || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    sendJson(res, 400, { error: "Name, email, and message are required." });
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
    sendJson(res, result.status, result.payload);
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

  sendJson(res, 200, { ok: true, redirectTo: "/contact/thanks/" });
};
