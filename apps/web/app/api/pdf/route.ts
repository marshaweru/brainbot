// apps/web/app/api/pdf/route.ts
import { NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

export const runtime = "nodejs"; // allow Buffer responses, good for Render/Node

const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "";

export async function POST(req: NextRequest) {
  try {
    // --- Auth: bot calls with Bearer token; browser calls with same-origin + X-Public: 1 ---
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const xPublic = req.headers.get("x-public") === "1";

    const sameOrigin = !!origin && !!host && new URL(origin).host === host;

    const authorized =
      (SERVICE_TOKEN && token === SERVICE_TOKEN) || // server-to-server (bot)
      (xPublic && sameOrigin); // browser on same origin

    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- Payload ---
    const { title, sections, downloadName, watermark } = await req.json();

    // --- Build PDF ---
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4 in points
    const { height } = page.getSize();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    let y = height - 50;

    page.drawText(String(title || "BrainBot Report"), {
      x: 50,
      y,
      size: 20,
      font,
      color: rgb(0.2, 0.4, 0.8),
    });
    y -= 40;

    if (Array.isArray(sections)) {
      for (const s of sections) {
        if (s?.heading) {
          page.drawText(String(s.heading), {
            x: 50,
            y,
            size: 14,
            font,
            color: rgb(0, 0, 0),
          });
          y -= 20;
        }
        if (s?.body) {
          const lines = String(s.body).split("\n");
          for (const line of lines) {
            page.drawText(line, {
              x: 70,
              y,
              size: 11,
              font,
              color: rgb(0.1, 0.1, 0.1),
            });
            y -= 15;
          }
          y -= 10;
        }
      }
    }

    // Branding footer
    page.drawText("© BrainBot Africa — KCSE Focused Exam Trainer", {
      x: 50,
      y: 40,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Optional watermark
    if (watermark) {
      page.drawText(String(watermark), {
        x: 100,
        y: height / 2,
        size: 50,
        font,
        color: rgb(0.85, 0.85, 0.85),
        rotate: degrees(45),
      });
    }

    const pdfBytes = await pdf.save(); // Uint8Array

    // Sanitize filename
    const safeName = String(downloadName || "brainbot-report").replace(/[^a-z0-9._-]/gi, "_");

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
