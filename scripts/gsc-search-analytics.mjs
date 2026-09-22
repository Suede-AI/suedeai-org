#!/usr/bin/env node
// Query Search Console's Search Analytics API with a service account.
//
// This exists because the impressions decline on suedeai.org (~60/day across
// Mar-Apr 2026 down to ~33/day over the following 30 days) could not be
// explained from the repository, and the Performance report is the only thing
// that can attribute it to specific pages.
//
// Scope note, so nobody expects more from this than it gives: the Search
// Console API has NO page-indexing/coverage endpoint. The per-reason URL lists
// behind "Not found (404)", "Page with redirect", "Discovered - currently not
// indexed" and "Crawled - currently not indexed" are UI-only exports and a
// service account cannot reach them. This script covers searchanalytics.query
// and sites.list, which is what the API does expose.
//
// Usage:
//   node scripts/gsc-search-analytics.mjs --list-sites
//   node scripts/gsc-search-analytics.mjs --site 'sc-domain:suedeai.org'
//   node scripts/gsc-search-analytics.mjs --site 'https://suedeai.org/' \
//     --start 2026-08-22 --end 2026-09-18 \
//     --compare-start 2026-03-01 --compare-end 2026-04-30
//
// In comparison mode the ranges need not be equal in length: metrics are
// reported per-day so a 28-day window and a 61-day baseline compare honestly.
//
// Credentials, in precedence order:
//   GSC_SERVICE_ACCOUNT_JSON  the key file's contents, inline (use this in CI)
//   GOOGLE_APPLICATION_CREDENTIALS  path to the key file on disk
//
// Setup: docs/deployment/search-console-api.md

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_ROOT = "https://www.googleapis.com/webmasters/v3";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const REPO_ROOT = resolve(import.meta.dirname, "..");
// Comparison fetches both sides in full and applies the display limit only
// after sorting. Fetching the current side at --limit would drop any page
// ranked below it, and the merge would then report that page as vanished
// purely because it was never fetched — manufacturing the exact signal this
// command exists to find.
const COMPARISON_FETCH_LIMIT = 5000;

const isIsoDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

// Inclusive: 2026-03-01..2026-03-01 is one day.
function dayCount(start, end) {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.floor(ms / 86400000) + 1;
}

function parseArgs(argv) {
  const args = { dimension: "page", limit: 25 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "list-sites" || key === "json" || key === "help") {
      args[key] = true;
      continue;
    }
    args[key] = argv[i + 1];
    i += 1;
  }
  return args;
}

// GSC finalises data on a 2-3 day lag, so an end date of "today" reports a
// trough that is collection latency rather than a real decline.
function defaultRange() {
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - 27 * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function loadCredentials() {
  const inline = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (inline) return JSON.parse(inline);

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) {
    throw new Error(
      "No credentials. Set GSC_SERVICE_ACCOUNT_JSON to the key file's contents, " +
        "or GOOGLE_APPLICATION_CREDENTIALS to its path. " +
        "See docs/deployment/search-console-api.md",
    );
  }

  // A service-account key inside the working tree is one `git add -A` away from
  // being published. Refuse rather than make that easy.
  const absolute = resolve(path);
  if (absolute.startsWith(REPO_ROOT)) {
    throw new Error(
      `Refusing to read a service-account key from inside the repository (${absolute}). ` +
        "Keep it outside the working tree, or pass it inline via GSC_SERVICE_ACCOUNT_JSON.",
    );
  }
  return JSON.parse(readFileSync(absolute, "utf8"));
}

async function accessToken(credentials) {
  const { client_email: clientEmail, private_key: privateKey } = credentials;
  if (!clientEmail || !privateKey) {
    throw new Error("Key file has no client_email/private_key — is it a service-account key?");
  }

  const b64 = (value) => Buffer.from(value).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )}`;

  const signer = createSign("RSA-SHA256");
  signer.update(body);
  const assertion = `${body}.${signer.sign(privateKey, "base64url")}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}

async function call(token, path, init = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 403 here almost always means the property exists but the service account
    // was never added to it, which is the step people forget.
    const hint =
      response.status === 403
        ? "\nThe service account is probably not a user on this property, or the site " +
          "identifier is the wrong form. Run --list-sites to see exactly what it can reach."
        : "";
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(payload)}${hint}`);
  }
  return payload;
}

async function query(token, site, start, end, dimension, limit) {
  const encoded = encodeURIComponent(site);
  const result = await call(token, `/sites/${encoded}/searchAnalytics/query`, {
    method: "POST",
    body: JSON.stringify({
      startDate: start,
      endDate: end,
      dimensions: [dimension],
      rowLimit: limit,
    }),
  });
  return result.rows ?? [];
}

// Ranges of different lengths cannot be compared on totals. The documented
// question is a rate ("~60/day against ~33/day"), and a 28-day window against a
// 61-day baseline would show every row collapsing even at an unchanged daily
// rate, confirming a decline that had not happened. Deltas are per-day.
function compare(current, baseline, currentDays, baselineDays) {
  const base = new Map(baseline.map((row) => [row.keys[0], row]));
  const seen = new Set();
  const merged = [];

  for (const row of current) {
    const key = row.keys[0];
    seen.add(key);
    const was = base.get(key);
    merged.push({
      key,
      impressions: row.impressions,
      wasImpressions: was?.impressions ?? 0,
      clicks: row.clicks,
    });
  }
  // Pages that vanished entirely are the whole point of the comparison, so they
  // must survive the merge rather than being dropped for having no current row.
  for (const row of baseline) {
    const key = row.keys[0];
    if (seen.has(key)) continue;
    merged.push({ key, impressions: 0, wasImpressions: row.impressions, clicks: 0 });
  }

  return merged
    .map((row) => {
      const perDay = row.impressions / currentDays;
      const wasPerDay = row.wasImpressions / baselineDays;
      return { ...row, perDay, wasPerDay, delta: perDay - wasPerDay };
    })
    .sort((a, b) => a.delta - b.delta);
}

function table(rows, withBaseline) {
  const width = Math.min(72, Math.max(20, ...rows.map((r) => r.key.length)));
  const rate = (value) => value.toFixed(1);
  const head = withBaseline
    ? `${"page".padEnd(width)}  ${"impr/day".padStart(9)}  ${"was/day".padStart(9)}  ${"delta/day".padStart(10)}  ${"clicks".padStart(7)}`
    : `${"page".padEnd(width)}  ${"impr".padStart(8)}  ${"clicks".padStart(7)}`;
  console.log(head);
  console.log("-".repeat(head.length));
  for (const row of rows) {
    const key = row.key.length > width ? `${row.key.slice(0, width - 1)}…` : row.key.padEnd(width);
    if (withBaseline) {
      const delta = row.delta > 0 ? `+${rate(row.delta)}` : rate(row.delta);
      console.log(
        `${key}  ${rate(row.perDay).padStart(9)}  ${rate(row.wasPerDay).padStart(9)}  ${delta.padStart(10)}  ${String(row.clicks).padStart(7)}`,
      );
    } else {
      console.log(`${key}  ${String(row.impressions).padStart(8)}  ${String(row.clicks).padStart(7)}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 28).join("\n"));
    return 0;
  }

  // Validate the invocation before touching credentials or the network, so a
  // typo is reported immediately rather than after a token exchange.
  const limit = Number(args.limit);
  if (!args["list-sites"]) {
    if (!args.site) {
      console.error("--site is required. Run --list-sites to see the exact identifiers available.");
      return 1;
    }
    if (!Number.isInteger(limit) || limit < 1) {
      console.error(`--limit must be a positive integer, got ${JSON.stringify(args.limit)}`);
      return 1;
    }
    if (Boolean(args["compare-start"]) !== Boolean(args["compare-end"])) {
      console.error("--compare-start and --compare-end must be given together.");
      return 1;
    }
    for (const flag of ["start", "end", "compare-start", "compare-end"]) {
      if (args[flag] !== undefined && !isIsoDate(args[flag])) {
        console.error(`--${flag} must be YYYY-MM-DD, got ${JSON.stringify(args[flag])}`);
        return 1;
      }
    }
    // Two non-overlapping ranges share no date keys, so every baseline day
    // reads as vanished and every current day as new — the output is entirely
    // artefact. Aligning days by offset would answer a different question than
    // this command asks, so refuse instead.
    if (args["compare-start"] && args.dimension === "date") {
      console.error(
        "--dimension date cannot be compared across ranges: the two periods share no date " +
          "keys, so every row would be an artefact. Compare by page or query instead.",
      );
      return 1;
    }
  }

  const token = await accessToken(loadCredentials());

  if (args["list-sites"]) {
    const { siteEntry = [] } = await call(token, "/sites");
    if (siteEntry.length === 0) {
      console.log(
        "No properties. The service account authenticated but has not been added as a user " +
          "on any Search Console property — see docs/deployment/search-console-api.md step 5.",
      );
      return 1;
    }
    for (const entry of siteEntry) {
      console.log(`${entry.permissionLevel.padEnd(18)}  ${entry.siteUrl}`);
    }
    return 0;
  }

  const site = args.site;
  const fallback = defaultRange();
  const start = args.start ?? fallback.start;
  const end = args.end ?? fallback.end;

  const comparing = Boolean(args["compare-start"]);
  const fetchLimit = comparing ? COMPARISON_FETCH_LIMIT : limit;

  const rows = await query(token, site, start, end, args.dimension, fetchLimit);
  const baseline = comparing
    ? await query(token, site, args["compare-start"], args["compare-end"], args.dimension, fetchLimit)
    : null;

  // Say so rather than silently reporting a truncated set as complete.
  for (const [label, set] of [["current", rows], ["baseline", baseline ?? []]]) {
    if (set.length === COMPARISON_FETCH_LIMIT) {
      console.error(
        `WARNING: the ${label} range returned ${COMPARISON_FETCH_LIMIT} rows, the fetch cap. ` +
          "Results may be truncated; narrow the range or the dimension.",
      );
    }
  }

  const result = comparing
    ? compare(rows, baseline, dayCount(start, end), dayCount(args["compare-start"], args["compare-end"])).slice(0, limit)
    : rows.map((r) => ({ key: r.keys[0], ...r }));

  if (args.json) {
    console.log(JSON.stringify({ site, start, end, rows: result }, null, 2));
    return 0;
  }

  console.log(`${site}  ${start} to ${end}  (${dayCount(start, end)}d, dimension: ${args.dimension})`);
  if (comparing) {
    const baselineDays = dayCount(args["compare-start"], args["compare-end"]);
    console.log(
      `baseline: ${args["compare-start"]} to ${args["compare-end"]} (${baselineDays}d). ` +
        "Rates are per-day so the unequal ranges compare; sorted by largest daily loss.",
    );
  }
  console.log("");
  if (result.length === 0) {
    console.log("No rows. Either the range has no data, or the property is the wrong identifier.");
    return 0;
  }
  table(result, Boolean(baseline));
  return 0;
}

// Exported for tests/gsc_search_analytics.test.js; the CLI still runs when this
// file is the entry point.
export { compare, dayCount, isIsoDate, COMPARISON_FETCH_LIMIT };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`FAIL: ${error.message}`);
      process.exit(1);
    },
  );
}
