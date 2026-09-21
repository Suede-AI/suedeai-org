# Search Console API access for suedeai.org

A service account for `searchanalytics.query`, so the Performance report can be
queried without a signed-in browser.

## What this does and does not unlock

The Search Console API exposes Search Analytics, sitemap submission, the site
list, and URL Inspection. It has **no page-indexing / coverage endpoint at all.**

That means a service account **cannot** retrieve the per-reason URL lists behind
the Page indexing report — "Not found (404)", "Page with redirect", "Discovered
— currently not indexed", "Crawled — currently not indexed". Those are UI-only
exports. No amount of credential provisioning changes this; only a signed-in
human clicking through the UI can export them.

| Need | API? |
|---|---|
| Performance by page / query / country / date | Yes — `searchanalytics.query` |
| Which properties this account can reach | Yes — `sites.list` |
| Submit or resubmit a sitemap | Yes — `sitemaps.submit` |
| Status of one URL you already know | Yes — URL Inspection (one URL per call) |
| **Enumerate the page-indexing reason lists** | **No. UI export only.** |

So this unblocks the impressions question. It does not unblock the outstanding
404 URL.

## Setup

Steps 1–5 need a browser signed in as a Search Console owner. Step 5 is the one
people forget, and it is the one that produces a confusing 403 later.

1. **Google Cloud project** — <https://console.cloud.google.com/projectcreate>,
   or reuse an existing project.
2. **Enable the API** — APIs & Services → Library → "Google Search Console API"
   → Enable. (Direct:
   <https://console.cloud.google.com/apis/library/searchconsole.googleapis.com>)
3. **Create the service account** — IAM & Admin → Service Accounts → Create.
   A name like `gsc-readonly` is enough. It needs **no** project IAM role; its
   access comes from the Search Console grant in step 5, not from Cloud IAM.
4. **Create a JSON key** — the service account → Keys → Add key → Create new key
   → JSON. This downloads once and cannot be re-downloaded. Treat it as a
   credential: see Handling the key below.
5. **Grant it the property** — Search Console → the **suedeai.org** property →
   Settings → Users and permissions → Add user. Paste the service account's
   email (it looks like `gsc-readonly@PROJECT.iam.gserviceaccount.com`, and is
   the `client_email` field in the JSON). **Full** permission is required —
   Restricted cannot read Search Analytics.

## Handling the key

Never commit it. `.gitignore` covers `*-service-account*.json`, `gsc-*.json`
and `service-account*.json`, and the script refuses to read a key from inside
the working tree.

Local:

```sh
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gcloud/suede-gsc.json"
```

CI or a remote session — paste the file's contents into a secret and pass it
inline, so no file ever touches disk:

```sh
export GSC_SERVICE_ACCOUNT_JSON="$(cat suede-gsc.json)"
```

If the key is ever exposed, delete it in Cloud Console → the service account →
Keys. The key is revoked immediately; the service account and its Search
Console grant survive, so you only repeat step 4.

## Use

Confirm access first. This prints exactly what the account can reach, which
settles whether the property is registered as a domain property
(`sc-domain:suedeai.org`) or a URL-prefix property (`https://suedeai.org/`) —
they are different resources and the wrong one returns 403:

```sh
node scripts/gsc-search-analytics.mjs --list-sites
```

Then the query this was built for — impressions by page, recent window against
the Mar–Apr baseline, sorted by largest loss:

```sh
node scripts/gsc-search-analytics.mjs \
  --site 'sc-domain:suedeai.org' \
  --compare-start 2026-03-01 --compare-end 2026-04-30
```

Pages that stopped appearing entirely are kept in the output with `impr 0`, and
sort to the top — they are the likeliest explanation for a sitewide impressions
drop.

Other dimensions: `--dimension query|country|device|date`. Raw output:
`--json`. Default window is the 28 days ending 3 days ago, because Search
Console finalises data on a 2–3 day lag and an end date of today reports a
trough that is collection latency rather than a real decline.

## Reading the result

The open question is whether the decline (~60 impressions/day across Mar–Apr,
~33/day over the following 30 days) is explained by the WordPress retirement.
Thirteen legacy article URLs now 301 to topic pages; a 301 passes ranking
signals but does not preserve the old page's query footprint.

If that is the cause, the losses concentrate on the retired article URLs and
their destination pages do not gain a matching number of impressions. If the
losses are spread evenly across pages that still exist and still rank, it is
something else — a ranking or seasonality change — and the redirects are not to
blame.
