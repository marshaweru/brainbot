// apps/bot/scripts/copy-assets.cjs
/* Copies non-TS assets into dist so runtime paths work after build. */
const fs = require("fs");
const path = require("path");

const FROM = path.join(__dirname, "..", "src", "pdf_worker");
const TO   = path.join(__dirname, "..", "dist", "pdf_worker");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

const copied = copyDir(FROM, TO);
console.log(`📎 Copied pdf_worker → ${TO} (${copied} file${copied === 1 ? "" : "s"})`);

