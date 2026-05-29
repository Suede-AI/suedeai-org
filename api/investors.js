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

const SOURCE = "suedeai.org/investors";
const SUCCESS_REDIRECT = "/investors/thanks/";

function buildIntent(fields) {
  const parts = [];
  if (normalizeText(fields.intent_intro)) parts.push("intro");
  if (normalizeText(fields.intent_deck)) parts.push("deck");
  if (normalizeText(fields.intent_call)) parts.push("call");
  return parts.join(",");
}

function buildAutoresponder({ name, deckUrl, calendarUrl }) {
  const hi = name ? ` ${name}` : "";
  const lines = [
    `Hi${hi},`,
    "",
    "Thank you for your interest in Suede Labs AI. We build the ownership and settlement layer for the AI media era: proof of creation, programmable IP, provenance, royalty routing, and agent commerce.",
    "",
  ];
  if (deckUrl) lines.push(`Investor materials: ${deckUrl}`);
  if (calendarUrl) lines.push(`Book an intro call: ${calendarUrl}`);
  if (!deckUrl && !calendarUrl) {
    lines.push("Our team will follow up shortly with materials and next steps.");
  }
  lines.push("", "Suede Labs AI", "https://suedeai.org/");
  return { subject: "Suede Labs AI — investor materials", text: lines.join("\n") };
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
  const firm = normalizeText(fields.firm);
  const role = normalizeText(fields.role);
  const investorType = normalizeText(fields.investor_type);
  const checkSize = normalizeText(fields.check_size);
  const timeline = normalizeText(fields.timeline);
  const website = normalizeText(fields.website);
  const message = normalizeText(fields.message);
  const intent = buildIntent(fields);
  const consentMarketing = Boolean(normalizeText(fields.consent));
  const utmSource = normalizeText(fields.utm_source);
  const utmCampaign = normalizeText(fields.utm_campaign);

  if (!name || !firm || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const errorMessage = "Name, email, and firm are required.";
    if (wantsJson(req)) {
      sendJson(res, 400, { error: errorMessage });
      return;
    }
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(errorMessage);
    return;
  }

  const table = process.env.SUPABASE_INVESTOR_TABLE || "investor_leads";
  const result = await insertRow(table, {
    name,
    email,
    firm,
    role,
    investor_type: investorType,
    check_size: checkSize,
    timeline,
    intent,
    website,
    message,
    consent_marketing: consentMarketing,
    source: SOURCE,
    utm_source: utmSource,
    utm_campaign: utmCampaign,
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

  const sender = getEnv("INVESTOR_EMAIL_FROM");
  const notifyTo = getEnv("INVESTOR_NOTIFY_TO");

  if (sender && notifyTo) {
    const summary = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Firm: ${firm}`,
      `Role: ${role || "(none)"}`,
      `Investor type: ${investorType || "(none)"}`,
      `Check size: ${checkSize || "(none)"}`,
      `Timeline: ${timeline || "(none)"}`,
      `Intent: ${intent || "(none)"}`,
      `Website: ${website || "(none)"}`,
      `UTM: ${utmSource || "-"} / ${utmCampaign || "-"}`,
      `Consent: ${consentMarketing ? "yes" : "no"}`,
      "",
      message || "(no message)",
    ].join("\n");

    await sendEmail({
      from: sender,
      to: [notifyTo],
      subject: `New investor lead: ${firm}${checkSize ? ` [${checkSize}]` : ""}`,
      text: summary,
      reply_to: email,
    });
  }

  if (sender && getEnv("INVESTOR_AUTORESPONDER") === "true") {
    const auto = buildAutoresponder({
      name,
      deckUrl: getEnv("INVESTOR_DECK_URL"),
      calendarUrl: getEnv("INVESTOR_CALENDAR_URL"),
    });
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
