import { describe, expect, it } from "vitest";
import { COMPONENT_TYPES } from "../../types";
import { SPEC_SCHEMA, normalizeSpecs } from "../specSchema";

describe("SPEC_SCHEMA", () => {
  it("defines every component type with unique keys", () => {
    for (const type of COMPONENT_TYPES) {
      const keys = SPEC_SCHEMA[type].map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("normalizeSpecs", () => {
  it("coerces values and drops unknown or invalid fields", () => {
    expect(normalizeSpecs("cpu", {
      socket: " AM5 ",
      cores: "8",
      threads: 16.4,
      tdp_w: "abc",
      integrated_gpu: "true",
      includes_cooler: false,
      unknown: 1,
    })).toEqual({ socket: "AM5", cores: 8, threads: 16, integrated_gpu: true, includes_cooler: false });
  });

  it("validates enums and lists", () => {
    expect(normalizeSpecs("motherboard", { ram_type: "DDR3", form_factor: "mATX" })).toEqual({ form_factor: "mATX" });
    expect(normalizeSpecs("case", { form_factors: ["ATX", "EATX", "ATX"] })).toEqual({ form_factors: ["ATX"] });
    expect(normalizeSpecs("cpu_cooler", { sockets: "AM4, AM5 ,, LGA1700" })).toEqual({ sockets: ["AM4", "AM5", "LGA1700"] });
  });

  it("enforces numeric ranges and tolerates bad input", () => {
    expect(normalizeSpecs("psu", { wattage: 50 })).toEqual({});
    expect(normalizeSpecs("psu", null)).toEqual({});
  });
});
