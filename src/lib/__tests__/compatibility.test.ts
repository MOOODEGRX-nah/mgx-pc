import { describe, expect, it } from "vitest";
import { candidateConflicts, checkCompatibility, recommendedPsuWattage } from "../compatibility";
import { component, item } from "./fixtures";

const ids = (items: Parameters<typeof checkCompatibility>[0]) => checkCompatibility(items).map((w) => w.id).sort();

const goodBuild = () => [
  item("cpu", { specs: { socket: "AM5", tdp_w: 105, integrated_gpu: true, includes_cooler: false } }),
  item("motherboard", { specs: { socket: "am5", ram_type: "DDR5", form_factor: "ATX" } }),
  item("ram", { specs: { ram_type: "DDR5" } }),
  item("gpu", { specs: { tdp_w: 220, length_mm: 300 } }),
  item("case", { specs: { form_factors: ["ATX", "mATX"], max_gpu_length_mm: 360, max_cooler_height_mm: 165 } }),
  item("cpu_cooler", { specs: { cooler_kind: "air", sockets: ["AM4", "AM5"], height_mm: 155 } }),
  item("psu", { specs: { wattage: 750 } }),
  item("ssd_nvme", { specs: { capacity_gb: 1000 } }),
];

describe("checkCompatibility", () => {
  it("returns no warnings for a consistent build", () => {
    expect(checkCompatibility(goodBuild())).toEqual([]);
  });

  it("skips every rule when specs are missing", () => {
    expect(ids([item("cpu"), item("motherboard"), item("gpu"), item("case"), item("psu"), item("ssd_sata")])).toEqual([]);
  });

  it("detects socket, RAM type, form factor, GPU length, cooler height and cooler socket errors", () => {
    const warnings = checkCompatibility([
      item("cpu", { specs: { socket: "LGA1700", tdp_w: 125 } }),
      item("motherboard", { specs: { socket: "AM5", ram_type: "DDR5", form_factor: "ATX" } }),
      item("ram", { specs: { ram_type: "DDR4" }, name: "Old kit" }),
      item("ram", { specs: { ram_type: "ddr5" } }),
      item("gpu", { specs: { length_mm: 340 } }),
      item("case", { specs: { form_factors: ["mATX", "ITX"], max_gpu_length_mm: 320, max_cooler_height_mm: 150 } }),
      item("cpu_cooler", { specs: { cooler_kind: "air", sockets: ["AM5"], height_mm: 160 } }),
      item("hdd_3_5"),
    ]);
    expect(warnings.map((w) => w.id).sort()).toEqual([
      "case_form_factor", "cooler_socket", "cooler_too_tall", "gpu_too_long", "ram_type_mismatch", "socket_mismatch",
    ]);
    expect(warnings.every((w) => w.severity === "error")).toBe(true);
    expect(warnings.find((w) => w.id === "ram_type_mismatch")?.params).toEqual({ ram: "DDR4", board: "DDR5", name: "Old kit" });
    expect(warnings.find((w) => w.id === "socket_mismatch")?.params).toEqual({ cpu: "LGA1700", board: "AM5" });
  });

  it("ignores case height for AIO coolers", () => {
    const build = goodBuild().map((i) =>
      i.component.type === "cpu_cooler"
        ? item("cpu_cooler", { specs: { cooler_kind: "aio", sockets: ["AM5"], height_mm: 400 } })
        : i);
    expect(ids(build)).toEqual([]);
  });

  it("warns when the PSU is below 1.4 × (CPU + GPU TDP) + 75 W", () => {
    expect(recommendedPsuWattage(105, 220)).toBe(530);
    const build = goodBuild().map((i) => (i.component.type === "psu" ? item("psu", { specs: { wattage: 500 } }) : i));
    expect(checkCompatibility(build)).toEqual([
      { id: "psu_underpowered", severity: "warning", params: { wattage: 500, recommended: 530 } },
    ]);
  });

  it("checks the PSU against CPU only when there is no GPU, but skips when the GPU TDP is unknown", () => {
    expect(ids([item("cpu", { specs: { tdp_w: 200 } }), item("psu", { specs: { wattage: 300 } }), item("ssd_sata")]))
      .toEqual(["psu_underpowered"]);
    expect(ids([item("cpu", { specs: { tdp_w: 200 } }), item("gpu"), item("psu", { specs: { wattage: 300 } }), item("ssd_sata")]))
      .toEqual([]);
  });

  it("warns about missing GPU, cooler and storage only when the CPU spec says so", () => {
    expect(ids([item("cpu", { specs: { integrated_gpu: false, includes_cooler: false } })]))
      .toEqual(["no_cooler", "no_gpu_no_igpu", "no_storage"]);
    expect(ids([item("cpu", { specs: { integrated_gpu: true, includes_cooler: true } }), item("ssd_nvme")])).toEqual([]);
    expect(ids([item("cpu"), item("ssd_nvme")])).toEqual([]);
  });

  it("does not warn about storage on an empty or accessory-only selection", () => {
    expect(ids([])).toEqual([]);
    expect(ids([item("accessory"), item("case")])).toEqual([]);
  });
});

describe("candidateConflicts", () => {
  it("reports errors a candidate would introduce, replacing single-item slots", () => {
    const current = [
      item("cpu", { specs: { socket: "AM5" } }),
      item("motherboard", { specs: { socket: "LGA1700" } }), // already mismatched
    ];
    // replacing the board with a matching one introduces nothing
    expect(candidateConflicts(current, component("motherboard", { socket: "AM5" }))).toEqual([]);
    // a DDR4 kit on a DDR5 board
    const ddr5 = [item("motherboard", { specs: { ram_type: "DDR5" } })];
    expect(candidateConflicts(ddr5, component("ram", { ram_type: "DDR4" }))).toEqual(["ram_type_mismatch"]);
  });
});
