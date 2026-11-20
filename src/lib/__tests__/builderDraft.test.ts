import { describe, expect, it } from "vitest";
import { missingForSubmit, parseDraft, serializeDraft, suggestCategory } from "../builderDraft";
import { item, offer } from "./fixtures";
import type { ComponentWithOffers, ItemWithComponent } from "../../types";

const asCatalog = (items: ItemWithComponent[]): ComponentWithOffers[] => items.map((i) => ({ ...i.component, offers: i.offers }));

describe("draft serialization", () => {
  it("round-trips and drops unknown components, duplicates and bad quantities", () => {
    const cpu = item("cpu", { quantity: 1 });
    const ram = item("ram", { quantity: 2 });
    const catalog = asCatalog([cpu, ram]);
    const raw = serializeDraft([cpu, ram]);
    expect(parseDraft(raw, catalog).map((i) => [i.component_id, i.quantity])).toEqual([[cpu.component_id, 1], [ram.component_id, 2]]);

    const messy = JSON.stringify({ v: 1, items: [{ id: "gone", qty: 1 }, { id: ram.component_id, qty: 99 }, { id: ram.component_id, qty: 1 }, { id: cpu.component_id, qty: "x" }] });
    expect(parseDraft(messy, catalog).map((i) => [i.component_id, i.quantity])).toEqual([[ram.component_id, 8], [cpu.component_id, 1]]);
  });

  it("ignores other versions and broken JSON", () => {
    expect(parseDraft(JSON.stringify({ v: 2, items: [] }), [])).toEqual([]);
    expect(parseDraft("{not json", [])).toEqual([]);
    expect(parseDraft(null, [])).toEqual([]);
  });
});

describe("missingForSubmit", () => {
  it("requires CPU, motherboard and RAM", () => {
    expect(missingForSubmit([item("cpu"), item("gpu")])).toEqual(["motherboard", "ram"]);
    expect(missingForSubmit([item("cpu"), item("motherboard"), item("ram")])).toEqual([]);
  });
});

describe("suggestCategory", () => {
  it("uses the GPU tier when known", () => {
    const gpu = item("gpu"); gpu.component.perf_tier = 4;
    expect(suggestCategory([gpu])).toBe("high-end");
    gpu.component.perf_tier = 3; expect(suggestCategory([gpu])).toBe("mid-range");
    gpu.component.perf_tier = 1; expect(suggestCategory([gpu])).toBe("budget");
  });
  it("falls back to the total", () => {
    expect(suggestCategory([item("cpu", { offers: [offer({ price: 9000 })] })])).toBe("high-end");
    expect(suggestCategory([item("cpu", { offers: [offer({ price: 5000 })] })])).toBe("mid-range");
    expect(suggestCategory([item("cpu")])).toBe("budget");
  });
});
