#!/usr/bin/env node
// Fails (exit 1) when the locale files do not have identical key sets.
// Usage: node scripts/check-i18n.mjs
// Note: i18next plural suffixes (_one/_other/_few…) differ between Arabic and English,
// so the app avoids plural keys and this strict parity check stays valid.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n", "locales");

function flatten(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const files = readdirSync(localesDir).filter((f) => f.endsWith(".json")).sort();
if (files.length < 2) {
  console.error(`check-i18n: expected at least 2 locale files in ${localesDir}`);
  process.exit(1);
}

const locales = files.map((file) => {
  const raw = readFileSync(join(localesDir, file), "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`check-i18n: ${file} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  return { file, keys: flatten(json) };
});

const allKeys = new Set(locales.flatMap((l) => [...l.keys.keys()]));
let problems = 0;

for (const { file, keys } of locales) {
  const missing = [...allKeys].filter((k) => !keys.has(k)).sort();
  for (const k of missing) {
    console.error(`  ${file}: missing key "${k}"`);
    problems++;
  }
  for (const [k, v] of keys) {
    if (typeof v !== "string") {
      console.error(`  ${file}: key "${k}" must be a string (got ${Array.isArray(v) ? "array" : typeof v})`);
      problems++;
    } else if (v.trim() === "") {
      console.error(`  ${file}: key "${k}" is empty`);
      problems++;
    }
  }
}

// Interpolation placeholders ({{name}}) must match across locales.
const placeholders = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");
for (const key of allKeys) {
  const variants = locales.filter((l) => l.keys.has(key)).map((l) => [l.file, placeholders(l.keys.get(key))]);
  const distinct = new Set(variants.map(([, p]) => p));
  if (distinct.size > 1) {
    console.error(`  key "${key}": interpolation placeholders differ: ${variants.map(([f, p]) => `${f}=[${p}]`).join(" ")}`);
    problems++;
  }
}

if (problems > 0) {
  console.error(`check-i18n: ${problems} problem(s) found in ${files.join(", ")}`);
  process.exit(1);
}
console.log(`check-i18n: OK — ${allKeys.size} keys in ${files.join(", ")}`);
