import { describe, expect, it } from "vitest";
import { shoppingListText, type ShoppingListLabels } from "../shoppingList";
import { item, offer } from "./fixtures";

const labels: ShoppingListLabels = {
  slot: (s) => s.toUpperCase(),
  noLink: "(no link)",
  total: (a) => `Total: ${a}`,
  partial: (n) => `Missing prices: ${n}`,
  accessories: (a) => `Accessories: ${a}`,
  pricesMayChange: "Prices may have changed.",
  money: (v) => `${v} SAR`,
};

describe("shoppingListText", () => {
  it("lists parts by slot with best link and totals", () => {
    const text = shoppingListText("My PC", [
      item("cpu", { name: "Ryzen", offers: [offer({ price: 900, url: "https://a/cpu" }), offer({ price: 800, url: "https://b/cpu" })] }),
      item("ram", { name: "Kit", quantity: 2, offers: [offer({ url: "https://a/ram" })] }),
      item("case", { name: "Box" }),
      item("accessory", { name: "Mouse", offers: [offer({ price: 50, url: "https://a/mouse" })] }),
    ], "en", labels, "https://site/build/1");
    expect(text).toBe([
      "My PC",
      "https://site/build/1",
      "",
      "CASE:",
      "- Box — (no link)",
      "",
      "CPU:",
      "- Ryzen (800 SAR) — https://b/cpu",
      "",
      "RAM:",
      "- Kit ×2 — https://a/ram",
      "",
      "ACCESSORY:",
      "- Mouse (50 SAR) — https://a/mouse",
      "",
      "Total: 800 SAR",
      "Missing prices: 2",
      "Accessories: 50 SAR",
      "Prices may have changed.",
    ].join("\n"));
  });

  it("omits the total when nothing is priced", () => {
    const text = shoppingListText("X", [item("cpu", { name: "C" })], "ar", labels);
    expect(text).not.toContain("Total");
    expect(text.endsWith("Prices may have changed.")).toBe(true);
  });
});
