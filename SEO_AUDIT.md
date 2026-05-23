# SEO Audit — suedeai-org (suedeai.org)

## Summary

> **Note (2026-05-21):** suedeai.org is intentionally standalone — no redirect to/from suedeai.ai, and no www→apex consolidation desired. The original P0 about the www 401 has been removed below; treat the 401 as intentional. Other findings stand.

The site is a well-structured static HTML site with 22 pages deployed at `https://suedeai.org/`. Foundation SEO is solid: every audited page has a unique title, meta description, canonical, viewport, and H1. The `robots.txt` is clean and well-formed, with an explicit sitemap reference. JSON-LD is present on all pages but consistently underspecified on the protection topic pages — they all use a bare `WebPage` type where `FAQPage` or `Article` would provide meaningful rich result eligibility. The most actionable issues are:

1. The OG image (`og-suede.png`) is 400×118 px — far below the 1200×630 minimum for a proper social card; it will render as a thumbnail or fail entirely on most platforms.
2. The sitemap carries zero `<lastmod>`, `<changefreq>`, or `<priority>` signals, reducing crawl scheduling quality.
3. `twitter:site` and `twitter:creator` tags appear only on the homepage — all other pages are missing them.
4. The `Book` JSON-LD on `/book/` has no ISBN, publisher, or `datePublished`, reducing its eligibility for Google's book-related features.
5. The protection topic pages (`content-provenance`, `ai-likeness-protection`, `ai-voice-protection`, `creator-ownership`) have no `FAQPage` schema despite containing structured Q&A-style content that would qualify for rich results.
6. The `ContactPage` on `/contact/` is missing an `Organization` contactPoint sub-entity, which limits its structured data completeness.
7. The `jason-colapietro/` page's JSON-LD `sameAs` array contains two identical duplicate pairs (`app.suedeai.ai/founder` and `app.suedeai.ai/jason-colapietro-images` each appear twice).
8. The homepage founder portrait `<img>` has no `width`/`height` attributes, which is a CLS risk.
9. The `docs` section referenced in the audit brief does not exist as a deployed page or sitemap entry. No crawl-blocker, but the section is absent.

---

## Deployed URL Diff vs Source

The live site at `https://suedeai.org/` renders the investor-thesis landing page from `/Users/jason/Documents/Ramboed/suedeai-org/index.html`. This is the homepage that differs structurally from the inner pages — it uses a separate CSS (`styles.css` relative path vs `/assets/css/site.css` absolute path used by all inner pages). The `www` subdomain returned HTTP 401 during the audit fetch, which indicates a missing Vercel redirect rule rather than a DNS or server misconfiguration on apex. The `.vercel/project.json` confirms deployment to the Vercel project, and `vercel.json` has `cleanUrls: true` and `trailingSlash: true`, which correctly generates canonical trailing-slash URLs matching those declared in the sitemap and `<link rel="canonical">` tags.

One file-vs-live discrepancy: the repo contains `assets/img/og-suede.svg` but every HTML page references `og-suede.png`. The live `.png` was confirmed to exist at 400×118 px, while the `.svg` is an unused asset. The HTML consistently points to the `.png`.

---

## P0 — Critical

```text
[CRITICAL] OG image is 400×118 px — fails minimum dimensions for social sharing
Location: Every page, og:property="og:image" → https://suedeai.org/assets/img/og-suede.png
Issue: Facebook requires 1200×630 px minimum (600×315 absolute minimum); Twitter/X requires
       800×418 px minimum for summary_large_image. At 400×118 the image falls below all
       platform thresholds. Twitter will downgrade the card to summary (small thumbnail).
       Facebook will show a broken or degraded card. Every share from every page is affected.
Fix:   Create a new og-suede.png at exactly 1200×630 px and replace the file in assets/img/.
       No HTML changes needed — all pages already reference the correct path.
```

> Note: an earlier draft of this audit listed `www.suedeai.org` HTTP 401 as a P0 missing redirect. That has been removed — suedeai.org is intentionally standalone and the www 401 is acceptable.

---

## P1 — High

```text
[HIGH] Sitemap has no lastmod, changefreq, or priority signals
Location: /Users/jason/Documents/Ramboed/suedeai-org/sitemap.xml
Issue: Every <url> contains only <loc>. Google's crawl scheduler uses lastmod to decide
       whether to re-crawl; without it, newly published or updated pages may be re-crawled
       on Google's default cadence rather than prompted by a freshness signal. changefreq
       and priority are advisory but still widely consumed by crawlers.
Fix:   Add <lastmod> in YYYY-MM-DD format to each URL. Use the actual last-modified date
       for each page or the deploy date as a minimum. Example:
       <url><loc>https://suedeai.org/ai-voice-protection/</loc><lastmod>2026-05-21</lastmod></url>
       Automate this at deploy time if a build step is added.
```

```text
[HIGH] Book JSON-LD missing ISBN, datePublished, and publisher — limits rich result eligibility
Location: /Users/jason/Documents/Ramboed/suedeai-org/book/index.html:21–51
Issue: The Book schema has name, author, description, image, and url but omits isbn,
       datePublished, and a publisher Organization node. Google's book structured data
       documentation lists isbn and publisher as recommended fields for book knowledge panel
       and book search integration eligibility.
Fix:   Add to the Book type block:
       "isbn": "<ISBN-13 if registered, or omit if not>",
       "datePublished": "2024",
       "publisher": { "@type": "Organization", "name": "Suede Labs", "url": "https://suedeai.org/" }
       If the book does not have a registered ISBN, omit that field rather than fabricating one.
```

```text
[HIGH] FAQPage schema absent on all four protection topic pages
Location:
  /Users/jason/Documents/Ramboed/suedeai-org/content-provenance/index.html
  /Users/jason/Documents/Ramboed/suedeai-org/ai-likeness-protection/index.html
  /Users/jason/Documents/Ramboed/suedeai-org/ai-voice-protection/index.html
  /Users/jason/Documents/Ramboed/suedeai-org/creator-ownership/index.html
Issue: Each of these pages has a "Why it matters" section and an "How Suede approaches..."
       section that map naturally to FAQ-style Question/Answer structured data. All four
       currently use a bare WebPage type. FAQPage enables the rich result accordion in Google
       Search that appears below the title, increasing click-through rate materially for
       informational queries about these topics.
Fix:   Replace or supplement the WebPage JSON-LD with a FAQPage block. Example for
       ai-voice-protection/index.html:
       {
         "@context": "https://schema.org",
         "@type": "FAQPage",
         "mainEntity": [
           {
             "@type": "Question",
             "name": "Why does AI voice protection matter?",
             "acceptedAnswer": { "@type": "Answer", "text": "Synthetic voice turns identity into media..." }
           },
           {
             "@type": "Question",
             "name": "How does Suede approach AI voice protection?",
             "acceptedAnswer": { "@type": "Answer", "text": "Suede anchors AI voice protection in proof of creation..." }
           }
         ]
       }
       Use the actual on-page copy for the answer text — Google requires the answer text to
       match visible page content.
```

```text
[HIGH] twitter:site and twitter:creator absent on all pages except homepage
Location: All pages except /Users/jason/Documents/Ramboed/suedeai-org/index.html
Issue: twitter:site (@AISUEDE) and twitter:creator (@johnnysuede) are only declared on
       index.html. Every other page — including book, contact, and all protection topics —
       has a twitter:card and twitter:title but no site/creator attribution. Twitter/X uses
       these for attribution display and account verification signals.
Fix:   Add to every page's <head> that has twitter:card:
       <meta name="twitter:site" content="@AISUEDE">
       <meta name="twitter:creator" content="@johnnysuede">
```

```text
[HIGH] ContactPage JSON-LD missing Organization contactPoint
Location: /Users/jason/Documents/Ramboed/suedeai-org/contact/index.html:20–22
Issue: The ContactPage schema is a bare one-liner with name, url, and description only.
       It has no contactPoint linking the page to the Organization entity defined on the
       homepage, and no reference to the parent organization. Google uses this to associate
       contact information with the organization's knowledge panel.
Fix:   Expand to:
       {
         "@context": "https://schema.org",
         "@type": "ContactPage",
         "name": "Talk to Suede",
         "url": "https://suedeai.org/contact/",
         "description": "...",
         "about": { "@id": "https://suedeai.org/#organization" },
         "mainEntity": {
           "@type": "Organization",
           "@id": "https://suedeai.org/#organization",
           "contactPoint": {
             "@type": "ContactPoint",
             "contactType": "partnerships",
             "url": "https://suedeai.org/contact/"
           }
         }
       }
```

---

## P2 — Medium

```text
[MEDIUM] Duplicate sameAs entries in jason-colapietro JSON-LD Person node
Location: /Users/jason/Documents/Ramboed/suedeai-org/jason-colapietro/index.html:39–46
Issue: "https://app.suedeai.ai/founder" and "https://app.suedeai.ai/jason-colapietro-images"
       each appear twice in the sameAs array. Duplicate sameAs values are not harmful to
       indexing but indicate a copy-paste error and make the structured data less clean for
       validators and knowledge graph association.
Fix:   Remove the duplicates, keeping one of each URL. The corrected array should have
       four unique entries: app.suedeai.ai/founder, app.suedeai.ai/jason-colapietro-images,
       x.com/johnnysuede, github.com/Suede-AI, plus suedeai.org/jason-colapietro/ for
       self-reference.
```

```text
[MEDIUM] Homepage founder portrait missing width and height attributes — CLS risk
Location: /Users/jason/Documents/Ramboed/suedeai-org/index.html:375–379
Issue: The <img src="/assets/img/founder-jason.png"> has alt and loading="lazy" but no
       width or height. Without explicit dimensions the browser cannot reserve layout space
       before the image loads, causing layout shift (CLS). The inner pages use the same
       image at width="1067" height="1475".
Fix:   Add width="1067" height="1475" to match the declared attributes on
       /jason-colapietro/index.html:107 where the same image is correctly sized.
```

```text
[MEDIUM] Sitewide fallback OG image — no section-specific OG images for protection topics
Location: ai-likeness-protection/, ai-voice-protection/, content-provenance/, creator-ownership/,
          proof-of-creation/, programmable-ip/, royalties/, why-copyright-fails/ — all HTML heads
Issue: All inner pages share the generic og-suede.png fallback. When these pages are shared
       on social platforms the card gives no visual signal about the topic. Pages with distinct
       OG images have higher click-through rates when shared. This is a medium-severity
       opportunity, not a blocker.
Fix:   Create per-section OG images (1200×630 px) with the page topic in the card design.
       Minimum viable scope: create variants for the four protection topic pages and /book/.
       The book pages already use stake-your-claim-cover.jpg which is topic-appropriate —
       those are fine.
```

```text
[MEDIUM] Sitemap includes /sharp-excerpt/ and /full-preview/ — potential thin content signals
Location: /Users/jason/Documents/Ramboed/suedeai-org/sitemap.xml lines 16–17
Issue: /sharp-excerpt/ and /full-preview/ are reader preview delivery pages. If their content
       is primarily a PDF embed or a short excerpt with a form, they may be treated as thin
       content relative to the full topic pages. They are currently indexed (no noindex).
       This is only a concern if their visible text content is under ~300 words.
Fix:   Audit the visible word count on both pages. If content is predominantly a PDF embed
       with minimal surrounding text, add <meta name="robots" content="noindex, follow"> to
       prevent them from diluting topical authority, or expand their surrounding editorial
       content to justify indexation.
```

```text
[MEDIUM] /docs/ section referenced in site audit brief does not exist
Location: No file at suedeai-org/docs/index.html; no entry in sitemap.xml
Issue: The audit brief identifies /docs/ as a site section. No such page exists in the
       repository or sitemap. If /docs/ is planned and linked from other pages, it will
       produce a 404. If it is not linked anywhere, no current issue exists.
Fix:   Confirm whether /docs/ is planned. If yes, either create the page before launching
       any inbound links to it, or ensure no navigation item or internal link points to it
       until it exists.
```

```text
[MEDIUM] og-suede.svg in repo is an unreferenced dead asset
Location: /Users/jason/Documents/Ramboed/suedeai-org/assets/img/og-suede.svg
Issue: No HTML file references og-suede.svg. All OG image references use og-suede.png.
       The SVG is deployed unnecessarily, adding to payload and potentially confusing
       future maintainers. SVG is also not a valid OG image format — platforms require PNG
       or JPG.
Fix:   Delete assets/img/og-suede.svg from the repository. When the new 1200×630 OG image
       is created (per the P0 fix above), it should be saved as og-suede.png replacing
       the current undersized version.
```

```text
[MEDIUM] No per-page og:url on inner pages
Location: Every inner page (book, contact, protection topics, etc.) — all HTML heads
Issue: The homepage declares <meta property="og:url" content="https://suedeai.org/"> but
       inner pages omit og:url entirely. Facebook's Open Graph debugger uses og:url as the
       canonical for de-duplication of shares. Without it, shares may not aggregate likes
       and share counts correctly if users share with and without trailing slashes.
Fix:   Add <meta property="og:url" content="https://suedeai.org/[page-path]/"> to every
       page's <head>. The value should match the existing canonical href on each page.
```

---

## Per-Section Table

| Section | URL | Title | Description | Canonical | H1 | JSON-LD type |
|---|---|---|---|---|---|---|
| Homepage | `/` | Yes | Yes | Yes (.org/) | Yes | Organization + Person + WebSite |
| Book | `/book/` | Yes | Yes | Yes | Yes | Book + WebPage |
| Contact | `/contact/` | Yes | Yes | Yes | Yes | ContactPage (bare) |
| Content Provenance | `/content-provenance/` | Yes | Yes | Yes | Yes | WebPage only |
| AI Likeness Protection | `/ai-likeness-protection/` | Yes | Yes | Yes | Yes | WebPage only |
| AI Voice Protection | `/ai-voice-protection/` | Yes | Yes | Yes | Yes | WebPage only |
| Creator Ownership | `/creator-ownership/` | Yes | Yes | Yes | Yes | WebPage only |
| Docs | `/docs/` — does not exist | — | — | — | — | — |
| Proof of Creation | `/proof-of-creation/` | Yes | Yes | Yes | Yes | WebPage only |
| Programmable IP | `/programmable-ip/` | Yes | Yes | Yes | Yes | WebPage only |
| Royalties | `/royalties/` | Yes | Yes | Yes | Yes | WebPage only |
| Why Copyright Fails | `/why-copyright-fails/` | Yes | Yes | Yes | Yes | WebPage only |
| Human Authenticity Layer | `/human-authenticity-layer/` | Yes | Yes | Yes | Yes | WebPage only |
| Jason Colapietro | `/jason-colapietro/` | Yes | Yes | Yes (+ og:type=profile) | Yes | ProfilePage + Person |
| Full Preview | `/full-preview/` | Yes | Yes | Yes | Yes | WebPage only |
| Sharp Excerpt | `/sharp-excerpt/` | Yes | Yes | Yes | Yes | WebPage only |
| Book Thanks | `/book/thanks/` | Yes | Yes | Yes (noindex,follow) | Yes | WebPage |
| Contact Thanks | `/contact/thanks/` | Yes | Yes | Yes (noindex,follow) | Yes | WebPage |

Notable absences across inner pages: `og:url`, `twitter:site`, `twitter:creator`, FAQPage schema on topic pages.

---

## Recommended Next 5 Actions

**1. Replace og-suede.png with a 1200×630 px version (P0)**
This single file replacement fixes the social card across all 22 pages simultaneously. The existing filename and all HTML references stay unchanged. Priority because every share from the site currently degrades on every major platform.

**2. Add FAQPage JSON-LD to the four protection topic pages (P1)**
`content-provenance`, `ai-likeness-protection`, `ai-voice-protection`, `creator-ownership` — these four pages target the highest-volume informational queries on the site. FAQPage schema makes rich result accordion eligibility immediate. The copy is already on the pages; it only needs to be mirrored into JSON-LD using the visible text verbatim.

**3. Add lastmod to sitemap.xml and add og:url + twitter:site/creator to all inner pages (P1)**
These three fixes can be batched into one pass across all HTML files. The sitemap update is a one-file edit. The meta tag additions are identical blocks that can be templated and inserted at the same time.

**4. Expand the Book JSON-LD and the ContactPage JSON-LD (P1)**
Add `publisher`, `datePublished` (and ISBN if registered) to `/book/index.html`. Expand `/contact/index.html` with the Organization contactPoint reference. Both are single-file edits with high structured data completeness payoff.
