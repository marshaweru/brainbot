// apps/bot/src/lib/llm.ts

// Node 20+ has global fetch. This file returns RAW JSON TEXT from the model.
// Services (marking, insights, etc.) will JSON.parse + Zod-validate.

type OpenAIChatMessage = { content?: string | null };
type OpenAIChoice = { message?: OpenAIChatMessage | null };
type OpenAIResp = { choices?: OpenAIChoice[] | null };

const PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase();
const MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

// Optional: Azure/OpenAI-compatible proxy base
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

function assertEnv(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/**
 * Call the configured LLM and return STRICT JSON text (no markdown fences).
 * Throw on transport/API errors. Downstream code handles JSON parsing.
 */
export async function llm(prompt: string): Promise<string> {
  switch (PROVIDER) {
    case "openai":
      assertEnv(OPENAI_API_KEY, "OPENAI_API_KEY missing");
      return callOpenAI(prompt);
    case "dummy":
      // For offline/dev testing. Always returns valid JSON text.
      return `{"_":"dummy","note":"Set LLM_PROVIDER=openai to use a real model."}`;
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${PROVIDER}`);
  }
}

async function callOpenAI(prompt: string): Promise<string> {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 1400,
      // We instruct the model to return JSON text only; services validate strictly.
      messages: [
        { role: "system", content: "Return STRICT JSON only. No markdown, no commentary, no code fences." },
        { role: "user", content: prompt },
      ],
      // keep as 'text' so we don't get tool metadata; we validate with Zod later
      response_format: { type: "text" },
    }),
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  // Properly typed parse (the old '{}' type caused the 'choices' error)
  const data: OpenAIResp = await safeJson<OpenAIResp>(res);

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI returned empty content");
  }

  // Our prompts demand raw JSON (no fences). Trim just in case.
  return content.trim();
}

/* ----------------- small helpers ----------------- */

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return (t || "").slice(0, 800);
  } catch {
    return "";
  }
}

async function safeJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    // If JSON parsing fails, surface body text in the thrown error for easier debugging
    const t = await safeText(res);
    throw new Error(`Failed to parse JSON from provider: ${t}`);
  }
}
