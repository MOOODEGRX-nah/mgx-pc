import type { Lang } from "../types";

/**
 * Locale used for numbers and dates. Arabic uses Latin digits (-u-nu-latn)
 * so prices read the same as part names and store listings.
 */
export function localeFor(lang: string): string {
  return lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
}

export function normalizeLang(lang: string | undefined | null): Lang {
  return lang?.startsWith("en") ? "en" : "ar";
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatMoney(value: number, lang: string, currency = "SAR"): string {
  const key = `${lang}|${currency}`;
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(localeFor(lang), {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    moneyFormatters.set(key, fmt);
  }
  return fmt.format(value);
}

export function formatNumber(value: number, lang: string): string {
  return new Intl.NumberFormat(localeFor(lang)).format(value);
}

/** Formats an ISO timestamp as a date. Returns "" for null/invalid input. */
export function formatDate(value: string | Date | null | undefined, lang: string): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  let fmt = dateFormatters.get(lang);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(localeFor(lang), { year: "numeric", month: "short", day: "numeric" });
    dateFormatters.set(lang, fmt);
  }
  return fmt.format(date);
}
