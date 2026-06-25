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
const COVER_IMG_URL = "https://suedeai.org/assets/img/stake-your-claim-cover.jpg";
const LOGO_IMG_URL = "https://suedeai.org/android-chrome-192x192.png";

function buildReaderPreviewEmail({ name }) {
  const greetingName = name ? ` ${escapeHtml(name)}` : "";
  const textGreeting = name ? ` ${name}` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#050b16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050b16;">
    <tr><td align="center" style="padding:32px 16px 0;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding-bottom:28px;">
          <img src="${LOGO_IMG_URL}" width="32" height="32" alt="Suede" style="display:block;border-radius:6px;">
        </td></tr>

        <!-- Cover image -->
        <tr><td style="border-radius:12px;overflow:hidden;line-height:0;">
          <img src="${COVER_IMG_URL}" width="560" alt="Stake Your Claim" style="display:block;width:100%;max-width:560px;border-radius:12px;">
        </td></tr>

        <!-- Body card -->
        <tr><td style="background-color:#09101b;border-radius:0 0 12px 12px;padding:36px 36px 32px;">

          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#22d3ee;">Reader Preview</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#eef2f7;line-height:1.25;">Stake Your Claim</h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#8a97a8;">Hi${greetingName}, your preview is ready. The book covers AI ownership, authorship, provenance, creator rights, and what durable assets look like in the agent economy.</p>

          <!-- CTAs -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding-bottom:12px;">
                <a href="${SHARP_EXCERPT_URL}" style="display:block;background-color:#9f101a;color:#eef2f7;text-decoration:none;font-size:14px;font-weight:600;text-align:center;padding:14px 20px;border-radius:8px;letter-spacing:0.01em;">Read the Sharp Excerpt →</a>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <a href="${FULL_PREVIEW_URL}" style="display:block;background-color:#0d1726;border:1px solid rgba(255,255,255,0.1);color:#eef2f7;text-decoration:none;font-size:14px;font-weight:600;text-align:center;padding:14px 20px;border-radius:8px;">Read the Full Preview</a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="${PREVIEW_PDF_URL}" style="display:block;background-color:#0d1726;border:1px solid rgba(255,255,255,0.1);color:#8a97a8;text-decoration:none;font-size:13px;font-weight:500;text-align:center;padding:12px 20px;border-radius:8px;">Download Condensed PDF</a>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:#3d4d5e;">
            <a href="https://suedeai.org" style="color:#22d3ee;text-decoration:none;">suedeai.org</a>
            &nbsp;·&nbsp;
            <a href="https://suedeai.ai" style="color:#22d3ee;text-decoration:none;">suedeai.ai</a>
          </p>
          <p style="margin:0;font-size:11px;color:#2a3542;">Creator ownership infrastructure for the AI media era.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: "Your Stake Your Claim reader preview",
    text: [
      `Hi${textGreeting},`,
      "",
      "Your reader preview for Stake Your Claim is ready.",
      "",
      `Sharp excerpt: ${SHARP_EXCERPT_URL}`,
      `Full preview: ${FULL_PREVIEW_URL}`,
      `Condensed preview PDF: ${PREVIEW_PDF_URL}`,
      "",
      "The book covers AI ownership, authorship, provenance, creator rights, and what durable assets look like in the agent economy.",
      "",
      "— Suede  |  suedeai.org",
    ].join("\n"),
    html,
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

  if (!sender || !getEnv("RESEND_API_KEY")) {
    if (wantsJson(req)) {
      sendJson(res, 503, { error: "Email delivery is not configured." });
      return;
    }
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Email delivery is not configured.");
    return;
  }

  const emailTemplate = buildReaderPreviewEmail({ name });
  const emailResult = await sendEmail({
    from: sender,
    to: [email],
    subject: emailTemplate.subject,
    text: emailTemplate.text,
    html: emailTemplate.html,
    reply_to: getEnv("BOOK_REPLY_TO") || sender,
  });

  if (!emailResult.ok) {
    if (wantsJson(req)) {
      sendJson(res, emailResult.status || 502, {
        error: "Submission was recorded, but email delivery failed.",
      });
      return;
    }
    res.statusCode = emailResult.status || 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Submission was recorded, but email delivery failed.");
    return;
  }

  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: "/book/thanks/" });
    return;
  }

  redirect(res, "/book/thanks/");
};
