// apps/bot/src/pdf/export.ts
import type { Feedback } from "../feedback/render.js";
import { Buffer } from "node:buffer";

const WEB_PDF_ENDPOINT = process.env.WEB_PDF_ENDPOINT!;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN!;

/**
 * Request a PDF from the web app API and return it as a Buffer.
 */
export async function fetchPdfBuffer(
  feedback: Feedback,
  opts?: { downloadName?: string; watermark?: string }
): Promise<Buffer> {
  if (!WEB_PDF_ENDPOINT || !SERVICE_TOKEN) {
    throw new Error("WEB_PDF_ENDPOINT or SERVICE_TOKEN not set");
  }

  const res = await fetch(WEB_PDF_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_TOKEN}`,
    },
    body: JSON.stringify({
      title: `${feedback.subject} – ${feedback.paper} Feedback`,
      sections: feedback.sections?.map((s) => ({
        heading: s.section,
        body: `Score: ${s.score}/${s.outOf}`,
      })),
      downloadName: opts?.downloadName ?? "brainbot-report",
      watermark: opts?.watermark ?? undefined,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PDF API failed: ${res.status} ${txt}`);
  }

  const arrBuf = await res.arrayBuffer();
  return Buffer.from(arrBuf);
}
