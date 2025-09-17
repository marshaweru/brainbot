import "dotenv/config";
import { connectMongo } from "../src/db/mongo";
import { upsertPaper } from "../src/repo/papersRepo";

async function main() {
  await connectMongo();
  const rows = [
    { subject: "Mathematics", year: 2021, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/math/2021-paper1.pdf" },
    { subject: "English",     year: 2022, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/english/2022-paper1.pdf" },
    { subject: "Kiswahili",   year: 2023, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/kiswahili/2023-paper1.pdf" },
    { subject: "Biology",     year: 2024, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/biology/2024-paper1.pdf" },
    { subject: "Chemistry",   year: 2020, paperNumber: 1, format: "pdf", pathOrUrl: "content/papers/chemistry/2020-paper1.pdf" },
  ];
  for (const r of rows) await upsertPaper(r as any);
  console.log("✅ Seeded papers");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
