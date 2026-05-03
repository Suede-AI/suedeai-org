# Suede Reader Preview Funnel Checklist

## What Was Wrong

- `/sharp-excerpt/` did not exist, so email or campaign links to the sharp excerpt would 404.
- `/full-preview/` did not exist, so the full preview handoff had no stable reader page.
- The book request API stored leads but had no reader preview email template with the sharp excerpt, full preview, and condensed PDF links.
- The book page and thank-you copy still described a mostly manual send flow instead of giving readers a direct path to the preview.
- `sitemap.xml` and the site verifier did not cover the new reader preview routes.

## Now Verified

- `/sharp-excerpt/` resolves to a static reader excerpt page.
- `/full-preview/` resolves to a static full preview handoff page.
- `/assets/files/stake-your-claim-condensed-preview.pdf` resolves as the stable condensed preview PDF.
- `/book/` links readers to `/full-preview/`, `/sharp-excerpt/`, and the email capture form consistently.
- `/api/book` includes the `Stake Your Claim reader preview` email template with the sharp excerpt, full preview, and PDF URLs.
- `tests/verify_site.py` now checks the preview routes, sitemap entries, PDF asset, and email-template URLs.

## Verification Run

- `python3 suedeai-org/tests/verify_site.py` -> `PASS: verified 14 HTML pages and core assets`
- `node --check suedeai-org/api/book.js && node --check suedeai-org/api/contact.js && node --check suedeai-org/api/_shared.js` -> pass
- Internal HTML link/asset resolver -> `PASS: internal HTML links/assets resolve`
- Local HTTP HEAD checks on `http://127.0.0.1:8765/sharp-excerpt/`, `/full-preview/`, and `/assets/files/stake-your-claim-condensed-preview.pdf` -> `HTTP/1.0 200 OK`
