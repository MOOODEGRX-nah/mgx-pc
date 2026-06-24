export type Category = "high-end" | "mid-range" | "budget" | "console-equiv";
export type ConsoleTarget = "ps5" | "xbox-series-x" | "xbox-series-s" | "nintendo-switch";
export type PriceVsConsole = "cheaper" | "similar" | "more-expensive";
export type PerfVsConsole = "stronger" | "similar" | "weaker";

export type PartType =
  | "case" | "motherboard" | "cpu" | "cpu_cooler" | "gpu"
  | "ram" | "ssd_nvme" | "ssd_sata" | "hdd_2_5" | "hdd_3_5";

export const PART_TYPES: PartType[] = [
  "case","motherboard","cpu","cpu_cooler","gpu",
  "ram","ssd_nvme","ssd_sata","hdd_2_5","hdd_3_5",
];

export const COMPOSITE_PARTS: PartType[] = [
  "case","cpu","gpu","cpu_cooler","ram","ssd_nvme",
];

export const CATEGORIES: Category[] = [
  "high-end","mid-range","budget","console-equiv",
];

export interface Store {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface Build {
  id: string;
  name_ar: string;
  name_en: string;
  category: Category;
  image_url: string | null;
  description_ar: string | null;
  description_en: string | null;
  console_target: ConsoleTarget | null;
  price_vs_console: PriceVsConsole | null;
  perf_vs_console: PerfVsConsole | null;
  created_at: string;
}

export interface Part {
  id: string;
  build_id: string;
  type: PartType;
  part_name: string;
  store_id: string | null;
  store_link: string | null;
  image_url: string | null;
}

export interface Tool {
  id: string;
  build_id: string;
  tool_name: string;
  store_id: string | null;
  store_link: string | null;
}

export interface BuildWithRelations extends Build {
  parts: Part[];
  tools: Tool[];
}
