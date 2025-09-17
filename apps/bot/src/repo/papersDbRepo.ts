// apps/bot/src/repo/papersDbRepo.ts
import mongoose from "mongoose";

/** --- Types --------------------------------------------------------------- */
export type PaperNumber = 1 | 2 | 3;
export type PaperFormat = "pdf" | "img" | "zip";
export type PaperSource = "kcse" | "mock" | "ai";

export type PaperUpsert = {
  subject: string;
  year: number;
  paperNumber: PaperNumber;
  format: PaperFormat;
  pathOrUrl: string;        // local path or remote URL
  source?: PaperSource;     // default "kcse"
};

/** --- Schema & Model ------------------------------------------------------ */
const PaperSchema = new mongoose.Schema<PaperUpsert>(
  {
    subject: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1900, max: 3000 },
    paperNumber: { type: Number, enum: [1, 2, 3], required: true },
    format: { type: String, enum: ["pdf", "img", "zip"], required: true },
    pathOrUrl: { type: String, required: true, trim: true },
    source: { type: String, enum: ["kcse", "mock", "ai"], default: "kcse" },
  },
  { timestamps: true }
);

// Uniqueness per (subject, year, paper)
PaperSchema.index({ subject: 1, year: 1, paperNumber: 1 }, { unique: true });

// Use a distinct model name to avoid clashing with any FS "Paper" model
const DbPaper =
  mongoose.models.DbPaper || mongoose.model<PaperUpsert>("DbPaper", PaperSchema);

/** --- API ----------------------------------------------------------------- */

/** Upsert one paper by (subject, year, paperNumber). */
export async function upsertPaper(row: PaperUpsert): Promise<void> {
  const doc = {
    ...row,
    source: row.source ?? "kcse",
  };
  await DbPaper.updateOne(
    { subject: doc.subject, year: doc.year, paperNumber: doc.paperNumber },
    { $set: doc },
    { upsert: true }
  );
}

/** Optional helpers (handy for admin/testing). */
export async function findPaper(
  key: Pick<PaperUpsert, "subject" | "year" | "paperNumber">
) {
  return DbPaper.findOne(key).lean<PaperUpsert | null>();
}

export async function listPapers(subject?: string) {
  const q = subject ? { subject } : {};
  return DbPaper.find(q).sort({ year: -1, paperNumber: 1 }).lean<PaperUpsert[]>();
}

/** Ensure indexes exist (safe to call during boot). */
export async function ensureIndexes() {
  await DbPaper.syncIndexes();
}
