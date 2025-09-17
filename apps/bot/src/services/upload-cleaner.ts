import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import { SessionModel } from "../models/Session.js";

/** Delete a folder recursively (safe). */
function rmDirRecursive(dir: string) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.error("[upload-cleaner] rm failed:", err);
  }
}

/** Resolve uploads/<telegramId> absolute path. Keep consistent with buildUploadPath. */
function uploadsRoot(): string {
  return path.join(process.cwd(), "uploads");
}

/**
 * Watch the Session collection. When a session is finished (active=false)
 * or deleted (TTL/manual), clear its uploads/<telegramId> folder.
 *
 * NOTE: Delete events only include the _id by default. If your cluster
 * supports pre-images, pass { fullDocumentBeforeChange: "whenAvailable" }
 * to receive the prior document; we use it when present.
 */
export async function watchUploadCleaner() {
  const base = uploadsRoot();

  // Listen only to updates (active flips) and deletes.
  const pipeline = [
    { $match: { operationType: { $in: ["update", "delete"] } } },
  ];


  const stream = SessionModel.watch(pipeline, {
    fullDocument: "updateLookup",
    // Will be ignored if cluster doesn't support pre-images
    // @ts-ignore
    fullDocumentBeforeChange: "whenAvailable",
  });

  stream.on("change", async (change: any) => {
    try {
      if (change.operationType === "update") {
        const doc = change.fullDocument;
        if (doc && doc.active === false && doc.telegramId) {
          const folder = path.join(base, String(doc.telegramId));
          rmDirRecursive(folder);
          console.log(`[upload-cleaner] finished → cleared uploads/${doc.telegramId}`);
        }
      }

      if (change.operationType === "delete") {
        // Prefer pre-image if available
        const pre = change.fullDocumentBeforeChange;
        let telegramId: string | null = pre?.telegramId ?? null;

        // As a last resort, try to infer from a local cache or skip. We skip here.
        if (!telegramId) {
          const id: unknown = change.documentKey?._id;
          console.log(
            `[upload-cleaner] delete without pre-image for _id=${String(id)} (skipping; enable pre-images to auto-clean here)`
          );
          return;
        }

        const folder = path.join(base, String(telegramId));
        rmDirRecursive(folder);
        console.log(`[upload-cleaner] delete → cleared uploads/${telegramId}`);
      }
    } catch (err) {
      console.error("[upload-cleaner] change handler error:", err);
    }
  });

  stream.on("error", (err: any) => {
    console.error("[upload-cleaner] stream error:", err?.message || err);
    setTimeout(() => {
      console.log("[upload-cleaner] retrying watcher in 5s…");
      watchUploadCleaner().catch((e) =>
        console.error("[upload-cleaner] retry failed:", e)
      );
    }, 5000);
  });

  console.log("[upload-cleaner] watching Session changes…");
}
