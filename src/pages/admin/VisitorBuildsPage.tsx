import { useCallback, useEffect, useId, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Archive, CheckCheck, ChevronDown, ExternalLink, Rocket, Trash2, Users } from "lucide-react";
import { BuildSummary } from "../../components/BuildSummary";
import { Sheet } from "../../components/ui/Sheet";
import { btnGhost, btnPrimary, cardCls, inputCls, labelCls } from "../../components/admin/ui";
import {
  deleteUserBuild, fetchUserBuilds, publishUserBuildAsBuild, updateUserBuildStatus,
} from "../../lib/userBuildsApi";
import { fetchStores } from "../../lib/api";
import { suggestCategory } from "../../lib/builderDraft";
import { toAppError } from "../../lib/errors";
import { formatDate, formatMoney } from "../../lib/format";
import { computeTotals } from "../../lib/pricing";
import {
  CATEGORIES, USER_BUILD_STATUSES,
  type AdvisorAnswers, type Category, type Store, type UserBuildStatus, type UserBuildWithItems,
} from "../../types";

const STATUS_STYLE: Record<UserBuildStatus, string> = {
  new: "border-[var(--color-red)]/50 bg-[var(--color-red-dim)]/25 text-[var(--color-ink)]",
  reviewed: "border-blue-400/30 text-blue-300",
  published: "border-green-500/30 text-green-400",
  archived: "border-[var(--color-line)] text-[var(--color-ink-faint)]",
};

function answersSummary(a: AdvisorAnswers | null, t: (k: string, o?: Record<string, unknown>) => string, lang: string): string {
  if (!a) return "";
  const parts: string[] = [];
  if (a.budget) parts.push(formatMoney(a.budget, lang));
  if (a.gameType) parts.push(t(`advisor.options.gameType.${a.gameType}`));
  if (a.quality) parts.push(a.quality);
  if (a.usage) parts.push(t(`advisor.options.usage.${a.usage}`));
  if (a.hasSetup) parts.push(t(`advisor.options.hasSetup.${a.hasSetup}`));
  return parts.join(" · ");
}

/** Inbox of builds sent by visitors from /builder. */
export function VisitorBuildsPage() {
  const { refreshCounts: onCountChange } = useOutletContext<{ refreshCounts?: () => void }>() ?? {};
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fid = useId();
  const [filter, setFilter] = useState<UserBuildStatus | "">("");
  const [rows, setRows] = useState<UserBuildWithItems[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<UserBuildWithItems | null>(null);
  const [pubForm, setPubForm] = useState<{ name_ar: string; name_en: string; category: Category }>({ name_ar: "", name_en: "", category: "mid-range" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; buildId?: string } | null>(null);

  const load = useCallback(() => {
    fetchUserBuilds(filter || undefined)
      .then((r) => { setRows(r); setError(null); })
      .catch((err) => { const e = toAppError(err); setError(t(e.i18nKey, e.params)); setRows([]); });
  }, [filter, t]);
  useEffect(load, [load]);
  useEffect(() => { fetchStores().then(setStores).catch(() => setStores([])); }, []);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); load(); onCountChange?.(); }
    catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
    finally { setBusy(false); }
  }

  function startPublish(r: UserBuildWithItems) {
    setPubForm({ name_ar: r.label ?? "", name_en: r.label ?? "", category: suggestCategory(r.items) });
    setPublishing(r);
  }

  async function publish() {
    if (!publishing || !pubForm.name_ar.trim() || !pubForm.name_en.trim()) return;
    setBusy(true); setError(null);
    try {
      const build = await publishUserBuildAsBuild(publishing.id, pubForm);
      setPublishing(null);
      setNotice({ text: t("admin.visitorBuilds.publishedNotice"), buildId: build.id });
      load(); onCountChange?.();
    } catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <h2 className="mb-1 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">{t("admin.visitorBuilds.title")}</h2>
      <p className="mb-4 text-xs text-[var(--color-ink-muted)]">{t("admin.visitorBuilds.subtitle")}</p>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {(["", ...USER_BUILD_STATUSES] as const).map((s) => (
          <button key={s || "all"} type="button" role="tab" aria-selected={filter === s} onClick={() => setFilter(s)}
            className={`min-h-10 rounded-lg border px-3.5 text-sm transition-colors ${filter === s ? "border-[var(--color-red)] bg-[var(--color-red-dim)]/25 text-[var(--color-ink)]" : "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"}`}>
            {s ? t(`admin.visitorBuilds.status.${s}`) : t("admin.visitorBuilds.all")}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-[var(--color-red-glow)]">{error}</p>}
      {notice && (
        <p role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {notice.text}
          {notice.buildId && <Link to={`/admin/builds/${notice.buildId}`} className="underline">{t("admin.visitorBuilds.openBuild")}</Link>}
        </p>
      )}

      {rows === null ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="shimmer h-[80px] rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className={`${cardCls} py-14 text-center text-sm text-[var(--color-ink-faint)]`}>{t("admin.visitorBuilds.empty")}</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const live = computeTotals(r.items);
            const isOpen = open === r.id;
            const answers = answersSummary(r.advisor_answers, t, lang);
            return (
              <li key={r.id} className={`${cardCls} overflow-hidden`}>
                <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen} className="flex w-full items-start gap-3 p-3 text-start">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[var(--color-ink)]">{r.label || t("admin.visitorBuilds.untitled")}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLE[r.status]}`}>{t(`admin.visitorBuilds.status.${r.status}`)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-ink-muted)]">
                      <span className="inline-flex items-center gap-1"><Users size={11} /> {t("admin.visitorBuilds.builtBy", { n: r.submit_count })}</span>
                      <span>{t("admin.visitorBuilds.items", { n: r.items.length })}</span>
                      <span>
                        {t("admin.visitorBuilds.liveTotal")}: {live.pricedCount > 0 ? <bdi>{formatMoney(live.total, lang)}</bdi> : "—"}
                        {r.total_snapshot != null && <> ({t("admin.visitorBuilds.atSubmit")}: <bdi>{formatMoney(r.total_snapshot, lang)}</bdi>)</>}
                      </span>
                      {r.lang && <span>{r.lang.toUpperCase()}</span>}
                      <span>{formatDate(r.last_submitted_at, lang)}</span>
                    </span>
                    {answers && <span className="mt-0.5 block text-[11px] text-[var(--color-ink-faint)]">{t("admin.visitorBuilds.answers")}: {answers}</span>}
                  </span>
                  <ChevronDown size={16} className={`mt-1 shrink-0 transition-transform ${isOpen ? "rotate-180 text-[var(--color-red)]" : "text-[var(--color-ink-faint)]"}`} />
                </button>
                <div className="accordion" data-open={isOpen} inert={!isOpen}>
                  <div>
                    <div className="border-t border-[var(--color-line)] p-3">
                      <BuildSummary items={r.items} stores={stores} />
                      <div className="mt-4 flex flex-wrap gap-2">
                        {r.status !== "published" && (
                          <button type="button" disabled={busy} onClick={() => startPublish(r)} className={btnPrimary}><Rocket size={14} /> {t("admin.visitorBuilds.publish")}</button>
                        )}
                        {r.published_build_id && (
                          <Link to={`/admin/builds/${r.published_build_id}`} className={btnGhost}><ExternalLink size={14} /> {t("admin.visitorBuilds.openBuild")}</Link>
                        )}
                        {r.status === "new" && (
                          <button type="button" disabled={busy} onClick={() => act(() => updateUserBuildStatus(r.id, "reviewed"))} className={btnGhost}><CheckCheck size={14} /> {t("admin.visitorBuilds.markReviewed")}</button>
                        )}
                        {r.status !== "archived" && (
                          <button type="button" disabled={busy} onClick={() => act(() => updateUserBuildStatus(r.id, "archived"))} className={btnGhost}><Archive size={14} /> {t("admin.visitorBuilds.archive")}</button>
                        )}
                        <button type="button" disabled={busy} onClick={() => { if (confirm(t("admin.visitorBuilds.confirmDelete"))) act(() => deleteUserBuild(r.id)); }} className={btnGhost} aria-label={t("admin.visitorBuilds.delete")}>
                          <Trash2 size={14} /> {t("admin.visitorBuilds.delete")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!publishing} onClose={() => setPublishing(null)} title={t("admin.visitorBuilds.publishTitle")} variant="modal">
        <form onSubmit={(e) => { e.preventDefault(); publish(); }} className="flex flex-col gap-3">
          <div>
            <label htmlFor={`${fid}-ar`} className={labelCls}>{t("admin.nameAr")}</label>
            <input id={`${fid}-ar`} dir="rtl" required value={pubForm.name_ar} onChange={(e) => setPubForm({ ...pubForm, name_ar: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor={`${fid}-en`} className={labelCls}>{t("admin.nameEn")}</label>
            <input id={`${fid}-en`} dir="ltr" required value={pubForm.name_en} onChange={(e) => setPubForm({ ...pubForm, name_en: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor={`${fid}-cat`} className={labelCls}>{t("admin.category")}</label>
            <select id={`${fid}-cat`} value={pubForm.category} onChange={(e) => setPubForm({ ...pubForm, category: e.target.value as Category })} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">{t("admin.visitorBuilds.categoryHint")}</p>
          </div>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? t("admin.saving") : t("admin.visitorBuilds.publishConfirm")}</button>
        </form>
      </Sheet>
    </div>
  );
}
