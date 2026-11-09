export type Category = "high-end" | "mid-range" | "budget" | "console-equiv";
export type ConsoleTarget = "ps5" | "xbox-series-x" | "xbox-series-s" | "nintendo-switch";
export type PriceVsConsole = "cheaper" | "similar" | "more-expensive";
export type PerfVsConsole = "stronger" | "similar" | "weaker";
export type Lang = "ar" | "en";

export const CATEGORIES: Category[] = [
  "high-end","mid-range","budget","console-equiv",
];

// ---------- Component catalog ----------

export type ComponentType =
  | "case" | "motherboard" | "cpu" | "cpu_cooler" | "gpu" | "ram"
  | "ssd_nvme" | "ssd_sata" | "hdd_2_5" | "hdd_3_5" | "psu" | "accessory";

export const COMPONENT_TYPES: ComponentType[] = [
  "case","motherboard","cpu","cpu_cooler","gpu","ram",
  "ssd_nvme","ssd_sata","hdd_2_5","hdd_3_5","psu","accessory",
];

export const STORAGE_TYPES: ComponentType[] = ["ssd_nvme","ssd_sata","hdd_2_5","hdd_3_5"];

/** Slots shown in the build editor / builder. "storage" groups all drive types. */
export type CoreSlot =
  | "case" | "cpu" | "gpu" | "ram" | "storage" | "cpu_cooler" | "psu" | "motherboard";

export const CORE_SLOTS: CoreSlot[] = [
  "case","cpu","gpu","ram","storage","cpu_cooler","psu","motherboard",
];

/** Component types accepted by each slot. */
export const SLOT_TYPES: Record<CoreSlot, ComponentType[]> = {
  case: ["case"],
  cpu: ["cpu"],
  gpu: ["gpu"],
  ram: ["ram"],
  storage: STORAGE_TYPES,
  cpu_cooler: ["cpu_cooler"],
  psu: ["psu"],
  motherboard: ["motherboard"],
};

/** Slots that may hold several different components (each with a quantity). */
export const MULTI_ITEM_SLOTS: CoreSlot[] = ["ram", "storage"];

export function slotOfType(type: ComponentType): CoreSlot | "accessory" {
  if (type === "accessory") return "accessory";
  if (STORAGE_TYPES.includes(type)) return "storage";
  return type as CoreSlot;
}

export type PerfTier = 1 | 2 | 3 | 4 | 5;
export const PERF_TIERS: PerfTier[] = [1, 2, 3, 4, 5];

export type SpecValue = string | number | boolean | string[];
export type ComponentSpecs = Record<string, SpecValue | undefined>;

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  name_ar: string | null;
  brand: string | null;
  image_url: string | null;
  specs: ComponentSpecs;
  perf_tier: PerfTier | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PriceSource = "manual" | "api" | "scrape";

export interface ComponentOffer {
  id: string;
  component_id: string;
  store_id: string | null;
  url: string | null;
  price: number | null;
  currency: string;
  in_stock: boolean | null; // null = unknown
  price_source: PriceSource;
  price_updated_at: string | null;
  created_at: string;
}

export interface ComponentWithOffers extends Component {
  offers: ComponentOffer[];
  /** Number of builds using this component (admin listings only). */
  used_in_builds?: number;
}

/**
 * Minimal shape needed by the pricing/compatibility logic. Satisfied by build
 * items, visitor-build items and unsaved builder selections alike.
 */
export interface ItemWithComponent {
  component_id: string;
  quantity: number;
  component: Component;
  offers: ComponentOffer[];
}

// ---------- Builds ----------

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
  is_published: boolean;
  created_at: string;
}

export interface BuildItem {
  id: string;
  build_id: string;
  component_id: string;
  quantity: number;
  sort_order: number;
}

export interface BuildItemWithComponent extends BuildItem, ItemWithComponent {}

export interface BuildVideo {
  id: string;
  build_id: string;
  youtube_id: string;
  start_seconds: number | null;
  title_ar: string | null;
  title_en: string | null;
  game: string | null;
  resolution: string | null;
  settings: string | null;
  approx_fps: number | null;
  sort_order: number;
  created_at: string;
}

/** Row of the `build_price_summary` view. */
export interface PriceSummary {
  build_id: string;
  total_best: number;
  items_count: number;
  priced_count: number;
  accessories_total_best: number;
  last_price_update: string | null;
}

export interface BuildWithSummary extends Build {
  summary: PriceSummary | null;
}

export interface BuildFull extends Build {
  items: BuildItemWithComponent[];
  videos: BuildVideo[];
}

// ---------- Visitor builds ----------

export type UserBuildStatus = "new" | "reviewed" | "published" | "archived";
export const USER_BUILD_STATUSES: UserBuildStatus[] = ["new", "reviewed", "published", "archived"];

export interface UserBuild {
  id: string;
  fingerprint: string;
  status: UserBuildStatus;
  label: string | null;
  lang: Lang | null;
  advisor_answers: AdvisorAnswers | null;
  total_snapshot: number | null;
  priced_count: number | null;
  items_count: number | null;
  submit_count: number;
  published_build_id: string | null;
  first_submitted_at: string;
  last_submitted_at: string;
}

export interface UserBuildItem {
  user_build_id: string;
  component_id: string;
  quantity: number;
}

export interface UserBuildItemWithComponent extends UserBuildItem, ItemWithComponent {}

export interface UserBuildWithItems extends UserBuild {
  items: UserBuildItemWithComponent[];
}

// ---------- Settings ----------

export interface AppSettings {
  setup_allowance_sar: number;
  price_stale_days: number;
}

export type AppSettingKey = keyof AppSettings;

// ---------- Advisor ----------

export type Resolution = "1080p" | "1440p" | "4k";
export type RefreshRate = 60 | 144 | 240;

export interface AdvisorAnswers {
  budget?: number;
  hasSetup?: "yes" | "no";
  setupPlan?: "within_budget" | "separate";
  gameType?: "competitive" | "light" | "aaa";
  usage?: "gaming_only" | "study_and_gaming";
  quality?: Resolution;
  monitorResolution?: Resolution | "unsure";
  monitorRefresh?: RefreshRate | "unsure";
}

// ---------- Legacy (v1) model — removed from the frontend in Phase 3 ----------

/** @deprecated Use ComponentType. Kept until the legacy parts editor is removed. */
export type PartType =
  | "case" | "motherboard" | "cpu" | "cpu_cooler" | "gpu"
  | "ram" | "ssd_nvme" | "ssd_sata" | "hdd_2_5" | "hdd_3_5";

/** @deprecated Use COMPONENT_TYPES / CORE_SLOTS. */
export const PART_TYPES: PartType[] = [
  "case","motherboard","cpu","cpu_cooler","gpu",
  "ram","ssd_nvme","ssd_sata","hdd_2_5","hdd_3_5",
];

/** @deprecated Composite editor will take catalog components in Phase 3. */
export const COMPOSITE_PARTS: PartType[] = [
  "case","cpu","gpu","cpu_cooler","ram","ssd_nvme",
];

/** @deprecated Legacy free-text part (table `parts`). */
export interface Part {
  id: string;
  build_id: string;
  type: PartType;
  part_name: string;
  store_id: string | null;
  store_link: string | null;
  image_url: string | null;
}

/** @deprecated Legacy accessory (table `tools`). */
export interface Tool {
  id: string;
  build_id: string;
  tool_name: string;
  store_id: string | null;
  store_link: string | null;
}

/** @deprecated Legacy build shape (builds + parts + tools). */
export interface BuildWithRelations extends Build {
  parts: Part[];
  tools: Tool[];
}
