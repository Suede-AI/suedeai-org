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
