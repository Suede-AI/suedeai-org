const TARGET_ENV = {
  deck: "INVESTOR_DECK_URL",
  call: "INVESTOR_CALENDAR_URL",
};
const FALLBACK = "/contact/";

module.exports = async (req, res) => {
  const parsed = new URL(req.url, "https://suedeai.org");
  const target = parsed.searchParams.get("target") || "";
  const envName = TARGET_ENV[target];
  const configured = envName ? String(process.env[envName] || "").trim() : "";
  const destination = configured || FALLBACK;

  res.statusCode = 302;
  res.setHeader("Location", destination);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};
