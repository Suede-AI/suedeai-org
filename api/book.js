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
const BOOK_A_CALL_URL = "https://suedeai.org/book-a-call/";
const BOX_IMG_URL = "https://suedeai.org/assets/img/stake-your-claim-box.png";
const LOGO_IMG_URL = "https://suedeai.org/android-chrome-192x192.png";

function buildReaderPreviewEmail({ name }) {
  const greetingName = name ? ` ${escapeHtml(name)}` : "";
  const textGreeting = name ? ` ${name}` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Your Stake Your Claim preview</title>
</head>
<body style="margin:0;padding:0;background-color:#050b16;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050b16">
<tr><td align="center" style="padding:40px 16px 48px;">

  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

    <!-- ── Wordmark ── -->
    <tr><td style="padding-bottom:32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${LOGO_IMG_URL}" width="28" height="28" alt="" style="display:block;border-radius:5px;">
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:15px;font-weight:700;color:#eef2f7;letter-spacing:-0.01em;">Suede</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ── Box hero ── -->
    <tr><td style="line-height:0;text-align:center;padding-bottom:8px;">
      <img src="${BOX_IMG_URL}" width="400" alt="Stake Your Claim" style="display:block;margin:0 auto;width:100%;max-width:400px;">
    </td></tr>

    <!-- ── Headline ── -->
    <tr><td style="padding:32px 0 8px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;color:#22d3ee;">Your preview is ready</p>
      <h1 style="margin:0 0 14px;font-size:30px;font-weight:800;color:#eef2f7;line-height:1.15;letter-spacing:-0.02em;">Stake Your Claim</h1>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#8a97a8;">Hi${greetingName} — three items are waiting for you below. AI ownership, authorship, provenance, creator rights, and what durable assets look like in the agent economy.</p>
    </td></tr>

    <!-- ── Divider ── -->
    <tr><td style="padding:28px 0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-top:1px solid #141e2e;font-size:0;">&nbsp;</td>
          <td style="white-space:nowrap;padding:0 14px;">
            <span style="font-size:10px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:#3d4d5e;">3 items in your preview</span>
          </td>
          <td style="border-top:1px solid #141e2e;font-size:0;">&nbsp;</td>
        </tr>
      </table>
    </td></tr>

    <!-- ── Items ── -->
    <tr><td style="padding-bottom:32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

        <!-- Sharp Excerpt -->
        <tr><td style="padding-bottom:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1726" style="border-radius:10px;border:1px solid #141e2e;">
            <tr>
              <td width="3" bgcolor="#9f101a" style="width:3px;border-radius:10px 0 0 10px;font-size:0;">&nbsp;</td>
              <td style="padding:16px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td>
                    <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#eef2f7;">Sharp Excerpt</p>
                    <p style="margin:0;font-size:13px;color:#8a97a8;line-height:1.5;">Six pages. What AI ownership actually means.</p>
                  </td>
                  <td style="text-align:right;white-space:nowrap;padding-left:16px;">
                    <a href="${SHARP_EXCERPT_URL}" style="font-size:13px;font-weight:600;color:#d11f2b;text-decoration:none;">Read &rarr;</a>
                  </td>
                </tr></table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Full Preview -->
        <tr><td style="padding-bottom:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1726" style="border-radius:10px;border:1px solid #141e2e;">
            <tr>
              <td width="3" bgcolor="#22d3ee" style="width:3px;border-radius:10px 0 0 10px;font-size:0;">&nbsp;</td>
              <td style="padding:16px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td>
                    <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#eef2f7;">Full Preview</p>
                    <p style="margin:0;font-size:13px;color:#8a97a8;line-height:1.5;">40+ pages — authorship, provenance, rights, agent commerce.</p>
                  </td>
                  <td style="text-align:right;white-space:nowrap;padding-left:16px;">
                    <a href="${FULL_PREVIEW_URL}" style="font-size:13px;font-weight:600;color:#22d3ee;text-decoration:none;">Read &rarr;</a>
                  </td>
                </tr></table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Condensed PDF -->
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1726" style="border-radius:10px;border:1px solid #141e2e;">
            <tr>
              <td width="3" bgcolor="#2a3542" style="width:3px;border-radius:10px 0 0 10px;font-size:0;">&nbsp;</td>
              <td style="padding:16px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td>
                    <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#eef2f7;">Condensed PDF</p>
                    <p style="margin:0;font-size:13px;color:#8a97a8;line-height:1.5;">Portable version — download and keep.</p>
                  </td>
                  <td style="text-align:right;white-space:nowrap;padding-left:16px;">
                    <a href="${PREVIEW_PDF_URL}" style="font-size:13px;font-weight:600;color:#8a97a8;text-decoration:none;">Download &rarr;</a>
                  </td>
                </tr></table>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>

    <!-- ── Book a call CTA ── -->
    <tr><td style="padding-bottom:32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1726" style="border-radius:10px;border:1px solid #22d3ee;">
        <tr><td style="padding:22px 22px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#22d3ee;">Want to talk it through?</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#8a97a8;">Book a call with Jason — partnerships, investing, rights and licensing, or just your reaction to the book.</p>
          <a href="${BOOK_A_CALL_URL}" style="display:inline-block;background-color:#22d3ee;color:#050b16;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Book a Call &rarr;</a>
        </td></tr>
      </table>
    </td></tr>

    <!-- ── Footer ── -->
    <tr><td style="border-top:1px solid #141e2e;padding-top:28px;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;color:#3d4d5e;">
        <a href="https://suedeai.org" style="color:#22d3ee;text-decoration:none;font-weight:600;">suedeai.org</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="https://suedeai.ai" style="color:#22d3ee;text-decoration:none;font-weight:600;">suedeai.ai</a>
      </p>
      <p style="margin:0;font-size:11px;color:#2a3542;line-height:1.6;">Creator ownership infrastructure for the AI media era.<br>You&rsquo;re receiving this because you requested the preview.</p>
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
      "Your reader preview for Stake Your Claim is ready — three items below.",
      "",
      "01 — Sharp Excerpt (6 pages)",
      `   ${SHARP_EXCERPT_URL}`,
      "",
      "02 — Full Preview (40+ pages)",
      `   ${FULL_PREVIEW_URL}`,
      "",
      "03 — Condensed PDF",
      `   ${PREVIEW_PDF_URL}`,
      "",
      "AI ownership, authorship, provenance, creator rights, and what durable assets look like in the agent economy.",
      "",
      "Want to talk it through? Book a call with Jason:",
      `   ${BOOK_A_CALL_URL}`,
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
