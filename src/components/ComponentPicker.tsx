import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Cpu, Search } from "lucide-react";
import { Sheet } from "./ui/Sheet";
import { candidateWarnings, type CompatItem } from "../lib/compatibility";
import { formatMoney } from "../lib/format";
import { pickLang } from "../lib/i18nData";
import { bestOffer } from "../lib/pricing";
import type { ComponentType, ComponentWithOffers } from "../types";

interface ComponentPickerProps {
  open: boolean;
  title: string;
  types: ComponentType[];
  catalog: ComponentWithOffers[];
  /** Current selection, used for the soft "incompatible" badge. */
  current: CompatItem[];
  /** Components that cannot be picked again (already in the list). */
  excludeIds?: string[];
  onPick: (component: ComponentWithOffers) => void;
  onClose: () => void;
}

/** Searchable catalog list for one slot. Incompatible items are flagged but still selectable. */
export function ComponentPicker({ open, title, types, catalog, current, excludeIds = [], onPick, onClose }: ComponentPickerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [search, setSearch] = useState("");

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog
      .filter((c) => types.includes(c.type) && !excludeIds.includes(c.id))
      .filter((c) => !q || [c.name, c.name_ar ?? "", c.brand ?? ""].some((s) => s.toLowerCase().includes(q)))
      .map((c) => ({ c, best: bestOffer(c.offers), warnings: candidateWarnings(current, c) }))
      .sort((a, b) => Number(!a.c.is_active) - Number(!b.c.is_active) || a.c.name.localeCompare(b.c.name));
  }, [catalog, types, excludeIds, search, current]);

  return (
    <Sheet open={open} onClose={onClose} title={title} variant="modal">
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("builder.searchCatalog")}
          aria-label={t("builder.searchCatalog")}
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] py-2 pe-3 ps-9 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]"
        />
      </div>
      {options.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-ink-faint)]">{t("builder.noResults")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {options.map(({ c, best, warnings }) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2 text-start transition-colors hover:border-[var(--color-red)]"
              >
                <span className="grid h-11 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--color-surface-3)]">
                  {c.image_url ? <img src={c.image_url} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" /> : <Cpu size={15} className="text-[var(--color-ink-faint)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span dir="ltr" className="block truncate text-start text-sm text-[var(--color-ink)] rtl:text-right">{pickLang(c, "name", lang)}</span>
                  <span className="flex flex-wrap gap-x-2 text-[11px] text-[var(--color-ink-faint)]">
                    {types.length > 1 && <span>{t(`partTypes.${c.type}`)}</span>}
                    {!c.is_active && <span className="text-yellow-400">{t("builder.hidden")}</span>}
                    {warnings.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-orange-400" title={warnings.map((w) => t(`compat.${w.id}`, w.params)).join("\n")}>
                        <AlertTriangle size={11} /> {t("compat.incompatible")}
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-[var(--color-ink)]">
                  {best?.price != null ? <bdi>{formatMoney(best.price, lang)}</bdi> : <span className="text-xs font-normal text-[var(--color-ink-faint)]">{t("price.none")}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
