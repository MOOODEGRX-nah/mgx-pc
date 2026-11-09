import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, localeFor, normalizeLang } from "../format";
import { pickLang } from "../i18nData";
import { cleanUrl, isHttpUrl } from "../url";
import { AppError, toAppError } from "../errors";

describe("formatMoney", () => {
  it("formats SAR without decimals in English", () => {
    const s = formatMoney(1500, "en");
    expect(s).toMatch(/SAR/);
    expect(s).toMatch(/1,500/);
    expect(formatMoney(1499.6, "en")).toMatch(/1,500/);
  });

  it("uses Latin digits in Arabic", () => {
    const s = formatMoney(12345, "ar");
    expect(s).toMatch(/12,345/);
    expect(s).not.toMatch(/[٠-٩]/);
  });

  it("maps languages to locales", () => {
    expect(localeFor("ar")).toBe("ar-SA-u-nu-latn");
    expect(localeFor("en")).toBe("en-US");
    expect(normalizeLang("en-GB")).toBe("en");
    expect(normalizeLang(undefined)).toBe("ar");
  });
});

describe("formatDate", () => {
  it("formats valid dates and ignores invalid ones", () => {
    expect(formatDate("2026-03-05T12:00:00Z", "en")).toMatch(/2026/);
    expect(formatDate("2026-03-05T12:00:00Z", "ar")).not.toMatch(/[٠-٩]/);
    expect(formatDate(null, "en")).toBe("");
    expect(formatDate("not a date", "en")).toBe("");
  });
});

describe("pickLang", () => {
  const build = { name_ar: "جهاز", name_en: "Rig" };
  const comp = { name: "Ryzen 5 7600", name_ar: "رايزن" };

  it("prefers the current language", () => {
    expect(pickLang(build, "name", "ar")).toBe("جهاز");
    expect(pickLang(build, "name", "en")).toBe("Rig");
  });

  it("falls back to the base field before the other language", () => {
    expect(pickLang(comp, "name", "en")).toBe("Ryzen 5 7600");
    expect(pickLang(comp, "name", "ar")).toBe("رايزن");
  });

  it("falls back to the other language and treats empty strings as missing", () => {
    expect(pickLang({ title_ar: "عنوان", title_en: "  " }, "title", "en")).toBe("عنوان");
    expect(pickLang({}, "title", "en")).toBe("");
  });
});

describe("url helpers", () => {
  it("accepts only http(s) URLs", () => {
    expect(isHttpUrl("https://amazon.sa/dp/123")).toBe(true);
    expect(isHttpUrl(" http://x.com ")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("amazon.sa/dp/123")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(cleanUrl("  ")).toBeNull();
    expect(cleanUrl(" https://a.b ")).toBe("https://a.b");
  });
});

describe("toAppError", () => {
  it("maps RPC exceptions and RLS failures", () => {
    expect(toAppError({ code: "P0001", message: "rate_limited" }).code).toBe("rate_limited");
    expect(toAppError({ code: "P0001", message: "unknown_component" }).i18nKey).toBe("errors.unknown_component");
    expect(toAppError({ code: "42501", message: "new row violates row-level security policy" }).code).toBe("not_allowed");
    expect(toAppError(new Error("boom")).code).toBe("generic");
    const original = new AppError("component_in_use", { count: 3 });
    expect(toAppError(original)).toBe(original);
  });
});
