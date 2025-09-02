// apps/bot/src/lib/openai.ts
import OpenAI from "openai";

/** Single shared client */
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ OPENAI_API_KEY not set — features that call OpenAI will fail at runtime.");
}
export const openai = new OpenAI({ apiKey: apiKey || "sk-void" });

// --------------------------- Models plan (env or defaults) ------------------

const DEFAULT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
const HEAVY_TEXT_MODEL   = process.env.OPENAI_HEAVY_MODEL || "gpt-5-thinking";
const VISION_MODEL       = process.env.OPENAI_VISION_MODEL || "gpt-4o";

export const models = {
  textDefault: DEFAULT_TEXT_MODEL,
  textHeavy: HEAVY_TEXT_MODEL,
  vision: VISION_MODEL,
};

// --------------------------- Chat completion wrapper -----------------------

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompleteArgs = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;

  /** Alias accepted by our wrapper; mapped to max_completion_tokens. */
  maxTokens?: number;

  /** Native param; also supported. */
  max_completion_tokens?: number;

  /** If true, request JSON response_format (some models support this) */
  json?: boolean;
};

/** Return the raw string the model produces (no parsing here). */
export async function chatComplete(args: ChatCompleteArgs): Promise<string> {
  const limit = args.max_completion_tokens ?? args.maxTokens;

  const resp = await openai.chat.completions.create({
    model: args.model,
    messages: args.messages,
    temperature: args.temperature ?? 0.2,
    ...(limit ? { max_completion_tokens: limit } : {}),
    ...(args.json ? { response_format: { type: "json_object" as const } } : {}),
  } as any);

  return resp.choices[0]?.message?.content ?? "";
}

// --------------------------- Ping / preflight ------------------------------

/** Try a 1-token call to see if a model is reachable. */
export async function pingModel(model: string): Promise<void> {
  try {
    await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_completion_tokens: 1,
    } as any);
  } catch (e: any) {
    // bubble to caller (we log at preflight)
    throw e;
  }
}

/** Warm up models in a plan (best-effort; logs if any fail). */
export async function preflightModels(plan: {
  default: string;
  heavy?: string;
  vision?: string;
}) {
  const list = [plan.default, plan.heavy, plan.vision].filter(Boolean) as string[];
  for (const m of list) {
    try {
      await pingModel(m);
    } catch (e: any) {
      console.warn(
        `OpenAI preflight failed on ${m} — will rely on fallback at runtime:`,
        e?.message || e
      );
    }
  }
  return plan;
}

// --------------------------- Vision helpers used in marking -----------------

/** Minimal OCR using Responses API (types kept loose to avoid SDK drift). */
export async function ocrImages(
  images: Array<{ url: string }>,
  hint?: string
): Promise<string> {
  const prompt = [
    { type: "text", text: hint || "Extract all readable text accurately." },
    ...images.map((i) => ({ type: "input_image", image_url: { url: i.url } })),
  ];

  const res: any = await openai.responses.create({
    model: VISION_MODEL,
    input: [{ role: "user", content: prompt }],
  } as any);

  return res?.output_text || res?.content?.[0]?.text || "";
}

/** Describe + score uploaded work (used by marking). */
export async function describeImages(
  images: Array<{ url: string }>,
  mode: "score" | "summary" = "score",
  subjectHint?: string
): Promise<string> {
  const prompt = [
    {
      type: "text",
      text:
        mode === "score"
          ? `You are a KCSE examiner. Give concise feedback and an indicative score. ${subjectHint || ""}`
          : `Summarize clearly what the student attempted. ${subjectHint || ""}`,
    },
    ...images.map((i) => ({ type: "input_image", image_url: { url: i.url } })),
  ];

  const res: any = await openai.responses.create({
    model: VISION_MODEL,
    input: [{ role: "user", content: prompt }],
  } as any);

  return res?.output_text || res?.content?.[0]?.text || "";
}
