import { STORAGE_TYPES, type ComponentSpecs, type ComponentType } from "../types";
import { specBool, specList, specNum, specStr } from "./specSchema";

/*
 * Soft compatibility checks. Never blocking: the UI shows warnings only.
 * A rule runs only when every spec field it needs is present, so missing
 * catalog data disables a check instead of producing a false warning.
 * Messages are translated as `compat.<id>` with `params`.
 */

export type CompatRuleId =
  | "socket_mismatch"
  | "ram_type_mismatch"
  | "case_form_factor"
  | "gpu_too_long"
  | "cooler_too_tall"
  | "cooler_socket"
  | "psu_underpowered"
  | "no_gpu_no_igpu"
  | "no_cooler"
  | "no_storage";

export type CompatSeverity = "error" | "warning";

export interface CompatWarning {
  id: CompatRuleId;
  severity: CompatSeverity;
  params: Record<string, string | number>;
}

/** Smallest item shape the rules need. */
export interface CompatItem {
  quantity?: number;
  component: { type: ComponentType; name: string; specs: ComponentSpecs | null };
}

/** Recommended PSU wattage: 1.4 × (CPU TDP + GPU TDP) + 75 W headroom, rounded up. */
export function recommendedPsuWattage(cpuTdp: number, gpuTdp: number): number {
  return Math.ceil(1.4 * (cpuTdp + gpuTdp) + 75);
}

const sameSocket = (a: string, b: string) => a.replace(/\s+/g, "").toLowerCase() === b.replace(/\s+/g, "").toLowerCase();

export function checkCompatibility(items: CompatItem[]): CompatWarning[] {
  const warnings: CompatWarning[] = [];
  const add = (id: CompatRuleId, severity: CompatSeverity, params: Record<string, string | number> = {}) =>
    warnings.push({ id, severity, params });

  const first = (type: ComponentType) => items.find((i) => i.component.type === type)?.component;
  const all = (type: ComponentType) => items.filter((i) => i.component.type === type).map((i) => i.component);

  const cpu = first("cpu");
  const board = first("motherboard");
  const gpu = first("gpu");
  const pcCase = first("case");
  const cooler = first("cpu_cooler");
  const psu = first("psu");
  const rams = all("ram");

  const cpuSocket = specStr(cpu?.specs, "socket");
  const boardSocket = specStr(board?.specs, "socket");

  // socket_mismatch
  if (cpu && board && cpuSocket && boardSocket && !sameSocket(cpuSocket, boardSocket)) {
    add("socket_mismatch", "error", { cpu: cpuSocket, board: boardSocket });
  }

  // ram_type_mismatch (each RAM kit)
  const boardRam = specStr(board?.specs, "ram_type");
  if (board && boardRam) {
    for (const ram of rams) {
      const ramType = specStr(ram.specs, "ram_type");
      if (ramType && ramType.toUpperCase() !== boardRam.toUpperCase()) {
        add("ram_type_mismatch", "error", { ram: ramType, board: boardRam, name: ram.name });
      }
    }
  }

  // case_form_factor
  const boardFf = specStr(board?.specs, "form_factor");
  const caseFfs = specList(pcCase?.specs, "form_factors");
  if (board && pcCase && boardFf && caseFfs && !caseFfs.some((f) => f.toLowerCase() === boardFf.toLowerCase())) {
    add("case_form_factor", "error", { board: boardFf, supported: caseFfs.join(", ") });
  }

  // gpu_too_long
  const gpuLen = specNum(gpu?.specs, "length_mm");
  const caseGpuMax = specNum(pcCase?.specs, "max_gpu_length_mm");
  if (gpu && pcCase && gpuLen !== undefined && caseGpuMax !== undefined && gpuLen > caseGpuMax) {
    add("gpu_too_long", "error", { length: gpuLen, max: caseGpuMax });
  }

  // cooler_too_tall (air coolers only; AIO height is the pump block, not limited by the case)
  const coolerHeight = specNum(cooler?.specs, "height_mm");
  const caseCoolerMax = specNum(pcCase?.specs, "max_cooler_height_mm");
  if (
    cooler && pcCase && specStr(cooler.specs, "cooler_kind") !== "aio" &&
    coolerHeight !== undefined && caseCoolerMax !== undefined && coolerHeight > caseCoolerMax
  ) {
    add("cooler_too_tall", "error", { height: coolerHeight, max: caseCoolerMax });
  }

  // cooler_socket
  const coolerSockets = specList(cooler?.specs, "sockets");
  if (cpu && cooler && cpuSocket && coolerSockets && !coolerSockets.some((s) => sameSocket(s, cpuSocket))) {
    add("cooler_socket", "error", { socket: cpuSocket, supported: coolerSockets.join(", ") });
  }

  // psu_underpowered: needs PSU wattage + CPU TDP, and GPU TDP when a GPU is selected
  const wattage = specNum(psu?.specs, "wattage");
  const cpuTdp = specNum(cpu?.specs, "tdp_w");
  const gpuTdp = gpu ? specNum(gpu.specs, "tdp_w") : 0;
  if (psu && cpu && wattage !== undefined && cpuTdp !== undefined && gpuTdp !== undefined) {
    const recommended = recommendedPsuWattage(cpuTdp, gpuTdp);
    if (wattage < recommended) add("psu_underpowered", "warning", { wattage, recommended });
  }

  // no_gpu_no_igpu
  if (cpu && !gpu && specBool(cpu.specs, "integrated_gpu") === false) {
    add("no_gpu_no_igpu", "warning");
  }

  // no_cooler
  if (cpu && !cooler && specBool(cpu.specs, "includes_cooler") === false) {
    add("no_cooler", "warning");
  }

  // no_storage: only once the build has a CPU or motherboard (avoids noise on an empty builder)
  if ((cpu || board) && !items.some((i) => STORAGE_TYPES.includes(i.component.type))) {
    add("no_storage", "warning");
  }

  return warnings;
}

/**
 * Rules that would fail if `candidate` were added to (or replaced its slot in) `current`.
 * Used for the "incompatible" badge in pickers. Only errors are reported; the
 * candidate is still selectable.
 */
export function candidateConflicts(current: CompatItem[], candidate: CompatItem["component"]): CompatRuleId[] {
  const replacesSlot = candidate.type !== "ram" && !STORAGE_TYPES.includes(candidate.type) && candidate.type !== "accessory";
  const base = replacesSlot ? current.filter((i) => i.component.type !== candidate.type) : current;
  const before = new Set(checkCompatibility(base).filter((w) => w.severity === "error").map((w) => w.id));
  return checkCompatibility([...base, { quantity: 1, component: candidate }])
    .filter((w) => w.severity === "error" && !before.has(w.id))
    .map((w) => w.id);
}
