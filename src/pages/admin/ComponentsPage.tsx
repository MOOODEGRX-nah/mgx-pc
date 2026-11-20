import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Cpu, Pencil, Plus, Search } from "lucide-react";
import { fetchComponents, updateComponent } from "../../lib/catalogApi";
import { fetchStores } from "../../lib/api";
import { fetchSettings, DEFAULT_SETTINGS } from "../../lib/settingsApi";
import { toAppError } from "../../lib/errors";
import { formatMoney } from "../../lib/format";
import { bestOffer, isStale } from "../../lib/pricing";
import { ComponentDrawer } from "../../components/admin/ComponentDrawer";
import { btnPrimary, cardCls, inputCls } from "../../components/admin/ui";
import { COMPONENT_GROUPS } from "../../lib/componentGroups";
import type { ComponentWithOffers, Store } from "../../types";


type Editing = { component: ComponentWithOffers | null } | null;

export function ComponentsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [groupKey, setGroupKey] = useState("cpu");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ComponentWithOffers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [staleDays, setStaleDays] = useState(DEFAULT_SETTINGS.price_stale_days);
  const [editing, setEditing] = useState<Editing>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const group = COMPONENT_GROUPS.find((g) => g.key === groupKey) ?? COMPONENT_GROUPS[0];

  useEffect(() => {
    fetchStores().then(setStores).catch(() => setStores([]));
    fetchSettings().then((s) => setStaleDays(s.price_stale_days));
  }, []);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchComponents({ type: group.types, search: query, includeInactive: true, withUsage: true })
      .then((data) => { if (active) { setItems(data); setError(null); } })
      .catch((err) => { if (active) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.types, query, reloadKey, t]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  async function toggleActive(c: ComponentWithOffers) {
    setItems((list) => list.map((x) => (x.id === c.id ? { ...x, is_active: !c.is_active } : x)));
    try {
      await updateComponent(c.id, { is_active: !c.is_active });
    } catch (err) {
      const e = toAppError(err);
      setError(t(e.i18nKey, e.params));
      reload();
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-[var(--color-ink)]">{t("admin.components.title")}</h2>
        <button type="button" onClick={() => setEditing({ component: null })} className={btnPrimary}>
          <Plus size={15} /> {t("admin.components.add")}
        </button>
      </div>

      {/* Type chips */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={t("admin.components.title")}>
        {COMPONENT_GROUPS.map((g) => {
          const active = g.key === groupKey;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGroupKey(g.key)}
              className={`min-h-10 rounded-lg border px-3.5 text-sm transition-colors ${active ? "border-[var(--color-red)] bg-[var(--color-red-dim)]/25 text-[var(--color-ink)]" : "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"}`}
            >
              {t(`admin.components.groups.${g.key}`)}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.components.search")}
          aria-label={t("admin.components.search")}
          className={`${inputCls} ps-9`}
        />
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-[var(--color-red-glow)]">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="shimmer h-[72px] rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className={`${cardCls} py-14 text-center text-sm text-[var(--color-ink-faint)]`}>
          <Cpu size={28} className="mx-auto mb-2 opacity-60" />
          {t("admin.components.empty")}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c, index) => {
            const best = bestOffer(c.offers);
            const stale = best !== null && isStale(best.price_updated_at, staleDays);
            return (
              <li
                key={c.id}
                className={`${cardCls} stagger flex animate-fade-up items-center gap-3 px-3 py-2.5 ${c.is_active ? "" : "opacity-60"}`}
                style={{ "--i": Math.min(index, 10) } as CSSProperties}
              >
                <div className="grid h-12 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]">
                  {c.image_url
                    ? <img src={c.image_url} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                    : <Cpu size={16} className="text-[var(--color-ink-faint)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p dir="ltr" className="truncate text-start text-sm font-medium text-[var(--color-ink)] rtl:text-right">{c.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-ink-faint)]">
                    {group.types.length > 1 && <span>{t(`partTypes.${c.type}`)}</span>}
                    {c.perf_tier && <span>{t("admin.components.tierShort", { tier: c.perf_tier })}</span>}
                    <span>{t("admin.components.offersCount", { n: c.offers.length })}</span>
                    <span>{t("admin.components.usedIn", { n: c.used_in_builds ?? 0 })}</span>
                    {stale && <span className="text-yellow-400">{t("admin.offers.stale")}</span>}
                  </div>
                </div>
                <div className="hidden shrink-0 text-end sm:block">
                  {best?.price != null
                    ? <bdi className="text-sm font-bold text-[var(--color-ink)]">{formatMoney(best.price, lang)}</bdi>
                    : <span className="text-xs text-[var(--color-ink-faint)]">{t("price.none")}</span>}
                </div>
                <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]" title={t("admin.components.isActive")}>
                  <input type="checkbox" checked={c.is_active} onChange={() => toggleActive(c)} className="h-4 w-4 accent-[var(--color-red)]" />
                  <span className="hidden sm:inline">{t("admin.components.activeShort")}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setEditing({ component: c })}
                  aria-label={`${t("admin.edit")}: ${c.name}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-red)]"
                >
                  <Pencil size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ComponentDrawer
          key={editing.component?.id ?? "new"}
          component={editing.component}
          defaultType={group.types[0]}
          stores={stores}
          staleDays={staleDays}
          onClose={() => setEditing(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
