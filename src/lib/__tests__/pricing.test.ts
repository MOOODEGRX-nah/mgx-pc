import { describe, expect, it } from "vitest";
import { bestOffer, computeTotals, isStale, lastPriceUpdate, totalsByStore } from "../pricing";
import { item, offer } from "./fixtures";

describe("bestOffer", () => {
  it("returns null when nothing is priced", () => {
    expect(bestOffer([])).toBeNull();
    expect(bestOffer([offer(), offer({ price: null, in_stock: true })])).toBeNull();
  });

  it("picks the cheapest offer that is not out of stock (unknown stock counts)", () => {
    const outOfStock = offer({ price: 100, in_stock: false });
    const unknown = offer({ price: 150, in_stock: null });
    const inStock = offer({ price: 200, in_stock: true });
    expect(bestOffer([outOfStock, unknown, inStock])).toBe(unknown);
  });

  it("breaks price ties with the most recently updated offer", () => {
    const older = offer({ price: 100, price_updated_at: "2026-01-01T00:00:00Z" });
    const newer = offer({ price: 100, price_updated_at: "2026-02-01T00:00:00Z" });
    const never = offer({ price: 100 });
    expect(bestOffer([older, never, newer])).toBe(newer);
  });

  it("treats price 0 as a valid price", () => {
    const free = offer({ price: 0 });
    expect(bestOffer([offer({ price: 10 }), free])).toBe(free);
  });
});

describe("computeTotals", () => {
  it("sums quantity × best price for core items and keeps accessories separate", () => {
    const t = computeTotals([
      item("cpu", { offers: [offer({ price: 1000 }), offer({ price: 900 })] }),
      item("ram", { quantity: 2, offers: [offer({ price: 150.25 })] }),
      item("accessory", { offers: [offer({ price: 50 })] }),
    ]);
    expect(t).toEqual({
      total: 1200.5,
      accessoriesTotal: 50,
      itemsCount: 2,
      pricedCount: 2,
      missingCount: 0,
      isPartial: false,
    });
  });

  it("flags partial totals when a core item has no usable price", () => {
    const t = computeTotals([
      item("cpu", { offers: [offer({ price: 1000 })] }),
      item("gpu", { offers: [offer({ price: 2000, in_stock: false })] }),
      item("case"),
      item("accessory"), // unpriced accessories never make the PC total partial
    ]);
    expect(t.total).toBe(1000);
    expect(t.itemsCount).toBe(3);
    expect(t.pricedCount).toBe(1);
    expect(t.missingCount).toBe(2);
    expect(t.isPartial).toBe(true);
  });

  it("handles an empty build", () => {
    expect(computeTotals([])).toMatchObject({ total: 0, itemsCount: 0, isPartial: false });
  });
});

describe("totalsByStore", () => {
  it("totals each store over the items it covers, best coverage first", () => {
    const rows = totalsByStore([
      item("cpu", { offers: [offer({ store_id: "amz", price: 1000 }), offer({ store_id: "ali", price: 800 })] }),
      item("ram", { quantity: 2, offers: [offer({ store_id: "amz", price: 100 }), offer({ store_id: "amz", price: 90 })] }),
      item("gpu", { offers: [offer({ store_id: "ali", price: 500, in_stock: false })] }),
      item("accessory", { offers: [offer({ store_id: "ali", price: 10 })] }),
    ]);
    expect(rows).toEqual([
      { storeId: "amz", total: 1180, coveredCount: 2, itemsCount: 3 },
      { storeId: "ali", total: 800, coveredCount: 1, itemsCount: 3 },
    ]);
  });
});

describe("isStale", () => {
  const now = Date.parse("2026-03-15T00:00:00Z");
  it("is stale when never updated", () => {
    expect(isStale(null, 14, now)).toBe(true);
  });
  it("compares against the threshold in days", () => {
    expect(isStale("2026-03-02T00:00:00Z", 14, now)).toBe(false); // 13 days
    expect(isStale("2026-02-28T00:00:00Z", 14, now)).toBe(true); // 15 days
  });
});

describe("lastPriceUpdate", () => {
  it("returns the newest update among usable offers", () => {
    expect(lastPriceUpdate([
      item("cpu", { offers: [offer({ price: 1, price_updated_at: "2026-01-05T00:00:00Z" })] }),
      item("gpu", { offers: [offer({ price: 1, in_stock: false, price_updated_at: "2026-02-01T00:00:00Z" })] }),
      item("ram", { offers: [offer({ price: 1, price_updated_at: "2026-01-20T00:00:00Z" })] }),
    ])).toBe("2026-01-20T00:00:00Z");
    expect(lastPriceUpdate([])).toBeNull();
  });
});
