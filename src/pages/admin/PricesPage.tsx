import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, Cpu, ExternalLink, Save } from "lucide-react";
import { fetchOffersQueue, touchOfferPrice, upsertOffer, type QueuedOffer } from "../../lib/catalogApi";
import { fetchStores } from "../../lib/api";
import { fetchSettings, DEFAULT_SETTINGS } from "../../lib/settingsApi";
import { toAppError } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { pickLang } from "../../lib/i18nData";
import { isStale } from "../../lib/pricing";
import { isHttpUrl } from "../../lib/url";
import { StoreBadge } from "../../components/StoreBadge";
import { cardCls, inputCls } from "../../components/admin/ui";
import type { Store } from "../../types";

interface RowDraft { price: string; in_stock: "" | "true" | "false" }

const toDraft = (o: QueuedOffer): RowDraft => ({
  price: o.price === null ? "" : String(o.price),
  in_stock: o.in_stock === null ? "" : o.in_stock ? "true" : "false",
});

/** Manual price workflow: open the store page, type the price, save. Works without any store API. */
export function PricesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [storeFilter, setStoreFilter] = useState("");
  const [onlyStale, setOnlyStale] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [staleDays, setStaleDays] = useState(DEFAULT_SETTINGS.price_stale_days);
  const [offers, setOffers] = useState<QueuedOffer[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStores().then(setStores).catch(() => setStores([]));
    fetchSettings().then((s) => setStaleDays(s.price_stale_days));
  }, []);

  const load = useCallback(() => {
    fetchOffersQueue(storeFilter || undefined)
      .then((o) => { setOffers(o); setError(null); })
      .catch((err) => { const e = toAppError(err); setError(t(e.i18nKey, e.params)); setOffers([]); });
  }, [storeFilter, t]);
  useEffect(load, [load]);

  const storeMap = new Map(stores.map((s) => [s.id, s]));
  const visible = (offers ?? []).filter((o) => !onlyStale || o.price === null || isStale(o.price_updated_at, staleDays));
  const staleCount = (offers ?? []).filter((o) => o.price === null || isStale(o.price_updated_at, staleDays)).length;

  function replace(updated: QueuedOffer) {
    setOffers((list) => list?.map((o) => (o.id === updated.id ? updated : o)) ?? null);
    setDrafts((d) => { const next = { ...d }; delete next[updated.id]; return next; });
  }

  async function save(o: QueuedOffer, d: RowDraft) {
    if (d.price.trim() !== "" && !(Number(d.price) >= 0)) { setError(t("admin.offers.invalidPrice")); return; }
    setBusy(o.id); setError(null);
    try {
      const saved = await upsertOffer({
        id: o.id, component_id: o.component_id,
        price: d.price.trim() === "" ? null : Number(d.price),
        in_stock: d.in_stock === "" ? null : d.in_stock === "true",
      });
      replace({ ...saved, component: o.component });
    } catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
    finally { setBusy(null); }
  }

  async function confirm(o: QueuedOffer) {
    setBusy(o.id); setError(null);
    try { replace({ ...(await touchOfferPrice(o.id)), component: o.component }); }
    catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">{t("admin.prices.title")}</h2>
          <p className="text-xs text-[var(--color-ink-muted)]">{t("admin.prices.subtitle", { n: staleCount, days: staleDays })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            <input type="checkbox" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} className="h-4 w-4 accent-[var(--color-red)]" />
            {t("admin.prices.onlyStale")}
          </label>
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} aria-label={t("admin.prices.filterStore")} className={`${inputCls} w-auto`}>
            <option value="">{t("admin.prices.allStores")}</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="none">{t("admin.noStore")}</option>
          </select>
        </div>
      </div>
      <p className="mb-5 text-[11px] text-[var(--color-ink-faint)]">{t("admin.prices.howTo")}</p>
      {error && <p role="alert" className="mb-4 text-sm text-[var(--color-red-glow)]">{error}</p>}

      {offers === null ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="shimmer h-[92px] rounded-xl" />)}</div>
      ) : visible.length === 0 ? (
        <div className={`${cardCls} py-14 text-center text-sm text-[var(--color-ink-faint)]`}>{onlyStale ? t("admin.prices.allFresh") : t("admin.prices.empty")}</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((o) => {
            const d = drafts[o.id] ?? toDraft(o);
            const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(o));
            const stale = o.price === null || isStale(o.price_updated_at, staleDays);
            const store = o.store_id ? storeMap.get(o.store_id) : null;
            const setD = (patch: Partial<RowDraft>) => setDrafts((all) => ({ ...all, [o.id]: { ...d, ...patch } }));
            return (
              <li key={o.id} className={`${cardCls} flex flex-col gap-2 p-3 sm:flex-row sm:items-center`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-11 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--color-surface-2)]">
                    {o.component.image_url ? <img src={o.component.image_url} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" /> : <Cpu size={15} className="text-[var(--color-ink-faint)]" />}
                  </span>
                  <span className="min-w-0">
                    <span dir="ltr" className="block truncate text-start text-sm text-[var(--color-ink)] rtl:text-right">{pickLang(o.component, "name", lang)}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--color-ink-faint)]">
                      {store ? <StoreBadge store={store} /> : <span>{t("admin.noStore")}</span>}
                      <span>{t(`partTypes.${o.component.type}`)}</span>
                      <span className={stale ? "text-yellow-400" : ""}>
                        {t("admin.offers.updated")}: {o.price_updated_at ? formatDate(o.price_updated_at, lang) : t("admin.offers.never")}
                      </span>
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {o.url && isHttpUrl(o.url) && (
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--color-line)] px-3 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                      <ExternalLink size={12} /> {t("admin.prices.openStore")}
                    </a>
                  )}
                  <input
                    type="number" min={0} step="0.01" dir="ltr" inputMode="decimal"
                    value={d.price} onChange={(e) => setD({ price: e.target.value })}
                    aria-label={`${t("admin.offers.price")}: ${o.component.name}`} placeholder={t("admin.offers.price")}
                    className={`${inputCls} w-28`}
                  />
                  <select value={d.in_stock} onChange={(e) => setD({ in_stock: e.target.value as RowDraft["in_stock"] })} aria-label={t("admin.offers.inStock")} className={`${inputCls} w-auto`}>
                    <option value="">{t("admin.offers.stockUnknown")}</option>
                    <option value="true">{t("admin.offers.stockYes")}</option>
                    <option value="false">{t("admin.offers.stockNo")}</option>
                  </select>
                  {dirty ? (
                    <button type="button" disabled={busy === o.id} onClick={() => save(o, d)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[var(--color-red)] px-3 text-xs font-bold text-white disabled:opacity-50">
                      <Save size={12} /> {t("admin.save")}
                    </button>
                  ) : o.price !== null && (
                    <button type="button" disabled={busy === o.id} onClick={() => confirm(o)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--color-line)] px-3 text-xs text-[var(--color-ink-muted)] hover:border-green-500/50 hover:text-green-400 disabled:opacity-50">
                      <CalendarCheck size={12} /> {t("admin.offers.confirmToday")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
