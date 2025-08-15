import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
type Purpose = "SESSION_NORMAL" | "SESSION_LANGUAGE" | "MARKING_FEEDBACK" | "ANSWERS_ON_TAP" | "PLAN_BUILDER";
export async function callGpt(messages: any[], purpose: Purpose, maxTokens: number, temperature = 0.6) {
  const res = await client.chat.completions.create({
    model: process.env.GPT_MODEL_ID || "gpt-5-turbo",
    temperature,
    max_tokens: maxTokens,
    messages,
  });
  return res.choices?.[0]?.message?.content || "";
}
