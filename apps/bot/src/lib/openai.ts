// apps/bot/src/lib/openai.ts
import OpenAI from "openai";

/* ───────────── env & client ───────────── */

if (!process.env.OPENAI_API_KEY) {
  throw new Error("❌ OPENAI_API_KEY missing");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,      // e.g., https://api.openai.com/v1
  organization: process.env.OPENAI_ORG_ID,   // optional
});

/* ───────────── model registry ─────────────
   Defaults bias to GPT-5 family, with safe fallbacks. */
export const MODELS = {
  default:
    process.env.GPT_MODEL_ID ||
    process.env.OPENAI_MODEL_DEFAULT ||
    process.env.OPENAI_MODEL ||
    "gpt-5-mini",
  heavy: process.env.OPENAI_MODEL_HEAVY || "gpt-5-thinking",
  vision: process.env.OPENAI_MODEL_VISION || "gpt-4o",
};

export type TaskKind =
  | "session"    // study session generation
  | "marking"    // rubric / feedback
  | "plan"       // study plan builder
  | "math-hard"  // tougher math/physics
  | "vision"     // diagrams, images in/out
  | "ocr"        // photos of written work
  | "chat";      // light Q&A

export function pickModel(opts?: { task?: TaskKind; hasImage?: boolean; force?: string }) {
  if (opts?.force) return opts.force;
  if (opts?.hasImage || opts?.task === "vision" || opts?.task === "ocr") return MODELS.vision;
  if (opts?.task === "marking" || opts?.task === "plan" || opts?.task === "math-hard") return MODELS.heavy;
  return MODELS.default;
}

/* ───────────── internals ───────────── */

type SimpleMsg = { role: "system" | "user" | "assistant"; content: string };

function sanitizeMessages(msgs: OpenAI.Chat.ChatCompletionMessageParam[]): SimpleMsg[] {
  const out: SimpleMsg[] = [];
  for (const m of msgs || []) {
    const role = ((m as any).role ?? "user") as SimpleMsg["role"];
    let content: any = (m as any).content;

    // flatten arrays (we mainly pass text); vision flows should bypass this helper
    if (Array.isArray(content)) {
      content = content.map((p: any) => (typeof p === "string" ? p : (p?.text ?? ""))).join("");
    } else if (typeof content !== "string") {
      content = String(content ?? "");
    }

    content = content.replace(/\u0000/g, "").trim();
    if (content.length > 0) out.push({ role, content });
  }
  return out;
}

function isGpt5Model(id: string) {
  return /^gpt-5/i.test(id);
}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_RETRIES = Math.max(0, Number(process.env.OPENAI_MAX_RETRIES ?? 3));
const BASE_DELAY_MS = Math.max(50, Number(process.env.OPENAI_RETRY_BASE_MS ?? 400));

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      attempt++;
      const status = Number(e?.status ?? e?.response?.status ?? 0);
      const msg = String(e?.message ?? "");
      const timeouty = /timeout|ETIMEDOUT|aborted/i.test(msg);

      if (attempt > MAX_RETRIES || (!RETRYABLE_STATUS.has(status) && !timeouty)) {
        throw e;
      }
      const jitter = Math.floor(Math.random() * 150);
      const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1) + jitter;
      console.warn(`[openai] retrying (${attempt}/${MAX_RETRIES}) after ${backoff}ms:`, status || msg);
      await sleep(backoff);
    }
  }
}

/* ───────────── Unified completion (text-first) ─────────────
   Uses GPT-5 Responses API when the model id starts with gpt-5,
   otherwise falls back to Chat Completions.
   Vision/ocr callers should use the helpers at the bottom (no sanitizing). */

export async function chatComplete(args: {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  maxTokens?: number;            // logical cap; mapped per API
  deadlineMs?: number;           // optional client-side timeout
}) {
  const model = args.model || pickModel();
  const useResponses = isGpt5Model(model);
  const maxTokens = args.maxTokens ?? 1200;

  const cleaned = sanitizeMessages(args.messages);

  const controller = args.deadlineMs ? new AbortController() : undefined;
  if (controller && args.deadlineMs) setTimeout(() => controller.abort(), args.deadlineMs);

  console.log(
    "🧠 Using model:", model,
    "| msgs:", cleaned.map((m) => `${m.role}:${m.content.length}`),
    "| maxTokens:", maxTokens
  );

  try {
    if (useResponses) {
      // GPT-5: collapse roles to a single input string
      const input = cleaned.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

      const res = await withRetry(() =>
        openai.responses.create({
          model,
          input,
          max_output_tokens: maxTokens,
          ...(controller ? { signal: controller.signal as any } : {}),
        })
      );

      const text = (res as any).output_text as string | undefined;
      const content = (text ?? "").trim();
      if (!content) throw new Error("empty response text");
      return { content, model, raw: res };
    }

    // Non-GPT-5: classic Chat Completions
    const payload: any = {
      model,
      messages: cleaned,
      max_tokens: maxTokens,
    };
    if (typeof args.temperature === "number") payload.temperature = args.temperature;

    const res = await withRetry(() =>
      openai.chat.completions.create(payload, { signal: controller?.signal as any })
    );

    const content = res.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) throw new Error("empty completion text");
    return { content, model, raw: res };
  } catch (e: any) {
    const msg = e?.message || "";
    const status = Number(e?.status ?? e?.response?.status ?? 0);

    // Model not available on this key → fallback to default mini (once)
    if (status === 404 || /does not exist|Unknown model/i.test(msg)) {
      const fallback = MODELS.default;
      if (fallback !== model) {
        console.warn(`↩️ Fallback from ${model} to ${fallback}: ${msg}`);
        return await chatComplete({ ...args, model: fallback });
      }
    }

    if (/aborted/i.test(msg)) {
      throw new Error("OpenAI request timed out (deadline reached). Try again.");
    }

    console.error("[openai.chatComplete] error:", status || msg);
    throw e;
  }
}

/* ───────────── Legacy wrapper (keeps your current calls working) ───────────── */

export type Purpose =
  | "SESSION_NORMAL"
  | "SESSION_LANGUAGE"
  | "MARKING_FEEDBACK"
  | "ANSWERS_ON_TAP"
  | "PLAN_BUILDER";

/** Back-compat wrapper for older call sites. */
export async function callGpt(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  purpose: Purpose,
  maxTokens: number,
  temperature = 0.6,
) {
  const taskMap: Record<Purpose, TaskKind> = {
    SESSION_NORMAL: "session",
    SESSION_LANGUAGE: "session",
    MARKING_FEEDBACK: "marking",
    ANSWERS_ON_TAP: "chat",
    PLAN_BUILDER: "plan",
  };

  const { content } = await chatComplete({
    model: pickModel({ task: taskMap[purpose] }),
    messages,
    temperature,
    maxTokens,
  });

  return content;
}

/* ───────────── Vision helpers (images-in, text-out) ─────────────
   Use these for OCR/diagrams so images aren't stripped by sanitizeMessages.
   Accepts HTTP(S) URLs or base64 data (we wrap as a data: URL).
*/

export type ImageSource =
  | { url: string }                 // http(s)/file/data URLs
  | { base64: string; mime?: string }; // will be wrapped into data: URL

function asImageUrl(src: ImageSource): string {
  if ("url" in src) return src.url;
  const mime = src.mime || "image/png";
  return `data:${mime};base64,${src.base64}`;
}

type VisionOpts = {
  prompt: string;
  images: ImageSource[];           // order matters
  system?: string;                 // optional system nudge
  model?: string;                  // defaults to MODELS.vision
  maxTokens?: number;              // default 800
  temperature?: number;            // default 0.2 (OCR-ish)
  deadlineMs?: number;
};

/** Low-level: send mixed text+images with Chat Completions (gpt-4o et al.) */
export async function visionComplete(opts: VisionOpts) {
  const model = opts.model || pickModel({ task: "vision", hasImage: true });
  const maxTokens = opts.maxTokens ?? 800;
  const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.2;

  const controller = opts.deadlineMs ? new AbortController() : undefined;
  if (controller && opts.deadlineMs) setTimeout(() => controller.abort(), opts.deadlineMs);

  // Build content parts: user message contains prompt + images
  const contentParts: any[] = [
    { type: "input_text", text: opts.prompt }
  ];
  for (const img of opts.images) {
    contentParts.push({ type: "input_image", image_url: asImageUrl(img) });
  }

  const messages: any[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: contentParts });

  const res = await withRetry(() =>
    openai.chat.completions.create(
      {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      },
      { signal: controller?.signal as any }
    )
  );

  const content = res.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("empty vision completion text");
  return { content, model, raw: res };
}

/** High-level: OCR for photos of written work (returns plain text) */
export async function ocrImages(images: ImageSource[], extraPrompt?: string) {
  const base =
    "Extract all readable text in logical order. Preserve math as TeX where possible. " +
    "Ignore page decorations. If multiple pages, separate with `---`.";
  const prompt = extraPrompt ? `${base}\n\nExtra guidance: ${extraPrompt}` : base;

  const { content } = await visionComplete({
    prompt,
    images,
    system:
      "You are a meticulous OCR assistant for exam scripts. " +
      "Return clean, copyable text. Avoid commentary unless asked.",
    maxTokens: 1500,
    temperature: 0.0,
  });

  return content;
}

/** High-level: diagram / working analysis (great for marking hints) */
export async function describeImages(images: ImageSource[], task: "explain" | "score" = "explain") {
  const prompt =
    task === "score"
      ? "Analyze the student’s working. Identify correct steps, mistakes, and missing justifications. " +
        "Return concise bullet feedback and a suggested /10 score."
      : "Explain what’s in the images and summarize any problem + solution steps shown. " +
        "Call out unclear steps you can’t read.";

  const { content } = await visionComplete({
    prompt,
    images,
    system:
      "You are a KCSE examiner. Be clear, specific, and concise. " +
      "Prefer bullet points. If unsure, say what’s unclear.",
    maxTokens: 900,
    temperature: 0.3,
  });

  return content;
}
