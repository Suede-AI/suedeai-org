# Suede SEO Website

Static website source for `suedeai.org`.

## Structure

- `index.html` and page folders contain deployable static pages
- `assets/css/site.css` contains the shared visual system
- `assets/js/site.js` contains small progressive enhancements
- `tests/verify_site.py` validates page coverage and SEO-critical markup
- `book-capture.php` and `contact-submit.php` are optional shared-hosting handlers

## Local preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment Notes

### Static hosting

Upload all files and folders as-is to the web root for `suedeai.org`.

### Namecheap shared hosting

- static pages work immediately
- `book-capture.php` and `contact-submit.php` require PHP enabled
- the PHP handlers append submissions to local `.log` files in the site root

### Vercel + Supabase

- the site deploys cleanly to Vercel as a static site with serverless functions in `api/`
- the book and contact forms progressively post to `/api/book` and `/api/contact` when those routes exist
- if the Vercel API route fails or is unavailable, the forms fall back to the PHP actions for shared hosting
- the reader funnel resolves through `/sharp-excerpt/`, `/full-preview/`, and the stable PDF asset path
- the abridged PDF is hosted at `assets/files/stake-your-claim-condensed-preview.pdf`
- the book cover lives at `assets/img/stake-your-claim-cover.jpg`
- book requests are stored in Supabase for manual send-out from the Suede team

Required Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_BOOK_TABLE` default: `book_leads`
- `SUPABASE_CONTACT_TABLE` default: `contact_inquiries`

Optional environment variables:

- `BOOK_EMAIL_FROM`
- `CONTACT_EMAIL_FROM`
- `CONTACT_NOTIFY_TO`
- `RESEND_API_KEY`

Current send-from recommendation:

- `info@suedeai.org` for book delivery and contact notifications

Suggested Supabase tables:

```sql
\i supabase/schema.sql
```

Before deploys, run the cross-project RLS audit from the sibling app repo:

```bash
cd ../Suede-AI-App/frontend
npm run audit:rls
```

Deployment flow:

1. Import this repo into Vercel
2. Add the Supabase environment variables
3. Run the insert-only RLS policies from `supabase/schema.sql`
4. Run `npm run audit:rls` from `../Suede-AI-App/frontend`
5. Point `suedeai.org` at the Vercel project
6. Keep `suedeai.ai` as the main site and let this site link into it

Detailed guide:

- [Vercel + Supabase + Namecheap deployment guide](/Users/jason/Documents/CodexXcampaign/SEO Webisite/docs/deployment/vercel-supabase-namecheap.md)

### Verification

```bash
python3 tests/verify_site.py
php -l book-capture.php
php -l contact-submit.php
```
