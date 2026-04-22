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

### Verification

```bash
python3 tests/verify_site.py
php -l book-capture.php
php -l contact-submit.php
```
