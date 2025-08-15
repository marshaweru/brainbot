import { SYSTEM_PROMPT } from '../prompts/system';
import { callGpt } from './openai';
import { SESSION_BUDGET } from '../utils/tokenBudget';
import { subjectType, QUICK_WINS } from '../utils/subjects';

export interface SessionRequest { subject: string; mode: "quick" | "weak" | "drill"; level?: string; }

export async function generateSession(req: SessionRequest) {
  const sType = subjectType(req.subject);
  const maxTokens = sType === "language" ? SESSION_BUDGET.LANGUAGE_MAX : SESSION_BUDGET.NORMAL_MAX;

  const systemMsg = { role: "system", content: SYSTEM_PROMPT + "\n(SESSION_BUDGET available to toolchain.)" };
  const userMsg = {
    role: "user",
    content: [
      `Generate a KCSE session now.`,
      `Subject: ${req.subject}`,
      `Mode: ${req.mode} (quick=high-frequency, weak=common mistakes coaching, drill=past-paper mini set).`,
      req.level ? `Level: ${req.level}` : ``,
      `If mode=quick and you need a topic, prefer: ${QUICK_WINS[req.subject] || "a high-frequency topic."}`,
      `Follow the OUTPUT STRUCTURE strictly.`,
      `Do not include full answer key unless asked.`
    ].filter(Boolean).join("\n")
  };

  const content = await callGpt([systemMsg as any, userMsg as any], sType === "language" ? "SESSION_LANGUAGE" : "SESSION_NORMAL", maxTokens);
  return { content, subjectType: sType };
}
