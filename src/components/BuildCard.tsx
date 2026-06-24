import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cpu } from "lucide-react";
import type { Build } from "../types";

const CATEGORY_META: Record<string, { text: string; badge: string }> = {
  "high-end": { text: "text-yellow-400", badge: "border-yellow-400/20 bg-yellow-400/8 text-yellow-400" },
  "mid-range": { text: "text-blue-400",  badge: "border-blue-400/20 bg-blue-400/8 text-blue-400" },
  "budget":    { text: "text-green-400", badge: "border-green-400/20 bg-green-400/8 text-green-400" },
};

export function BuildCard({ build }: { build: Build }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const name = isRtl ? build.name_ar : build.name_en;
  const description = isRtl ? build.description_ar : build.description_en;
  const meta = CATEGORY_META[build.category] ?? { text: "text-[var(--color-red)]", badge: "border-[var(--color-red-dim)] bg-[var(--color-surface-2)] text-[var(--color-red)]" };

  return (
    <Link
      to={`/build/${build.id}`}
      className="group block overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] transition-all duration-300 hover:border-[var(--color-red)] hover:shadow-[0_0_28px_rgba(225,6,0,0.1)]"
    >
      {/* Image area */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-surface-2)]">
        {build.image_url ? (
          <img
            src={build.image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--color-ink-faint)]">
            <Cpu size={32} />
            <span className="font-mono text-xs">MGX(PC)</span>
          </div>
        )}

        {/* Bottom fade overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--color-surface)]/90 to-transparent" />

        {/* Category badge — positioned at bottom left/right depending on direction */}
        <span
          className={[
            "absolute bottom-3 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest",
            isRtl ? "right-3" : "left-3",
            meta.badge,
          ].join(" ")}
        >
          {t(`categories.${build.category}`)}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-[var(--font-display)] text-base font-bold leading-snug text-[var(--color-ink)]">
          {name}
        </h3>
        {description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--color-ink-faint)]">
            {description}
          </p>
        )}
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium text-[var(--color-ink-faint)] transition-colors duration-200 group-hover:${meta.text}`}>
          {t("home.viewBuild")}
          <span className={isRtl ? "rotate-180" : ""}>→</span>
        </div>
      </div>

      {/* Bottom red accent line */}
      <div className="h-[2px] w-full origin-left scale-x-0 bg-[var(--color-red)] transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}
