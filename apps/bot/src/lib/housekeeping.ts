// apps/bot/src/lib/housekeeping.ts
import cron from "node-cron";
import { ensurePerfIndexes, purgeOldPerf } from "./perf.js";

export function scheduleHousekeeping() {
  // run once on boot: make sure indexes exist
  ensurePerfIndexes().catch(() => { /* ignore */ });

  // daily at 03:17 server time (quiet hours)
  cron.schedule("17 3 * * *", async () => {
    try {
      const deleted = await purgeOldPerf(90);
      if (deleted > 0) {
        console.log(`[housekeeping] purged ${deleted} old perf docs (>90d)`);
      }
    } catch (e: any) {
      console.error("[housekeeping] purge failed:", e?.message || e);
    }
  });
}
