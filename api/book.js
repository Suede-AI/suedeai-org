const {
  allowPostOnly,
  insertRow,
  normalizeText,
  sendJson,
} = require("./_shared");

module.exports = async (req, res) => {
  if (!allowPostOnly(req, res)) {
    return;
  }

  const email = normalizeText(req.body?.email);
  const name = normalizeText(req.body?.name);
  const context = normalizeText(req.body?.context);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    sendJson(res, 400, { error: "Valid email is required." });
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
    sendJson(res, result.status, result.payload);
    return;
  }

  sendJson(res, 200, { ok: true, redirectTo: "/book/thanks/" });
};
