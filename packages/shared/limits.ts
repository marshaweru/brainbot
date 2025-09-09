// Token and usage limits per plan for GPT/OpenAI usage
export const PLAN_LIMITS = {
  lite: { maxTokens: 3000, maxSessions: 1, pdf: false, voice: true },
  steady: { maxTokens: 6000, maxSessions: 7, pdf: true, voice: true },
  serious: { maxTokens: 9000, maxSessions: 60, pdf: true, voice: true },
  limited: { maxTokens: 9000, maxSessions: 60, pdf: true, voice: true },
  elite: { maxTokens: 16000, maxSessions: 120, pdf: true, voice: true },
  free: { maxTokens: 3000, maxSessions: 1, pdf: false, voice: true }
};
