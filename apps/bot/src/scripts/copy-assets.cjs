// apps/bot/scripts/copy-assets.cjs
/* Copies non-TS assets into dist so runtime paths work after build. */
const fs = require("fs");
const path = require("path");

const from = path.join(__dirname, "..", "src", "pdf_worker");
const to = path.join(__dirname, "..", "dist", "pdf_worker");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyDir(from, to);
console.log(`📎 Copied pdf_worker → ${to}`);
