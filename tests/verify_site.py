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
