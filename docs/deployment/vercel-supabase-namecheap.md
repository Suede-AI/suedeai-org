# Suede Deployment Guide

## Recommended Setup

- `suedeai.org` served from Vercel
- forms captured through Vercel serverless functions + Supabase
- Namecheap used as registrar and DNS
- `suedeai.ai` remains the broader main site

## 1. Create Supabase Tables

In Supabase SQL editor, run:

```sql
\i supabase/schema.sql
```

If your SQL editor does not support `\i`, paste the contents of [schema.sql](/Users/jason/Documents/CodexXcampaign/SEO Webisite/supabase/schema.sql) directly.

## 2. Add Vercel Environment Variables

Set these in the Vercel project settings:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BOOK_TABLE`
- `SUPABASE_CONTACT_TABLE`

Use [.env.example](/Users/jason/Documents/CodexXcampaign/SEO Webisite/.env.example) as the reference.

## 3. Import Into Vercel

From the Vercel dashboard:

1. Create a new project
2. Import this repository or upload this folder
3. Leave framework preset as `Other`
4. Confirm the project root is this website directory
5. Add the environment variables above
6. Deploy

## 4. Point Namecheap Domain To Vercel

At Namecheap, either:

- set the nameservers to Vercel, or
- keep Namecheap DNS and add the Vercel-provided records for `suedeai.org`

Recommended:

- apex/root domain: `suedeai.org` -> Vercel
- optional `www.suedeai.org` -> redirect to apex

## 5. Keep Site Relationships Clean

- `suedeai.org` is the ownership/provenance/SEO discovery site
- `suedeai.ai` is the broader main site
- link from `.org` into `.ai` where broader product/company context helps
- avoid turning `.org` into a thin doorway page

## 6. Verify After Deploy

Check:

- homepage loads with CSS/JS
- `/proof-of-creation/` loads
- `/book/` form submits successfully
- `/contact/` form submits successfully
- `sitemap.xml` and `robots.txt` are public
- canonical tags point at `https://suedeai.org/...`

## 7. Optional Namecheap Fallback

If you ever move off Vercel and back to shared hosting:

- upload the site as static files
- enable PHP
- the forms will fall back to:
  - `book-capture.php`
  - `contact-submit.php`

That fallback writes to local `.log` files in the site root.
