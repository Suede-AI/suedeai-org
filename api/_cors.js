// CORS for a handler that a sibling site posts to cross-origin.
//
// Only api/investors.js uses this: the investor form on suedeai.ai posts to
// suedeai.org so both sites share one system of record. Every other handler
// stays same-origin and keeps answering OPTIONS with 405 via allowPostOnly.
//
// Origins match exactly (scheme, host, no path, no wildcard). A request from
// any other origin gets no Access-Control-Allow-Origin header, so the browser
// refuses to hand the response to the calling page.

const PREFLIGHT_MAX_AGE_SECONDS = 600;

function requestOrigin(req) {
  return String((req.headers && req.headers.origin) || "").trim();
}

// Sets Vary: Origin always (the answer depends on it) and the allow-origin
// header only when the caller is on the list. Returns whether it was allowed.
function applyCors(req, res, allowedOrigins) {
  res.setHeader("Vary", "Origin");
  const origin = requestOrigin(req);
  if (!origin || !allowedOrigins.includes(origin)) {
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  return true;
}

// Answers an OPTIONS preflight. Returns true when it handled the request, so
// the caller returns before allowPostOnly would answer 405.
function handlePreflight(req, res, allowedOrigins) {
  if (req.method !== "OPTIONS") {
    return false;
  }
  if (applyCors(req, res, allowedOrigins)) {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Max-Age", String(PREFLIGHT_MAX_AGE_SECONDS));
  }
  res.setHeader("Allow", "POST, OPTIONS");
  res.statusCode = 204;
  res.end("");
  return true;
}

module.exports = { applyCors, handlePreflight, PREFLIGHT_MAX_AGE_SECONDS };
