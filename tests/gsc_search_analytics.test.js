// Regression guards for scripts/gsc-search-analytics.mjs.
//
// Both cases below were real bugs caught in review on PR #109. They matter more
// than most because this script exists to test a hypothesis — that the
// impressions decline on suedeai.org was caused by the WordPress retirement —
// and each bug made the output appear to confirm that hypothesis whether or not
// it was true.

import { test } from "node:test";
import assert from "node:assert/strict";

import { compare, dayCount, isIsoDate } from "../scripts/gsc-search-analytics.mjs";

const row = (key, impressions, clicks = 0) => ({ keys: [key], impressions, clicks });
const find = (rows, key) => rows.find((r) => r.key === key);

test("dayCount counts inclusively", () => {
  assert.equal(dayCount("2026-03-01", "2026-03-01"), 1);
  assert.equal(dayCount("2026-03-01", "2026-03-02"), 2);
  assert.equal(dayCount("2026-03-01", "2026-04-30"), 61);
  assert.equal(dayCount("2026-08-22", "2026-09-18"), 28);
});

test("dayCount spans a DST boundary without drifting", () => {
  // Dates are parsed as UTC precisely so a local-time DST shift cannot turn a
  // day count into 30.958... and round the rates wrong.
  assert.equal(dayCount("2026-03-01", "2026-03-31"), 31);
  assert.equal(dayCount("2026-10-25", "2026-11-01"), 8);
});

test("unequal ranges compare on daily rate, not totals", () => {
  // 28 impressions over 28 days against 61 over 61: the same one per day.
  // Comparing totals would report this as -33, a decline that never happened.
  const current = [row("/a/", 28)];
  const baseline = [row("/a/", 61)];

  const [result] = compare(current, baseline, 28, 61);

  assert.equal(result.perDay, 1);
  assert.equal(result.wasPerDay, 1);
  assert.equal(result.delta, 0, "identical daily rates must produce a zero delta");
});

test("a real decline still surfaces as negative, scaled per day", () => {
  const [result] = compare([row("/a/", 28)], [row("/a/", 122)], 28, 61);
  assert.equal(result.perDay, 1);
  assert.equal(result.wasPerDay, 2);
  assert.equal(result.delta, -1);
});

test("a page present in both sets is never reported as vanished", () => {
  // The fetch-limit bug: the current side was fetched at --limit, so a page
  // ranked below it was absent from the merge and reported at zero. compare()
  // must keep a page that is present on both sides at its real value, and the
  // caller must fetch both sides in full before slicing.
  const current = [row("/top/", 500), row("/quiet/", 10)];
  const baseline = [row("/top/", 500), row("/quiet/", 10)];

  const result = compare(current, baseline, 10, 10);
  const quiet = find(result, "/quiet/");

  assert.equal(quiet.impressions, 10);
  assert.equal(quiet.delta, 0);
  assert.notEqual(quiet.perDay, 0, "a page with current impressions must not read as vanished");
});

test("a genuinely vanished page is kept, at zero, and sorts first", () => {
  const current = [row("/stayed/", 100)];
  const baseline = [row("/stayed/", 100), row("/gone/", 300)];

  const result = compare(current, baseline, 10, 10);
  const gone = find(result, "/gone/");

  assert.ok(gone, "a page absent from the current range must survive the merge");
  assert.equal(gone.impressions, 0);
  assert.equal(gone.perDay, 0);
  assert.equal(gone.wasPerDay, 30);
  assert.equal(result[0].key, "/gone/", "largest daily loss sorts first");
});

test("compare returns every row so the caller slices after sorting", () => {
  const current = Array.from({ length: 5 }, (_, i) => row(`/c${i}/`, 10));
  const baseline = Array.from({ length: 5 }, (_, i) => row(`/b${i}/`, 10));

  // Ten distinct keys, none shared: the merge must not silently truncate.
  assert.equal(compare(current, baseline, 1, 1).length, 10);
});

test("isIsoDate accepts YYYY-MM-DD and rejects the rest", () => {
  assert.ok(isIsoDate("2026-03-01"));
  for (const bad of ["2026-3-1", "03/01/2026", "2026-13-01", "yesterday", "", "2026-03-01T00:00:00Z"]) {
    assert.ok(!isIsoDate(bad), `${JSON.stringify(bad)} must be rejected`);
  }
});
