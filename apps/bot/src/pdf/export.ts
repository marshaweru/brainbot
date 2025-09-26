// apps/bot/src/pdf/export.ts
import type { Feedback } from "../feedback/render.js";
import { Buffer } from "node:buffer";

const WEB_PDF_ENDPOINT = process.env.WEB_PDF_ENDPOINT!;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN!;

/** Palette + brand metadata, used across PDF + image rendering */
export type Brand = {
  name: string;
  tagline?: string;
  watermark?: string;

  bg?: string;
  card?: string;
  text?: string;
  muted?: string;
  primary?: string;
  accent?: string;
  success?: string;
  danger?: string;
};

export const BRAND: Brand = {
  name: "BrainBot Africa",
  tagline: "KCSE • CBC • Study Coach",
  watermark: "BrainBot Africa",

  // sensible defaults (used in report-card.ts)
  bg: "#0b1220",
  card: "#111827",
  text: "#e5e7eb",
  muted: "#94a3b8",
  primary: "#facc15",
  accent: "#a78bfa",
  success: "#22c55e",
  danger: "#ef4444",
};

/**
 * Generic PDF builder — called with {title, body,...}
 */
export async function buildPdfBuffer(opts: {
  title: string;
  body: string;
  brand?: Brand;
  downloadName?: string;
  watermark?: string;
}): Promise<Buffer> {
  ensureEnv();
  const res = await fetch(WEB_PDF_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_TOKEN}`,
    },
    body: JSON.stringify({
      title: opts.title,
      sections: [{ heading: opts.title, body: opts.body }],
      downloadName: opts.downloadName ?? "brainbot-report",
      watermark: opts.watermark ?? opts.brand?.watermark ?? BRAND.watermark,
      brand: {
        name: opts.brand?.name ?? BRAND.name,
        tagline: opts.brand?.tagline ?? BRAND.tagline,
        bg: opts.brand?.bg ?? BRAND.bg,
        card: opts.brand?.card ?? BRAND.card,
        text: opts.brand?.text ?? BRAND.text,
        muted: opts.brand?.muted ?? BRAND.muted,
        primary: opts.brand?.primary ?? BRAND.primary,
        accent: opts.brand?.accent ?? BRAND.accent,
        success: opts.brand?.success ?? BRAND.success,
        danger: opts.brand?.danger ?? BRAND.danger,
      },
    }),
  });
  if (!res.ok) throw new Error(`PDF API failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Helper: build a PDF directly from a Feedback object
 */
export async function fetchPdfBufferFromFeedback(
  feedback: Feedback,
  opts?: { downloadName?: string; brand?: Brand; watermark?: string }
): Promise<Buffer> {
  const title = `${feedback.subject} – ${feedback.paper} Feedback`;
  const body = (feedback.sections ?? [])
    .map((s) => `${s.section}: ${s.score}/${s.outOf}`)
    .join("\n");

  return buildPdfBuffer({
    title,
    body,
    brand: opts?.brand,
    downloadName: opts?.downloadName,
    watermark: opts?.watermark,
  });
}

function ensureEnv() {
  if (!WEB_PDF_ENDPOINT || !SERVICE_TOKEN) {
    throw new Error("WEB_PDF_ENDPOINT or SERVICE_TOKEN not set");
  }
}
