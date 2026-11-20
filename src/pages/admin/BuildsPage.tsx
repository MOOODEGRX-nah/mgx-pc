import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cpu, Pencil, Plus, Trash2 } from "lucide-react";
import { fetchBuildsWithSummary } from "../../lib/buildsApi";
import { deleteBuild, updateBuild } from "../../lib/api";
import { toAppError } from "../../lib/errors";
import { formatMoney } from "../../lib/format";
import { pickLang } from "../../lib/i18nData";
import { btnPrimary, cardCls } from "../../components/admin/ui";
import type { BuildWithSummary } from "../../types";

export function BuildsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const otherLang = lang === "ar" ? "en" : "ar";
  const [builds, setBuilds] = useState<BuildWithSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchBuildsWithSummary()
      .then((b) => { setBuilds(b); setError(null); })
      .catch((err) => { const e = toAppError(err); setError(t(e.i18nKey, e.params)); setBuilds([]); });
  }, [t]);

  useEffect(load, [load]);

  async function togglePublished(b: BuildWithSummary) {
    setBuilds((list) => list?.map((x) => (x.id === b.id ? { ...x, is_published: !b.is_published } : x)) ?? null);
    try { await updateBuild(b.id, { is_published: !b.is_published }); }
    catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); load(); }
  }

  async function remove(b: BuildWithSummary) {
    if (!confirm(t("admin.builds.confirmDelete", { name: pickLang(b, "name", lang) }))) return;
    try { await deleteBuild(b.id); load(); }
    catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-[var(--color-ink)]">{t("admin.builds.title")}</h2>
        <Link to="/admin/builds/new" className={btnPrimary}><Plus size={15} /> {t("admin.addBuild")}</Link>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-[var(--color-red-glow)]">{error}</p>}

      {builds === null ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="shimmer h-[76px] rounded-xl" />)}</div>
      ) : builds.length === 0 ? (
        <div className={`${cardCls} py-14 text-center text-sm text-[var(--color-ink-faint)]`}>{t("admin.builds.empty")}</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {builds.map((b, index) => {
            const s = b.summary;
            return (
              <li key={b.id} className={`${cardCls} stagger flex animate-fade-up items-center gap-3 px-3 py-2.5`} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
                <div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]">
                  {b.image_url ? <img src={b.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Cpu size={16} className="text-[var(--color-ink-faint)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--color-ink)]">{pickLang(b, "name", lang)}</p>
                  <p className="truncate text-[11px] text-[var(--color-ink-faint)]">{pickLang(b, "name", otherLang)}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[var(--color-ink-muted)]">
                    <span className="text-[var(--color-red)]">{t(`categories.${b.category}`)}</span>
                    {s && s.priced_count > 0 && (
                      <span>
                        {s.priced_count < s.items_count && `${t("price.fromPrefix")} `}
                        <bdi>{formatMoney(s.total_best, lang)}</bdi>
                      </span>
                    )}
                    <span>{t("admin.builds.pricedOf", { priced: s?.priced_count ?? 0, total: s?.items_count ?? 0 })}</span>
                  </p>
                </div>
                <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
                  <input type="checkbox" checked={b.is_published} onChange={() => togglePublished(b)} className="h-4 w-4 accent-[var(--color-red)]" />
                  <span className="hidden sm:inline">{b.is_published ? t("admin.builds.published") : t("admin.builds.draft")}</span>
                </label>
                <Link to={`/admin/builds/${b.id}`} aria-label={`${t("admin.edit")}: ${pickLang(b, "name", lang)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-red)]">
                  <Pencil size={15} />
                </Link>
                <button type="button" onClick={() => remove(b)} aria-label={`${t("admin.builds.delete")}: ${pickLang(b, "name", lang)}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-red)]">
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
