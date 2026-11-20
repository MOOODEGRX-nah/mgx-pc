import { describe, expect, it } from "vitest";
import {
  GPU_TIER_TABLE, effectiveBudget, recommend, requiredCpuTier, requiredGpuTier, suggestAccessories,
  targetResolution, toCandidate, type AdvisorCandidate, type CandidateItem,
} from "../advisor";
import type { AdvisorAnswers, PerfTier } from "../../types";

const cand = (name: string, total: number, gpu: number | null, cpu: number | null, extra: Partial<AdvisorCandidate<string>> = {}): AdvisorCandidate<string> => ({
  build: name, total, completePrice: true, gpuTier: gpu, cpuTier: cpu, ramGb: 16, hasSsd: true, ...extra,
});
const base: AdvisorAnswers = { budget: 6000, hasSetup: "yes", gameType: "aaa", usage: "gaming_only", quality: "1080p", monitorResolution: "unsure" };

describe("tier table and rules", () => {
  it("matches the plan's table", () => {
    expect(GPU_TIER_TABLE).toEqual({
      competitive: { "1080p": 2, "1440p": 3, "4k": 4 },
      light: { "1080p": 1, "1440p": 2, "4k": 3 },
      aaa: { "1080p": 3, "1440p": 4, "4k": 5 },
    });
    expect(requiredGpuTier("aaa", "1440p")).toBe(4);
  });

  it("CPU tier is one below the GPU, +1 for competitive at 144 Hz+, capped at 5", () => {
    expect(requiredCpuTier(1, base)).toBe(1);
    expect(requiredCpuTier(4, base)).toBe(3);
    expect(requiredCpuTier(3, { ...base, gameType: "competitive", monitorRefresh: 144 })).toBe(3);
    expect(requiredCpuTier(3, { ...base, gameType: "competitive", monitorRefresh: 60 })).toBe(2);
    expect(requiredCpuTier(5, { ...base, gameType: "competitive", monitorRefresh: 240 })).toBe(5);
    // refresh only counts when the visitor has a setup
    expect(requiredCpuTier(3, { ...base, hasSetup: "no", gameType: "competitive", monitorRefresh: 240 })).toBe(2);
  });
});

describe("budget math", () => {
  it("subtracts the setup allowance only when buying the setup within budget", () => {
    expect(effectiveBudget({ ...base, hasSetup: "no", setupPlan: "within_budget" }, 1500)).toBe(4500);
    expect(effectiveBudget({ ...base, hasSetup: "no", setupPlan: "separate" }, 1500)).toBe(6000);
    expect(effectiveBudget({ ...base, hasSetup: "yes" }, 1500)).toBe(6000);
    expect(effectiveBudget({ ...base, budget: 1000, hasSetup: "no", setupPlan: "within_budget" }, 1500)).toBe(0);
  });
});

describe("resolution clamping", () => {
  it("limits quality to the monitor resolution when known", () => {
    expect(targetResolution({ ...base, quality: "4k", monitorResolution: "1440p" })).toEqual({ resolution: "1440p", clamped: true });
    expect(targetResolution({ ...base, quality: "1080p", monitorResolution: "4k" })).toEqual({ resolution: "1080p", clamped: false });
    expect(targetResolution({ ...base, quality: "4k", monitorResolution: "unsure" })).toEqual({ resolution: "4k", clamped: false });
    expect(targetResolution({ ...base, hasSetup: "no", quality: "4k", monitorResolution: "1080p" })).toEqual({ resolution: "4k", clamped: false });
  });
});

describe("recommend", () => {
  const candidates = [
    cand("exact", 5500, 3, 2),
    cand("overkill", 5000, 5, 5),
    cand("cheapExact", 5200, 3, 2),
    cand("weak", 3000, 2, 2),
    cand("tooExpensive", 9000, 4, 4),
    cand("partial", 4000, 3, 3, { completePrice: false }),
    cand("noTier", 3000, null, 3),
  ];

  it("ranks matches by closest tiers then price, and groups the rest", () => {
    const r = recommend(base, 1500, candidates);
    expect(r.gpuTier).toBe(3);
    expect(r.cpuTier).toBe(2);
    expect(r.matches.map((c) => c.build)).toEqual(["cheapExact", "exact", "overkill"]);
    expect(r.belowTarget.map((c) => c.build)).toEqual(["weak"]);
    expect(r.priceIncomplete.map((c) => c.build)).toEqual(["partial"]);
    expect(r.excludedNoTier).toBe(1);
    expect(r.cheapestMeetingTarget).toBeNull();
    expect(r.needAbout).toBeNull();
  });

  it("puts study-friendly builds first for study + gaming", () => {
    const r = recommend({ ...base, usage: "study_and_gaming" }, 1500, [
      cand("smallRam", 5000, 3, 2, { ramGb: 8 }),
      cand("studyOk", 5900, 4, 4),
    ]);
    expect(r.matches.map((c) => [c.build, c.studyFit])).toEqual([["studyOk", true], ["smallRam", false]]);
  });

  it("no result: points to the cheapest build that meets the target and the extra money needed", () => {
    const r = recommend({ ...base, budget: 4000, quality: "1440p" }, 1500, candidates);
    expect(r.gpuTier).toBe(4);
    expect(r.matches).toEqual([]);
    expect(r.cheapestMeetingTarget?.build).toBe("overkill");
    expect(r.needAbout).toBe(1000);
    expect(r.belowTarget.map((c) => c.build)).toEqual(["weak"]);
  });

  it("no result and nothing meets the target", () => {
    const r = recommend({ ...base, quality: "4k" }, 1500, [cand("weak", 3000, 2, 2)]);
    expect(r.gpuTier).toBe(5);
    expect(r.cheapestMeetingTarget).toBeNull();
    expect(r.needAbout).toBeNull();
  });

  it("flags a separately bought setup", () => {
    expect(recommend({ ...base, hasSetup: "no", setupPlan: "separate" }, 1500, []).setupSeparate).toBe(true);
  });
});

describe("toCandidate", () => {
  const it_ = (type: CandidateItem["component"]["type"], perf_tier: number | null, specs = {}, quantity = 1): CandidateItem =>
    ({ quantity, component: { type, perf_tier: perf_tier as PerfTier | null, specs } });
  it("derives tiers, RAM and SSD from the items", () => {
    const c = toCandidate("b", [it_("gpu", 4), it_("cpu", 3), it_("ram", null, { capacity_gb: 16 }, 2), it_("ssd_nvme", null)], 5000, 4, 4);
    expect(c).toMatchObject({ gpuTier: 4, cpuTier: 3, ramGb: 32, hasSsd: true, completePrice: true });
    expect(toCandidate("b", [it_("cpu", 3), it_("ram", null)], 1, 1, 2)).toMatchObject({ gpuTier: null, ramGb: null, hasSsd: false, completePrice: false });
  });
});

describe("suggestAccessories", () => {
  it("picks the cheapest per category and checks the allowance", () => {
    const acc = (category: string, price: number | null) => ({ component: { specs: { category } }, price });
    const r = suggestAccessories([acc("mouse", 100), acc("mouse", 80), acc("keyboard", 200), acc("other", 10), acc("chair", null)], 300);
    expect(r.picks.map((p) => [p.category, p.price])).toEqual([["keyboard", 200], ["mouse", 80]]);
    expect(r.total).toBe(280);
    expect(r.fits).toBe(true);
  });
});
