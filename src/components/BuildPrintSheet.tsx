import { useTranslation } from "react-i18next";
import { groupItemsBySlot } from "../lib/buildItems";
import { formatDate, formatMoney } from "../lib/format";
import { pickLang } from "../lib/i18nData";
import { bestOffer, computeTotals, primaryOffer } from "../lib/pricing";
import type { BuildFull, Store } from "../types";

interface BuildPrintSheetProps {
  build: BuildFull;
  stores: Map<string, Store>;
  pageUrl: string;
}

/**
 * Printable shopping sheet (hidden on screen, shown by @media print). Links are
 * printed in full as text so the PDF stays useful on paper. Follows the UI language.
 */
export function BuildPrintSheet({ build, stores, pageUrl }: BuildPrintSheetProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const totals = computeTotals(build.items);
  const groups = groupItemsBySlot(build.items);

  return (
    <div className="print-sheet hidden print:block">
      <header className="mb-4 border-b border-black pb-3">
        <p className="text-xs font-bold tracking-wide">MGX(PC)</p>
        <h1 className="text-2xl font-black">{pickLang(build, "name", lang)}</h1>
        <p className="text-xs">
          {t(`categories.${build.category}`)} · {t("print.generated", { date: formatDate(new Date(), lang) })}
        </p>
        <p dir="ltr" className="text-start text-[10px] rtl:text-right">{pageUrl}</p>
      </header>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-black text-start">
            <th className="py-1 pe-2 text-start">{t("print.component")}</th>
            <th className="py-1 pe-2 text-start">{t("print.price")}</th>
            <th className="py-1 pe-2 text-start">{t("print.store")}</th>
            <th className="py-1 text-start">{t("print.link")}</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) => [
            <tr key={`h-${g.slot}`} className="print-row">
              <td colSpan={4} className="pt-3 pb-1 font-bold">{t(`slots.${g.slot}`)}</td>
            </tr>,
            ...g.items.map((item) => {
              const best = bestOffer(item.offers);
              const link = primaryOffer(item.offers);
              const store = link?.store_id ? stores.get(link.store_id)?.name : null;
              return (
                <tr key={item.component_id} className="print-row border-b border-neutral-300 align-top">
                  <td className="py-1 pe-2"><bdi>{pickLang(item.component, "name", lang)}</bdi>{item.quantity > 1 && ` ×${item.quantity}`}</td>
                  <td className="py-1 pe-2 whitespace-nowrap">{best?.price != null ? <bdi>{formatMoney(best.price * item.quantity, lang)}</bdi> : "—"}</td>
                  <td className="py-1 pe-2">{store ?? "—"}</td>
                  <td dir="ltr" className="py-1 text-start break-all">{link?.url ?? t("build.noLink")}</td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>

      <div className="mt-4 text-sm">
        {totals.pricedCount > 0 && (
          <p className="font-bold">
            {t("price.total")}: {totals.isPartial && `${t("price.fromPrefix")} `}<bdi>{formatMoney(totals.total, lang)}</bdi>
          </p>
        )}
        {totals.isPartial && totals.pricedCount > 0 && <p className="text-xs">{t("price.partial", { n: totals.missingCount })}</p>}
        {totals.accessoriesTotal > 0 && <p className="text-xs">{t("price.accessories")}: <bdi>{formatMoney(totals.accessoriesTotal, lang)}</bdi></p>}
        <p className="mt-2 text-xs">{t("print.pricesMayChange")}</p>
      </div>
    </div>
  );
}
