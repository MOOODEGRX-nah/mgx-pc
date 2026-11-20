import { groupItemsBySlot } from "./buildItems";
import { pickLang } from "./i18nData";
import { bestOffer, computeTotals, primaryOffer } from "./pricing";
import type { ItemWithComponent, Lang } from "../types";

export interface ShoppingListLabels {
  /** Section heading for a slot ("CPU", "Accessories"…). */
  slot: (slot: string) => string;
  noLink: string;
  total: (amount: string) => string;
  partial: (missing: number) => string;
  accessories: (amount: string) => string;
  pricesMayChange: string;
  money: (value: number) => string;
}

/**
 * Plain-text shopping list: one "Name — URL" line per part, grouped by slot,
 * then totals. Uses the best offer's link, or the first link when nothing is priced.
 */
export function shoppingListText(
  title: string,
  items: ItemWithComponent[],
  lang: Lang,
  labels: ShoppingListLabels,
  pageUrl?: string,
): string {
  const lines: string[] = [title];
  if (pageUrl) lines.push(pageUrl);

  for (const group of groupItemsBySlot(items)) {
    lines.push("", `${labels.slot(group.slot)}:`);
    for (const item of group.items) {
      const name = pickLang(item.component, "name", lang) + (item.quantity > 1 ? ` ×${item.quantity}` : "");
      const best = bestOffer(item.offers);
      const price = best?.price != null ? ` (${labels.money(best.price * item.quantity)})` : "";
      const url = primaryOffer(item.offers)?.url ?? labels.noLink;
      lines.push(`- ${name}${price} — ${url}`);
    }
  }

  const totals = computeTotals(items);
  lines.push("");
  if (totals.pricedCount > 0) {
    lines.push(labels.total(labels.money(totals.total)));
    if (totals.isPartial) lines.push(labels.partial(totals.missingCount));
  }
  if (totals.accessoriesTotal > 0) lines.push(labels.accessories(labels.money(totals.accessoriesTotal)));
  lines.push(labels.pricesMayChange);
  return lines.join("\n");
}
