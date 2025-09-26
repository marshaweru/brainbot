# Prompt routing rules
# Prompt Router 📡 (BrainBot)

This file is the human-readable map for all `.hbs` templates used by the bot.
Code resolves paths via `PROMPTS` (see `apps/bot/src/prompts/index.ts`).  
You edit prompts here (`/prompts/*.hbs`), services pull them via the barrel, and life stays drama-free.

---

## Index (barrel)

**File:** `apps/bot/src/prompts/index.ts`

```ts
export const PROMPTS = {
  drillGenerator: "<abs path>/prompts/drill_generator.hbs",
  examinerInsights: "<abs path>/prompts/examiner_insights.hbs",
  marking: "<abs path>/prompts/marking.hbs",
  notesSummarizer: "<abs path>/prompts/notes_summarizer.hbs",
};
export type PromptKey = keyof typeof PROMPTS;
