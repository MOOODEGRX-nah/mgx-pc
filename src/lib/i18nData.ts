import type { Lang } from "../types";

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Picks a bilingual field from a data row.
 * Order: `<field>_<lang>` → `<field>` (base, e.g. components.name) → `<field>_<other lang>`.
 * The base field comes before the other language so an English page shows
 * a component's base name rather than its Arabic name. Empty strings count as missing.
 */
export function pickLang<T extends object>(obj: T, field: string, lang: Lang | string): string {
  const current: Lang = lang === "en" ? "en" : "ar";
  const other: Lang = current === "ar" ? "en" : "ar";
  const row = obj as Record<string, unknown>;
  return (
    nonEmpty(row[`${field}_${current}`]) ??
    nonEmpty(row[field]) ??
    nonEmpty(row[`${field}_${other}`]) ??
    ""
  );
}
