function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.end("");
}

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

function getSupabaseConfig() {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_PUBLISHABLE_KEY") || getEnv("SUPABASE_ANON_KEY");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

function getResendConfig() {
  const apiKey = getEnv("RESEND_API_KEY");

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}

async function insertRow(table, row) {
  const config = getSupabaseConfig();

  if (!config) {
    return {
      ok: false,
      status: 503,
      payload: {
        error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
      },
    };
  }

  let response;
  try {
    response = await fetch(`${config.url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      payload: { error: "Supabase insert failed.", details: String(error && error.message) },
    };
  }

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      payload: {
        error: "Supabase insert failed.",
        details: text,
      },
    };
  }

  return { ok: true };
}

async function sendEmail(payload) {
  const config = getResendConfig();

  if (!config) {
    return {
      ok: false,
      status: 503,
      payload: {
        error: "Email delivery is not configured. Set RESEND_API_KEY and sender details.",
      },
    };
  }

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // A network failure must not throw past the handler and turn a stored
    // lead into a 500 for the visitor.
    return {
      ok: false,
      status: 502,
      payload: { error: "Email delivery failed.", details: String(error && error.message) },
    };
  }

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      payload: {
        error: "Email delivery failed.",
        details: text,
      },
    };
  }

  return { ok: true };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function isValidEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || ""));
}

function allowPostOnly(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return false;
  }

  return true;
}

function readField(source, key) {
  return source && Object.prototype.hasOwnProperty.call(source, key) ? source[key] : "";
}

function parseFormEncoded(value) {
  const params = new URLSearchParams(String(value || ""));
  return Object.fromEntries(params.entries());
}

function getRequestFields(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body;
  }

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  const raw = req.body;

  if (typeof raw === "string" && raw) {
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      return parseFormEncoded(raw);
    }
  }

  return {};
}

// A lead is kept when either the database row or the team notification email
// lands. Only when both fail does the visitor see an error, and the error never
// carries the database's own text: that goes to the function log instead.
const LEAD_LOST_MESSAGE =
  "We could not send that just now. Please try again in a minute.";

function logInsertFailure(label, result) {
  console.error(`[${label}] lead insert failed`, {
    status: result && result.status,
    error: result && result.payload && result.payload.error,
    details: result && result.payload && result.payload.details,
  });
}

function sendLeadLost(req, res) {
  if (wantsJson(req)) {
    sendJson(res, 503, { error: LEAD_LOST_MESSAGE });
    return;
  }

  res.statusCode = 503;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(LEAD_LOST_MESSAGE);
}

function wantsJson(req) {
  const accept = String(req.headers.accept || "").toLowerCase();
  return accept.includes("application/json");
}

module.exports = {
  allowPostOnly,
  escapeHtml,
  getEnv,
  getRequestFields,
  insertRow,
  isValidEmail,
  LEAD_LOST_MESSAGE,
  logInsertFailure,
  normalizeText,
  redirect,
  sendEmail,
  sendJson,
  sendLeadLost,
  wantsJson,
};
