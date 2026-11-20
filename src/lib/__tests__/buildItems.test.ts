import { describe, expect, it } from "vitest";
import { diffBuildItems, groupItemsBySlot } from "../buildItems";
import { primaryOffer } from "../pricing";
import { item, offer } from "./fixtures";

describe("groupItemsBySlot", () => {
  it("groups in display order, storage by drive type, and skips empty slots", () => {
    const groups = groupItemsBySlot([
      item("accessory", { name: "Mouse" }),
      item("hdd_3_5", { name: "Big HDD" }),
      item("cpu", { name: "CPU" }),
      item("ssd_nvme", { name: "Fast SSD" }),
      item("case", { name: "Case" }),
      item("ram", { name: "B kit" }),
      item("ram", { name: "A kit" }),
    ]);
    expect(groups.map((g) => g.slot)).toEqual(["case", "cpu", "ram", "storage", "accessory"]);
    expect(groups.find((g) => g.slot === "storage")?.items.map((i) => i.component.name)).toEqual(["Fast SSD", "Big HDD"]);
    expect(groups.find((g) => g.slot === "ram")?.items.map((i) => i.component.name)).toEqual(["A kit", "B kit"]);
  });
});

describe("diffBuildItems", () => {
  it("deletes removed items, upserts the rest in order and clamps quantities", () => {
    const diff = diffBuildItems(
      [{ id: "r1", component_id: "a" }, { id: "r2", component_id: "b" }],
      [{ component_id: "c", quantity: 12 }, { component_id: "a", quantity: 0 }, { component_id: "c", quantity: 2 }],
    );
    expect(diff.remove).toEqual(["r2"]);
    expect(diff.upsert).toEqual([
      { component_id: "c", quantity: 2, sort_order: 0 },
      { component_id: "a", quantity: 1, sort_order: 1 },
    ]);
  });

  it("removes everything for an empty list", () => {
    expect(diffBuildItems([{ id: "r1", component_id: "a" }], [])).toEqual({ remove: ["r1"], upsert: [] });
  });
});

describe("primaryOffer", () => {
  it("prefers the best priced offer, else the first offer with a link", () => {
    const linkOnly = offer({ url: "https://a.example" });
    const priced = offer({ price: 10, url: "https://b.example" });
    expect(primaryOffer([linkOnly, priced])).toBe(priced);
    expect(primaryOffer([offer({ url: null }), linkOnly])).toBe(linkOnly);
    expect(primaryOffer([])).toBeNull();
  });
});
