import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import { StoreBadge } from "./StoreBadge";
import { formatDate, formatMoney } from "../lib/format";
import { pickLang } from "../lib/i18nData";
import { bestOffer } from "../lib/pricing";
import { isHttpUrl } from "../lib/url";
import type { ItemWithComponent, Store } from "../types";

interface ItemRowProps {
  label?: string;
  item: ItemWithComponent;
  stores: Map<string, Store>;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch { /* clipboard unavailable */ }
  }
  return { copied, copy };
}

/** One build component: name, best price; expands to every store offer with open/copy actions. */
export function ItemRow({ label, item, stores }: ItemRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopy();
  const name = pickLang(item.component, "name", lang);
  const best = bestOffer(item.offers);
  const offers = [...item.offers].sort((a, b) =>
    (a.id === best?.id ? -1 : b.id === best?.id ? 1 : 0) || (a.price ?? Infinity) - (b.price ?? Infinity));

  const btn = "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-3)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-95";

  return (
    <div
      className={`overflow-hidden rounded-lg border transition-all duration-200 ${
        open
          ? "border-[var(--color-red)]/40 bg-[var(--color-surface-2)] shadow-[0_0_12px_rgba(225,6,0,0.06)]"
          : "border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-surface-3)]"
      }`}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-start">
        {label && (
          <span className="min-w-[80px] shrink-0 font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)] rtl:tracking-normal">{label}</span>
        )}
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="min-w-0 text-end">
            <span dir="ltr" className="block truncate text-sm font-medium text-[var(--color-ink)]">
              {name}{item.quantity > 1 && <span className="text-[var(--color-red)]"> ×{item.quantity}</span>}
            </span>
            {best?.price != null && (
              <span className="block text-[11px] text-[var(--color-ink-muted)]">
                <bdi>{formatMoney(best.price * item.quantity, lang)}</bdi>
                {best.store_id && stores.get(best.store_id) && <> · {stores.get(best.store_id)!.name}</>}
              </span>
            )}
          </span>
          <ChevronDown size={15} className={`shrink-0 transition-[transform,color] duration-300 ${open ? "rotate-180 text-[var(--color-red)]" : "text-[var(--color-ink-faint)]"}`} />
        </span>
      </button>

      <div className="accordion" data-open={open} inert={!open}>
        <div>
          <div className="flex flex-col gap-2 border-t border-[var(--color-line)] px-4 py-3">
            {offers.length === 0 && <span className="text-xs text-[var(--color-ink-faint)]">{t("build.noLink")}</span>}
            {offers.map((o) => {
              const store = o.store_id ? stores.get(o.store_id) : null;
              const usable = o.url && isHttpUrl(o.url);
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {store ? <StoreBadge store={store} /> : <span className="text-[var(--color-ink-muted)]">{t("price.otherLinks")}</span>}
                    <span className="font-bold text-[var(--color-ink)]">{o.price != null ? <bdi>{formatMoney(o.price, lang)}</bdi> : t("price.none")}</span>
                    {o.id === best?.id && <span className="rounded-full border border-green-500/30 px-1.5 text-[10px] text-green-400">{t("price.best")}</span>}
                    {o.in_stock === false && <span className="text-[10px] text-[var(--color-red-glow)]">{t("price.outOfStock")}</span>}
                    {o.price_updated_at && <span className="text-[10px] text-[var(--color-ink-faint)]">{formatDate(o.price_updated_at, lang)}</span>}
                  </span>
                  {usable && (
                    <>
                      <a href={o.url!} target="_blank" rel="noopener noreferrer" className={btn}>
                        <ExternalLink size={12} /> {t("build.openStore")}
                      </a>
                      <button type="button" onClick={() => copy(o.id, o.url!)} className={btn}>
                        {copied === o.id ? <Check size={12} className="animate-pop text-[var(--color-red)]" /> : <Copy size={12} />}
                        {copied === o.id ? t("build.copied") : t("build.copyLink")}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => copy("name", item.component.name)} className={btn}>
                {copied === "name" ? <Check size={12} className="animate-pop text-[var(--color-red)]" /> : <Copy size={12} />}
                {copied === "name" ? t("build.copied") : t("build.copyName")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
