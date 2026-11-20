import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Cpu, Sparkles, Wrench } from "lucide-react";
import { CategoryToggle } from "../components/CategoryToggle";
import { BuildCard } from "../components/BuildCard";
import { fetchBuildsWithSummary } from "../lib/buildsApi";
import type { BuildWithSummary, Category } from "../types";

export function Home() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>("high-end");
  const [builds, setBuilds] = useState<BuildWithSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchBuildsWithSummary(category)
      .then((data) => { if (active) setBuilds(data); })
      .catch(() => { if (active) setBuilds([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category]);

  return (
    <div>
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-x-clip">
        {/* Ambient glow. overflow-x-clip stops it widening the page on phones
            without clipping the glow vertically (unlike overflow-hidden). */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[640px] -translate-x-1/2 -translate-y-1/2 animate-breathe rounded-full bg-[var(--color-red)] opacity-[0.05] blur-[100px]"
        />
        {/* Faint circuit grid, fading out towards the edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-fade-in opacity-60 [background-image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_60%_55%_at_center,black_10%,transparent_75%)]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:pt-24 sm:pb-16 sm:px-6">
          {/* Badge */}
          <div
            className="stagger mb-5 inline-flex animate-fade-up items-center gap-2 rounded-full border border-[var(--color-red-dim)] bg-[var(--color-surface)] px-4 py-1.5"
            style={{ "--i": 0 } as CSSProperties}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping-soft rounded-full bg-[var(--color-red)]" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--color-red)] shadow-[0_0_6px_2px_rgba(225,6,0,0.5)]" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-red-glow)]">
              MGX(PC) — Saudi PC Market
            </span>
          </div>

          <h1
            className="stagger animate-fade-up font-display text-4xl font-black leading-[1.1] text-[var(--color-ink)] sm:text-6xl lg:text-7xl"
            style={{ "--i": 1 } as CSSProperties}
          >
            {t("home.welcomeTo")}
          </h1>
          <p
            className="stagger mx-auto mt-5 max-w-lg animate-fade-up text-base leading-relaxed text-[var(--color-ink-muted)] sm:text-lg"
            style={{ "--i": 2 } as CSSProperties}
          >
            {t("home.tagline")}
          </p>
          <div className="stagger mt-7 flex animate-fade-up flex-wrap justify-center gap-3" style={{ "--i": 3 } as CSSProperties}>
            <Link to="/advisor" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--color-red)] px-5 text-sm font-bold text-white shadow-[0_0_24px_rgba(225,6,0,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(225,6,0,0.5)] active:translate-y-0">
              <Sparkles size={16} /> {t("home.ctaAdvisor")}
            </Link>
            <Link to="/builder" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 text-sm text-[var(--color-ink)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-red)] active:translate-y-0">
              <Wrench size={16} /> {t("home.ctaBuilder")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ──────────────────────────────────────────────── */}
      <div className="trace-divider" />

      {/* ── BUILDS ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 pb-24 sm:px-6" aria-labelledby="builds-heading">
        <h2 id="builds-heading" className="sr-only">{t("home.buildsHeading")}</h2>
        <div className="stagger animate-fade-up" style={{ "--i": 4 } as CSSProperties}>
          <CategoryToggle value={category} onChange={setCategory} />
        </div>

        <div className="mt-10">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                  <div className="shimmer aspect-[16/10]" />
                  <div className="space-y-2 p-4">
                    <div className="shimmer h-4 w-2/3 rounded" />
                    <div className="shimmer h-3 w-full rounded" />
                    <div className="shimmer h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : builds.length === 0 ? (
            <div className="animate-fade-in py-24 text-center">
              <Cpu size={36} className="mx-auto mb-3 text-[var(--color-ink-faint)] opacity-60" />
              <p className="text-sm text-[var(--color-ink-faint)]">{t("home.noBuilds")}</p>
            </div>
          ) : (
            <div key={category} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {builds.map((build, index) => (
                <div key={build.id} className="stagger animate-fade-up" style={{ "--i": index } as CSSProperties}>
                  <BuildCard build={build} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
