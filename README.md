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

Required Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BOOK_TABLE` default: `book_leads`
- `SUPABASE_CONTACT_TABLE` default: `contact_inquiries`

Suggested Supabase tables:

```sql
create table if not exists public.book_leads (
  id bigint generated always as identity primary key,
  email text not null,
  name text,
  context text,
  source text,
  submitted_at timestamptz not null
);

create table if not exists public.contact_inquiries (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  topic text,
  message text not null,
  source text,
  submitted_at timestamptz not null
);
```

Deployment flow:

1. Import this repo into Vercel
2. Add the Supabase environment variables
3. Point `suedeai.org` at the Vercel project
4. Keep `suedeai.ai` as the main site and let this site link into it

Detailed guide:

- [Vercel + Supabase + Namecheap deployment guide](/Users/jason/Documents/CodexXcampaign/SEO Webisite/docs/deployment/vercel-supabase-namecheap.md)

### Verification

```bash
python3 tests/verify_site.py
php -l book-capture.php
php -l contact-submit.php
```
