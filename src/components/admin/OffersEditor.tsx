import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { deleteOffer, touchOfferPrice, upsertOffer } from "../../lib/catalogApi";
import { toAppError } from "../../lib/errors";
import { formatDate, formatMoney } from "../../lib/format";
import { bestOffer, isStale } from "../../lib/pricing";
import { isHttpUrl } from "../../lib/url";
import type { ComponentOffer, Store } from "../../types";
import { inputCls, labelCls } from "./ui";

interface OfferDraft {
  id?: string;
  store_id: string;
  url: string;
  price: string;
  in_stock: "" | "true" | "false";
}

function toDraft(o: ComponentOffer): OfferDraft {
  return {
    id: o.id,
    store_id: o.store_id ?? "",
    url: o.url ?? "",
    price: o.price === null ? "" : String(o.price),
    in_stock: o.in_stock === null ? "" : o.in_stock ? "true" : "false",
  };
}

const emptyDraft: OfferDraft = { store_id: "", url: "", price: "", in_stock: "" };

interface OffersEditorProps {
  componentId: string;
  offers: ComponentOffer[];
  stores: Store[];
  staleDays: number;
  onChange: (offers: ComponentOffer[]) => void;
}

/** Store offers of one component: link, price (SAR), stock, last update. Each row saves on its own. */
export function OffersEditor({ componentId, offers, stores, staleDays, onChange }: OffersEditorProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [drafts, setDrafts] = useState<Record<string, OfferDraft>>({});
  const [adding, setAdding] = useState<OfferDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const best = bestOffer(offers);

  const draftOf = (o: ComponentOffer) => drafts[o.id] ?? toDraft(o);
  const setDraft = (id: string, patch: Partial<OfferDraft>, base: OfferDraft) =>
    setDrafts((d) => ({ ...d, [id]: { ...base, ...patch } }));

  function validate(d: OfferDraft): string | null {
    if (d.url.trim() !== "" && !isHttpUrl(d.url)) return t("errors.invalid_url");
    if (d.price.trim() !== "" && !(Number(d.price) >= 0)) return t("admin.offers.invalidPrice");
    return null;
  }

  async function save(d: OfferDraft, key: string) {
    const problem = validate(d);
    if (problem) { setError(problem); return; }
    setBusy(key); setError(null);
    try {
      const saved = await upsertOffer({
        id: d.id,
        component_id: componentId,
        store_id: d.store_id || null,
        url: d.url,
        price: d.price.trim() === "" ? null : Number(d.price),
        in_stock: d.in_stock === "" ? null : d.in_stock === "true",
      });
      onChange(d.id ? offers.map((o) => (o.id === saved.id ? saved : o)) : [...offers, saved]);
      if (d.id) {
        const id = d.id;
        setDrafts((all) => {
          const next = { ...all };
          delete next[id];
          return next;
        });
      } else {
        setAdding(null);
      }
    } catch (err) {
      const e = toAppError(err);
      setError(t(e.i18nKey, e.params));
    } finally { setBusy(null); }
  }

  async function confirmToday(o: ComponentOffer) {
    setBusy(o.id); setError(null);
    try {
      const saved = await touchOfferPrice(o.id);
      onChange(offers.map((x) => (x.id === saved.id ? saved : x)));
    } catch (err) {
      const e = toAppError(err);
      setError(t(e.i18nKey, e.params));
    } finally { setBusy(null); }
  }

  async function remove(o: ComponentOffer) {
    if (!confirm(t("admin.offers.confirmDelete"))) return;
    setBusy(o.id); setError(null);
    try {
      await deleteOffer(o.id);
      onChange(offers.filter((x) => x.id !== o.id));
    } catch (err) {
      const e = toAppError(err);
      setError(t(e.i18nKey, e.params));
    } finally { setBusy(null); }
  }

  function row(d: OfferDraft, key: string, offer?: ComponentOffer) {
    const dirty = offer ? JSON.stringify(d) !== JSON.stringify(toDraft(offer)) : true;
    const stale = offer && offer.price !== null && isStale(offer.price_updated_at, staleDays);
    const isBest = offer && best?.id === offer.id;
    const update = (patch: Partial<OfferDraft>) =>
      offer ? setDraft(offer.id, patch, d) : setAdding({ ...d, ...patch });

    return (
      <div
        key={key}
        className={`rounded-lg border p-3 ${isBest ? "border-green-500/30 bg-green-500/5" : "border-[var(--color-line)] bg-[var(--color-surface-2)]"}`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_120px_110px]">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls} htmlFor={`${key}-store`}>{t("admin.offers.store")}</label>
            <select id={`${key}-store`} value={d.store_id} onChange={(e) => update({ store_id: e.target.value })} className={inputCls}>
              <option value="">{t("admin.noStore")}</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls} htmlFor={`${key}-url`}>{t("admin.offers.url")}</label>
            <input id={`${key}-url`} dir="ltr" type="url" placeholder="https://" value={d.url} onChange={(e) => update({ url: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor={`${key}-price`}>{t("admin.offers.price")}</label>
            <input id={`${key}-price`} dir="ltr" type="number" min={0} step="0.01" inputMode="decimal" value={d.price} onChange={(e) => update({ price: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor={`${key}-stock`}>{t("admin.offers.inStock")}</label>
            <select id={`${key}-stock`} value={d.in_stock} onChange={(e) => update({ in_stock: e.target.value as OfferDraft["in_stock"] })} className={inputCls}>
              <option value="">{t("admin.offers.stockUnknown")}</option>
              <option value="true">{t("admin.offers.stockYes")}</option>
              <option value="false">{t("admin.offers.stockNo")}</option>
            </select>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {offer && (
            <span className="text-[var(--color-ink-faint)]">
              {t("admin.offers.updated")}:{" "}
              {offer.price_updated_at ? formatDate(offer.price_updated_at, lang) : t("admin.offers.never")}
            </span>
          )}
          {isBest && offer?.price !== null && offer && (
            <span className="rounded-full border border-green-500/30 px-2 py-0.5 text-green-400">
              {t("admin.offers.best")} · <bdi>{formatMoney(offer.price!, lang)}</bdi>
            </span>
          )}
          {stale && (
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-400">
              {t("admin.offers.stale")}
            </span>
          )}
          <div className="ms-auto flex flex-wrap gap-1.5">
            {offer?.url && isHttpUrl(offer.url) && (
              <a href={offer.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                <ExternalLink size={12} /> {t("admin.offers.open")}
              </a>
            )}
            {offer && offer.price !== null && !dirty && (
              <button type="button" disabled={busy === key} onClick={() => confirmToday(offer)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 text-[var(--color-ink-muted)] hover:border-green-500/50 hover:text-green-400 disabled:opacity-50">
                <CalendarCheck size={12} /> {t("admin.offers.confirmToday")}
              </button>
            )}
            {dirty && (
              <button type="button" disabled={busy === key} onClick={() => save(d, key)} className="inline-flex min-h-9 items-center gap-1 rounded-md bg-[var(--color-red)] px-3 font-bold text-white disabled:opacity-50">
                <Save size={12} /> {busy === key ? t("admin.saving") : t("admin.save")}
              </button>
            )}
            {offer ? (
              <button type="button" disabled={busy === key} onClick={() => remove(offer)} aria-label={t("admin.offers.delete")} title={t("admin.offers.delete")} className="grid min-h-9 min-w-9 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-red)] disabled:opacity-50">
                <Trash2 size={13} />
              </button>
            ) : (
              <button type="button" onClick={() => setAdding(null)} className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-line)] px-2.5 text-[var(--color-ink-muted)]">
                {t("admin.cancel")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {offers.length === 0 && !adding && (
        <p className="text-xs text-[var(--color-ink-faint)]">{t("admin.offers.empty")}</p>
      )}
      {offers.map((o) => row(draftOf(o), o.id, o))}
      {adding && row(adding, "new")}
      {error && <p role="alert" className="text-xs text-[var(--color-red-glow)]">{error}</p>}
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding({ ...emptyDraft })}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-line)] text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-red)] hover:text-[var(--color-ink)]"
        >
          <Plus size={14} /> {t("admin.offers.add")}
        </button>
      )}
    </div>
  );
}
