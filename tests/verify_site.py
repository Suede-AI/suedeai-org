from pathlib import Path
import re
import sys
import json
import struct

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://suedeai.org"
MAIN_SITE_URL = "https://suedeai.ai/"
FAVICON_VERSION = "v=3"
CANONICAL_PREVIEW_PDF_URL = "https://suedeai.ai/stake-your-claim-condensed-preview.pdf"
LEGACY_PREVIEW_PDF_URL = "https://suedeai.org/assets/files/stake-your-claim-condensed-preview.pdf"
OFFICIAL_CASE_CITATION = "Bartz et al. v. Anthropic PBC, No. 3:24-cv-05417-AMO (N.D. Cal.)"
UNRELATED_ORGANIZATION_WIKIDATA = "https://www.wikidata.org/wiki/Q131489584"
FOUNDER_WIKIDATA = "https://www.wikidata.org/wiki/Q140235755"
FOUNDER_OG_IMAGE_URL = f"{SITE_URL}/assets/img/og-jason-colapietro.png"
FAVICON_MAX_BYTES = 12_000
FAVICON_REQUIRED_SIZES = [(16, 16), (32, 32), (48, 48)]
CANONICAL_ORGANIZATION_ID = "https://suedeai.ai/#organization"
CANONICAL_ORGANIZATION_SAME_AS = [
    "https://suedeai.org/",
    "https://x.com/AISUEDE",
    "https://github.com/Suede-AI",
    "https://www.youtube.com/@aisuede",
    "https://www.instagram.com/suedeai/",
    "https://www.facebook.com/people/Suede-Labs-AI/61584534847516",
    "https://t.me/SUEDEAI",
    "https://linktr.ee/suedelabsai",
    "https://www.crunchbase.com/organization/suede-labs-ai",
    "https://www.linkedin.com/company/suede-labs-ai",
    "https://www.wikidata.org/wiki/Q141169484",
]

LEGACY_REDIRECTS = {
    "/home/": "/",
    "/guide/": "/book/",
    "/ai/": "/",
    "/the-hidden-tax-stealing-time-money-and-control/": "/creator-ownership/",
    "/how-record-labels-trap-artists-the-kreayshawn-case-study/": "/royalties/",
    "/the-future-of-music-rights-technology-meets-creativity/": "/programmable-ip/",
    "/beyond-points-4-ways-suede-labs-is-redefining-user-rewards/": "/royalties/",
    "/bringing-ip-ai-powered-creative-tools-to-students/": "/creator-ownership/",
    "/build-your-community-the-art-of-derivatives-remixes/": "/programmable-ip/",
    "/the-first-fully-autonomous-agentic-music-marketplace/": "/agentic-commerce/",
    "/the-truth-engine-for-digital-ip-and-its-live-now/": "/proof-of-creation/",
    "/feed/": "/",
    "/comments/feed/": "/",
    "/sitemap_index.xml": "/sitemap.xml",
    "/wp-sitemap.xml": "/sitemap.xml",
    "/voice/": "/voice/support/",
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


def assert_not_contains(label: str, haystack: str, needle: str, failures: list[str]) -> None:
    if needle in haystack:
        failures.append(f"{label}: contains forbidden '{needle}'")


def assert_regex(label: str, haystack: str, pattern: str, failures: list[str], flags: int = re.IGNORECASE | re.MULTILINE) -> None:
    if not re.search(pattern, haystack, flags):
        failures.append(f"{label}: missing pattern /{pattern}/")


def json_ld_nodes(html_text: str) -> list[dict]:
    nodes: list[dict] = []
    scripts = re.findall(
        r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html_text,
        re.IGNORECASE | re.DOTALL,
    )
    for script in scripts:
        payload = json.loads(script)
        if isinstance(payload, dict) and isinstance(payload.get("@graph"), list):
            nodes.extend(node for node in payload["@graph"] if isinstance(node, dict))
        elif isinstance(payload, dict):
            nodes.append(payload)
    return nodes


def node_has_type(node: dict, expected_type: str) -> bool:
    node_type = node.get("@type")
    if isinstance(node_type, list):
        return expected_type in node_type
    return node_type == expected_type


def same_as_urls(node: dict) -> set[str]:
    same_as = node.get("sameAs", [])
    if isinstance(same_as, str):
        return {same_as}
    if isinstance(same_as, list):
        return {value for value in same_as if isinstance(value, str)}
    return set()


def ico_sizes(path: Path) -> list[tuple[int, int]]:
    data = path.read_bytes()
    if len(data) < 6:
        raise ValueError("ICO header is truncated")
    reserved, icon_type, image_count = struct.unpack_from("<HHH", data)
    if reserved != 0 or icon_type != 1:
        raise ValueError("expected a Windows icon file")
    if len(data) < 6 + (16 * image_count):
        raise ValueError("ICO directory is truncated")

    sizes: list[tuple[int, int]] = []
    for index in range(image_count):
        entry_offset = 6 + (16 * index)
        width_byte, height_byte = struct.unpack_from("BB", data, entry_offset)
        width, height = width_byte or 256, height_byte or 256
        payload_size, payload_offset = struct.unpack_from("<II", data, entry_offset + 8)
        payload_end = payload_offset + payload_size
        if payload_size == 0 or payload_offset < 6 + (16 * image_count) or payload_end > len(data):
            raise ValueError(f"{width}x{height} frame payload is out of bounds")
        payload = data[payload_offset:payload_end]
        if len(payload) < 24 or payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[12:16] != b"IHDR":
            raise ValueError(f"{width}x{height} frame is not a valid embedded PNG")
        png_width, png_height = struct.unpack_from(">II", payload, 16)
        if (png_width, png_height) != (width, height):
            raise ValueError(
                f"{width}x{height} directory entry contains a {png_width}x{png_height} PNG"
            )
        sizes.append((width, height))
    return sizes


def main() -> int:
    failures: list[str] = []
    stale_founder_url_pattern = r'"@id"\s*:\s*"https://suedeai\.ai/founder#person"[\s\S]{0,2000}?"url"\s*:\s*"https://suedeai\.org/jason-colapietro/"'
    # Phrases that must NEVER appear on a public surface. The book-count entries
    # below are stale-claim guards, not claims. Amazon is the canonical total of
    # published books, so the published count is four; the shelf still carries
    # six titles, the other two named as self-hosted works. Every count this
    # estate has previously published — five, six, three — is therefore stale
    # and stays banned. Do not "update" these to the current count; that would
    # ban the true claim instead of the stale one.
    public_regression_phrases = [
        "Published author of five books",
        "published author of five books",
        "author of five books",
        "5x published author",
        "author of six books",
        "six published books",
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
        " ".join(("Suede", "Web", "Systems")),
        "".join(("suede", "web", "systems")) + ".ai",
        "-".join(("full", "stack")) + " GEO",
        "-".join(("full", "stack")) + " AI visibility",
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
        assert_contains("jason-colapietro/index.html", founder_html, '"alternateName": ["Johnny Suede"]', failures)
        assert_contains("jason-colapietro/index.html", founder_html, '"url": "https://suedeai.ai/founder"', failures)
        assert_contains("jason-colapietro/index.html", founder_html, 'href="https://suedeai.ai/founder"', failures)
        assert_contains("jason-colapietro/index.html", founder_html, 'href="https://jasoncolapietro.com/"', failures)
        assert_contains("jason-colapietro/index.html", founder_html, 'href="https://johnnysuede.com/"', failures)
        assert_contains("jason-colapietro/index.html", founder_html, f'<meta property="og:image" content="{FOUNDER_OG_IMAGE_URL}">', failures)
        assert_contains("jason-colapietro/index.html", founder_html, '<meta property="og:image:width" content="1200">', failures)
        assert_contains("jason-colapietro/index.html", founder_html, '<meta property="og:image:height" content="630">', failures)
        assert_contains("jason-colapietro/index.html", founder_html, '<meta property="og:image:type" content="image/png">', failures)
        assert_contains("jason-colapietro/index.html", founder_html, f'<meta name="twitter:image" content="{FOUNDER_OG_IMAGE_URL}">', failures)
        assert_contains("jason-colapietro/index.html", founder_html, '"primaryImageOfPage": "https://suedeai.org/assets/img/founder-jason.png"', failures)
        assert_contains("jason-colapietro/index.html", founder_html, '<img src="/assets/img/founder-jason.png"', failures)

        founder_og_path = ROOT / "assets" / "img" / "og-jason-colapietro.png"
        if not founder_og_path.exists():
            failures.append("assets/img/og-jason-colapietro.png: file does not exist")
        else:
            png_header = founder_og_path.read_bytes()[:24]
            if png_header[:8] != b"\x89PNG\r\n\x1a\n":
                failures.append("assets/img/og-jason-colapietro.png: expected PNG signature")
            elif (
                int.from_bytes(png_header[16:20], "big"),
                int.from_bytes(png_header[20:24], "big"),
            ) != (1200, 630):
                failures.append("assets/img/og-jason-colapietro.png: expected 1200x630 dimensions")

    for schema_path in [home_path, founder_path]:
        if not schema_path.exists():
            continue
        relative_path = schema_path.relative_to(ROOT).as_posix()
        nodes = json_ld_nodes(read_text(schema_path))
        organizations = [node for node in nodes if node_has_type(node, "Organization")]
        people = [node for node in nodes if node_has_type(node, "Person")]
        if not organizations:
            failures.append(f"{relative_path}: missing Organization JSON-LD node")
        if schema_path == home_path:
            canonical_organizations = [
                organization
                for organization in organizations
                if organization.get("@id") == CANONICAL_ORGANIZATION_ID
            ]
            if len(canonical_organizations) != 1:
                failures.append(
                    f"{relative_path}: expected exactly one Organization JSON-LD node with @id {CANONICAL_ORGANIZATION_ID}"
                )
            else:
                raw_same_as = canonical_organizations[0].get("sameAs")
                valid_same_as_list = (
                    isinstance(raw_same_as, list)
                    and all(isinstance(url, str) for url in raw_same_as)
                    and len(raw_same_as) == len(set(raw_same_as))
                )
                if not valid_same_as_list:
                    failures.append(
                        f"{relative_path}: Organization sameAs must be a unique list of URL strings"
                    )
                organization_same_as = same_as_urls(canonical_organizations[0])
                if valid_same_as_list and raw_same_as != CANONICAL_ORGANIZATION_SAME_AS:
                    canonical_same_as = set(CANONICAL_ORGANIZATION_SAME_AS)
                    missing = sorted(canonical_same_as - organization_same_as)
                    unexpected = sorted(organization_same_as - canonical_same_as)
                    failures.append(
                        f"{relative_path}: Organization sameAs differs from the canonical entity set; "
                        f"missing={missing}, unexpected={unexpected}, order_matches=False"
                    )
        if not people:
            failures.append(f"{relative_path}: missing Person JSON-LD node")
        for organization in organizations:
            organization_same_as = same_as_urls(organization)
            if UNRELATED_ORGANIZATION_WIKIDATA in organization_same_as:
                failures.append(
                    f"{relative_path}: Organization sameAs contains unrelated Wikidata {UNRELATED_ORGANIZATION_WIKIDATA}"
                )
            if FOUNDER_WIKIDATA in organization_same_as:
                failures.append(
                    f"{relative_path}: founder Wikidata must remain on Person, not Organization"
                )
        if people and not any(FOUNDER_WIKIDATA in same_as_urls(person) for person in people):
            failures.append(f"{relative_path}: Person sameAs is missing founder Wikidata {FOUNDER_WIKIDATA}")

    for html_path in ROOT.rglob("*.html"):
        html_text = read_text(html_path)
        if re.search(stale_founder_url_pattern, html_text, re.IGNORECASE | re.MULTILINE):
            relative_path = html_path.relative_to(ROOT).as_posix()
            failures.append(
                f"{relative_path}: founder person @id uses supporting profile URL instead of https://suedeai.ai/founder"
            )
        lower_html_text = " ".join(html_text.lower().split())
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
            lower_text = " ".join(text.lower().split())
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
            # "Jay Colapietro" was declared as an alias until 2026-08-07 and
            # removed: Jason has never used it publicly, so it consolidated no
            # real query or citation, and answer engines had begun repeating
            # the claim as established fact. Guard against reintroduction.
            if "Jay Colapietro" in text:
                relative_path = text_path.relative_to(ROOT).as_posix()
                failures.append(f"{relative_path}: removed alias 'Jay Colapietro'")
            assert_contains(text_path.name, text, "Johnny Suede", failures)

    llms_path = ROOT / "llms.txt"
    if llms_path.exists():
        llms_text = read_text(llms_path)
        assert_contains("llms.txt", llms_text, "Canonical founder entity: https://suedeai.ai/founder", failures)
        assert_contains("llms.txt", llms_text, "Supporting founder profile: https://suedeai.org/jason-colapietro/", failures)

    for machine_path in [llms_path, ROOT / "llms-full.txt"]:
        if not machine_path.exists():
            continue
        machine_text = read_text(machine_path)
        assert_contains(machine_path.name, machine_text, CANONICAL_PREVIEW_PDF_URL, failures)
        assert_not_contains(machine_path.name, machine_text, LEGACY_PREVIEW_PDF_URL, failures)

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
            'name="company_url"',
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

    if favicon_ico.exists():
        favicon_bytes = favicon_ico.stat().st_size
        if favicon_bytes > FAVICON_MAX_BYTES:
            failures.append(
                f"favicon.ico: expected at most {FAVICON_MAX_BYTES} bytes, found {favicon_bytes}"
            )
        try:
            favicon_sizes = ico_sizes(favicon_ico)
        except ValueError as error:
            failures.append(f"favicon.ico: {error}")
        else:
            if favicon_sizes != FAVICON_REQUIRED_SIZES:
                failures.append(
                    f"favicon.ico: expected frames {FAVICON_REQUIRED_SIZES}, found {favicon_sizes}"
                )

    if pdf_asset.exists():
        reader = PdfReader(str(pdf_asset))
        if len(reader.pages) != 46:
            failures.append(
                f"{pdf_asset.relative_to(ROOT)}: expected 46 pages, found {len(reader.pages)}"
            )
        pdf_text = " ".join((page.extract_text() or "") for page in reader.pages)
        pdf_text = re.sub(r"(\w)[\u00ad\u2010]\s+(\w)", r"\1\2", pdf_text)
        pdf_text = re.sub(r"\s+", " ", pdf_text)
        assert_contains(
            pdf_asset.relative_to(ROOT).as_posix(),
            pdf_text,
            OFFICIAL_CASE_CITATION,
            failures,
        )
        assert_not_contains(
            pdf_asset.relative_to(ROOT).as_posix(),
            pdf_text,
            "Harmon v. GenAudio",
            failures,
        )
        for preserved_claim in [
            "Over seventy copyright lawsuits have been filed against major AI companies since 2023.",
            "The ones who do will be compensated. The ones who don't will be told their claim cannot be substantiated.",
            "Register your work. That is the entire instruction. Everything else follows from that one action.",
        ]:
            assert_contains(
                pdf_asset.relative_to(ROOT).as_posix(),
                pdf_text,
                preserved_claim,
                failures,
            )

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

        pdf_header_rule = next(
            (
                rule
                for rule in config.get("headers", [])
                if rule.get("source") == PREVIEW_PDF_PATH
            ),
            None,
        )
        if not pdf_header_rule:
            failures.append(f"vercel.json: missing PDF header rule for {PREVIEW_PDF_PATH}")
        else:
            pdf_headers = {
                header.get("key", "").lower(): header.get("value")
                for header in pdf_header_rule.get("headers", [])
            }
            if pdf_headers.get("x-robots-tag") != "noindex, follow":
                failures.append(
                    f"vercel.json: {PREVIEW_PDF_PATH} must send X-Robots-Tag: noindex, follow"
                )
            expected_link = f'<{CANONICAL_PREVIEW_PDF_URL}>; rel="canonical"'
            if pdf_headers.get("link") != expected_link:
                failures.append(
                    f"vercel.json: {PREVIEW_PDF_PATH} must send Link: {expected_link}"
                )

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
