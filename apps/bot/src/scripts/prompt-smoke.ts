// apps/bot/src/scripts/prompt-smoke.ts
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { PROMPTS } from "../prompts/index.js";

(async () => {
  const tpl = await readFile(PROMPTS.lessonPlan, "utf8");
  const prompt = Handlebars.compile(tpl)({
    subject: "Physics",
    topic: "Vectors",
    level: "KCSE",
  });
  console.log(prompt);
})();
