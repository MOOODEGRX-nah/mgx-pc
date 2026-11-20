import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { checkCompatibility } from "../lib/compatibility";
import { formatDate, formatMoney } from "../lib/format";
import { pickLang } from "../lib/i18nData";
import { bestOffer, computeTotals, lastPriceUpdate, totalsByStore } from "../lib/pricing";
import type { ItemWithComponent, Store } from "../types";

interface BuildSummaryProps {
  items: ItemWithComponent[];
  stores: Store[];
  /** Show the per-item price list (off when the page already lists prices). */
  showItems?: boolean;
  children?: ReactNode;
}

/** Live totals, partial-price notice, compatibility warnings and per-store totals. */
export function BuildSummary({ items, stores, showItems = true, children }: BuildSummaryProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const totals = computeTotals(items);
  const warnings = checkCompatibility(items);
  const byStore = totalsByStore(items).filter((s) => s.coveredCount > 0);
  const updated = lastPriceUpdate(items);
  const storeName = (id: string | null) => (id ? stores.find((s) => s.id === id)?.name : null) ?? t("price.otherLinks");

  return (
    <div className="flex flex-col gap-4">
      {/* Total */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-faint)] rtl:tracking-normal">{t("price.total")}</p>
        {totals.pricedCount > 0 ? (
          <p className="mt-1 font-display text-3xl font-black text-[var(--color-ink)]">
            {totals.isPartial && <span className="me-1 text-base font-bold text-[var(--color-ink-muted)]">{t("price.fromPrefix")}</span>}
            <bdi>{formatMoney(totals.total, lang)}</bdi>
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{items.length ? t("price.noPrices") : t("builder.empty")}</p>
        )}
        {totals.isPartial && totals.pricedCount > 0 && (
          <p className="mt-1 text-xs text-yellow-400">{t("price.partial", { n: totals.missingCount })}</p>
        )}
        {totals.accessoriesTotal > 0 && (
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            {t("price.accessories")}: <bdi>{formatMoney(totals.accessoriesTotal, lang)}</bdi>
          </p>
        )}
        {updated && <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">{t("price.lastUpdate", { date: formatDate(updated, lang) })}</p>}
      </div>

      {/* Items */}
      {showItems && items.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-[var(--color-line)] pt-3 text-xs">
          {items.map((i) => {
            const best = bestOffer(i.offers);
            return (
              <li key={i.component_id} className="flex items-baseline justify-between gap-2">
                <span dir="ltr" className="min-w-0 truncate text-start text-[var(--color-ink-muted)] rtl:text-right">
                  {pickLang(i.component, "name", lang)}{i.quantity > 1 && ` ×${i.quantity}`}
                </span>
                <span className="shrink-0 text-[var(--color-ink)]">
                  {best?.price != null ? <bdi>{formatMoney(best.price * i.quantity, lang)}</bdi> : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Compatibility */}
      {items.length > 0 && (
        <div className="border-t border-[var(--color-line)] pt-3">
          <p className="mb-1.5 text-xs font-bold text-[var(--color-ink)]">{t("compat.title")}</p>
          {warnings.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle2 size={13} /> {t("compat.ok")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {warnings.map((w, idx) => (
                <li key={`${w.id}-${idx}`} className={`flex items-start gap-1.5 text-xs ${w.severity === "error" ? "text-[var(--color-red-glow)]" : "text-yellow-400"}`}>
                  {w.severity === "error" ? <XCircle size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
                  <span>{t(`compat.${w.id}`, w.params)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[10px] text-[var(--color-ink-faint)]">{t("compat.note")}</p>
        </div>
      )}

      {/* One store */}
      {byStore.length > 0 && (
        <div className="border-t border-[var(--color-line)] pt-3">
          <p className="mb-1.5 text-xs font-bold text-[var(--color-ink)]">{t("price.byStore")}</p>
          <ul className="flex flex-col gap-1 text-xs">
            {byStore.map((s) => (
              <li key={s.storeId ?? "none"} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--color-ink-muted)]">
                  {storeName(s.storeId)} <span className="text-[var(--color-ink-faint)]">({t("price.covers", { covered: s.coveredCount, total: s.itemsCount })})</span>
                </span>
                <bdi className="text-[var(--color-ink)]">{formatMoney(s.total, lang)}</bdi>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </div>
  );
}
