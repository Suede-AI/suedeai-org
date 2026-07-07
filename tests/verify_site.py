from pathlib import Path
import re
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://suedeai.org"
MAIN_SITE_URL = "https://suedeai.ai/"
FAVICON_VERSION = "v=3"

LEGACY_REDIRECTS = {
    "/home/": "/",
    "/guide/": "/book/",
    "/ai/": "/",
}

NOINDEX_PAGES = [
    "book/thanks/index.html",
    "contact/thanks/index.html",
    "investors/thanks/index.html",
    "book-a-call/thanks/index.html",
    "welcome-back/index.html",
]

PAGES = {
    "index.html": "/",
    "proof-of-creation/index.html": "/proof-of-creation/",
    "why-copyright-fails/index.html": "/why-copyright-fails/",
    "royalties/index.html": "/royalties/",
    "programmable-ip/index.html": "/programmable-ip/",
    "agentic-commerce/index.html": "/agentic-commerce/",
    "content-provenance/index.html": "/content-provenance/",
    "creator-ownership/index.html": "/creator-ownership/",
    "jason-colapietro/index.html": "/jason-colapietro/",
    "ai-voice-protection/index.html": "/ai-voice-protection/",
    "ai-likeness-protection/index.html": "/ai-likeness-protection/",
    "human-authenticity-layer/index.html": "/human-authenticity-layer/",
    "book/index.html": "/book/",
    "sharp-excerpt/index.html": "/sharp-excerpt/",
    "full-preview/index.html": "/full-preview/",
    "contact/index.html": "/contact/",
    "investors/index.html": "/investors/",
    "book-a-call/index.html": "/book-a-call/",
}

PREVIEW_PDF_PATH = "/assets/files/stake-your-claim-condensed-preview.pdf"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def assert_contains(label: str, haystack: str, needle: str, failures: list[str]) -> None:
    if needle not in haystack:
        failures.append(f"{label}: missing '{needle}'")


def assert_regex(label: str, haystack: str, pattern: str, failures: list[str], flags: int = re.IGNORECASE | re.MULTILINE) -> None:
    if not re.search(pattern, haystack, flags):
        failures.append(f"{label}: missing pattern /{pattern}/")


def main() -> int:
    failures: list[str] = []
    stale_founder_url_pattern = r'"@id"\s*:\s*"https://suedeai\.ai/founder#person"[\s\S]{0,2000}?"url"\s*:\s*"https://suedeai\.org/jason-colapietro/"'
    public_regression_phrases = [
        "Published author of five books",
        "published author of five books",
        "author of five books",
        "5x published author",
        "three published books",
        "Suede Studio Guitar",
        "suede-studio-guitar",
        "Suede Studio Inspiration",
        "suede-studio-inspiration",
        "Suede Agents: AI That Earns",
        "suede-agents-ai-that-earns",
        "24 production x402 paid endpoints",
        "24 production x402 endpoints",
        "24 live x402 paid endpoints",
        "24 production paid endpoints",
        "24 agent-payable x402 endpoints",
    ]
    dead_asins = [
        "B0GMBBWHMQ",
    ]
    dead_urls = [
        "https://www.amazon.com/author/johnnysuede",
    ]
    guitar_wrong_asin_patterns = [
        r'href="https://www\.amazon\.com/dp/B0GD5FX6N6"[^>]*>The Guitar Without a Number',
        r'"name"\s*:\s*"The Guitar Without a Number"[\s\S]{0,500}?"url"\s*:\s*"https://www\.amazon\.com/dp/B0GD5FX6N6"',
    ]

    home_path = ROOT / "index.html"
    if home_path.exists():
        home_html = read_text(home_path)
        # New "Creative rails for the AI era" content strings — root is now the Suede Labs investor thesis page
        assert_contains("index.html", home_html, "Creative rails for the", failures)
        assert_contains("index.html", home_html, "AI era.", failures)
        assert_contains("index.html", home_html, "Suede Labs", failures)
        assert_contains("index.html", home_html, "Suede Labs investor thesis", failures)
        assert_contains("index.html", home_html, "Talk to Suede", failures)
        assert_contains("index.html", home_html, "Jason Colapietro", failures)
        assert_contains("index.html", home_html, 'href="https://suedeai.ai/"', failures)
        # Root SEO presence — restored after the "Creative rails" redesign
        assert_contains("index.html", home_html, '<link rel="canonical" href="https://suedeai.org/"', failures)
        assert_contains("index.html", home_html, '<link rel="icon" href="/favicon.ico?v=3" sizes="any">', failures)
        assert_contains("index.html", home_html, '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3">', failures)
        assert_contains("index.html", home_html, '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3">', failures)
        assert_contains("index.html", home_html, '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3">', failures)
        assert_contains("index.html", home_html, '<link rel="manifest" href="/site.webmanifest">', failures)
        assert_contains("index.html", home_html, 'property="og:title"', failures)
        assert_contains("index.html", home_html, 'property="og:description"', failures)
        assert_contains("index.html", home_html, 'property="og:image"', failures)
        assert_contains("index.html", home_html, 'property="og:url"', failures)
        assert_contains("index.html", home_html, 'name="twitter:card"', failures)
        assert_contains("index.html", home_html, 'type="application/ld+json"', failures)
        # JSON-LD must include Organization (Suede Labs) and Person (Jason Colapietro)
        assert_contains("index.html", home_html, '"@type": "Organization"', failures)
        assert_contains("index.html", home_html, '"@type": "Person"', failures)
        assert_contains("index.html", home_html, '"@id": "https://suedeai.ai/founder#person"', failures)
        assert_contains("index.html", home_html, '"url": "https://suedeai.ai/founder"', failures)
        assert_contains("index.html", home_html, '"https://suedeai.org/jason-colapietro/"', failures)

    h1_pattern = r"<h1\b[^>]*>.*?</h1>"
    h1_flags = re.IGNORECASE | re.DOTALL

    for file_name, route in PAGES.items():
        path = ROOT / file_name
        if not path.exists():
            failures.append(f"{file_name}: file does not exist")
            continue

        html = read_text(path)
        canonical = f"{SITE_URL}{route}"

        assert_regex(file_name, html, r"<title>.+</title>", failures)
        # Allow multi-line/whitespace-formatted description tags so the regex works against
        # both compact subpage markup and the prettier multi-line root markup.
        assert_regex(file_name, html, r'<meta\s+name="description"\s+content="[^"]+"', failures, flags=re.IGNORECASE | re.DOTALL)
        assert_contains(file_name, html, f'<link rel="canonical" href="{canonical}"', failures)
        assert_contains(file_name, html, f'<link rel="icon" href="/favicon.ico?{FAVICON_VERSION}" sizes="any">', failures)
        assert_contains(file_name, html, f'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?{FAVICON_VERSION}">', failures)
        assert_contains(file_name, html, f'<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?{FAVICON_VERSION}">', failures)
        assert_contains(file_name, html, f'<link rel="apple-touch-icon" href="/apple-touch-icon.png?{FAVICON_VERSION}">', failures)
        assert_contains(file_name, html, '<link rel="manifest" href="/site.webmanifest">', failures)
        assert_contains(file_name, html, 'property="og:title"', failures)
        assert_contains(file_name, html, 'property="og:description"', failures)
        assert_contains(file_name, html, 'property="og:image"', failures)
        assert_contains(file_name, html, 'name="twitter:card"', failures)
        assert_regex(file_name, html, h1_pattern, failures, flags=h1_flags)
        assert_contains(file_name, html, 'type="application/ld+json"', failures)
        assert_contains(file_name, html, MAIN_SITE_URL, failures)

    founder_path = ROOT / "jason-colapietro" / "index.html"
    if founder_path.exists():
        founder_html = read_text(founder_path)
        assert_contains("jason-colapietro/index.html", founder_html, '"@id": "https://suedeai.ai/founder#person"', failures)
        assert_contains("jason-colapietro/index.html", founder_html, '"url": "https://suedeai.ai/founder"', failures)
        assert_contains("jason-colapietro/index.html", founder_html, 'href="https://suedeai.ai/founder"', failures)

    for html_path in ROOT.rglob("*.html"):
        html_text = read_text(html_path)
        if re.search(stale_founder_url_pattern, html_text, re.IGNORECASE | re.MULTILINE):
            relative_path = html_path.relative_to(ROOT).as_posix()
            failures.append(
                f"{relative_path}: founder person @id uses supporting profile URL instead of https://suedeai.ai/founder"
            )
        lower_html_text = html_text.lower()
        for phrase in public_regression_phrases:
            if phrase.lower() in lower_html_text:
                relative_path = html_path.relative_to(ROOT).as_posix()
                failures.append(f"{relative_path}: stale public phrase '{phrase}'")
        for asin in dead_asins:
            if asin in html_text:
                relative_path = html_path.relative_to(ROOT).as_posix()
                failures.append(f"{relative_path}: dead Amazon ASIN '{asin}'")
        for url in dead_urls:
            if url in html_text:
                relative_path = html_path.relative_to(ROOT).as_posix()
                failures.append(f"{relative_path}: dead public URL '{url}'")
        for pattern in guitar_wrong_asin_patterns:
            if re.search(pattern, html_text, re.IGNORECASE | re.MULTILINE):
                relative_path = html_path.relative_to(ROOT).as_posix()
                failures.append(
                    f"{relative_path}: The Guitar Without a Number points to the Human Authenticity ASIN"
                )

    for text_path in [ROOT / "llms.txt", ROOT / "llms-full.txt"]:
        if text_path.exists():
            text = read_text(text_path)
            lower_text = text.lower()
            for phrase in public_regression_phrases:
                if phrase.lower() in lower_text:
                    relative_path = text_path.relative_to(ROOT).as_posix()
                    failures.append(f"{relative_path}: stale public phrase '{phrase}'")
            for asin in dead_asins:
                if asin in text:
                    relative_path = text_path.relative_to(ROOT).as_posix()
                    failures.append(f"{relative_path}: dead Amazon ASIN '{asin}'")
            for url in dead_urls:
                if url in text:
                    relative_path = text_path.relative_to(ROOT).as_posix()
                    failures.append(f"{relative_path}: dead public URL '{url}'")

    llms_path = ROOT / "llms.txt"
    if llms_path.exists():
        llms_text = read_text(llms_path)
        assert_contains("llms.txt", llms_text, "Canonical founder entity: https://suedeai.ai/founder", failures)
        assert_contains("llms.txt", llms_text, "Supporting founder profile: https://suedeai.org/jason-colapietro/", failures)

    pages_requiring_contact = [
        "index.html",
        "proof-of-creation/index.html",
        "why-copyright-fails/index.html",
        "royalties/index.html",
        "programmable-ip/index.html",
        "content-provenance/index.html",
        "creator-ownership/index.html",
        "jason-colapietro/index.html",
        "ai-voice-protection/index.html",
        "ai-likeness-protection/index.html",
        "human-authenticity-layer/index.html",
        "book/index.html",
        "sharp-excerpt/index.html",
        "full-preview/index.html",
        "contact/index.html",
        "book-a-call/index.html",
    ]

    for file_name in pages_requiring_contact:
        path = ROOT / file_name
        if path.exists():
            assert_contains(file_name, read_text(path), "Talk to Suede", failures)

    concept_expectations = {
        "proof-of-creation/index.html": "Proof of creation makes authorship, provenance, and creator rights verifiable",
        "why-copyright-fails/index.html": "Copyright tries to protect ownership after distribution.",
        "royalties/index.html": "You cannot automate royalties on content you cannot verify.",
        "programmable-ip/index.html": "Programmable IP moves ownership, licensing, attribution, and usage rules",
        "agentic-commerce/index.html": "Rights need a payment layer. ACP and x402 are how agents pay for them.",
        "content-provenance/index.html": "Content provenance records the source, authorship, and ownership context",
    }

    for file_name, sentence in concept_expectations.items():
        path = ROOT / file_name
        if path.exists():
            assert_contains(file_name, read_text(path), sentence, failures)

    wedge_expectations = {
        "creator-ownership/index.html": "Creator ownership becomes more important as AI makes production easier.",
        "ai-voice-protection/index.html": "AI voice protection is a rights problem, not just a detection problem.",
        "ai-likeness-protection/index.html": "AI likeness protection starts with ownership, consent, and proof.",
        "human-authenticity-layer/index.html": "Human authenticity becomes premium when synthetic content is cheap.",
    }

    for file_name, sentence in wedge_expectations.items():
        path = ROOT / file_name
        if path.exists():
            assert_contains(file_name, read_text(path), sentence, failures)

    # Form expectations match the current Vercel-API-only flow. The PHP shared-hosting
    # fallback was removed; book and contact submit directly to /api/book/ and /api/contact/.
    form_expectations = {
        "book/index.html": [
            'action="/api/book/"',
            'data-api-endpoint="/api/book/"',
            "Email Me the Preview",
            'name="company_url"',
        ],
        "sharp-excerpt/index.html": [
            "The sharp excerpt",
            'href="/full-preview/"',
            'href="/book/#get-the-book"',
            PREVIEW_PDF_PATH,
        ],
        "full-preview/index.html": [
            "Read the condensed preview",
            PREVIEW_PDF_PATH,
            'href="/book/#get-the-book"',
        ],
        "contact/index.html": [
            'action="/api/contact/"',
            'data-api-endpoint="/api/contact/"',
        ],
        "book/thanks/index.html": [
            "Your request is in.",
        ],
        "contact/thanks/index.html": [
            "Thanks. Your note is in.",
        ],
        "investors/index.html": [
            'action="/api/investors/"',
            'data-api-endpoint="/api/investors/"',
            "who owns the rails",
        ],
        "investors/thanks/index.html": [
            "Your request is in.",
        ],
        "book-a-call/index.html": [
            'action="/api/book-call/"',
            'data-api-endpoint="/api/book-call/"',
            "Request a Call",
        ],
        "book-a-call/thanks/index.html": [
            "Your request is in.",
        ],
    }

    for file_name, fragments in form_expectations.items():
        path = ROOT / file_name
        if path.exists():
            html = read_text(path)
            for fragment in fragments:
                assert_contains(file_name, html, fragment, failures)

    robots = ROOT / "robots.txt"
    sitemap = ROOT / "sitemap.xml"
    vercel_config = ROOT / "vercel.json"
    og_asset = ROOT / "assets" / "img" / "og-suede.svg"
    og_asset_png = ROOT / "assets" / "img" / "og-suede.png"
    cover_asset = ROOT / "assets" / "img" / "stake-your-claim-cover.jpg"
    pdf_asset = ROOT / "assets" / "files" / "stake-your-claim-condensed-preview.pdf"
    css_asset = ROOT / "assets" / "css" / "site.css"
    investors_css = ROOT / "assets" / "css" / "investors.css"
    js_asset = ROOT / "assets" / "js" / "site.js"
    favicon_ico = ROOT / "favicon.ico"
    favicon_svg = ROOT / "favicon.svg"
    favicon_16 = ROOT / "favicon-16x16.png"
    favicon_32 = ROOT / "favicon-32x32.png"
    apple_touch_icon = ROOT / "apple-touch-icon.png"
    webmanifest = ROOT / "site.webmanifest"
    llms_txt = ROOT / "llms.txt"
    llms_full = ROOT / "llms-full.txt"
    license_file = ROOT / "LICENSE"

    for asset in [
        robots,
        sitemap,
        vercel_config,
        og_asset,
        og_asset_png,
        cover_asset,
        pdf_asset,
        css_asset,
        investors_css,
        js_asset,
        favicon_ico,
        favicon_svg,
        favicon_16,
        favicon_32,
        apple_touch_icon,
        webmanifest,
        llms_txt,
        llms_full,
        license_file,
    ]:
        if not asset.exists():
            failures.append(f"{asset.relative_to(ROOT)}: file does not exist")

    book_api = ROOT / "api" / "book.js"
    if book_api.exists():
        book_api_text = read_text(book_api)
        for fragment in [
            "buildReaderPreviewEmail",
            "https://suedeai.org/sharp-excerpt/",
            "https://suedeai.org/full-preview/",
            f"https://suedeai.org{PREVIEW_PDF_PATH}",
            "Stake Your Claim reader preview",
            "https://suedeai.org/book-a-call/",
            "Book a Call",
            "company_url",
        ]:
            assert_contains("api/book.js", book_api_text, fragment, failures)

    book_call_api = ROOT / "api" / "book-call.js"
    if book_call_api.exists():
        book_call_api_text = read_text(book_call_api)
        for fragment in [
            "call_requests",
            "suedeai.org/book-a-call",
            "/book-a-call/thanks/",
        ]:
            assert_contains("api/book-call.js", book_call_api_text, fragment, failures)

    investors_api = ROOT / "api" / "investors.js"
    if investors_api.exists():
        investors_api_text = read_text(investors_api)
        for fragment in [
            "investor_leads",
            "suedeai.org/investors",
            "INVESTOR_NOTIFY_TO",
        ]:
            assert_contains("api/investors.js", investors_api_text, fragment, failures)

    if vercel_config.exists():
        config = json.loads(read_text(vercel_config))
        redirect_map = {
            redirect.get("source"): redirect
            for redirect in config.get("redirects", [])
        }

        for source, destination in LEGACY_REDIRECTS.items():
            redirect = redirect_map.get(source)
            if not redirect:
                failures.append(f"vercel.json: missing redirect for {source}")
                continue
            if redirect.get("destination") != destination:
                failures.append(
                    f"vercel.json: {source} redirects to {redirect.get('destination')}, expected {destination}"
                )
            if redirect.get("permanent") is not True:
                failures.append(f"vercel.json: {source} redirect is not permanent")

    for file_name in NOINDEX_PAGES:
        path = ROOT / file_name
        if path.exists():
            assert_contains(
                file_name,
                read_text(path),
                '<meta name="robots" content="noindex, follow">',
                failures,
            )

    if robots.exists():
        robots_text = read_text(robots)
        assert_contains("robots.txt", robots_text, "Sitemap: https://suedeai.org/sitemap.xml", failures)
        # AI-crawler allowlist must be explicit so Suede Labs content is indexed by the major LLM crawlers.
        for crawler in [
            "GPTBot",
            "ClaudeBot",
            "anthropic-ai",
            "PerplexityBot",
            "Applebot-Extended",
            "Google-Extended",
            "Meta-ExternalAgent",
            "CCBot",
        ]:
            assert_contains("robots.txt", robots_text, f"User-agent: {crawler}", failures)

    if sitemap.exists():
        sitemap_text = read_text(sitemap)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/</loc>", failures)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/book/</loc>", failures)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/agentic-commerce/</loc>", failures)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/sharp-excerpt/</loc>", failures)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/full-preview/</loc>", failures)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/investors/</loc>", failures)
        assert_contains("sitemap.xml", sitemap_text, "<loc>https://suedeai.org/book-a-call/</loc>", failures)

    if failures:
        print("FAIL: site verification failed")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"PASS: verified {len(PAGES)} HTML pages and core assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
