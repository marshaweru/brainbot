# apps/bot/pdf_worker/md_to_pdf.py
import sys, os, re, tempfile, base64, mimetypes, urllib.request, argparse, pathlib
from markdown2 import markdown
from xhtml2pdf import pisa

# -----------------------------
# Markdown → HTML
# -----------------------------
MD_EXTRAS = [
    "tables",
    "fenced-code-blocks",
    "strike",
    "footnotes",
    "code-friendly",
    "smarty-pants",
]

def _md_to_html(md_text: str) -> str:
    # Treat Markdown horizontal rules as page breaks
    md_text = re.sub(r"^\s*---\s*$", "<hr class='pagebreak'/>", md_text, flags=re.M)
    html = markdown(md_text, extras=MD_EXTRAS)
    return html

# -----------------------------
# Resource resolver for images/fonts/css
# -----------------------------
def _is_data_uri(uri: str) -> bool:
    return uri.startswith("data:")

def _write_data_uri_to_temp(uri: str) -> str:
    # data:[<mediatype>][;base64],<data>
    try:
        header, b64 = uri.split(",", 1)
        # if not base64, xhtml2pdf won’t read it well
        if ";base64" not in header:
            # attempt to base64-encode raw data
            b64 = base64.b64encode(b64.encode("utf-8")).decode("ascii")
        mime = header.split(";")[0].split(":", 1)[1] if ":" in header else "application/octet-stream"
        ext = mimetypes.guess_extension(mime) or ".bin"
        fd, path = tempfile.mkstemp(suffix=ext)
        with os.fdopen(fd, "wb") as f:
            f.write(base64.b64decode(b64))
        return path
    except Exception:
        return ""  # let pisa try default

def _fetch_http(uri: str) -> str:
    if os.getenv("ALLOW_HTTP_IMAGES", "0") != "1":
        return ""  # blocked by default for safety
    try:
        with urllib.request.urlopen(uri) as r:
            data = r.read()
        ext = pathlib.Path(urllib.parse.urlparse(uri).path).suffix or ".bin"
        fd, path = tempfile.mkstemp(suffix=ext)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        return path
    except Exception:
        return ""

def link_callback_factory(base_dir: str):
    """
    Resolve relative / absolute / data / http(s) resources for xhtml2pdf.
    """
    def _link_callback(uri, rel):
        # data URI
        if _is_data_uri(uri):
            p = _write_data_uri_to_temp(uri)
            return p or uri

        # http(s)
        if uri.startswith("http://") or uri.startswith("https://"):
            p = _fetch_http(uri)
            return p or uri  # fallback: let pisa try

        # absolute filesystem path
        if os.path.isabs(uri) and os.path.exists(uri):
            return uri

        # relative → base_dir
        candidate = os.path.normpath(os.path.join(base_dir, uri))
        if os.path.exists(candidate):
            return candidate

        # allow relative to current working directory as last resort
        cwd_candidate = os.path.normpath(os.path.join(os.getcwd(), uri))
        if os.path.exists(cwd_candidate):
            return cwd_candidate

        return uri  # let pisa attempt its own resolution
    return _link_callback

# -----------------------------
# HTML shell + CSS
# -----------------------------
BASE_CSS = """
@page {
  size: A4;
  margin: 18mm 14mm 18mm 14mm;
}
body {
  font-family: DejaVu Sans, Arial, Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.35;
  color: #111;
}
h1, h2, h3, h4, h5, h6 { margin: 8px 0 6px; page-break-after: avoid; }
p { margin: 6px 0; }
ul, ol { margin: 6px 0 6px 20px; }
code, pre {
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 10pt;
  white-space: pre-wrap;
  word-wrap: break-word;
}
pre {
  border: 1px solid #ddd;
  padding: 8px;
  border-radius: 4px;
  background: #fafafa;
}
table {
  border-collapse: collapse; width: 100%;
  page-break-inside: avoid;
}
th, td { border: 1px solid #999; padding: 6px; vertical-align: top; }
img { max-width: 100%; height: auto; }
blockquote { border-left: 3px solid #bbb; padding-left: 10px; color: #444; }
hr.pagebreak { page-break-after: always; border: 0; margin: 0; padding: 0; }
.footer {
  position: fixed;
  bottom: -6mm; left: 0; right: 0;
  text-align: right;
  color: #666;
  font-size: 9pt;
}
.header {
  position: fixed;
  top: -8mm; left: 0; right: 0;
  text-align: left;
  color: #666;
  font-size: 9pt;
}
"""

def _html_doc(html_body: str, title: str | None) -> str:
    safe_title = (title or "BrainBot Study Pack").replace("<", "").replace(">", "")
    return f"""
<html>
  <head>
    <meta charset="utf-8"/>
    <title>{safe_title}</title>
    <style>{BASE_CSS}</style>
  </head>
  <body>
    <div class="header">{safe_title}</div>
    <div class="footer">BrainBot • <pdf:pageNumber/> / <pdf:pageCount/></div>
    {html_body}
  </body>
</html>
"""

# -----------------------------
# Public API
# -----------------------------
def md_to_pdf(md_text: str, out_path: str, *, title: str | None = None, base_dir: str | None = None) -> int:
    base_dir = base_dir or os.getenv("PDF_BASE_DIR") or os.getcwd()
    html = _md_to_html(md_text)
    html_doc = _html_doc(html, title)

    try:
        with open(out_path, "wb") as f:
            result = pisa.CreatePDF(
                html_doc,
                dest=f,
                link_callback=link_callback_factory(base_dir),
                encoding="utf-8",
            )
        return 0 if getattr(result, "err", 1) == 0 else 1
    except Exception as e:
        print(f"[md_to_pdf] ERROR: {e}", file=sys.stderr)
        return 1

# -----------------------------
# CLI
# -----------------------------
def _cli():
    p = argparse.ArgumentParser(description="Render Markdown to PDF (BrainBot).")
    p.add_argument("out_path", help="Where to write the PDF")
    p.add_argument("--title", help="Optional document title (header)", default=None)
    p.add_argument("--base", help="Base directory to resolve relative images", default=None)
    args = p.parse_args()

    md_text = sys.stdin.read()
    rc = md_to_pdf(md_text, args.out_path, title=args.title, base_dir=args.base)
    if rc != 0:
        print("[md_to_pdf] Rendering failed", file=sys.stderr)
    sys.exit(rc)

if __name__ == "__main__":
    _cli()
