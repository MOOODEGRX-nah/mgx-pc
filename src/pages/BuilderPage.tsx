import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ClipboardList, FileDown, RotateCcw, Send, ShieldCheck, Target } from "lucide-react";
import { BuildSlots } from "../components/BuildSlots";
import { BuildSummary } from "../components/BuildSummary";
import { BuildPrintSheet } from "../components/BuildPrintSheet";
import { Sheet } from "../components/ui/Sheet";
import { fetchComponents } from "../lib/catalogApi";
import { fetchBuildFull } from "../lib/buildsApi";
import { fetchStores } from "../lib/api";
import { submitUserBuild } from "../lib/userBuildsApi";
import { DRAFT_KEY, missingForSubmit, parseDraft, readAdvisorAnswers, serializeDraft } from "../lib/builderDraft";
import { copyText } from "../lib/clipboard";
import { toAppError } from "../lib/errors";
import { formatMoney, normalizeLang } from "../lib/format";
import { shoppingListText } from "../lib/shoppingList";
import type { ComponentWithOffers, ItemWithComponent, Store } from "../types";

const numParam = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);

export function BuilderPage() {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);
  const fid = useId();
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState<ComponentWithOffers[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<ItemWithComponent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [listCopied, setListCopied] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);

  const target = useMemo(() => ({
    budget: numParam(params.get("budget")),
    gpuTier: numParam(params.get("gpuTier")),
    cpuTier: numParam(params.get("cpuTier")),
  }), [params]);
  const fromId = params.get("from");

  // Load the catalog, then restore the draft or clone a build (?from=<id>).
  useEffect(() => {
    let active = true;
    Promise.all([fetchComponents(), fetchStores(), fromId ? fetchBuildFull(fromId).catch(() => null) : Promise.resolve(null)])
      .then(([cat, st, build]) => {
        if (!active) return;
        setCatalog(cat);
        setStores(st);
        if (build) {
          const available = new Map(cat.map((c) => [c.id, c]));
          setItems(build.items.filter((i) => available.has(i.component_id)).map((i) => ({ ...i, component: available.get(i.component_id)!, offers: available.get(i.component_id)!.offers })));
        } else {
          let raw: string | null = null;
          try { raw = localStorage.getItem(DRAFT_KEY); } catch { /* storage blocked */ }
          setItems(parseDraft(raw, cat));
        }
        setLoaded(true);
      })
      .catch((err) => { if (active) { const e = toAppError(err); setLoadError(t(e.i18nKey, e.params)); setLoaded(true); } });
    return () => { active = false; };
    // fromId is read once on load; the param is removed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drop ?from= once used, so a reload keeps the visitor's own edits.
  useEffect(() => {
    if (loaded && fromId) {
      const next = new URLSearchParams(params);
      next.delete("from");
      setParams(next, { replace: true });
    }
  }, [loaded, fromId, params, setParams]);

  // Persist the draft (per browser only).
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(DRAFT_KEY, serializeDraft(items)); } catch { /* storage blocked */ }
  }, [items, loaded]);

  const missing = missingForSubmit(items);
  const storeMap = new Map(stores.map((s) => [s.id, s]));
  const title = label.trim() || t("builder.myBuild");

  function reset() {
    if (items.length && !confirm(t("builder.resetConfirm"))) return;
    setItems([]);
    setSendResult(null);
  }

  async function copyList() {
    const text = shoppingListText(title, items, lang, {
      slot: (slot) => t(`slots.${slot}`),
      noLink: t("build.noLink"),
      total: (amount) => `${t("price.total")}: ${amount}`,
      partial: (n) => t("price.partial", { n }),
      accessories: (amount) => `${t("price.accessories")}: ${amount}`,
      pricesMayChange: t("print.pricesMayChange"),
      money: (v) => formatMoney(v, lang),
    });
    if (await copyText(text)) { setListCopied(true); setTimeout(() => setListCopied(false), 2000); }
  }

  async function send() {
    setSending(true); setSendResult(null);
    try {
      await submitUserBuild({
        items: items.map((i) => ({ component_id: i.component_id, quantity: i.quantity })),
        label: label.trim() || null,
        lang,
        answers: readAdvisorAnswers(),
        website: honeypot.current?.value ?? null,
      });
      setSendResult({ ok: true, text: t("builder.sent") });
    } catch (err) {
      const e = toAppError(err);
      setSendResult({ ok: false, text: t(e.i18nKey, e.params) });
    } finally { setSending(false); }
  }

  const btnSecondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-[0.98] disabled:opacity-40";

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 print:hidden">
        <div className="mb-6 animate-fade-up">
          <h1 className="font-[var(--font-display)] text-3xl font-black text-[var(--color-ink)] sm:text-4xl">{t("builder.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)]">{t("builder.intro")}</p>
        </div>

        {(target.budget || target.gpuTier || target.cpuTier) && (
          <div className="mb-5 flex animate-fade-up flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[var(--color-red-dim)] bg-[var(--color-red-dim)]/15 px-4 py-3 text-sm text-[var(--color-ink)]">
            <span className="inline-flex items-center gap-1.5 font-bold"><Target size={15} className="text-[var(--color-red)]" /> {t("builder.target")}</span>
            {target.budget && <span>{t("builder.targetBudget")}: <bdi>{formatMoney(target.budget, lang)}</bdi></span>}
            {target.gpuTier && <span>{t("builder.targetGpu", { tier: target.gpuTier })}</span>}
            {target.cpuTier && <span>{t("builder.targetCpu", { tier: target.cpuTier })}</span>}
          </div>
        )}

        {loadError && <p role="alert" className="mb-4 text-sm text-[var(--color-red-glow)]">{loadError}</p>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <section className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            {loaded ? (
              <BuildSlots catalog={catalog} value={items} onChange={(next) => { setItems(next); setSendResult(null); }} />
            ) : (
              <div className="flex flex-col gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="shimmer h-16 rounded-lg" />)}</div>
            )}
          </section>

          <aside className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 lg:sticky lg:top-20">
            <BuildSummary items={items} stores={stores}>
              {target.budget && items.length > 0 && (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {t("builder.vsBudget")}: <bdi>{formatMoney(target.budget, lang)}</bdi>
                </p>
              )}
              <button
                type="button"
                onClick={() => { setSendResult(null); setSaveOpen(true); }}
                disabled={items.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-red)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              >
                <Send size={15} /> {t("builder.save")}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => window.print()} disabled={items.length === 0} className={btnSecondary}><FileDown size={15} /> PDF</button>
                <button type="button" onClick={copyList} disabled={items.length === 0} className={btnSecondary}>
                  {listCopied ? <Check size={15} className="animate-pop text-[var(--color-red)]" /> : <ClipboardList size={15} />}
                  {listCopied ? t("build.listCopied") : t("builder.copy")}
                </button>
              </div>
              <button type="button" onClick={reset} disabled={items.length === 0} className={btnSecondary}><RotateCcw size={14} /> {t("builder.reset")}</button>
              <p className="text-[11px] text-[var(--color-ink-faint)]">{t("builder.draftNote")}</p>
            </BuildSummary>
          </aside>
        </div>
      </div>

      <BuildPrintSheet title={title} items={items} stores={storeMap} pageUrl={window.location.origin + window.location.pathname} />

      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title={t("builder.saveTitle")} variant="modal">
        {sendResult?.ok ? (
          <div className="py-4 text-center">
            <Check size={36} className="mx-auto mb-3 animate-pop text-green-400" />
            <p role="status" className="text-sm text-[var(--color-ink)]">{sendResult.text}</p>
            <button type="button" onClick={() => setSaveOpen(false)} className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">{t("common.close")}</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (!missing.length) send(); }} className="flex flex-col gap-4">
            <p className="text-sm text-[var(--color-ink-muted)]">{t("builder.saveIntro")}</p>
            <div>
              <label htmlFor={`${fid}-label`} className="mb-1 block text-xs text-[var(--color-ink-muted)]">{t("builder.label")}</label>
              <input
                id={`${fid}-label`} maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)}
                placeholder={t("builder.labelPlaceholder")}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]"
              />
            </div>
            {/* Honeypot: invisible to people, bots tend to fill it. */}
            <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
              <label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <p className="flex items-start gap-2 text-xs text-[var(--color-ink-faint)]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-green-400" /> {t("builder.privacy")}</p>
            {missing.length > 0 && (
              <p role="alert" className="text-sm text-yellow-400">{t("builder.minimum", { parts: missing.map((m) => t(`slots.${m}`)).join(t("builder.listSeparator")) })}</p>
            )}
            {sendResult && !sendResult.ok && <p role="alert" className="text-sm text-[var(--color-red-glow)]">{sendResult.text}</p>}
            <button type="submit" disabled={sending || missing.length > 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-red)] px-4 text-sm font-bold text-white disabled:opacity-40">
              <Send size={15} /> {sending ? t("builder.sending") : t("builder.send")}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}
