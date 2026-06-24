import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Cpu } from "lucide-react";
import { fetchBuildById, fetchStores } from "../lib/api";
import { SpecRow } from "../components/SpecRow";
import { PART_TYPES, type BuildWithRelations, type Store } from "../types";

const CATEGORY_COLOR: Record<string, string> = {
  "high-end":      "text-yellow-400",
  "mid-range":     "text-blue-400",
  "budget":        "text-green-400",
  "console-equiv": "text-purple-400",
};

const CONSOLE_ICONS: Record<string, string> = {
  "ps5":            "🎮",
  "xbox-series-x":  "🟢",
  "xbox-series-s":  "🟩",
  "nintendo-switch":"🔴",
};

const PRICE_STYLE: Record<string, string> = {
  "cheaper":        "text-green-400 bg-green-400/10 border-green-400/20",
  "similar":        "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "more-expensive": "text-red-400 bg-red-400/10 border-red-400/20",
};

const PERF_STYLE: Record<string, string> = {
  "stronger": "text-green-400 bg-green-400/10 border-green-400/20",
  "similar":  "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "weaker":   "text-red-400 bg-red-400/10 border-red-400/20",
};

export function BuildDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const [build, setBuild] = useState<BuildWithRelations | null | undefined>(undefined);
  const [stores, setStores]   = useState<Store[]>([]);
  const [imgErr, setImgErr]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchBuildById(id).then(setBuild);
    fetchStores().then(setStores);
  }, [id]);

  // Loading skeleton
  if (build === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-2)] mb-8" />
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="flex-1 space-y-3">
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-surface-2)]" />
            <div className="h-10 w-3/4 animate-pulse rounded bg-[var(--color-surface-2)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--color-surface-2)]" />
          </div>
          <div className="aspect-[4/3] flex-1 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
        </div>
      </div>
    );
  }

  if (build === null) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Cpu size={48} className="mb-4 text-[var(--color-ink-faint)]" />
        <p className="text-[var(--color-ink-muted)]">{t("build.notFound")}</p>
        <Link to="/" className="mt-4 text-sm text-[var(--color-red)] hover:underline">{t("build.back")}</Link>
      </div>
    );
  }

  const name  = isRtl ? build.name_ar : build.name_en;
  const desc  = isRtl ? build.description_ar : build.description_en;
  const storeMap = new Map(stores.map((s) => [s.id, s]));
  const hasImg = !!build.image_url && imgErr !== build.image_url;
  const catColor = CATEGORY_COLOR[build.category] ?? "text-[var(--color-red)]";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      {/* Back */}
      <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-red)]">
        <BackIcon size={14} />
        {t("build.back")}
      </Link>

      {/* Hero: text + image
          In RTL (Arabic): text is on the natural inline-start side (right),
          image is on inline-end (left) — achieved with CSS order on md screens.
          In LTR (English): text left, image right.  */}
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
        {/* Text — md:order follows RTL rule */}
        <div className={`flex flex-1 flex-col justify-center ${isRtl ? "md:order-2" : "md:order-1"}`}>
          <span className={`font-mono text-xs font-bold uppercase tracking-widest ${catColor}`}>
            {t(`categories.${build.category}`)}
          </span>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-black leading-tight text-[var(--color-ink)] sm:text-4xl">
            {name}
          </h1>
          {desc && (
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">{desc}</p>
          )}

          {/* Stats row: parts count + tools count */}
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
                {t("build.partsCount")}
              </p>
              <p className="mt-0.5 text-xl font-black text-[var(--color-ink)]">{build.parts.length}</p>
            </div>
            {build.tools.length > 0 && (
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
                  {t("build.tools")}
                </p>
                <p className="mt-0.5 text-xl font-black text-[var(--color-ink)]">{build.tools.length}</p>
              </div>
            )}
          </div>
        </div>

        {/* Image */}
        <div className={`relative flex-1 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] ${isRtl ? "md:order-1" : "md:order-2"}`}>
          {hasImg ? (
            <img
              src={build.image_url!}
              alt={name}
              onError={() => setImgErr(build.image_url)}
              className="h-full w-full object-cover"
              style={{ minHeight: "260px", maxHeight: "400px" }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-[var(--color-ink-faint)]" style={{ minHeight: "260px" }}>
              <Cpu size={40} />
              <span className="font-mono text-xs">MGX(PC)</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--color-bg)]/60 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Console comparison section */}
      {build.category === "console-equiv" && build.console_target && (
        <div className="mt-8 rounded-xl border border-purple-500/20 bg-purple-400/5 p-5">
          <h2 className="mb-4 font-[var(--font-display)] text-base font-bold text-purple-300">
            🕹️ {t("build.consoleSection")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {/* Target console */}
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-purple-400/70">
                {t("build.consoleTarget")}
              </p>
              <span className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-[var(--color-surface)] px-3 py-2 text-sm font-bold text-purple-300">
                {CONSOLE_ICONS[build.console_target]} {t(`consoleTarget.${build.console_target}`)}
              </span>
            </div>

            {/* Price comparison */}
            {build.price_vs_console && (
              <div className="flex flex-col gap-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-purple-400/70">
                  {t("build.priceVsConsole")}
                </p>
                <span className={`rounded-lg border px-3 py-2 text-sm font-bold ${PRICE_STYLE[build.price_vs_console]}`}>
                  {t(`priceVsConsole.${build.price_vs_console}`)}
                </span>
              </div>
            )}

            {/* Performance comparison */}
            {build.perf_vs_console && (
              <div className="flex flex-col gap-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-purple-400/70">
                  {t("build.perfVsConsole")}
                </p>
                <span className={`rounded-lg border px-3 py-2 text-sm font-bold ${PERF_STYLE[build.perf_vs_console]}`}>
                  {t(`perfVsConsole.${build.perf_vs_console}`)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="trace-divider my-10" />

      {/* Specs */}
      <section>
        <h2 className="mb-5 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
          {t("build.specs")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PART_TYPES.map((type) => {
            const part = build.parts.find((p) => p.type === type);
            if (!part) return null;
            return (
              <SpecRow
                key={part.id}
                label={t(`partTypes.${type}`)}
                valueName={part.part_name}
                storeLink={part.store_link}
                store={part.store_id ? storeMap.get(part.store_id) : null}
              />
            );
          })}
        </div>
      </section>

      {/* Tools */}
      {build.tools.length > 0 && (
        <section className="mt-10">
          <div className="trace-divider mb-8" />
          <h2 className="mb-5 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
            {t("build.tools")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {build.tools.map((tool) => (
              <SpecRow
                key={tool.id}
                valueName={tool.tool_name}
                storeLink={tool.store_link}
                store={tool.store_id ? storeMap.get(tool.store_id) : null}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
