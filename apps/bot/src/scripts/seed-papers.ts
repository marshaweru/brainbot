// apps/bot/src/scripts/seed-papers.ts
import "dotenv/config";
import { connectMongo } from "../db/mongo.js";
// apps/bot/src/scripts/seed-papers.ts
import { upsertPaper } from "../repo/papersDbRepo.js";

type SeedPaper = {
  subject: string;
  year: number;
  paperNumber: 1 | 2 | 3;
  format: "pdf" | "img" | "zip";
  pathOrUrl: string;
};

async function main() {
  console.log("🔌 connecting to Mongo… CWD=", process.cwd());
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
  await connectMongo();
  console.log("✅ connected");

  const rows: SeedPaper[] = [
    { subject: "Mathematics", year: 2021, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/math/2021-paper1.pdf" },
    { subject: "English",     year: 2022, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/english/2022-paper1.pdf" },
    { subject: "Kiswahili",   year: 2023, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/kiswahili/2023-paper1.pdf" },
    { subject: "Biology",     year: 2024, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/biology/2024-paper1.pdf" },
    { subject: "Chemistry",   year: 2020, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/chemistry/2020-paper1.pdf" },
  ];

  for (const r of rows) {
    console.log(`⬆️ upsert ${r.subject} ${r.year} P${r.paperNumber}`);
    await upsertPaper(r as any);
  }

  console.log(`🎉 Seeded ${rows.length} papers`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
