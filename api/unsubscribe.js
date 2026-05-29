const { getEnv } = require("./_shared.js");

function page(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<meta name="robots" content="noindex, nofollow"><title>${title} | Suede</title>`
    + `<link rel="stylesheet" href="/assets/css/site.css"></head>`
    + `<body><main class="site-shell"><section class="section"><article class="panel">`
    + `<h1>${title}</h1><p>${body}</p><p><a class="button button--secondary" href="https://suedeai.org/">Back to Suede</a></p>`
    + `</article></section></main></body></html>`;
}

function getToken(req) {
  try {
    const u = new URL(req.url, "https://suedeai.org");
    const q = u.searchParams.get("token");
    if (q) return q.trim();
  } catch (_) {}
  if (req.body && typeof req.body === "object" && req.body.token) return String(req.body.token).trim();
  if (typeof req.body === "string") {
    const m = req.body.match(/token=([^&\s]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return "";
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405; res.end("Method not allowed."); return;
  }
  const token = getToken(req);
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_PUBLISHABLE_KEY") || getEnv("SUPABASE_ANON_KEY");

  if (token && url && key) {
    try {
      await fetch(`${url}/rest/v1/rpc/marketing_unsubscribe`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: token }),
      });
    } catch (_) { /* generic success either way — no enumeration signal */ }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(page("You&rsquo;re unsubscribed",
    "You won&rsquo;t receive further re-engagement emails from Suede. If this was a mistake, just reply to any Suede email and we&rsquo;ll sort it out."));
};
