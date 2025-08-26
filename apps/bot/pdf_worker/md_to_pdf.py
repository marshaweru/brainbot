# apps/bot/pdf_worker/md_to_pdf.py
import sys, os, re
from markdown2 import markdown
from xhtml2pdf import pisa

def _md_to_html(md_text: str) -> str:
    html = markdown(md_text, extras=["tables", "fenced-code-blocks"])
    # Treat Markdown horizontal rules as page breaks
    html = re.sub(r"<hr\s*/?>", '<hr class="pagebreak"/>', html, flags=re.I)
    return html

def md_to_pdf(md_text: str, out_path: str) -> int:
    html = _md_to_html(md_text)
    # Basic HTML scaffold for better fonts/layout
    html_doc = f"""
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page {{
            size: A4;
            margin: 18mm 14mm 18mm 14mm;
          }}
          body {{
            font-family: DejaVu Sans, Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.35;
          }}
          h1, h2, h3, h4, h5, h6 {{ margin: 8px 0 6px; page-break-after: avoid; }}
          p {{ margin: 6px 0; }}
          code, pre {{
            font-family: Consolas, 'DejaVu Sans Mono', monospace;
            font-size: 10pt;
            white-space: pre-wrap; /* wrap long lines */
            word-wrap: break-word;
          }}
          pre {{
            border: 1px solid #ddd;
            padding: 8px;
            border-radius: 4px;
            background: #fafafa;
          }}
          table {{
            border-collapse: collapse; width: 100%;
            page-break-inside: avoid;
          }}
          th, td {{ border: 1px solid #999; padding: 6px; vertical-align: top; }}
          img {{ max-width: 100%; height: auto; }}
          hr.pagebreak {{
            page-break-after: always; border: 0; margin: 0; padding: 0;
          }}
          /* Footer with page numbers */
          .footer {{
            position: fixed;
            bottom: -6mm;
            left: 0; right: 0;
            text-align: right;
            color: #666;
            font-size: 9pt;
          }}
        </style>
      </head>
      <body>
        <div class="footer">BrainBot • <pdf:pageNumber/> / <pdf:pageCount/></div>
        {html}
      </body>
    </html>
    """
    try:
        with open(out_path, "wb") as f:
            result = pisa.CreatePDF(html_doc, dest=f)
        # pisa returns an object with .err count (0 = success)
        return 0 if getattr(result, "err", 1) == 0 else 1
    except Exception as e:
        print(f"[md_to_pdf] ERROR: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    # Usage: python md_to_pdf.py <out_path>
    # Reads Markdown from STDIN and writes PDF to <out_path>
    if len(sys.argv) < 2:
        print("Usage: md_to_pdf.py <out_path>", file=sys.stderr)
        sys.exit(2)
    out_path = sys.argv[1]
    md_text = sys.stdin.read()
    rc = md_to_pdf(md_text, out_path)
    if rc != 0:
        print("[md_to_pdf] Rendering failed", file=sys.stderr)
    sys.exit(rc)
