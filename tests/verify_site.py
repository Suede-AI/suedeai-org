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

    home_path = ROOT / "index.html"
    if home_path.exists():
        home_html = read_text(home_path)
        assert_contains("index.html", home_html, "Proof of Creation. Programmable IP.", failures)
        assert_contains("index.html", home_html, "Get the Book", failures)
        assert_contains("index.html", home_html, 'href="https://suedeai.ai/"', failures)
        assert_contains(
            "index.html",
            home_html,
            "Proof-of-Creation Infrastructure",
            failures,
        )
        assert_contains("index.html", home_html, "Capture -&gt; Prove -&gt; Monetize", failures)
        assert_contains("index.html", home_html, "Creation is moving faster than ownership.", failures)

    for file_name, route in PAGES.items():
        path = ROOT / file_name
        if not path.exists():
            failures.append(f"{file_name}: file does not exist")
            continue

        html = read_text(path)
        canonical = f"{SITE_URL}{route}"

        assert_regex(file_name, html, r"<title>.+</title>", failures)
        assert_regex(file_name, html, r'<meta name="description" content="[^"]+">', failures)
        assert_contains(file_name, html, f'<link rel="canonical" href="{canonical}">', failures)
        assert_contains(file_name, html, 'property="og:title"', failures)
        assert_contains(file_name, html, 'property="og:description"', failures)
        assert_contains(file_name, html, 'property="og:image"', failures)
        assert_contains(file_name, html, 'name="twitter:card"', failures)
        assert_regex(file_name, html, r"<h1>.+</h1>", failures)
        assert_contains(file_name, html, 'type="application/ld+json"', failures)
        assert_contains(file_name, html, MAIN_SITE_URL, failures)

    pages_requiring_contact = [
        "index.html",
        "proof-of-creation/index.html",
        "programmable-ip/index.html",
        "content-provenance/index.html",
        "creator-ownership/index.html",
        "ai-voice-protection/index.html",
        "ai-likeness-protection/index.html",
        "human-authenticity-layer/index.html",
        "book/index.html",
        "contact/index.html",
    ]

    for file_name in pages_requiring_contact:
        path = ROOT / file_name
        if path.exists():
            assert_contains(file_name, read_text(path), "Talk to Suede", failures)

    concept_expectations = {
        "proof-of-creation/index.html": "Proof of creation makes authorship, provenance, and creator rights verifiable",
        "programmable-ip/index.html": "Programmable IP moves ownership, licensing, attribution, and usage rules",
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

    form_expectations = {
        "book/index.html": [
            'action="/book-capture.php"',
            'data-api-endpoint="/api/book/"',
            'data-fallback-action="/book-capture.php"',
            "Email Me the Preview",
        ],
        "contact/index.html": [
            'action="/contact-submit.php"',
            'data-api-endpoint="/api/contact/"',
            'data-fallback-action="/contact-submit.php"',
        ],
        "book/thanks/index.html": [
            "Your request is in.",
        ],
        "contact/thanks/index.html": [
            "Thanks. Your note is in.",
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
    og_asset = ROOT / "assets" / "img" / "og-suede.svg"
    cover_asset = ROOT / "assets" / "img" / "stake-your-claim-cover.jpg"
    pdf_asset = ROOT / "assets" / "files" / "stake-your-claim-condensed-preview.pdf"
    css_asset = ROOT / "assets" / "css" / "site.css"
    js_asset = ROOT / "assets" / "js" / "site.js"

    for asset in [robots, sitemap, og_asset, cover_asset, pdf_asset, css_asset, js_asset]:
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

    print(f"PASS: verified {len(PAGES)} HTML pages and core assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
