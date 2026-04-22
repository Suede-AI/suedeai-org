const {
  allowPostOnly,
  getRequestFields,
  insertRow,
  normalizeText,
  redirect,
  sendJson,
  wantsJson,
} = require("./_shared");

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

  if (wantsJson(req)) {
    sendJson(res, 200, { ok: true, redirectTo: "/book/thanks/" });
    return;
  }

  redirect(res, "/book/thanks/");
};
