// apps/bot/src/scripts/debugFree.ts
import { connectDB } from "../lib/db.js";
import {
  getTrialState,
  saveTrialState,
  consumeTrialSessionAtomic,
} from "../lib/trialStore.js";
import { defaultTrial, claimTrial } from "../utils/trial.js";

async function main() {
  const telegramId = String(process.env.TEST_TELEGRAM_ID || "").trim();
  if (!telegramId) throw new Error("Set TEST_TELEGRAM_ID");

  // init DB
  await connectDB();

  // read current state
  const before = await getTrialState(telegramId);
  console.log("[trial:before]", before);

  // ensure a claimed trial exists (adds startedAt etc.)
  if (before.sessionsRemaining == null) {
    const claimed = claimTrial(defaultTrial());
    await saveTrialState(telegramId, claimed);
    console.log("[trial:claimed]", claimed);
  }

  // atomically consume one session if available
  const { ok, state } = await consumeTrialSessionAtomic(telegramId);
  console.log("[trial:consume]", { ok, state });

  process.exit(0);
}

main().catch((err) => {
  console.error("[debugFree] error:", err);
  process.exit(1);
});
