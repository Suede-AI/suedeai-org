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
            "Proof-of-Creation Infrastructure for the AI-Native Economy",
            failures,
        )
        assert_contains("index.html", home_html, "Capture -&gt; Prove -&gt; Monetize", failures)

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
        assert_contains(file_name, html, "Talk to Suede", failures)
        assert_contains(file_name, html, MAIN_SITE_URL, failures)

    concept_expectations = {
        "proof-of-creation/index.html": "Proof of creation matters more when content becomes infinite.",
        "programmable-ip/index.html": "Programmable IP turns rights from paperwork into infrastructure.",
        "content-provenance/index.html": "Content provenance is what makes authenticity durable instead of performative.",
    }

    for file_name, sentence in concept_expectations.items():
        path = ROOT / file_name
        if path.exists():
            assert_contains(file_name, read_text(path), sentence, failures)

    wedge_expectations = {
        "creator-ownership/index.html": "Creator ownership becomes more important as AI makes creation abundant.",
        "ai-voice-protection/index.html": "AI voice protection needs rights infrastructure, not just detection.",
        "ai-likeness-protection/index.html": "Likeness protection is a core ownership problem in synthetic media.",
        "human-authenticity-layer/index.html": "Human authenticity becomes premium when synthetic content is cheap.",
    }

    for file_name, sentence in wedge_expectations.items():
        path = ROOT / file_name
        if path.exists():
            assert_contains(file_name, read_text(path), sentence, failures)

    form_expectations = {
        "book/index.html": 'action="/book-capture.php"',
        "contact/index.html": 'action="/contact-submit.php"',
        "book/thanks/index.html": "Thanks. The book request is in.",
        "contact/thanks/index.html": "Thanks. Your note is in.",
    }

    for file_name, fragment in form_expectations.items():
        path = ROOT / file_name
        if path.exists():
            assert_contains(file_name, read_text(path), fragment, failures)

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
