# Suede SEO Website

> **[Suede Labs AI](https://suedeai.ai) · By [Jason Colapietro](https://suedeai.ai/founder) · Live at [suedeai.org](https://suedeai.org)**

Static website source for `suedeai.org`.

## Structure

- `index.html` and page folders contain deployable static pages
- `styles.css` is the homepage stylesheet (Dark Institutional IP Terminal system)
- `assets/css/site.css` is the shared visual system for all sub-pages (same design tokens)
- `assets/css/investors.css` scopes the investor-funnel styles
- `assets/js/site.js` contains small progressive enhancements
- `api/` holds the Vercel serverless handlers (`book`, `book-call`, `contact`, `investors`)
- `tests/verify_site.py` validates page coverage and SEO-critical markup

## Local preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment Notes

### Static hosting

Upload all files and folders as-is to the web root for `suedeai.org`.

### Vercel + Supabase

- the site deploys to Vercel as a static site with serverless functions in `api/`
- the book, call, contact, and investor forms post to `/api/book/`, `/api/book-call/`, `/api/contact/`, and `/api/investors/`
- the reader funnel resolves through `/sharp-excerpt/`, `/full-preview/`, and the stable PDF asset path
- the reader-preview email (`api/book.js`) includes a "Book a Call" CTA linking to `/book-a-call/`
- the abridged PDF is hosted at `assets/files/stake-your-claim-condensed-preview.pdf`
- the book cover lives at `assets/img/stake-your-claim-cover.jpg`
- book requests and call requests are stored in Supabase for manual follow-up from the Suede team

Required Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_BOOK_TABLE` default: `book_leads`
- `SUPABASE_CONTACT_TABLE` default: `contact_inquiries`
- `SUPABASE_CALL_TABLE` default: `call_requests`

Optional environment variables:

- `BOOK_EMAIL_FROM`
- `CONTACT_EMAIL_FROM`
- `CONTACT_NOTIFY_TO`
- `CALL_NOTIFY_TO` falls back to `CONTACT_NOTIFY_TO` if unset
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

- Vercel + Supabase + Namecheap deployment guide (internal)

### Verification

```bash
python3 tests/verify_site.py
```
