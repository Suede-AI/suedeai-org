const {
  allowPostOnly,
  escapeHtml,
  getEnv,
  getRequestFields,
  insertRow,
  normalizeText,
  redirect,
  sendEmail,
  sendJson,
  wantsJson,
} = require("./_shared");

const SHARP_EXCERPT_URL = "https://suedeai.org/sharp-excerpt/";
const FULL_PREVIEW_URL = "https://suedeai.org/full-preview/";
const PREVIEW_PDF_URL = "https://suedeai.org/assets/files/stake-your-claim-condensed-preview.pdf";

function buildReaderPreviewEmail({ name }) {
  const greetingName = name ? ` ${escapeHtml(name)}` : "";
  const textGreeting = name ? ` ${name}` : "";

  return {
    subject: "Stake Your Claim reader preview",
    text: [
      `Hi${textGreeting},`,
      "",
      "Here is the Suede reader preview for Stake Your Claim.",
      "",
      `Sharp excerpt: ${SHARP_EXCERPT_URL}`,
      `Full preview: ${FULL_PREVIEW_URL}`,
      `Condensed preview PDF: ${PREVIEW_PDF_URL}`,
      "",
      "The preview covers AI ownership, authorship, provenance, creator rights, agents, and durable assets.",
      "",
      "Suede",
    ].join("\n"),
    html: [
      `<p>Hi${greetingName},</p>`,
      "<p>Here is the Suede reader preview for <em>Stake Your Claim</em>.</p>",
      "<ul>",
      `<li><a href="${SHARP_EXCERPT_URL}">Sharp excerpt</a></li>`,
      `<li><a href="${FULL_PREVIEW_URL}">Full preview</a></li>`,
      `<li><a href="${PREVIEW_PDF_URL}">Condensed preview PDF</a></li>`,
      "</ul>",
      "<p>The preview covers AI ownership, authorship, provenance, creator rights, agents, and durable assets.</p>",
      "<p>Suede</p>",
    ].join(""),
  };
}

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const fields = getRequestFields(req);
  const email = normalizeText(fields.email);
  const name = normalizeText(fields.name);
  const context = normalizeText(fields.context);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    if (wantsJson(req)) {
      sendJson(res, 400, { error: "Valid email is required." });
      return;
    }

    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Valid email is required.");
    return;
  }

  const table = process.env.SUPABASE_BOOK_TABLE || "book_leads";
  const result = await insertRow(table, {
    email,
    name,
    context,
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

  const sender = getEnv("BOOK_EMAIL_FROM") || getEnv("CONTACT_EMAIL_FROM");
  const canSendReaderEmail = sender && getEnv("RESEND_API_KEY");

  if (canSendReaderEmail) {
    const emailTemplate = buildReaderPreviewEmail({ name });
    await sendEmail({
      from: sender,
      to: [email],
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
      reply_to: "info@suedeai.org",
    });
  }

  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: "/book/thanks/" });
    return;
  }

  redirect(res, "/book/thanks/");
};
