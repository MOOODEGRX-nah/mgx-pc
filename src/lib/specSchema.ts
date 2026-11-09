import type { ComponentSpecs, ComponentType, SpecValue } from "../types";

/*
 * Spec fields per component type (stored in components.specs).
 * Drives the admin form (dynamic inputs) and the compatibility rules.
 * Every field is optional: missing data disables the related check.
 * Field labels are translated under `specs.<key>`; enum options under
 * `specOptions.<key>.<value>` only when `translateOptions` is set.
 */

export type SpecKind = "int" | "string" | "bool" | "enum" | "multi_enum" | "string_list";

export interface SpecField {
  key: string;
  kind: SpecKind;
  /** Allowed values for enum / multi_enum. */
  options?: readonly string[];
  /** Translate option labels (e.g. accessory categories); technical values like DDR5 are shown as-is. */
  translateOptions?: boolean;
  /** Display unit appended to inputs (not translated: W, mm, GB, MHz, Hz). */
  unit?: string;
  min?: number;
  max?: number;
  /** Placeholder / example shown in the admin input. */
  example?: string;
  /** Only relevant when another spec has a given value. */
  showIf?: { key: string; equals: string };
}

export const RAM_TYPES = ["DDR4", "DDR5"] as const;
export const FORM_FACTORS = ["ATX", "mATX", "ITX"] as const;
export const COOLER_KINDS = ["air", "aio"] as const;
export const ACCESSORY_CATEGORIES = ["keyboard", "mouse", "headset", "monitor", "desk", "chair", "other"] as const;

const capacity: SpecField = { key: "capacity_gb", kind: "int", unit: "GB", min: 1, max: 100000 };

export const SPEC_SCHEMA: Record<ComponentType, SpecField[]> = {
  cpu: [
    { key: "socket", kind: "string", example: "AM5" },
    { key: "cores", kind: "int", min: 1, max: 256 },
    { key: "threads", kind: "int", min: 1, max: 512 },
    { key: "tdp_w", kind: "int", unit: "W", min: 1, max: 1000 },
    { key: "integrated_gpu", kind: "bool" },
    { key: "includes_cooler", kind: "bool" },
  ],
  motherboard: [
    { key: "socket", kind: "string", example: "AM5" },
    { key: "ram_type", kind: "enum", options: RAM_TYPES },
    { key: "form_factor", kind: "enum", options: FORM_FACTORS },
    { key: "m2_slots", kind: "int", min: 0, max: 16 },
  ],
  gpu: [
    { key: "vram_gb", kind: "int", unit: "GB", min: 1, max: 256 },
    { key: "tdp_w", kind: "int", unit: "W", min: 1, max: 2000 },
    { key: "length_mm", kind: "int", unit: "mm", min: 50, max: 600 },
  ],
  ram: [
    { key: "ram_type", kind: "enum", options: RAM_TYPES },
    { key: "capacity_gb", kind: "int", unit: "GB", min: 1, max: 1024 },
    { key: "speed_mhz", kind: "int", unit: "MHz", min: 100, max: 20000 },
    { key: "modules", kind: "int", min: 1, max: 16 },
  ],
  ssd_nvme: [capacity],
  ssd_sata: [capacity],
  hdd_2_5: [capacity],
  hdd_3_5: [capacity],
  cpu_cooler: [
    { key: "cooler_kind", kind: "enum", options: COOLER_KINDS, translateOptions: true },
    { key: "sockets", kind: "string_list", example: "AM4, AM5, LGA1700" },
    { key: "height_mm", kind: "int", unit: "mm", min: 10, max: 300, showIf: { key: "cooler_kind", equals: "air" } },
    { key: "radiator_mm", kind: "int", unit: "mm", min: 80, max: 480, showIf: { key: "cooler_kind", equals: "aio" } },
  ],
  psu: [
    { key: "wattage", kind: "int", unit: "W", min: 100, max: 3000 },
    { key: "efficiency", kind: "string", example: "80+ Gold" },
    { key: "modular", kind: "bool" },
  ],
  case: [
    { key: "form_factors", kind: "multi_enum", options: FORM_FACTORS },
    { key: "max_gpu_length_mm", kind: "int", unit: "mm", min: 50, max: 800 },
    { key: "max_cooler_height_mm", kind: "int", unit: "mm", min: 10, max: 300 },
  ],
  accessory: [
    { key: "category", kind: "enum", options: ACCESSORY_CATEGORIES, translateOptions: true },
    { key: "resolution", kind: "string", example: "2560x1440", showIf: { key: "category", equals: "monitor" } },
    { key: "refresh_hz", kind: "int", unit: "Hz", min: 30, max: 1000, showIf: { key: "category", equals: "monitor" } },
  ],
};

/** CPU and GPU carry a performance tier (1–5) used by the advisor. */
export function hasPerfTier(type: ComponentType): boolean {
  return type === "cpu" || type === "gpu";
}

function coerce(field: SpecField, raw: unknown): SpecValue | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  switch (field.kind) {
    case "int": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) return undefined;
      const i = Math.round(n);
      if (field.min !== undefined && i < field.min) return undefined;
      if (field.max !== undefined && i > field.max) return undefined;
      return i;
    }
    case "bool":
      if (typeof raw === "boolean") return raw;
      if (raw === "true") return true;
      if (raw === "false") return false;
      return undefined;
    case "string": {
      const s = String(raw).trim();
      return s === "" ? undefined : s;
    }
    case "enum": {
      const s = String(raw).trim();
      return field.options?.includes(s) ? s : undefined;
    }
    case "multi_enum":
    case "string_list": {
      const list = (Array.isArray(raw) ? raw : String(raw).split(","))
        .map((v) => String(v).trim())
        .filter((v) => v !== "");
      const allowed = field.kind === "multi_enum" ? list.filter((v) => field.options?.includes(v)) : list;
      const unique = [...new Set(allowed)];
      return unique.length > 0 ? unique : undefined;
    }
  }
}

/**
 * Keeps only the fields defined for `type`, coerced to their kind.
 * Invalid or empty values are dropped (never throws).
 */
export function normalizeSpecs(type: ComponentType, raw: Record<string, unknown> | null | undefined): ComponentSpecs {
  const out: ComponentSpecs = {};
  if (!raw || typeof raw !== "object") return out;
  for (const field of SPEC_SCHEMA[type]) {
    const value = coerce(field, raw[field.key]);
    if (value !== undefined) out[field.key] = value;
  }
  return out;
}

// ---------- typed readers (used by compatibility rules) ----------

export function specNum(specs: ComponentSpecs | null | undefined, key: string): number | undefined {
  const v = specs?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function specStr(specs: ComponentSpecs | null | undefined, key: string): string | undefined {
  const v = specs?.[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export function specBool(specs: ComponentSpecs | null | undefined, key: string): boolean | undefined {
  const v = specs?.[key];
  return typeof v === "boolean" ? v : undefined;
}

export function specList(specs: ComponentSpecs | null | undefined, key: string): string[] | undefined {
  const v = specs?.[key];
  if (!Array.isArray(v)) return undefined;
  const list = v.map((x) => String(x).trim()).filter((x) => x !== "");
  return list.length > 0 ? list : undefined;
}
