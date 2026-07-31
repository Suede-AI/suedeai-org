from pathlib import Path
import json
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
STATUS_URL = "https://suedeai.ai/proof-of-creation"
HELD_ROUTES = [
    "/proof-of-creation/",
    "/programmable-ip/",
    "/royalties/",
    "/creator-ownership/",
    "/content-provenance/",
    "/ai-voice-protection/",
    "/ai-likeness-protection/",
    "/human-authenticity-layer/",
    "/why-copyright-fails/",
]
ACTIVE_MARKETING_FILES = [
    "index.html",
    "about/index.html",
    "contact/index.html",
    "investors/index.html",
    "jason-colapietro/index.html",
    "agentic-commerce/index.html",
    "book-a-call/index.html",
    "welcome-back/index.html",
    "contact/thanks/index.html",
    "investors/thanks/index.html",
]


class RegistryMarketingHoldTests(unittest.TestCase):
    def test_held_routes_temporarily_redirect_to_status(self) -> None:
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        redirects = {
            redirect["source"]: redirect for redirect in config.get("redirects", [])
        }

        for route in HELD_ROUTES:
            with self.subTest(route=route):
                self.assertIn(route, redirects)
                self.assertEqual(redirects[route]["destination"], STATUS_URL)
                self.assertIs(redirects[route]["permanent"], False)

    def test_held_routes_are_not_in_machine_readable_marketing(self) -> None:
        llm_text = "\n".join(
            (ROOT / name).read_text(encoding="utf-8")
            for name in ("llms.txt", "llms-full.txt")
        )
        sitemap_root = ET.parse(ROOT / "sitemap.xml").getroot()
        sitemap_locations = {
            element.text
            for element in sitemap_root.findall(
                "{http://www.sitemaps.org/schemas/sitemap/0.9}url/"
                "{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
            )
        }

        for route in HELD_ROUTES:
            with self.subTest(route=route):
                self.assertNotIn(f"https://suedeai.org{route}", llm_text)
                self.assertNotIn(f"https://suedeai.org{route}", sitemap_locations)

    def test_active_marketing_does_not_link_to_held_routes(self) -> None:
        for file_name in ACTIVE_MARKETING_FILES:
            text = (ROOT / file_name).read_text(encoding="utf-8")
            for route in HELD_ROUTES:
                with self.subTest(file=file_name, route=route):
                    self.assertNotIn(f'href="{route}"', text)

    def test_public_status_is_explicit_and_machine_readable(self) -> None:
        home = (ROOT / "index.html").read_text(encoding="utf-8")
        about = (ROOT / "about/index.html").read_text(encoding="utf-8")
        investors = (ROOT / "investors/index.html").read_text(encoding="utf-8")
        llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
        robots = (ROOT / "robots.txt").read_text(encoding="utf-8")

        for label, text in [
            ("index.html", home),
            ("about/index.html", about),
            ("investors/index.html", investors),
            ("llms.txt", llms),
        ]:
            with self.subTest(file=label):
                self.assertIn("security remediation", text.lower())
                self.assertIn(STATUS_URL, text)

        for route in HELD_ROUTES:
            with self.subTest(route=route):
                self.assertIn(f"Disallow: {route}", robots)

    def test_live_product_claims_are_removed_from_active_marketing(self) -> None:
        active_text = "\n".join(
            (ROOT / name).read_text(encoding="utf-8")
            for name in ACTIVE_MARKETING_FILES
        ).lower()
        for claim in [
            "suede registers creative works",
            "working product: rights passports",
            "registration, provenance, licensing, usdc payments, and royalty rails",
            "the reference works an identity travels through enter the registry",
            "base smart contracts for an ip registry",
            "he built the creator-ownership layer",
        ]:
            with self.subTest(claim=claim):
                self.assertNotIn(claim, active_text)


if __name__ == "__main__":
    unittest.main()
