import type { ComponentOffer, ComponentType } from "../types";

/*
 * Price rules. Keep identical to the SQL in supabase/v2_catalog.sql:
 *   - view   public.build_price_summary
 *   - RPC    public.submit_user_build (total_snapshot)
 * "Best offer" = cheapest offer that has a price and is not marked out of stock
 * (in_stock null = unknown, still counts). Accessories are excluded from the
 * PC total and summed separately.
 */

/** Smallest shape the pricing functions need; build/builder items satisfy it. */
export interface PricedItem {
  quantity: number;
  component: { type: ComponentType };
  offers: ComponentOffer[];
}

export interface Totals {
  /** Σ quantity × best price over non-accessory items that have a price. */
  total: number;
  /** Same sum for accessories (not included in `total`). */
  accessoriesTotal: number;
  /** Non-accessory items. */
  itemsCount: number;
  /** Non-accessory items with a best offer. */
  pricedCount: number;
  /** Non-accessory items without any usable price. */
  missingCount: number;
  /** True when some non-accessory item has no price. */
  isPartial: boolean;
}

export interface StoreTotal {
  storeId: string | null;
  /** Σ quantity × cheapest usable price at this store, over covered items. */
  total: number;
  /** Non-accessory items this store has a usable price for. */
  coveredCount: number;
  itemsCount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function isUsable(offer: ComponentOffer): offer is ComponentOffer & { price: number } {
  return offer.price !== null && offer.price !== undefined && offer.in_stock !== false;
}

function timeOf(value: string | null): number {
  if (!value) return -Infinity;
  const t = Date.parse(value);
  return Number.isNaN(t) ? -Infinity : t;
}

/** Cheapest usable offer; ties go to the most recently updated price. */
export function bestOffer(offers: ComponentOffer[]): ComponentOffer | null {
  let best: (ComponentOffer & { price: number }) | null = null;
  for (const offer of offers) {
    if (!isUsable(offer)) continue;
    if (
      best === null ||
      offer.price < best.price ||
      (offer.price === best.price && timeOf(offer.price_updated_at) > timeOf(best.price_updated_at))
    ) {
      best = offer;
    }
  }
  return best;
}

export function computeTotals(items: PricedItem[]): Totals {
  let total = 0;
  let accessoriesTotal = 0;
  let itemsCount = 0;
  let pricedCount = 0;
  for (const item of items) {
    const offer = bestOffer(item.offers);
    const line = offer?.price != null ? item.quantity * offer.price : null;
    if (item.component.type === "accessory") {
      if (line !== null) accessoriesTotal += line;
      continue;
    }
    itemsCount++;
    if (line !== null) {
      pricedCount++;
      total += line;
    }
  }
  const missingCount = itemsCount - pricedCount;
  return {
    total: round2(total),
    accessoriesTotal: round2(accessoriesTotal),
    itemsCount,
    pricedCount,
    missingCount,
    isPartial: missingCount > 0,
  };
}

/**
 * "Buy everything from one store" comparison over non-accessory items.
 * Offers without a store are grouped under storeId null.
 * Sorted by coverage (desc), then total (asc).
 */
export function totalsByStore(items: PricedItem[]): StoreTotal[] {
  const core = items.filter((i) => i.component.type !== "accessory");
  const byStore = new Map<string | null, StoreTotal>();
  for (const item of core) {
    // cheapest usable price per store for this item
    const cheapest = new Map<string | null, number>();
    for (const offer of item.offers) {
      if (!isUsable(offer)) continue;
      const prev = cheapest.get(offer.store_id);
      if (prev === undefined || offer.price < prev) cheapest.set(offer.store_id, offer.price);
    }
    for (const [storeId, price] of cheapest) {
      const entry = byStore.get(storeId) ?? { storeId, total: 0, coveredCount: 0, itemsCount: core.length };
      entry.total += item.quantity * price;
      entry.coveredCount++;
      byStore.set(storeId, entry);
    }
  }
  return [...byStore.values()]
    .map((s) => ({ ...s, total: round2(s.total) }))
    .sort((a, b) => b.coveredCount - a.coveredCount || a.total - b.total);
}

/** A price is stale when it was never confirmed or is older than `staleDays`. */
export function isStale(updatedAt: string | null, staleDays: number, now: number = Date.now()): boolean {
  const t = timeOf(updatedAt);
  if (t === -Infinity) return true;
  return now - t > staleDays * 24 * 60 * 60 * 1000;
}

/**
 * Most recent price_updated_at among usable offers of the given items
 * (same as build_price_summary.last_price_update).
 */
export function lastPriceUpdate(items: PricedItem[]): string | null {
  let latest: string | null = null;
  for (const item of items) {
    for (const offer of item.offers) {
      if (isUsable(offer) && offer.price_updated_at && timeOf(offer.price_updated_at) > timeOf(latest)) {
        latest = offer.price_updated_at;
      }
    }
  }
  return latest;
}
