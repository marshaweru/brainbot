import fs from "fs";
import path from "path";

// CLI
const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();

// Skip noisy dirs; add more if needed
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "out", ".turbo", "coverage"]);

// Source extensions we consider “dev-time”
const EXT_IN = new Set([".ts", ".tsx", ".mts", ".cts"]);

// Runtime-resolvable extensions (Node ESM)
const EXT_OK = [".js", ".mjs", ".cjs", ".json", ".node"];

// Matches: import/export ... from '...'
const reFrom = /^(?:\s*)(?:import|export)\b[^;\n]*?\bfrom\s+(['"])(\.(?:\.?)[^'")\s;]+)\1/gm;
// Matches: bare side-effect imports: import '...'
const reBare = /^(?:\s*)import\s+(['"])(\.(?:\.?)[^'")\s;]+)\1/gm;
// Matches: dynamic import('...')
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

  // If import already has a runtime extension, keep it
  if (hasRuntimeExt(spec)) return spec;

  // Try same path with known TS extensions
  for (const ext of EXT_IN) {
    if (fileExists(path.join(baseDir, spec + ext))) {
      return spec + ".js";
    }
  }

  // Try directory index variants (index.ts / index.tsx / index.mts / index.cts)
  for (const ext of EXT_IN) {
    if (fileExists(path.join(baseDir, spec, "index" + ext))) {
      return spec.endsWith("/") ? spec + "index.js" : spec + "/index.js";
    }
  }

  // Fallback: append .js (valid in Node ESM)
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

  // Handle import/export-from, bare imports, and dynamic imports
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
    } else {
      // Include .ts, .tsx, .mts, .cts (but skip .d.ts)
      if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        out.push(path.join(dir, entry.name));
      }
    }
  }
  return out;
}

const files = walk(ROOT);
const touched = [];

for (const f of files) {
  let orig;
  try {
    orig = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  const { text, changed } = fixText(f, orig);
  if (!changed) continue;

  touched.push(f);
  if (APPLY) {
    try {
      fs.writeFileSync(f + ".bak", orig);
      fs.writeFileSync(f, text);
    } catch (e) {
      console.error("Failed to patch:", f, e);
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
