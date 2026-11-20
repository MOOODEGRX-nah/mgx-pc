import { useEffect, useState, type CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, ClipboardList, Cpu, FileDown, Wrench } from "lucide-react";
import { fetchStores } from "../lib/api";
import { fetchBuildFull } from "../lib/buildsApi";
import { groupItemsBySlot } from "../lib/buildItems";
import { ItemRow } from "../components/ItemRow";
import { BuildSummary } from "../components/BuildSummary";
import { BuildPrintSheet } from "../components/BuildPrintSheet";
import { VideoFacade } from "../components/VideoFacade";
import { copyText } from "../lib/clipboard";
import { formatMoney, normalizeLang } from "../lib/format";
import { pickLang } from "../lib/i18nData";
import { shoppingListText } from "../lib/shoppingList";
import { Reveal } from "../components/Reveal";
import type { BuildFull, Store } from "../types";

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

  const [build, setBuild] = useState<BuildFull | null | undefined>(undefined);
  const [stores, setStores]   = useState<Store[]>([]);
  const [imgErr, setImgErr]   = useState<string | null>(null);
  const [listCopied, setListCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchBuildFull(id).then(setBuild).catch(() => setBuild(null));
    fetchStores().then(setStores).catch(() => setStores([]));
  }, [id]);

  // Loading skeleton
  if (build === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="h-4 w-20 shimmer rounded mb-8" />
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="flex-1 space-y-3">
            <div className="h-3 w-24 shimmer rounded" />
            <div className="h-10 w-3/4 shimmer rounded" />
            <div className="h-4 w-full shimmer rounded" />
          </div>
          <div className="aspect-[4/3] flex-1 shimmer rounded-xl" />
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
  const groups = groupItemsBySlot(build.items);
  const coreGroups = groups.filter((g) => g.slot !== "accessory");
  const accessories = groups.find((g) => g.slot === "accessory")?.items ?? [];
  const partsCount = coreGroups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.quantity, 0), 0);
  const accessoriesCount = accessories.reduce((n, i) => n + i.quantity, 0);
  const pageUrl = window.location.href;
  const lang = normalizeLang(i18n.language);

  async function copyShoppingList() {
    if (!build) return;
    const text = shoppingListText(pickLang(build, "name", lang), build.items, lang, {
      slot: (slot) => t(`slots.${slot}`),
      noLink: t("build.noLink"),
      total: (amount) => `${t("price.total")}: ${amount}`,
      partial: (n) => t("price.partial", { n }),
      accessories: (amount) => `${t("price.accessories")}: ${amount}`,
      pricesMayChange: t("print.pricesMayChange"),
      money: (v) => formatMoney(v, lang),
    }, pageUrl);
    if (await copyText(text)) {
      setListCopied(true);
      setTimeout(() => setListCopied(false), 2000);
    }
  }
  const hasImg = !!build.image_url && imgErr !== build.image_url;
  const catColor = CATEGORY_COLOR[build.category] ?? "text-[var(--color-red)]";

  return (
    <>
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 print:hidden">
      {/* Back */}
      <Link to="/" className="group mt-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-red)]">
        <BackIcon size={14} className="transition-transform duration-300 ltr:group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
        {t("build.back")}
      </Link>

      {/* Hero: text + image
          In RTL (Arabic): text is on the natural inline-start side (right),
          image is on inline-end (left) — achieved with CSS order on md screens.
          In LTR (English): text left, image right.  */}
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
        {/* Text — md:order follows RTL rule */}
        <div className={`flex flex-1 animate-fade-up flex-col justify-center ${isRtl ? "md:order-2" : "md:order-1"}`}>
          <span className={`font-mono text-xs font-bold uppercase tracking-widest rtl:tracking-normal ${catColor}`}>
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
            <div className="stagger animate-scale-in rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5" style={{ "--i": 3 } as CSSProperties}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
                {t("build.partsCount")}
              </p>
              <p className="mt-0.5 text-xl font-black text-[var(--color-ink)]">{partsCount}</p>
            </div>
            {accessoriesCount > 0 && (
              <div className="stagger animate-scale-in rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5" style={{ "--i": 4 } as CSSProperties}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]">
                  {t("build.tools")}
                </p>
                <p className="mt-0.5 text-xl font-black text-[var(--color-ink)]">{accessoriesCount}</p>
              </div>
            )}
          </div>
        </div>

        {/* Image */}
        <div className={`stagger group relative flex-1 animate-scale-in overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] ${isRtl ? "md:order-1" : "md:order-2"}`} style={{ "--i": 2 } as CSSProperties}>
          {hasImg ? (
            <img
              src={build.image_url!}
              alt={name}
              onError={() => setImgErr(build.image_url)}
              className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
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

      {/* Price + actions */}
      <Reveal className="mt-8 grid grid-cols-1 gap-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 md:grid-cols-[minmax(0,1fr)_auto]">
        <BuildSummary items={build.items} stores={stores} showItems={false} />
        <div className="flex flex-col gap-2 md:min-w-[200px]">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-red)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <FileDown size={16} /> {t("build.exportPdf")}
          </button>
          <p className="text-center text-[11px] text-[var(--color-ink-faint)]">{t("build.pdfHint")}</p>
          <button
            type="button"
            onClick={copyShoppingList}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-[0.98]"
          >
            {listCopied ? <Check size={16} className="animate-pop text-[var(--color-red)]" /> : <ClipboardList size={16} />}
            {listCopied ? t("build.listCopied") : t("build.copyList")}
          </button>
          <Link
            to={`/builder?from=${build.id}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-[0.98]"
          >
            <Wrench size={16} /> {t("build.openInBuilder")}
          </Link>
        </div>
      </Reveal>

      {/* Console comparison section */}
      {build.category === "console-equiv" && build.console_target && (
        <Reveal className="mt-8 rounded-xl border border-purple-500/20 bg-purple-400/5 p-5">
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
        </Reveal>
      )}

      {/* Performance videos */}
      {build.videos.length > 0 && (
        <section className="mt-10">
          <div className="trace-divider mb-8" />
          <h2 className="mb-1 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">{t("videos.title")}</h2>
          <p className="mb-5 text-xs text-[var(--color-ink-faint)]">{t("videos.approxNote")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {build.videos.map((v, index) => (
              <Reveal key={v.id} delay={index * 80}><VideoFacade video={v} /></Reveal>
            ))}
          </div>
        </section>
      )}

      <div className="trace-divider my-10" />

      {/* Specs */}
      <section>
        <h2 className="mb-5 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
          {t("build.specs")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {coreGroups.flatMap((g) => g.items).map((item, index) => (
            <Reveal key={item.component_id} delay={index * 60}>
              <ItemRow label={t(`partTypes.${item.component.type}`)} item={item} stores={storeMap} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Tools */}
      {accessories.length > 0 && (
        <section className="mt-10">
          <div className="trace-divider mb-8" />
          <h2 className="mb-5 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
            {t("build.tools")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {accessories.map((item, index) => (
              <Reveal key={item.component_id} delay={index * 60}>
                <ItemRow item={item} stores={storeMap} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
    <BuildPrintSheet title={pickLang(build, "name", lang)} category={build.category} items={build.items} stores={storeMap} pageUrl={pageUrl} />
    </>
  );
}
