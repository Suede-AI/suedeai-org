function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function insertRow(table, row) {
  const config = getSupabaseConfig();

  if (!config) {
    return {
      ok: false,
      status: 503,
      payload: {
        error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
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
  insertRow,
  normalizeText,
  sendJson,
};
