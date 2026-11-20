#!/usr/bin/env node
// Lists literal t("key") calls in src/ whose key is missing from en.json (dynamic keys are not checked).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const en = JSON.parse(readFileSync("src/i18n/locales/en.json", "utf8"));
const has = (key) => key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), en) !== undefined;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

const missing = new Map();
for (const file of files("src")) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.-]+)["']/g)) {
    if (!has(m[1])) missing.set(m[1], [...(missing.get(m[1]) ?? []), file]);
  }
}
for (const [key, where] of [...missing].sort()) console.log(`${key}  (${[...new Set(where)].join(", ")})`);
if (missing.size) process.exit(1);
console.log("find-missing-i18n: OK");
