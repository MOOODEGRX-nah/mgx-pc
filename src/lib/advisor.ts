import type { AdvisorAnswers, ComponentSpecs, ComponentType, PerfTier, Resolution } from "../types";

/*
 * Advisor rules (plan, Phase 7). Pure functions; the page only wires answers in
 * and renders the result.
 */

export const RESOLUTIONS: Resolution[] = ["1080p", "1440p", "4k"];

/** Required GPU tier by game type and target resolution. */
export const GPU_TIER_TABLE: Record<NonNullable<AdvisorAnswers["gameType"]>, Record<Resolution, PerfTier>> = {
  competitive: { "1080p": 2, "1440p": 3, "4k": 4 },
  light: { "1080p": 1, "1440p": 2, "4k": 3 },
  aaa: { "1080p": 3, "1440p": 4, "4k": 5 },
};

/** Rule 1: the budget left for the PC itself. */
export function effectiveBudget(answers: AdvisorAnswers, setupAllowance: number): number {
  const budget = Math.max(0, answers.budget ?? 0);
  if (answers.hasSetup === "no" && answers.setupPlan === "within_budget") return Math.max(0, budget - setupAllowance);
  return budget;
}

/** Rule 2: the wanted quality, limited by the visitor's monitor when it is known. */
export function targetResolution(answers: AdvisorAnswers): { resolution: Resolution; clamped: boolean } {
  const wanted = answers.quality ?? "1080p";
  const monitor = answers.hasSetup === "yes" ? answers.monitorResolution : undefined;
  if (!monitor || monitor === "unsure") return { resolution: wanted, clamped: false };
  const resolution = RESOLUTIONS[Math.min(RESOLUTIONS.indexOf(wanted), RESOLUTIONS.indexOf(monitor))];
  return { resolution, clamped: resolution !== wanted };
}

/** Rule 3. */
export function requiredGpuTier(gameType: AdvisorAnswers["gameType"], resolution: Resolution): PerfTier {
  return GPU_TIER_TABLE[gameType ?? "light"][resolution];
}

/** Rule 4: one tier below the GPU (min 1); +1 for competitive play on a 144 Hz+ monitor (max 5). */
export function requiredCpuTier(gpuTier: number, answers: AdvisorAnswers): PerfTier {
  let tier = Math.max(1, gpuTier - 1);
  const refresh = answers.hasSetup === "yes" && typeof answers.monitorRefresh === "number" ? answers.monitorRefresh : 0;
  if (answers.gameType === "competitive" && refresh >= 144) tier = Math.min(5, tier + 1);
  return tier as PerfTier;
}

// ---------- candidates ----------

export interface CandidateItem {
  quantity: number;
  component: { type: ComponentType; perf_tier: PerfTier | null; specs: ComponentSpecs | null };
}

export interface AdvisorCandidate<B = unknown> {
  build: B;
  /** PC total from best prices (non-accessory items). */
  total: number;
  /** All non-accessory items have a price. */
  completePrice: boolean;
  gpuTier: number | null;
  cpuTier: number | null;
  /** Total RAM in GB, null when a RAM kit has no capacity spec. */
  ramGb: number | null;
  hasSsd: boolean;
}

/** Rule 9: tiers come from the build's GPU/CPU components. */
export function toCandidate<B>(build: B, items: CandidateItem[], total: number, pricedCount: number, itemsCount: number): AdvisorCandidate<B> {
  const tierOf = (type: ComponentType) => {
    const tiers = items.filter((i) => i.component.type === type).map((i) => i.component.perf_tier);
    if (tiers.length === 0 || tiers.some((t) => t == null)) return null;
    return Math.max(...(tiers as number[]));
  };
  const rams = items.filter((i) => i.component.type === "ram");
  const capacities = rams.map((i) => {
    const c = i.component.specs?.capacity_gb;
    return typeof c === "number" ? c * i.quantity : null;
  });
  return {
    build,
    total,
    completePrice: itemsCount > 0 && pricedCount === itemsCount,
    gpuTier: tierOf("gpu"),
    cpuTier: tierOf("cpu"),
    ramGb: rams.length === 0 || capacities.some((c) => c == null) ? null : capacities.reduce<number>((a, c) => a + (c ?? 0), 0),
    hasSsd: items.some((i) => i.component.type === "ssd_nvme" || i.component.type === "ssd_sata"),
  };
}

// ---------- recommendation ----------

export interface RankedCandidate<B> extends AdvisorCandidate<B> {
  /** Rule 5: study use wants >= 16 GB RAM and an SSD. */
  studyFit: boolean;
}

export interface AdvisorResult<B> {
  budget: number;
  effectiveBudget: number;
  resolution: Resolution;
  resolutionClamped: boolean;
  gpuTier: PerfTier;
  cpuTier: PerfTier;
  setupSeparate: boolean;
  /** (a) within budget and meeting both tiers: closest tiers first, then cheapest. */
  matches: RankedCandidate<B>[];
  /** (b) within budget but below the target tiers. */
  belowTarget: RankedCandidate<B>[];
  /** Rule 6: builds whose prices are incomplete (not ranked). */
  priceIncomplete: RankedCandidate<B>[];
  /** Builds left out because their CPU/GPU has no tier. */
  excludedNoTier: number;
  /** (c) when nothing matches: the cheapest complete build that meets the tiers. */
  cheapestMeetingTarget: RankedCandidate<B> | null;
  /** (c) roughly how much more is needed (rounded up to 100 SAR), null when not applicable. */
  needAbout: number | null;
}

const meets = (c: AdvisorCandidate, gpu: number, cpu: number) => (c.gpuTier ?? 0) >= gpu && (c.cpuTier ?? 0) >= cpu;

export function recommend<B>(answers: AdvisorAnswers, setupAllowance: number, candidates: AdvisorCandidate<B>[]): AdvisorResult<B> {
  const eff = effectiveBudget(answers, setupAllowance);
  const { resolution, clamped } = targetResolution(answers);
  const gpuTier = requiredGpuTier(answers.gameType, resolution);
  const cpuTier = requiredCpuTier(gpuTier, answers);
  const study = answers.usage === "study_and_gaming";

  const ranked: RankedCandidate<B>[] = candidates.map((c) => ({
    ...c,
    studyFit: !study || ((c.ramGb ?? 0) >= 16 && c.hasSsd),
  }));
  const tiered = ranked.filter((c) => c.gpuTier != null && c.cpuTier != null);
  const complete = tiered.filter((c) => c.completePrice);
  const studyFirst = (a: RankedCandidate<B>, b: RankedCandidate<B>) => Number(b.studyFit) - Number(a.studyFit);

  const matches = complete
    .filter((c) => c.total <= eff && meets(c, gpuTier, cpuTier))
    .sort((a, b) =>
      studyFirst(a, b) ||
      ((a.gpuTier! - gpuTier) + (a.cpuTier! - cpuTier)) - ((b.gpuTier! - gpuTier) + (b.cpuTier! - cpuTier)) ||
      a.total - b.total);

  const belowTarget = complete
    .filter((c) => c.total <= eff && !meets(c, gpuTier, cpuTier))
    .sort((a, b) => studyFirst(a, b) || (b.gpuTier! + b.cpuTier!) - (a.gpuTier! + a.cpuTier!) || a.total - b.total);

  let cheapestMeetingTarget: RankedCandidate<B> | null = null;
  let needAbout: number | null = null;
  if (matches.length === 0) {
    cheapestMeetingTarget = complete
      .filter((c) => meets(c, gpuTier, cpuTier))
      .sort((a, b) => studyFirst(a, b) || a.total - b.total)[0] ?? null;
    if (cheapestMeetingTarget) needAbout = Math.ceil(Math.max(0, cheapestMeetingTarget.total - eff) / 100) * 100;
  }

  return {
    budget: Math.max(0, answers.budget ?? 0),
    effectiveBudget: eff,
    resolution,
    resolutionClamped: clamped,
    gpuTier,
    cpuTier,
    setupSeparate: answers.hasSetup === "no" && answers.setupPlan === "separate",
    matches,
    belowTarget,
    priceIncomplete: tiered.filter((c) => !c.completePrice),
    excludedNoTier: ranked.length - tiered.length,
    cheapestMeetingTarget,
    needAbout,
  };
}

// ---------- accessories (rule 8) ----------

export interface AccessoryOption<C> {
  category: string;
  component: C;
  price: number;
}

/**
 * Cheapest priced accessory per category (keyboard, mouse, headset, monitor, desk, chair),
 * and whether the set fits the setup allowance.
 */
export function suggestAccessories<C extends { specs: ComponentSpecs | null }>(
  accessories: { component: C; price: number | null }[],
  allowance: number,
): { picks: AccessoryOption<C>[]; total: number; fits: boolean } {
  const best = new Map<string, AccessoryOption<C>>();
  for (const a of accessories) {
    const category = typeof a.component.specs?.category === "string" ? a.component.specs.category : null;
    if (!category || category === "other" || a.price == null) continue;
    const prev = best.get(category);
    if (!prev || a.price < prev.price) best.set(category, { category, component: a.component, price: a.price });
  }
  const order = ["monitor", "keyboard", "mouse", "headset", "desk", "chair"];
  const picks = [...best.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  const total = Math.round(picks.reduce((s, p) => s + p.price, 0) * 100) / 100;
  return { picks, total, fits: total <= allowance };
}
