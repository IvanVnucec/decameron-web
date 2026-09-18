import shutil
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
TEMPLATES_DIR = ROOT / "templates"
BUILD_DIR = ROOT / "build"

PAGES = {
    "index.html": {"output": "index.html", "context": {}},
    "about.html": {"output": "about.html", "context": {}},
    "how-it-works.html": {"output": "how-it-works.html", "context": {}},
    "camera-coverage.html": {"output": "camera-coverage.html", "context": {}},
    "setup-and-update.html": {"output": "setup-and-update.html", "context": {}},
    "shop.html": {"output": "shop.html", "context": {}},
    "support-and-faq.html": {"output": "support-and-faq.html", "context": {}},
}

env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
)

def main():
    shutil.rmtree(BUILD_DIR, ignore_errors=True)
    BUILD_DIR.mkdir()

    for name, page in PAGES.items():
        html = env.get_template(name).render(**page["context"])
        out_path = BUILD_DIR / page["output"]
        out_path.write_text(html, encoding="utf-8")
    shutil.copytree(ROOT / "css", BUILD_DIR / "css")
    shutil.copytree(ROOT / "img", BUILD_DIR / "img")

if __name__ == "__main__":
    main()
