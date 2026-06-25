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

    <!-- ── Hero ── -->
    <tr><td style="line-height:0;border-radius:14px;overflow:hidden;">
      <img src="${COVER_IMG_URL}" width="560" alt="Stake Your Claim" style="display:block;width:100%;max-width:560px;border-radius:14px;">
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

    <!-- ── Item 01: Sharp Excerpt ── -->
    <tr><td style="padding-bottom:10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1726" style="border-radius:12px;border:1px solid #141e2e;">
        <tr>
          <!-- Red accent bar -->
          <td width="4" bgcolor="#9f101a" style="width:4px;border-radius:12px 0 0 12px;font-size:0;">&nbsp;</td>
          <!-- Content -->
          <td style="padding:22px 22px 22px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:16px;">
                  <!-- Number badge -->
                  <div style="display:inline-block;background-color:#9f101a;color:#eef2f7;font-size:10px;font-weight:800;letter-spacing:0.08em;padding:3px 8px;border-radius:4px;line-height:1.4;">01</div>
                </td>
                <td style="vertical-align:top;width:100%;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#d11f2b;">Sharp Excerpt</p>
                  <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#eef2f7;line-height:1.3;">The sharpest cut.</p>
                  <p style="margin:0 0 16px;font-size:13px;color:#8a97a8;line-height:1.6;">Six pages. What AI ownership actually means, and why authorship is the new moat.</p>
                  <a href="${SHARP_EXCERPT_URL}" style="display:inline-block;background-color:#9f101a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 18px;border-radius:7px;letter-spacing:0.01em;">Read now &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ── Item 02: Full Preview ── -->
    <tr><td style="padding-bottom:10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1726" style="border-radius:12px;border:1px solid #141e2e;">
        <tr>
          <!-- Cyan accent bar -->
          <td width="4" bgcolor="#22d3ee" style="width:4px;border-radius:12px 0 0 12px;font-size:0;">&nbsp;</td>
          <!-- Content -->
          <td style="padding:22px 22px 22px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:16px;">
                  <div style="display:inline-block;background-color:#0a2330;border:1px solid #22d3ee;color:#22d3ee;font-size:10px;font-weight:800;letter-spacing:0.08em;padding:3px 8px;border-radius:4px;line-height:1.4;">02</div>
                </td>
                <td style="vertical-align:top;width:100%;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#22d3ee;">Full Preview</p>
                  <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#eef2f7;line-height:1.3;">The complete reader preview.</p>
                  <p style="margin:0 0 16px;font-size:13px;color:#8a97a8;line-height:1.6;">40+ pages covering AI authorship, provenance, licensing infrastructure, royalty routing, and agent commerce.</p>
                  <a href="${FULL_PREVIEW_URL}" style="display:inline-block;background-color:#0a2330;border:1px solid #22d3ee;color:#22d3ee;text-decoration:none;font-size:13px;font-weight:700;padding:10px 18px;border-radius:7px;letter-spacing:0.01em;">Read now &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ── Item 03: PDF ── -->
    <tr><td style="padding-bottom:32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1726" style="border-radius:12px;border:1px solid #141e2e;">
        <tr>
          <!-- Muted accent bar -->
          <td width="4" bgcolor="#2a3542" style="width:4px;border-radius:12px 0 0 12px;font-size:0;">&nbsp;</td>
          <!-- Content -->
          <td style="padding:22px 22px 22px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:16px;">
                  <div style="display:inline-block;background-color:#141e2e;border:1px solid #2a3542;color:#8a97a8;font-size:10px;font-weight:800;letter-spacing:0.08em;padding:3px 8px;border-radius:4px;line-height:1.4;">03</div>
                </td>
                <td style="vertical-align:top;width:100%;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8a97a8;">Condensed PDF</p>
                  <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#eef2f7;line-height:1.3;">Portable. Keep it.</p>
                  <p style="margin:0 0 16px;font-size:13px;color:#8a97a8;line-height:1.6;">A condensed take on the full preview. Download and reference it anywhere.</p>
                  <a href="${PREVIEW_PDF_URL}" style="display:inline-block;background-color:#141e2e;border:1px solid #2a3542;color:#8a97a8;text-decoration:none;font-size:13px;font-weight:700;padding:10px 18px;border-radius:7px;letter-spacing:0.01em;">Download PDF &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
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
