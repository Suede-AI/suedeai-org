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
const { applyCors, handlePreflight } = require("./_cors");

const DEFAULT_SOURCE = "suedeai.org/investors";
// The form posts here from both sites. Anything else a client sends in
// `source` is ignored and recorded as the default.
const ALLOWED_SOURCES = [DEFAULT_SOURCE, "suedeai.ai/investors"];
// Origins allowed to call this endpoint cross-site (CORS) and never scored as
// foreign by the spam gate, even when FORM_ALLOWED_ORIGINS overrides the
// gate's defaults.
const CROSS_SITE_ORIGINS = ["https://suedeai.ai", "https://www.suedeai.ai"];
const SUCCESS_REDIRECT = "/investors/thanks/";

function resolveSource(fields) {
  const requested = normalizeText(fields.source).toLowerCase();
  return ALLOWED_SOURCES.includes(requested) ? requested : DEFAULT_SOURCE;
}

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
    "Thank you for your interest in Suede AI. We build the ownership and settlement layer for the AI media era: proof of creation, programmable IP, provenance, royalty routing, and agent commerce.",
    "",
  ];
  if (deckUrl) lines.push(`Investor materials: ${deckUrl}`);
  if (calendarUrl) lines.push(`Book an intro call: ${calendarUrl}`);
  if (!deckUrl && !calendarUrl) {
    lines.push("Our team will follow up shortly with materials and next steps.");
  }
  lines.push("", "Suede AI", "https://suedeai.org/");
  return { subject: "Suede AI — investor materials", text: lines.join("\n") };
}

module.exports = async (req, res) => {
  if (handlePreflight(req, res, CROSS_SITE_ORIGINS)) {
    return;
  }
  // Before allowPostOnly so the 405 carries the header too: every answer to an
  // allowed origin must, or the calling page cannot read it.
  applyCors(req, res, CROSS_SITE_ORIGINS);

  if (!allowPostOnly(req, res)) {
    return;
  }

  const fields = getRequestFields(req);

  // Honeypot: a hidden field humans never fill. Everything else is scored by
  // the spam gate. Either way a bot gets the same success answer a person
  // gets, and nothing is stored or emailed.
  const honeypot = Boolean(normalizeText(fields.company_url));
  const gate = assessSubmission({
    form: "investors",
    fields,
    headers: req.headers,
    extraOrigins: CROSS_SITE_ORIGINS,
  });
  if (honeypot || gate.verdict === "drop") {
    logDrop(honeypot ? { ...gate, reasons: ["honeypot", ...gate.reasons] } : gate, fields);
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
  const source = resolveSource(fields);

  if (!name || !firm || !email || !isValidEmail(email)) {
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
  const row = {
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
    source,
    utm_source: utmSource,
    utm_campaign: utmCampaign,
    submitted_at: new Date().toISOString(),
  };
  let result = await insertRow(table, row);
  let storedSource = source;

  // The table's insert policy pins `source` to an allowlist. Until the policy
  // that admits "suedeai.ai/investors" is applied (supabase/schema.sql), an
  // insert with it is refused as 401/403. Store the lead under the default
  // source rather than lose it; the email still names where it came from.
  if (!result.ok && source !== DEFAULT_SOURCE && (result.status === 401 || result.status === 403)) {
    console.warn("[investors] source rejected by insert policy, stored as default", { source });
    storedSource = DEFAULT_SOURCE;
    result = await insertRow(table, { ...row, source: DEFAULT_SOURCE });
  }

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
      `Source: ${source}${storedSource !== source ? ` (stored as ${storedSource})` : ""}`,
      `UTM: ${utmSource || "-"} / ${utmCampaign || "-"}`,
      `Consent: ${consentMarketing ? "yes" : "no"}`,
      "",
      message || "(no message)",
    ].join("\n");

    await sendEmail({
      from: sender,
      to: [notifyTo],
      subject: `${reviewPrefix(gate)}New investor lead: ${firm}${checkSize ? ` [${checkSize}]` : ""}`,
      text: summary + reviewNote(gate),
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
