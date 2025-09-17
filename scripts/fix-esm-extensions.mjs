// scripts/fix-esm-extensions.mjs
import fs from "fs";
import path from "path";
import url from "url";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ROOT = process.cwd();

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "out"]);
const EXT_IN = new Set([".ts", ".tsx", ".mts", ".cts"]);
const EXT_OK = [".js", ".mjs", ".cjs", ".json", ".node"];

const reFrom = /^(?:\s*)(?:import|export)\b[^;\n]*?\bfrom\s+(['"])(\.(?:\.?)[^'")\s;]+)\1/gm;
const reBare = /^(?:\s*)import\s+(['"])(\.(?:\.?)[^'")\s;]+)\1/gm;
const reDyn  = /^(?:\s*)import\(\s*(['"])(\.(?:\.?)[^'")\s;]+)\1\s*\)/gm;

function isRelativeSpec(spec) {
  return spec.startsWith("./") || spec.startsWith("../");
}
function hasRuntimeExt(spec) {
  return EXT_OK.some(ext => spec.endsWith(ext));
}
function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function resolveNewSpec(filePath, spec) {
  const baseDir = path.dirname(filePath);

  // If the import already points to a file with runtime ext, keep it
  if (hasRuntimeExt(spec)) return spec;

  // Try same path with TypeScript extensions
  for (const ext of EXT_IN) {
    if (fileExists(path.join(baseDir, spec + ext))) {
      return spec + ".js";
    }
  }

  // Try directory index
  for (const ext of EXT_IN) {
    if (fileExists(path.join(baseDir, spec, "index" + ext))) {
      return spec.endsWith("/") ? spec + "index.js" : spec + "/index.js";
    }
  }

  // Fallback: append .js (ESM requires an extension at runtime)
  return spec + ".js";
}

function fixText(filePath, text) {
  let changed = false;

  const replacer = (match, q, spec) => {
    if (!isRelativeSpec(spec) || hasRuntimeExt(spec)) return match;
    const newSpec = resolveNewSpec(filePath, spec);
    if (newSpec === spec) return match;
    changed = true;
    return match.replace(spec, newSpec);
  };

  text = text.replace(reFrom, replacer);
  text = text.replace(reBare, replacer);
  text = text.replace(reDyn, replacer);

  return { text, changed };
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const files = walk(ROOT);
const touched = [];

for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  const { text, changed } = fixText(f, orig);
  if (changed) {
    touched.push(f);
    if (APPLY) {
      fs.writeFileSync(f + ".bak", orig);
      fs.writeFileSync(f, text);
    }
  }
}

if (touched.length === 0) {
  console.log("No fixes needed.");
} else if (APPLY) {
  console.log(`Patched ${touched.length} file(s). Backups written as *.bak`);
  for (const f of touched) console.log(" -", path.relative(ROOT, f));
} else {
  console.log(`Dry run: would patch ${touched.length} file(s). Run with --apply to write changes:`);
  for (const f of touched) console.log(" -", path.relative(ROOT, f));
}
