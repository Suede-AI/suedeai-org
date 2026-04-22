function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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

  const response = await fetch(`${config.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

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

function allowPostOnly(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return false;
  }

  return true;
}

module.exports = {
  allowPostOnly,
  escapeHtml,
  getEnv,
  insertRow,
  normalizeText,
  sendEmail,
  sendJson,
};
