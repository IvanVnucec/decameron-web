import argparse
import shutil
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
import livereload

ROOT = Path(__file__).parent
TEMPLATES_DIR = ROOT / "templates"
BUILD_DIR = ROOT / "build"

CONTEXT = {
    "price": "99 €",
    "num_cams": "70,000+",
}

PAGES = {
    "index.html": {"output": "index.html", "context": CONTEXT},
    "about.html": {"output": "about.html", "context": CONTEXT},
    "how-it-works.html": {"output": "how-it-works.html", "context": CONTEXT},
    "camera-coverage.html": {"output": "camera-coverage.html", "context": CONTEXT},
    "setup-and-update.html": {"output": "setup-and-update.html", "context": CONTEXT},
    "shop.html": {"output": "shop.html", "context": CONTEXT},
    "support-and-faq.html": {"output": "support-and-faq.html", "context": CONTEXT},
}

env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
)

def build():
    shutil.rmtree(BUILD_DIR, ignore_errors=True)
    BUILD_DIR.mkdir()

    for name, page in PAGES.items():
        html = env.get_template(name).render(**page["context"])
        out_path = BUILD_DIR / page["output"]
        out_path.write_text(html, encoding="utf-8")
    shutil.copytree(ROOT / "css", BUILD_DIR / "css")
    shutil.copytree(ROOT / "img", BUILD_DIR / "img")
    shutil.copytree(ROOT / "js", BUILD_DIR / "js")
    print("Files generated.")

def watch(port):
    build()
    server = livereload.Server()
    for path in (TEMPLATES_DIR, ROOT / "css", ROOT / "img", ROOT / "js", Path(__file__)):
        server.watch(path, build, delay=1.0)
    server.serve(port=port, root=BUILD_DIR, open_url_delay=0.5)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the site; optionally watch and serve with live-reload.")
    parser.add_argument("--watch", action="store_true", help="rebuild on changes and serve build/ with live-reload")
    parser.add_argument("--port", type=int, default=8000, help="port for --watch server (default: 8000)")
    args = parser.parse_args()

    if args.watch:
        watch(args.port)
    else:
        build()
