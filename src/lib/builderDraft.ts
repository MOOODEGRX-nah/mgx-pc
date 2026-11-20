import { computeTotals } from "./pricing";
import type { AdvisorAnswers, Category, ComponentWithOffers, ItemWithComponent } from "../types";

/** localStorage key of the visitor's unsaved builder selection. */
export const DRAFT_KEY = "mgxpc-draft-build";
const DRAFT_VERSION = 1;

interface DraftV1 {
  v: 1;
  items: { id: string; qty: number }[];
}

export function serializeDraft(items: ItemWithComponent[]): string {
  const draft: DraftV1 = { v: DRAFT_VERSION, items: items.map((i) => ({ id: i.component_id, qty: i.quantity })) };
  return JSON.stringify(draft);
}

/**
 * Restores a draft against the current catalog. Unknown versions, malformed JSON
 * and components that no longer exist are dropped silently.
 */
export function parseDraft(raw: string | null, catalog: ComponentWithOffers[]): ItemWithComponent[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Partial<DraftV1>;
    if (data?.v !== DRAFT_VERSION || !Array.isArray(data.items)) return [];
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const out: ItemWithComponent[] = [];
    for (const entry of data.items) {
      const c = typeof entry?.id === "string" ? byId.get(entry.id) : undefined;
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      const qty = Number.isInteger(entry.qty) ? Math.min(8, Math.max(1, entry.qty)) : 1;
      out.push({ component_id: c.id, quantity: qty, component: c, offers: c.offers });
    }
    return out;
  } catch {
    return [];
  }
}

/** Visitors must pick at least a CPU, a motherboard and RAM before sending a build. */
export function missingForSubmit(items: ItemWithComponent[]): ("cpu" | "motherboard" | "ram")[] {
  const types = new Set(items.map((i) => i.component.type));
  return (["cpu", "motherboard", "ram"] as const).filter((t) => !types.has(t));
}

/**
 * Category suggestion when publishing a visitor build: from the GPU tier when
 * known (≥4 high-end, 3 mid-range, ≤2 budget), else from the total
 * (≥ 8000 SAR high-end, ≥ 4000 mid-range).
 */
export function suggestCategory(items: ItemWithComponent[]): Category {
  const gpuTier = items.find((i) => i.component.type === "gpu")?.component.perf_tier;
  if (gpuTier) return gpuTier >= 4 ? "high-end" : gpuTier === 3 ? "mid-range" : "budget";
  const { total } = computeTotals(items);
  return total >= 8000 ? "high-end" : total >= 4000 ? "mid-range" : "budget";
}

/** sessionStorage key where the advisor keeps its answers (attached to submissions). */
export const ADVISOR_KEY = "mgxpc-advisor";

export function readAdvisorAnswers(): AdvisorAnswers | null {
  try {
    const raw = sessionStorage.getItem(ADVISOR_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === "object" && !Array.isArray(data) ? (data as AdvisorAnswers) : null;
  } catch { return null; }
}
