// apps/bot/src/scripts/initPerfIndexes.ts
import { ensurePerfIndexes } from "../lib/perf.js";

(async () => {
  await ensurePerfIndexes();
  console.log("perf indexes ensured");
  process.exit(0);
})();
