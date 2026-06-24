import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryToggle } from "../components/CategoryToggle";
import { BuildCard } from "../components/BuildCard";
import { fetchBuilds } from "../lib/api";
import type { Build, Category } from "../types";

export function Home() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>("high-end");
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchBuilds(category)
      .then((data) => { if (active) setBuilds(data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category]);

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative">
        {/* Ambient glow — stays within section, no overflow-hidden */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[320px] w-[640px] rounded-full bg-[var(--color-red)] opacity-[0.05] blur-[100px]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:pt-24 sm:pb-16 sm:px-6">
          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-red-dim)] bg-[var(--color-surface)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-red)] shadow-[0_0_6px_2px_rgba(225,6,0,0.5)]" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-red)]">
              MGX(PC) — Saudi PC Market
            </span>
          </div>

          <h1 className="font-[var(--font-display)] text-4xl font-black leading-[1.1] text-[var(--color-ink)] sm:text-6xl lg:text-7xl">
            {t("home.welcomeTo")}
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-[var(--color-ink-muted)] sm:text-lg leading-relaxed">
            {t("home.tagline")}
          </p>
        </div>
      </section>

      {/* ── DIVIDER ──────────────────────────────────────────────── */}
      <div className="trace-divider" />

      {/* ── BUILDS ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 pb-24 sm:px-6">
        <CategoryToggle value={category} onChange={setCategory} />

        <div className="mt-10">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                  <div className="aspect-[16/10] animate-pulse bg-[var(--color-surface-2)]" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--color-surface-3)]" />
                    <div className="h-3 w-full animate-pulse rounded bg-[var(--color-surface-3)]" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--color-surface-3)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : builds.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-sm text-[var(--color-ink-faint)]">{t("home.noBuilds")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {builds.map((build) => (
                <BuildCard key={build.id} build={build} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
