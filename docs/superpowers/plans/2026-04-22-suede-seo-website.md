# Suede SEO Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bright-infrastructure, SEO-first static website for `suedeai.org` with institutional homepage, ownership/provenance landing pages, book funnel, contact flow, and optional Namecheap-compatible PHP form handlers.

**Architecture:** The site ships as plain static HTML pages with one shared stylesheet, one small shared JavaScript file, and static SEO assets (`robots.txt`, `sitemap.xml`, schema markup, OG asset). Contact and book capture work as regular static pages by default and can optionally post to lightweight PHP handlers on shared hosting. A Python verification script provides test-first coverage for page existence, metadata, linking, and CTA integrity.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, optional PHP 8.x handlers, Python 3 verification script, Namecheap shared hosting-compatible static output

---

## File Structure

### New files to create

- `README.md`
- `assets/css/site.css`
- `assets/js/site.js`
- `assets/img/og-suede.svg`
- `index.html`
- `proof-of-creation/index.html`
- `programmable-ip/index.html`
- `content-provenance/index.html`
- `creator-ownership/index.html`
- `ai-voice-protection/index.html`
- `ai-likeness-protection/index.html`
- `human-authenticity-layer/index.html`
- `book/index.html`
- `book/thanks/index.html`
- `contact/index.html`
- `contact/thanks/index.html`
- `book-capture.php`
- `contact-submit.php`
- `robots.txt`
- `sitemap.xml`
- `tests/verify_site.py`

### Responsibility map

- `assets/css/site.css`: global design tokens, layout system, bright infrastructure visual language, page components, responsive rules
- `assets/js/site.js`: mobile nav toggle, optional form enhancement, small UI interactions only
- `assets/img/og-suede.svg`: default Open Graph image used across pages
- `index.html`: institutional homepage and internal-link hub
- concept and wedge page `index.html` files: keyword-specific landing pages
- `book/index.html`: thesis-led book funnel page with capture form
- thank-you pages: successful CTA destinations without relying on JavaScript
- `book-capture.php`: optional email capture handler for Namecheap shared hosting
- `contact-submit.php`: optional contact form handler for Namecheap shared hosting
- `robots.txt` and `sitemap.xml`: crawl and discovery assets
- `tests/verify_site.py`: test-first verification for metadata, internal links, canonical tags, schema, CTA links, and external link to `https://suedeai.ai/`

### Deck-informed implementation notes

The April 2026 pitch deck should influence the public-site copy in these places:

- homepage secondary headline and proof block should echo `Proof-of-Creation Infrastructure for the AI-Native Economy`
- homepage credibility section should compress the deck's system logic into `capture -> prove -> monetize`
- homepage or one concept page should translate the four-layer stack into a public-safe summary:
  - hardware anchor
  - storage vault
  - on-chain registry
  - AI agent
- credibility copy should prefer live infrastructure / revenue / deployed stack language over generic claims
- tokenomics and fundraise detail from the deck should not become a primary public-site focus

## Task 1: Initialize project skeleton and repository guardrails

**Files:**
- Create: `README.md`
- Create: directory skeleton for `assets/`, page folders, and `tests/`

- [ ] **Step 1: Write a failing project-shape check in the verifier scaffold**

Create `tests/verify_site.py` with this minimal failing check first:

```python
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_PATHS = [
    ROOT / "index.html",
    ROOT / "assets" / "css" / "site.css",
    ROOT / "assets" / "js" / "site.js",
    ROOT / "proof-of-creation" / "index.html",
]

missing = [str(path.relative_to(ROOT)) for path in REQUIRED_PATHS if not path.exists()]

if missing:
    print("FAIL: missing required paths")
    for path in missing:
        print(f"- {path}")
    sys.exit(1)

print("PASS: required paths exist")
```

- [ ] **Step 2: Run the verifier to confirm it fails**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: missing required paths
- index.html
- assets/css/site.css
- assets/js/site.js
- proof-of-creation/index.html
```

- [ ] **Step 3: Create the base directory structure and README**

Create the folders and `README.md` with:

```md
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
```

- [ ] **Step 4: Re-run the verifier after creating empty placeholders**

Create empty placeholder files for `index.html`, `assets/css/site.css`, `assets/js/site.js`, and `proof-of-creation/index.html`, then run:

`python3 tests/verify_site.py`

Expected:

```text
PASS: required paths exist
```

- [ ] **Step 5: Initialize git for execution checkpoints**

Run:

```bash
git init
git add README.md tests/verify_site.py index.html assets/css/site.css assets/js/site.js proof-of-creation/index.html
git commit -m "chore: initialize suede seo website scaffold"
```

Expected:

```text
Initialized empty Git repository
[main (root-commit) ...] chore: initialize suede seo website scaffold
```

## Task 2: Expand the verifier into a full SEO and structure test harness

**Files:**
- Modify: `tests/verify_site.py`

- [ ] **Step 1: Write the failing full-site verification checks**

Replace `tests/verify_site.py` with:

```python
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://suedeai.org"
MAIN_SITE_URL = "https://suedeai.ai/"

PAGES = {
    "index.html": "/",
    "proof-of-creation/index.html": "/proof-of-creation/",
    "programmable-ip/index.html": "/programmable-ip/",
    "content-provenance/index.html": "/content-provenance/",
    "creator-ownership/index.html": "/creator-ownership/",
    "ai-voice-protection/index.html": "/ai-voice-protection/",
    "ai-likeness-protection/index.html": "/ai-likeness-protection/",
    "human-authenticity-layer/index.html": "/human-authenticity-layer/",
    "book/index.html": "/book/",
    "contact/index.html": "/contact/",
}

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def assert_contains(label: str, haystack: str, needle: str, failures: list[str]) -> None:
    if needle not in haystack:
        failures.append(f"{label}: missing '{needle}'")

def assert_regex(label: str, haystack: str, pattern: str, failures: list[str]) -> None:
    if not re.search(pattern, haystack, re.IGNORECASE | re.MULTILINE):
        failures.append(f"{label}: missing pattern /{pattern}/")

def main() -> int:
    failures: list[str] = []

    for file_name, route in PAGES.items():
        path = ROOT / file_name
        if not path.exists():
            failures.append(f"{file_name}: file does not exist")
            continue

        html = read_text(path)
        canonical = f'{SITE_URL}{route}'

        assert_regex(file_name, html, r"<title>.+</title>", failures)
        assert_regex(file_name, html, r'<meta name="description" content="[^"]+">', failures)
        assert_contains(file_name, html, f'<link rel="canonical" href="{canonical}">', failures)
        assert_contains(file_name, html, 'property="og:title"', failures)
        assert_contains(file_name, html, 'property="og:description"', failures)
        assert_contains(file_name, html, 'property="og:image"', failures)
        assert_contains(file_name, html, 'name="twitter:card"', failures)
        assert_regex(file_name, html, r"<h1>.+</h1>", failures)
        assert_contains(file_name, html, 'type="application/ld+json"', failures)
        assert_contains(file_name, html, 'Talk to Suede', failures)
        assert_contains(file_name, html, MAIN_SITE_URL, failures)

    robots = ROOT / "robots.txt"
    sitemap = ROOT / "sitemap.xml"
    og_asset = ROOT / "assets" / "img" / "og-suede.svg"
    css_asset = ROOT / "assets" / "css" / "site.css"
    js_asset = ROOT / "assets" / "js" / "site.js"

    for asset in [robots, sitemap, og_asset, css_asset, js_asset]:
        if not asset.exists():
            failures.append(f"{asset.relative_to(ROOT)}: file does not exist")

    if robots.exists():
        robots_text = read_text(robots)
        assert_contains("robots.txt", robots_text, "Sitemap: https://suedeai.org/sitemap.xml", failures)

    if sitemap.exists():
        sitemap_text = read_text(sitemap)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/</loc>", failures)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/book/</loc>", failures)

    if failures:
        print("FAIL: site verification failed")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"PASS: verified {len(PAGES)} HTML pages and core SEO assets")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Run the verifier to confirm the expanded checks fail**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- programmable-ip/index.html: file does not exist
- content-provenance/index.html: file does not exist
- creator-ownership/index.html: file does not exist
- ai-voice-protection/index.html: file does not exist
- ai-likeness-protection/index.html: file does not exist
- human-authenticity-layer/index.html: file does not exist
- book/index.html: file does not exist
- contact/index.html: file does not exist
- robots.txt: file does not exist
- sitemap.xml: file does not exist
```

- [ ] **Step 3: Commit the failing test harness**

Run:

```bash
git add tests/verify_site.py
git commit -m "test: add site verification harness"
```

Expected:

```text
[main ...] test: add site verification harness
```

## Task 3: Build the shared visual system, global JavaScript, and homepage

**Files:**
- Modify: `assets/css/site.css`
- Modify: `assets/js/site.js`
- Modify: `index.html`
- Create: `assets/img/og-suede.svg`

- [ ] **Step 1: Write a focused failing assertion for the homepage hero**

Temporarily add this block inside `main()` in `tests/verify_site.py`, after reading `index.html`:

```python
home_html = read_text(ROOT / "index.html")
assert_contains("index.html", home_html, "Proof of Creation. Programmable IP.", failures)
assert_contains("index.html", home_html, "Get the Book", failures)
assert_contains("index.html", home_html, 'href="https://suedeai.ai/"', failures)
assert_contains("index.html", home_html, "Proof-of-Creation Infrastructure for the AI-Native Economy", failures)
assert_contains("index.html", home_html, "Capture -> Prove -> Monetize", failures)
```

- [ ] **Step 2: Run the verifier to confirm homepage-copy assertions fail**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- index.html: missing 'Proof of Creation. Programmable IP.'
- index.html: missing 'Get the Book'
- index.html: missing 'href="https://suedeai.ai/"'
- index.html: missing 'Proof-of-Creation Infrastructure for the AI-Native Economy'
- index.html: missing 'Capture -> Prove -> Monetize'
```

- [ ] **Step 3: Create the shared stylesheet**

Replace `assets/css/site.css` with:

```css
:root {
  --bg: #edf5ff;
  --bg-strong: #dcecff;
  --surface: rgba(255, 255, 255, 0.72);
  --surface-strong: #ffffff;
  --ink: #091426;
  --ink-soft: #3e536d;
  --line: rgba(12, 42, 84, 0.12);
  --line-strong: rgba(12, 42, 84, 0.22);
  --accent: #0057ff;
  --accent-soft: #d8e7ff;
  --dark: #08101d;
  --dark-soft: #0f1a2d;
  --success: #0e8b5b;
  --radius-lg: 28px;
  --radius-md: 20px;
  --radius-sm: 14px;
  --shadow-lg: 0 24px 80px rgba(7, 17, 32, 0.10);
  --shadow-md: 0 16px 40px rgba(7, 17, 32, 0.08);
  --max-width: 1180px;
  --font-sans: "Inter", "Segoe UI", sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--ink);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.55)),
    linear-gradient(rgba(15, 54, 108, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 54, 108, 0.05) 1px, transparent 1px),
    linear-gradient(180deg, var(--bg) 0%, #f8fbff 100%);
  background-size: auto, 40px 40px, 40px 40px, auto;
  line-height: 1.6;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}

.site-shell {
  width: min(calc(100% - 40px), var(--max-width));
  margin: 0 auto;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(14px);
  background: rgba(237, 245, 255, 0.82);
  border-bottom: 1px solid var(--line);
}

.site-header__inner,
.site-footer__inner {
  width: min(calc(100% - 40px), var(--max-width));
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 0;
}

.brand {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}

.brand__name {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.brand__tag {
  font-size: 0.78rem;
  color: var(--ink-soft);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.nav-toggle {
  display: none;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 18px;
}

.site-nav a {
  color: var(--ink-soft);
  font-size: 0.95rem;
}

.site-nav a:hover,
.site-nav a:focus-visible {
  color: var(--ink);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 700;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.button:hover,
.button:focus-visible {
  transform: translateY(-1px);
}

.button--primary {
  color: #ffffff;
  background: var(--accent);
  box-shadow: var(--shadow-md);
}

.button--secondary {
  background: var(--surface-strong);
  border-color: var(--line-strong);
}

.button--ghost {
  border-color: var(--line-strong);
  color: var(--ink-soft);
}

.hero {
  position: relative;
  overflow: hidden;
  padding: 88px 0 42px;
}

.hero__grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 32px;
  align-items: center;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 18px;
  color: var(--ink-soft);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero h1,
.page-hero h1 {
  margin: 0 0 18px;
  font-size: clamp(3rem, 6vw, 5.4rem);
  line-height: 0.96;
  letter-spacing: -0.06em;
}

.lede {
  max-width: 660px;
  margin: 0 0 24px;
  color: var(--ink-soft);
  font-size: 1.12rem;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 26px;
}

.hero-card,
.panel,
.keyword-card,
.cta-band,
.form-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.hero-card {
  position: relative;
  min-height: 420px;
  padding: 28px;
  background:
    radial-gradient(circle at 80% 22%, rgba(0,87,255,0.14), transparent 18%),
    linear-gradient(180deg, rgba(255,255,255,0.94), rgba(229,240,255,0.80));
}

.hero-card::before,
.signal-rings::before {
  content: "";
  position: absolute;
  right: 40px;
  top: 54px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  border: 1px solid rgba(0,87,255,0.22);
  box-shadow:
    0 0 0 20px rgba(0,87,255,0.08),
    0 0 0 58px rgba(0,87,255,0.05);
}

.metric-grid,
.card-grid,
.link-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.metric,
.keyword-card {
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.76);
}

.metric strong,
.keyword-card strong {
  display: inline-block;
  margin-bottom: 10px;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.section {
  padding: 34px 0 24px;
}

.section h2 {
  margin: 0 0 12px;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.section p,
.section li {
  color: var(--ink-soft);
}

.thesis-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.thesis-strip div,
.dark-band__item {
  padding: 18px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.7);
  font-weight: 700;
  line-height: 1.35;
}

.dark-band {
  margin: 28px 0;
  background: linear-gradient(180deg, var(--dark) 0%, var(--dark-soft) 100%);
  color: #eef5ff;
  border-radius: 32px;
  padding: 26px;
  box-shadow: var(--shadow-lg);
}

.dark-band__grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.8fr;
  gap: 18px;
}

.dark-band p,
.dark-band li,
.dark-band .eyebrow {
  color: rgba(238, 245, 255, 0.78);
}

.cta-band {
  padding: 28px;
  background: linear-gradient(135deg, #ffffff, #dcecff);
}

.page-hero {
  padding: 72px 0 18px;
}

.page-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
}

.sidebar-nav,
.form-card {
  padding: 22px;
  position: sticky;
  top: 94px;
}

.sidebar-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.content-stack {
  display: grid;
  gap: 20px;
}

.panel {
  padding: 26px;
}

.panel h2,
.panel h3 {
  margin-top: 0;
}

.site-footer {
  margin-top: 42px;
  background: linear-gradient(180deg, var(--dark) 0%, #050b14 100%);
  color: #eff6ff;
}

.site-footer a {
  color: rgba(239,246,255,0.82);
}

.site-footer p {
  color: rgba(239,246,255,0.72);
}

form {
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 8px;
  font-weight: 600;
}

input,
textarea {
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  padding: 14px 16px;
  font: inherit;
  color: var(--ink);
  background: #ffffff;
}

textarea {
  min-height: 140px;
  resize: vertical;
}

.note {
  font-size: 0.92rem;
  color: var(--ink-soft);
}

.success-hero {
  padding: 120px 0 80px;
}

@media (max-width: 980px) {
  .hero__grid,
  .page-layout,
  .dark-band__grid,
  .metric-grid,
  .card-grid,
  .link-grid,
  .thesis-strip {
    grid-template-columns: 1fr;
  }

  .site-nav {
    display: none;
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    padding-top: 16px;
  }

  .site-nav.is-open {
    display: flex;
  }

  .site-header__inner {
    flex-wrap: wrap;
  }

  .nav-toggle {
    display: inline-flex;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: #ffffff;
  }

  .sidebar-nav,
  .form-card {
    position: static;
  }
}
```

- [ ] **Step 4: Create the shared JavaScript**

Replace `assets/js/site.js` with:

```js
const toggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-site-nav]");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll("[data-form-status]").forEach((node) => {
  node.hidden = false;
});
```

- [ ] **Step 5: Create the default Open Graph asset**

Create `assets/img/og-suede.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">Suede — Proof of Creation. Programmable IP.</title>
  <desc id="desc">Bright infrastructure brand card for suedeai.org.</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#eef5ff"/>
      <stop offset="100%" stop-color="#d8e7ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g stroke="#0057ff" fill="none" opacity="0.22">
    <circle cx="960" cy="182" r="82"/>
    <circle cx="960" cy="182" r="132"/>
    <circle cx="960" cy="182" r="184"/>
  </g>
  <text x="92" y="120" fill="#47617e" font-family="Arial, sans-serif" font-size="24" letter-spacing="5">THE OWNERSHIP LAYER FOR THE AI ERA</text>
  <text x="92" y="272" fill="#08101d" font-family="Arial, sans-serif" font-size="88" font-weight="700">Proof of Creation.</text>
  <text x="92" y="368" fill="#08101d" font-family="Arial, sans-serif" font-size="88" font-weight="700">Programmable IP.</text>
  <text x="92" y="454" fill="#47617e" font-family="Arial, sans-serif" font-size="30">Verifiable ownership, provenance, voice, likeness, and rights infrastructure.</text>
  <text x="92" y="540" fill="#0057ff" font-family="Arial, sans-serif" font-size="28">suedeai.org</text>
</svg>
```

- [ ] **Step 6: Create the homepage**

Replace `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Suede | Proof of Creation. Programmable IP.</title>
  <meta name="description" content="Suede is the ownership layer for the AI era, turning creation into verifiable, ownable, programmable IP across provenance, voice, likeness, and rights infrastructure.">
  <link rel="canonical" href="https://suedeai.org/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Suede | Proof of Creation. Programmable IP.">
  <meta property="og:description" content="The ownership layer for the AI era. Real infrastructure for provenance, voice, likeness, and programmable IP.">
  <meta property="og:url" content="https://suedeai.org/">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Suede | Proof of Creation. Programmable IP.">
  <meta name="twitter:description" content="The ownership layer for the AI era.">
  <meta name="twitter:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Suede",
    "url": "https://suedeai.org/",
    "sameAs": ["https://suedeai.ai/"],
    "description": "Suede is the ownership layer for the AI era."
  }
  </script>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="brand" href="/">
        <span class="brand__name">Suede</span>
        <span class="brand__tag">Proof of Creation. Programmable IP.</span>
      </a>
      <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary">
        <a href="/proof-of-creation/">Proof of Creation</a>
        <a href="/programmable-ip/">Programmable IP</a>
        <a href="/creator-ownership/">Creator Ownership</a>
        <a href="/book/">Book</a>
        <a href="/contact/">Talk to Suede</a>
        <a href="https://suedeai.ai/" rel="noopener">Main Site</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="site-shell hero__grid">
        <div>
          <span class="eyebrow">The Ownership Layer For The AI Era</span>
          <h1>Proof of Creation.<br>Programmable IP.</h1>
          <p class="lede">Suede turns creation into verifiable, ownable, programmable IP across voice, likeness, media, and agent-native commerce.</p>
          <div class="button-row">
            <a class="button button--primary" href="/contact/">Talk to Suede</a>
            <a class="button button--secondary" href="/book/">Get the Book</a>
            <a class="button button--ghost" href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a>
          </div>
          <div class="metric-grid">
            <article class="metric">
              <strong>Creator Ownership</strong>
              <p>AI made creation abundant. Ownership became more important.</p>
            </article>
            <article class="metric">
              <strong>Voice + Likeness</strong>
              <p>Identity protection for AI-native media and commerce.</p>
            </article>
            <article class="metric">
              <strong>Rights Infrastructure</strong>
              <p>Undernoticed rails beneath the next media layer.</p>
            </article>
          </div>
        </div>
        <aside class="hero-card signal-rings">
          <span class="eyebrow">Proof-of-Creation Infrastructure for the AI-Native Economy</span>
          <h2>Creation changed. Ownership didn’t.</h2>
          <p>AI can generate content at infinite scale. Provenance, rights, licensing, and human authenticity still need rails.</p>
          <ul>
            <li>Verifiable provenance</li>
            <li>Programmable IP</li>
            <li>Human authenticity</li>
            <li>Ownership rails for AI media and agent commerce</li>
          </ul>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="site-shell">
        <div class="thesis-strip">
          <div>AI made creation abundant.</div>
          <div>Ownership did not upgrade with it.</div>
          <div>Suede is the rights layer that closes that gap.</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="site-shell">
        <span class="eyebrow">Commercial Wedge</span>
        <h2>Infrastructure first. Commercially clear.</h2>
        <div class="card-grid">
          <article class="keyword-card">
            <strong>Creator Ownership</strong>
            <p>Ownable provenance and rights infrastructure for creators, media, and AI-native outputs.</p>
            <a href="/creator-ownership/">Explore creator ownership</a>
          </article>
          <article class="keyword-card">
            <strong>Voice + Likeness</strong>
            <p>Protection and verification for identity-based rights as synthetic media scales.</p>
            <a href="/ai-voice-protection/">Explore voice protection</a>
          </article>
          <article class="keyword-card">
            <strong>Programmable Rights</strong>
            <p>Move from attribution theater to programmable ownership infrastructure.</p>
            <a href="/programmable-ip/">Explore programmable IP</a>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="site-shell dark-band">
        <div class="dark-band__grid">
          <div class="dark-band__item">
            <span class="eyebrow">Market Disconnect</span>
            <h2>Real infrastructure. Still early discovery.</h2>
            <p>The market still prices interfaces faster than ownership rails beneath them.</p>
          </div>
          <div class="dark-band__item">
            <strong>Why Now</strong>
            <p>If content becomes infinite, provenance becomes premium.</p>
          </div>
          <div class="dark-band__item">
            <strong>Capture -&gt; Prove -&gt; Monetize</strong>
            <p>Hardware anchor, on-chain provenance, and licensing rails compressed into one public-facing system story.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="site-shell">
        <span class="eyebrow">Ownership Cluster</span>
        <h2>Pages built to rank and reinforce.</h2>
        <div class="link-grid">
          <a class="keyword-card" href="/proof-of-creation/"><strong>Proof of Creation</strong><p>Verifiable authorship and provenance in the AI era.</p></a>
          <a class="keyword-card" href="/content-provenance/"><strong>Content Provenance</strong><p>Trust, attribution, and authenticity beyond surface metadata.</p></a>
          <a class="keyword-card" href="/human-authenticity-layer/"><strong>Human Authenticity Layer</strong><p>Identity and proof when media can be generated instantly.</p></a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="site-shell">
        <span class="eyebrow">System</span>
        <h2>Four layers. One ownership stack.</h2>
        <div class="card-grid">
          <article class="keyword-card">
            <strong>Hardware Anchor</strong>
            <p>Proof that starts at capture, not after distribution.</p>
          </article>
          <article class="keyword-card">
            <strong>On-Chain Registry</strong>
            <p>Transparent provenance and licensing rails.</p>
          </article>
          <article class="keyword-card">
            <strong>AI Agent</strong>
            <p>Autonomous rights and monetization logic for AI-native commerce.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="site-shell cta-band">
        <span class="eyebrow">Book</span>
        <h2>500 pages on AI, ownership, authorship, rights, and what the market is still missing.</h2>
        <p class="lede">A thesis-led guide for people who want more than surface-level commentary.</p>
        <div class="button-row">
          <a class="button button--primary" href="/book/">Get the Book</a>
          <a class="button button--secondary" href="/contact/">Talk to Suede</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="site-footer__inner">
      <div>
        <strong>Suede</strong>
        <p>Ownership rails for provenance, human authenticity, and programmable IP.</p>
      </div>
      <div class="button-row">
        <a href="/contact/">Talk to Suede</a>
        <a href="/book/">Get the Book</a>
        <a href="https://suedeai.ai/" rel="noopener">Main Site</a>
      </div>
    </div>
  </footer>
</body>
</html>
```

- [ ] **Step 7: Run the verifier to confirm homepage assertions now pass while other pages still fail**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- programmable-ip/index.html: file does not exist
- content-provenance/index.html: file does not exist
...
```

- [ ] **Step 8: Commit the shared system and homepage**

Run:

```bash
git add assets/css/site.css assets/js/site.js assets/img/og-suede.svg index.html tests/verify_site.py
git commit -m "feat: add global visual system and homepage"
```

Expected:

```text
[main ...] feat: add global visual system and homepage
```

## Task 4: Add the core concept pages for proof, programmable IP, and provenance

**Files:**
- Modify: `proof-of-creation/index.html`
- Create: `programmable-ip/index.html`
- Create: `content-provenance/index.html`

- [ ] **Step 1: Add failing assertions for concept-page keywords**

Append these checks inside `main()` in `tests/verify_site.py`:

```python
concept_expectations = {
    "proof-of-creation/index.html": "Proof of creation matters more when content becomes infinite.",
    "programmable-ip/index.html": "Programmable IP turns rights from paperwork into infrastructure.",
    "content-provenance/index.html": "Content provenance is what makes authenticity durable instead of performative."
}

for file_name, sentence in concept_expectations.items():
    path = ROOT / file_name
    if path.exists():
        assert_contains(file_name, read_text(path), sentence, failures)
```

- [ ] **Step 2: Run the verifier and confirm concept-copy checks fail**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- proof-of-creation/index.html: missing 'Proof of creation matters more when content becomes infinite.'
- programmable-ip/index.html: file does not exist
- content-provenance/index.html: file does not exist
```

- [ ] **Step 3: Create `proof-of-creation/index.html`**

Replace `proof-of-creation/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Proof of Creation | Suede</title>
  <meta name="description" content="Proof of creation is the missing ownership layer for the AI era. Suede makes authorship, provenance, and rights verifiable and programmable.">
  <link rel="canonical" href="https://suedeai.org/proof-of-creation/">
  <meta property="og:title" content="Proof of Creation | Suede">
  <meta property="og:description" content="Why proof of creation matters when content becomes infinite.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Proof of Creation",
    "url": "https://suedeai.org/proof-of-creation/",
    "description": "Why proof of creation matters when content becomes infinite."
  }
  </script>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Ownership Rails</span></a>
      <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary">
        <a href="/programmable-ip/">Programmable IP</a>
        <a href="/content-provenance/">Content Provenance</a>
        <a href="/book/">Get the Book</a>
        <a href="/contact/">Talk to Suede</a>
        <a href="https://suedeai.ai/" rel="noopener">Main Site</a>
      </nav>
    </div>
  </header>
  <main class="site-shell">
    <section class="page-hero">
      <span class="eyebrow">Proof of Creation</span>
      <h1>Proof of creation is the missing layer beneath AI media.</h1>
      <p class="lede">Proof of creation matters more when content becomes infinite. The more abundant generation becomes, the more valuable verifiable authorship, provenance, and rights become.</p>
    </section>
    <div class="page-layout">
      <div class="content-stack">
        <article class="panel">
          <h2>Why it matters in the AI era</h2>
          <p>AI upgraded creation speed. It did not upgrade ownership certainty. That gap is where attribution breaks, rights blur, and authenticity becomes harder to trust.</p>
        </article>
        <article class="panel">
          <h2>How Suede approaches proof</h2>
          <p>Suede treats proof as infrastructure. Creation becomes verifiable, ownable, and programmable instead of remaining a loose claim attached to content after the fact.</p>
        </article>
        <article class="panel">
          <h2>Related ownership concepts</h2>
          <ul>
            <li><a href="/programmable-ip/">Programmable IP</a></li>
            <li><a href="/content-provenance/">Content Provenance</a></li>
            <li><a href="/creator-ownership/">Creator Ownership</a></li>
          </ul>
        </article>
      </div>
      <aside class="sidebar-nav">
        <h2>Next</h2>
        <ul>
          <li><a href="/contact/">Talk to Suede</a></li>
          <li><a href="/book/">Get the Book</a></li>
          <li><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></li>
        </ul>
      </aside>
    </div>
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner"><p>Suede is the human authenticity and ownership layer for AI-era media.</p><a href="/contact/">Talk to Suede</a></div>
  </footer>
</body>
</html>
```

- [ ] **Step 4: Create `programmable-ip/index.html`**

Create:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Programmable IP | Suede</title>
  <meta name="description" content="Programmable IP turns rights into infrastructure. Suede brings ownership, licensing, and provenance into the AI era.">
  <link rel="canonical" href="https://suedeai.org/programmable-ip/">
  <meta property="og:title" content="Programmable IP | Suede">
  <meta property="og:description" content="Programmable IP for the AI era.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Programmable IP",
    "url": "https://suedeai.org/programmable-ip/",
    "description": "Programmable IP for the AI era."
  }
  </script>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Programmable IP</span></a>
      <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary">
        <a href="/proof-of-creation/">Proof of Creation</a>
        <a href="/content-provenance/">Content Provenance</a>
        <a href="/contact/">Talk to Suede</a>
        <a href="https://suedeai.ai/" rel="noopener">Main Site</a>
      </nav>
    </div>
  </header>
  <main class="site-shell">
    <section class="page-hero">
      <span class="eyebrow">Programmable IP</span>
      <h1>Rights become more valuable when they can move like software.</h1>
      <p class="lede">Programmable IP turns rights from paperwork into infrastructure. It brings ownership, licensing, and composability into AI-native media and agent commerce.</p>
    </section>
    <div class="page-layout">
      <div class="content-stack">
        <article class="panel">
          <h2>Why it matters in the AI era</h2>
          <p>Creation now scales at machine speed. Rights still move too slowly. That mismatch is where programmable IP becomes category infrastructure.</p>
        </article>
        <article class="panel">
          <h2>How Suede approaches programmable IP</h2>
          <p>Suede turns proof, provenance, and ownership logic into verifiable rails that can support licensing, attribution, and downstream rights logic.</p>
        </article>
        <article class="panel">
          <h2>Related concepts</h2>
          <ul>
            <li><a href="/proof-of-creation/">Proof of Creation</a></li>
            <li><a href="/creator-ownership/">Creator Ownership</a></li>
            <li><a href="/ai-likeness-protection/">AI Likeness Protection</a></li>
          </ul>
        </article>
      </div>
      <aside class="sidebar-nav">
        <h2>Action</h2>
        <ul>
          <li><a href="/contact/">Talk to Suede</a></li>
          <li><a href="/book/">Get the Book</a></li>
          <li><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></li>
        </ul>
      </aside>
    </div>
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner"><p>Programmable ownership for AI-era media and commerce.</p><a href="/contact/">Talk to Suede</a></div>
  </footer>
</body>
</html>
```

- [ ] **Step 5: Create `content-provenance/index.html`**

Create:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Content Provenance | Suede</title>
  <meta name="description" content="Content provenance is how authorship, authenticity, and ownership stay durable in the AI era. Suede provides the rights layer beneath that trust.">
  <link rel="canonical" href="https://suedeai.org/content-provenance/">
  <meta property="og:title" content="Content Provenance | Suede">
  <meta property="og:description" content="Content provenance for the AI era.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Content Provenance",
    "url": "https://suedeai.org/content-provenance/",
    "description": "Content provenance for the AI era."
  }
  </script>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Content Provenance</span></a>
      <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary">
        <a href="/proof-of-creation/">Proof of Creation</a>
        <a href="/programmable-ip/">Programmable IP</a>
        <a href="/contact/">Talk to Suede</a>
        <a href="https://suedeai.ai/" rel="noopener">Main Site</a>
      </nav>
    </div>
  </header>
  <main class="site-shell">
    <section class="page-hero">
      <span class="eyebrow">Content Provenance</span>
      <h1>Authenticity only compounds when provenance survives scale.</h1>
      <p class="lede">Content provenance is what makes authenticity durable instead of performative. In the AI era, proof needs infrastructure, not just platform labels.</p>
    </section>
    <div class="page-layout">
      <div class="content-stack">
        <article class="panel">
          <h2>Why it matters</h2>
          <p>As content becomes easier to generate, trust shifts from appearance to lineage. Provenance becomes the bridge between creation and ownership.</p>
        </article>
        <article class="panel">
          <h2>How Suede approaches provenance</h2>
          <p>Suede treats provenance as part of the ownership stack: proof, rights, identity, and programmable control all reinforce one another.</p>
        </article>
        <article class="panel">
          <h2>Related concepts</h2>
          <ul>
            <li><a href="/proof-of-creation/">Proof of Creation</a></li>
            <li><a href="/human-authenticity-layer/">Human Authenticity Layer</a></li>
            <li><a href="/ai-voice-protection/">AI Voice Protection</a></li>
          </ul>
        </article>
      </div>
      <aside class="sidebar-nav">
        <h2>Next</h2>
        <ul>
          <li><a href="/contact/">Talk to Suede</a></li>
          <li><a href="/book/">Get the Book</a></li>
          <li><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></li>
        </ul>
      </aside>
    </div>
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner"><p>Provenance becomes premium when content becomes infinite.</p><a href="/contact/">Talk to Suede</a></div>
  </footer>
</body>
</html>
```

- [ ] **Step 6: Run the verifier to confirm concept pages pass**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- creator-ownership/index.html: file does not exist
- ai-voice-protection/index.html: file does not exist
- ai-likeness-protection/index.html: file does not exist
- human-authenticity-layer/index.html: file does not exist
- book/index.html: file does not exist
- contact/index.html: file does not exist
- robots.txt: file does not exist
- sitemap.xml: file does not exist
```

- [ ] **Step 7: Commit the concept pages**

Run:

```bash
git add proof-of-creation/index.html programmable-ip/index.html content-provenance/index.html tests/verify_site.py
git commit -m "feat: add core ownership concept pages"
```

Expected:

```text
[main ...] feat: add core ownership concept pages
```

## Task 5: Add commercial wedge and narrative support pages

**Files:**
- Create: `creator-ownership/index.html`
- Create: `ai-voice-protection/index.html`
- Create: `ai-likeness-protection/index.html`
- Create: `human-authenticity-layer/index.html`

- [ ] **Step 1: Add failing assertions for wedge pages**

Append these checks to `tests/verify_site.py`:

```python
wedge_expectations = {
    "creator-ownership/index.html": "Creator ownership becomes more important as AI makes creation abundant.",
    "ai-voice-protection/index.html": "AI voice protection needs rights infrastructure, not just detection.",
    "ai-likeness-protection/index.html": "Likeness protection is a core ownership problem in synthetic media.",
    "human-authenticity-layer/index.html": "Human authenticity becomes premium when synthetic content is cheap."
}

for file_name, sentence in wedge_expectations.items():
    path = ROOT / file_name
    if path.exists():
        assert_contains(file_name, read_text(path), sentence, failures)
```

- [ ] **Step 2: Run the verifier and confirm wedge pages fail**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- creator-ownership/index.html: file does not exist
- ai-voice-protection/index.html: file does not exist
- ai-likeness-protection/index.html: file does not exist
- human-authenticity-layer/index.html: file does not exist
```

- [ ] **Step 3: Create `creator-ownership/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Creator Ownership | Suede</title>
  <meta name="description" content="Creator ownership infrastructure for the AI era. Suede brings provenance, rights, and programmable IP into one ownership layer.">
  <link rel="canonical" href="https://suedeai.org/creator-ownership/">
  <meta property="og:title" content="Creator Ownership | Suede">
  <meta property="og:description" content="Creator ownership for AI-era media.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Creator Ownership","url":"https://suedeai.org/creator-ownership/","description":"Creator ownership for AI-era media."}
  </script>
</head>
<body>
  <header class="site-header"><div class="site-header__inner"><a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Creator Ownership</span></a><button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary"><a href="/proof-of-creation/">Proof of Creation</a><a href="/programmable-ip/">Programmable IP</a><a href="/contact/">Talk to Suede</a><a href="https://suedeai.ai/" rel="noopener">Main Site</a></nav></div></header>
  <main class="site-shell">
    <section class="page-hero"><span class="eyebrow">Creator Ownership</span><h1>Ownership is the category that matters after creation becomes abundant.</h1><p class="lede">Creator ownership becomes more important as AI makes creation abundant. Scarcity shifts from production to provenance, identity, and rights.</p></section>
    <div class="page-layout"><div class="content-stack"><article class="panel"><h2>Why it matters</h2><p>Creation without durable ownership leaves value floating. The more media gets generated, the more creators need verifiable authorship and programmable control.</p></article><article class="panel"><h2>How Suede approaches creator ownership</h2><p>Suede combines proof of creation, provenance, and rights infrastructure into a single ownership layer that can support creators and platforms alike.</p></article><article class="panel"><h2>Related pages</h2><ul><li><a href="/proof-of-creation/">Proof of Creation</a></li><li><a href="/content-provenance/">Content Provenance</a></li><li><a href="/book/">Get the Book</a></li></ul></article></div><aside class="sidebar-nav"><h2>Action</h2><ul><li><a href="/contact/">Talk to Suede</a></li><li><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></li></ul></aside></div>
  </main>
  <footer class="site-footer"><div class="site-footer__inner"><p>Creation changed. Ownership didn’t.</p><a href="/contact/">Talk to Suede</a></div></footer>
</body>
</html>
```

- [ ] **Step 4: Create `ai-voice-protection/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Voice Protection | Suede</title>
  <meta name="description" content="AI voice protection requires more than detection. Suede brings provenance, rights, and ownership infrastructure to synthetic voice.">
  <link rel="canonical" href="https://suedeai.org/ai-voice-protection/">
  <meta property="og:title" content="AI Voice Protection | Suede">
  <meta property="og:description" content="AI voice protection needs rights infrastructure.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"AI Voice Protection","url":"https://suedeai.org/ai-voice-protection/","description":"AI voice protection for the ownership era."}
  </script>
</head>
<body>
  <header class="site-header"><div class="site-header__inner"><a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">AI Voice Protection</span></a><button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary"><a href="/content-provenance/">Content Provenance</a><a href="/ai-likeness-protection/">AI Likeness Protection</a><a href="/contact/">Talk to Suede</a><a href="https://suedeai.ai/" rel="noopener">Main Site</a></nav></div></header>
  <main class="site-shell">
    <section class="page-hero"><span class="eyebrow">AI Voice Protection</span><h1>Voice becomes a rights surface when media becomes synthetic.</h1><p class="lede">AI voice protection needs rights infrastructure, not just detection. Voice is identity, attribution, and ownership all at once.</p></section>
    <div class="page-layout"><div class="content-stack"><article class="panel"><h2>Why it matters</h2><p>Synthetic voice compresses creation and imitation into one workflow. Protection needs proof, control, and ownership logic that can travel with the media itself.</p></article><article class="panel"><h2>How Suede approaches voice protection</h2><p>Suede anchors voice protection in provenance, programmable rights, and identity-aware ownership rails.</p></article><article class="panel"><h2>Related pages</h2><ul><li><a href="/ai-likeness-protection/">AI Likeness Protection</a></li><li><a href="/human-authenticity-layer/">Human Authenticity Layer</a></li><li><a href="/contact/">Talk to Suede</a></li></ul></article></div><aside class="sidebar-nav"><h2>Action</h2><ul><li><a href="/contact/">Talk to Suede</a></li><li><a href="/book/">Get the Book</a></li><li><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></li></ul></aside></div>
  </main>
  <footer class="site-footer"><div class="site-footer__inner"><p>Identity protection for AI-native media and commerce.</p><a href="/contact/">Talk to Suede</a></div></footer>
</body>
</html>
```

- [ ] **Step 5: Create `ai-likeness-protection/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Likeness Protection | Suede</title>
  <meta name="description" content="AI likeness protection is an ownership problem. Suede provides the provenance and programmable rights layer beneath identity in synthetic media.">
  <link rel="canonical" href="https://suedeai.org/ai-likeness-protection/">
  <meta property="og:title" content="AI Likeness Protection | Suede">
  <meta property="og:description" content="Likeness protection for synthetic media.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"AI Likeness Protection","url":"https://suedeai.org/ai-likeness-protection/","description":"Likeness protection for synthetic media."}
  </script>
</head>
<body>
  <header class="site-header"><div class="site-header__inner"><a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">AI Likeness Protection</span></a><button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary"><a href="/ai-voice-protection/">AI Voice Protection</a><a href="/human-authenticity-layer/">Human Authenticity Layer</a><a href="/contact/">Talk to Suede</a><a href="https://suedeai.ai/" rel="noopener">Main Site</a></nav></div></header>
  <main class="site-shell">
    <section class="page-hero"><span class="eyebrow">AI Likeness Protection</span><h1>When identity can be generated, likeness becomes infrastructure.</h1><p class="lede">Likeness protection is a core ownership problem in synthetic media. Without verifiable rights and provenance, identity becomes cheap to copy and hard to defend.</p></section>
    <div class="page-layout"><div class="content-stack"><article class="panel"><h2>Why it matters</h2><p>Generative media turns identity into a programmable surface. Protection needs more than moderation workflows; it needs durable ownership rails.</p></article><article class="panel"><h2>How Suede approaches likeness protection</h2><p>Suede ties identity claims to proof, provenance, and programmable control, helping likeness function as protected rights-bearing media.</p></article><article class="panel"><h2>Related pages</h2><ul><li><a href="/ai-voice-protection/">AI Voice Protection</a></li><li><a href="/content-provenance/">Content Provenance</a></li><li><a href="/contact/">Talk to Suede</a></li></ul></article></div><aside class="sidebar-nav"><h2>Next</h2><ul><li><a href="/contact/">Talk to Suede</a></li><li><a href="/book/">Get the Book</a></li><li><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></li></ul></aside></div>
  </main>
  <footer class="site-footer"><div class="site-footer__inner"><p>Identity rights for the AI era.</p><a href="/contact/">Talk to Suede</a></div></footer>
</body>
</html>
```

- [ ] **Step 6: Create `human-authenticity-layer/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Human Authenticity Layer | Suede</title>
  <meta name="description" content="Human authenticity becomes premium when synthetic content is cheap. Suede is the ownership and provenance layer beneath that shift.">
  <link rel="canonical" href="https://suedeai.org/human-authenticity-layer/">
  <meta property="og:title" content="Human Authenticity Layer | Suede">
  <meta property="og:description" content="Human authenticity for the AI era.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Human Authenticity Layer","url":"https://suedeai.org/human-authenticity-layer/","description":"Human authenticity for the AI era."}
  </script>
</head>
<body>
  <header class="site-header"><div class="site-header__inner"><a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Human Authenticity Layer</span></a><button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary"><a href="/proof-of-creation/">Proof of Creation</a><a href="/content-provenance/">Content Provenance</a><a href="/contact/">Talk to Suede</a><a href="https://suedeai.ai/" rel="noopener">Main Site</a></nav></div></header>
  <main class="site-shell">
    <section class="page-hero"><span class="eyebrow">Human Authenticity Layer</span><h1>Authenticity becomes a premium layer when generation becomes infinite.</h1><p class="lede">Human authenticity becomes premium when synthetic content is cheap. Proof, provenance, and rights need to work together if identity is going to remain defensible.</p></section>
    <div class="page-layout"><div class="content-stack"><article class="panel"><h2>Why it matters</h2><p>The internet optimized access. AI optimized creation. The next upgrade is ownership and authenticity that can survive abundance.</p></article><article class="panel"><h2>How Suede approaches human authenticity</h2><p>Suede connects authorship, provenance, voice, likeness, and programmable rights into an ownership layer that makes human authenticity legible and durable.</p></article><article class="panel"><h2>Related pages</h2><ul><li><a href="/proof-of-creation/">Proof of Creation</a></li><li><a href="/ai-likeness-protection/">AI Likeness Protection</a></li><li><a href="/book/">Get the Book</a></li></ul></article></div><aside class="sidebar-nav"><h2>Action</h2><ul><li><a href="/contact/">Talk to Suede</a></li><li><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></li></ul></aside></div>
  </main>
  <footer class="site-footer"><div class="site-footer__inner"><p>The rights layer beneath human authenticity.</p><a href="/contact/">Talk to Suede</a></div></footer>
</body>
</html>
```

- [ ] **Step 7: Run the verifier to confirm wedge pages pass**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- book/index.html: file does not exist
- contact/index.html: file does not exist
- robots.txt: file does not exist
- sitemap.xml: file does not exist
```

- [ ] **Step 8: Commit the wedge pages**

Run:

```bash
git add creator-ownership/index.html ai-voice-protection/index.html ai-likeness-protection/index.html human-authenticity-layer/index.html tests/verify_site.py
git commit -m "feat: add commercial wedge and authenticity pages"
```

Expected:

```text
[main ...] feat: add commercial wedge and authenticity pages
```

## Task 6: Add the book funnel, contact flow, and optional PHP handlers

**Files:**
- Create: `book/index.html`
- Create: `book/thanks/index.html`
- Create: `contact/index.html`
- Create: `contact/thanks/index.html`
- Create: `book-capture.php`
- Create: `contact-submit.php`

- [ ] **Step 1: Add failing assertions for form actions and thank-you destinations**

Append these checks to `tests/verify_site.py`:

```python
form_expectations = {
    "book/index.html": 'action="/book-capture.php"',
    "contact/index.html": 'action="/contact-submit.php"',
    "book/thanks/index.html": "Thanks. The book request is in.",
    "contact/thanks/index.html": "Thanks. Your note is in."
}

for file_name, fragment in form_expectations.items():
    path = ROOT / file_name
    if path.exists():
        assert_contains(file_name, read_text(path), fragment, failures)
```

- [ ] **Step 2: Run the verifier and confirm form-page failures**

Run: `python3 tests/verify_site.py`

Expected:

```text
FAIL: site verification failed
- book/index.html: file does not exist
- contact/index.html: file does not exist
- book/thanks/index.html: file does not exist
- contact/thanks/index.html: file does not exist
```

- [ ] **Step 3: Create `book/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Get the Book | Suede</title>
  <meta name="description" content="Get Suede's thesis-led guide on AI, ownership, authorship, rights, and what the market is still missing.">
  <link rel="canonical" href="https://suedeai.org/book/">
  <meta property="og:title" content="Get the Book | Suede">
  <meta property="og:description" content="A 500-page thesis and guide on AI-era ownership.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Get the Book","url":"https://suedeai.org/book/","description":"A thesis-led book on AI ownership, authorship, and rights."}
  </script>
</head>
<body>
  <header class="site-header"><div class="site-header__inner"><a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Get the Book</span></a><button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary"><a href="/proof-of-creation/">Proof of Creation</a><a href="/contact/">Talk to Suede</a><a href="https://suedeai.ai/" rel="noopener">Main Site</a></nav></div></header>
  <main class="site-shell">
    <section class="page-hero"><span class="eyebrow">Book</span><h1>500 pages on AI, ownership, authorship, rights, and what the market is still missing.</h1><p class="lede">This is not a generic newsletter bribe. It is a thesis-led guide built from founder worldview, category framing, and practical writing on the future of ownership.</p></section>
    <div class="page-layout"><div class="content-stack"><article class="panel"><h2>What readers get</h2><ul><li>Founder thesis and category framing</li><li>Guides on ownership, authenticity, and rights</li><li>A sharper lens on what AI changes and what ownership still needs</li></ul></article><article class="panel"><h2>Why it matters</h2><p>Most people talk about generation. Fewer talk seriously about authorship, rights, and provenance. The book is for people who want the full stack of that argument.</p></article></div><aside class="form-card"><h2>Get the Book</h2><form action="/book-capture.php" method="post"><label>Email<input type="email" name="email" required></label><label>Name<input type="text" name="name"></label><label>What brought you here?<textarea name="context"></textarea></label><button class="button button--primary" type="submit">Get the Book</button><p class="note" data-form-status hidden>Static fallback: this form can submit directly on Namecheap shared hosting.</p></form></aside></div>
  </main>
  <footer class="site-footer"><div class="site-footer__inner"><p>Deep-conviction material for ownership in the AI era.</p><a href="/contact/">Talk to Suede</a></div></footer>
</body>
</html>
```

- [ ] **Step 4: Create `book/thanks/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Book Request Received | Suede</title>
  <meta name="description" content="Your Suede book request has been received.">
  <link rel="canonical" href="https://suedeai.org/book/thanks/">
  <meta property="og:title" content="Book Request Received | Suede">
  <meta property="og:description" content="Your Suede book request has been received.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Book Request Received","url":"https://suedeai.org/book/thanks/","description":"Book request confirmation."}
  </script>
</head>
<body>
  <main class="site-shell success-hero">
    <div class="panel">
      <span class="eyebrow">Book</span>
      <h1>Thanks. The book request is in.</h1>
      <p class="lede">If you need to reach the team directly while you wait, use the contact page.</p>
      <div class="button-row"><a class="button button--primary" href="/contact/">Talk to Suede</a><a class="button button--secondary" href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></div>
    </div>
  </main>
</body>
</html>
```

- [ ] **Step 5: Create `contact/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Talk to Suede | Contact</title>
  <meta name="description" content="Contact Suede about partnerships, investors, creator ownership, voice protection, likeness protection, and ownership infrastructure.">
  <link rel="canonical" href="https://suedeai.org/contact/">
  <meta property="og:title" content="Talk to Suede | Contact">
  <meta property="og:description" content="Contact Suede for partnerships, investors, and ownership infrastructure.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script defer src="/assets/js/site.js"></script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"ContactPage","name":"Talk to Suede","url":"https://suedeai.org/contact/","description":"Contact page for Suede."}
  </script>
</head>
<body>
  <header class="site-header"><div class="site-header__inner"><a class="brand" href="/"><span class="brand__name">Suede</span><span class="brand__tag">Talk to Suede</span></a><button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" data-site-nav aria-label="Primary"><a href="/proof-of-creation/">Proof of Creation</a><a href="/book/">Get the Book</a><a href="https://suedeai.ai/" rel="noopener">Main Site</a></nav></div></header>
  <main class="site-shell">
    <section class="page-hero"><span class="eyebrow">Contact</span><h1>Talk to Suede.</h1><p class="lede">Partnerships, investors, creator ownership, voice and likeness protection, or deeper infrastructure conversations.</p></section>
    <div class="page-layout"><div class="content-stack"><article class="panel"><h2>What to use this for</h2><ul><li>Partnership inquiries</li><li>Investor conversations</li><li>Ownership and authenticity infrastructure</li><li>Voice or likeness protection discussions</li></ul></article><article class="panel"><h2>Main site</h2><p>If you want the broader company surface, visit <a href="https://suedeai.ai/" rel="noopener">suedeai.ai</a>.</p></article></div><aside class="form-card"><h2>Send a note</h2><form action="/contact-submit.php" method="post"><label>Name<input type="text" name="name" required></label><label>Email<input type="email" name="email" required></label><label>Topic<input type="text" name="topic"></label><label>Message<textarea name="message" required></textarea></label><button class="button button--primary" type="submit">Talk to Suede</button><p class="note" data-form-status hidden>Static fallback: this form posts directly on shared hosting.</p></form></aside></div>
  </main>
  <footer class="site-footer"><div class="site-footer__inner"><p>Real infrastructure for ownership in the AI era.</p><a href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></div></footer>
</body>
</html>
```

- [ ] **Step 6: Create `contact/thanks/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Message Received | Suede</title>
  <meta name="description" content="Your message to Suede has been received.">
  <link rel="canonical" href="https://suedeai.org/contact/thanks/">
  <meta property="og:title" content="Message Received | Suede">
  <meta property="og:description" content="Your message to Suede has been received.">
  <meta property="og:image" content="https://suedeai.org/assets/img/og-suede.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Message Received","url":"https://suedeai.org/contact/thanks/","description":"Contact confirmation page."}
  </script>
</head>
<body>
  <main class="site-shell success-hero">
    <div class="panel">
      <span class="eyebrow">Contact</span>
      <h1>Thanks. Your note is in.</h1>
      <p class="lede">If you want broader context while you wait, visit the main site or explore the ownership pages.</p>
      <div class="button-row"><a class="button button--primary" href="/">Back to Home</a><a class="button button--secondary" href="https://suedeai.ai/" rel="noopener">Visit suedeai.ai</a></div>
    </div>
  </main>
</body>
</html>
```

- [ ] **Step 7: Create `book-capture.php`**

```php
<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /book/');
    exit;
}

$email = trim((string) ($_POST['email'] ?? ''));
$name = trim((string) ($_POST['name'] ?? ''));
$context = trim((string) ($_POST['context'] ?? ''));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: /book/?error=invalid-email');
    exit;
}

$line = sprintf(
    "[%s]\t%s\t%s\t%s\n",
    date('c'),
    $email,
    $name,
    preg_replace('/\s+/', ' ', $context)
);

file_put_contents(__DIR__ . '/book-capture.log', $line, FILE_APPEND | LOCK_EX);

header('Location: /book/thanks/');
exit;
```

- [ ] **Step 8: Create `contact-submit.php`**

```php
<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /contact/');
    exit;
}

$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$topic = trim((string) ($_POST['topic'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));

if ($name === '' || $message === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: /contact/?error=invalid-form');
    exit;
}

$line = sprintf(
    "[%s]\t%s\t%s\t%s\t%s\n",
    date('c'),
    $name,
    $email,
    $topic,
    preg_replace('/\s+/', ' ', $message)
);

file_put_contents(__DIR__ . '/contact-submit.log', $line, FILE_APPEND | LOCK_EX);

header('Location: /contact/thanks/');
exit;
```

- [ ] **Step 9: Run the verifier and PHP syntax checks**

Run:

```bash
python3 tests/verify_site.py
php -l book-capture.php
php -l contact-submit.php
```

Expected:

```text
FAIL: site verification failed
- robots.txt: file does not exist
- sitemap.xml: file does not exist
No syntax errors detected in book-capture.php
No syntax errors detected in contact-submit.php
```

- [ ] **Step 10: Commit the funnel and form flow**

Run:

```bash
git add book/index.html book/thanks/index.html contact/index.html contact/thanks/index.html book-capture.php contact-submit.php tests/verify_site.py
git commit -m "feat: add book funnel and contact forms"
```

Expected:

```text
[main ...] feat: add book funnel and contact forms
```

## Task 7: Add crawl assets, finish metadata coverage, and pass verification

**Files:**
- Create: `robots.txt`
- Create: `sitemap.xml`
- Modify: all HTML pages as needed for missing metadata/link fixes

- [ ] **Step 1: Create `robots.txt`**

```txt
User-agent: *
Allow: /

Sitemap: https://suedeai.org/sitemap.xml
```

- [ ] **Step 2: Create `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://suedeai.org/</loc></url>
  <url><loc>https://suedeai.org/proof-of-creation/</loc></url>
  <url><loc>https://suedeai.org/programmable-ip/</loc></url>
  <url><loc>https://suedeai.org/content-provenance/</loc></url>
  <url><loc>https://suedeai.org/creator-ownership/</loc></url>
  <url><loc>https://suedeai.org/ai-voice-protection/</loc></url>
  <url><loc>https://suedeai.org/ai-likeness-protection/</loc></url>
  <url><loc>https://suedeai.org/human-authenticity-layer/</loc></url>
  <url><loc>https://suedeai.org/book/</loc></url>
  <url><loc>https://suedeai.org/contact/</loc></url>
</urlset>
```

- [ ] **Step 3: Run the verifier and fix any remaining failures inline**

Run: `python3 tests/verify_site.py`

Expected:

```text
PASS: verified 10 HTML pages and core SEO assets
```

If any page still fails, fix that page immediately before moving on. Typical fixes:

```html
<meta name="twitter:card" content="summary_large_image">
<a href="https://suedeai.ai/" rel="noopener">Main Site</a>
<a href="/contact/">Talk to Suede</a>
```

- [ ] **Step 4: Manually smoke-test the site locally**

Run:

```bash
python3 -m http.server 8000
```

Open:

- `http://localhost:8000/`
- `http://localhost:8000/proof-of-creation/`
- `http://localhost:8000/book/`
- `http://localhost:8000/contact/`

Expected:

```text
Pages render without missing stylesheet or script errors.
Navigation links resolve.
Forms submit to PHP endpoints when hosted with PHP; static HTML renders cleanly even without PHP execution.
```

- [ ] **Step 5: Commit the final SEO and crawl assets**

Run:

```bash
git add robots.txt sitemap.xml
git commit -m "feat: add sitemap robots and final seo coverage"
```

Expected:

```text
[main ...] feat: add sitemap robots and final seo coverage
```

## Task 8: Final verification and deployment handoff

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add deployment notes to `README.md`**

Append:

```md
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
```

- [ ] **Step 2: Run the full verification suite one last time**

Run:

```bash
python3 tests/verify_site.py
php -l book-capture.php
php -l contact-submit.php
```

Expected:

```text
PASS: verified 10 HTML pages and core SEO assets
No syntax errors detected in book-capture.php
No syntax errors detected in contact-submit.php
```

- [ ] **Step 3: Commit the deployment handoff**

Run:

```bash
git add README.md
git commit -m "docs: add deployment and verification notes"
```

Expected:

```text
[main ...] docs: add deployment and verification notes
```

## Self-Review

### Spec coverage

- institutional homepage: covered in Task 3
- concept pages for proof, programmable IP, provenance: covered in Task 4
- wedge pages for creator ownership, voice, likeness, authenticity: covered in Task 5
- book funnel and contact path: covered in Task 6
- optional Namecheap PHP support: covered in Task 6
- sitemap, robots, metadata, internal linking: covered in Task 7
- main site linking to `https://suedeai.ai/`: enforced in Tasks 2 through 7
- deployment and verification notes: covered in Task 8
- deck-derived credibility language and system framing: added to Task 3

### Placeholder scan

No `TODO`, `TBD`, or deferred implementation markers remain in this plan.

### Type consistency

- canonical URLs use `https://suedeai.org/...` consistently
- main site links use `https://suedeai.ai/` consistently
- CTA naming uses `Talk to Suede` and `Get the Book` consistently
- PHP handler filenames match form actions exactly
