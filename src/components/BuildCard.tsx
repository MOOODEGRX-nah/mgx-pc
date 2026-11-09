import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Cpu } from "lucide-react";
import type { Build, Category } from "../types";

// Full class names (Tailwind cannot see classes built from template strings).
const CATEGORY_META: Record<Category, { hoverText: string; badge: string; glow: string }> = {
  "high-end": {
    hoverText: "group-hover:text-yellow-400",
    badge: "border-yellow-400/20 bg-yellow-400/10 text-yellow-400",
    glow: "hover:shadow-[0_12px_40px_-12px_rgba(250,204,21,0.25)]",
  },
  "mid-range": {
    hoverText: "group-hover:text-blue-400",
    badge: "border-blue-400/20 bg-blue-400/10 text-blue-400",
    glow: "hover:shadow-[0_12px_40px_-12px_rgba(96,165,250,0.25)]",
  },
  "budget": {
    hoverText: "group-hover:text-green-400",
    badge: "border-green-400/20 bg-green-400/10 text-green-400",
    glow: "hover:shadow-[0_12px_40px_-12px_rgba(74,222,128,0.25)]",
  },
  "console-equiv": {
    hoverText: "group-hover:text-purple-300",
    badge: "border-purple-400/20 bg-purple-400/10 text-purple-300",
    glow: "hover:shadow-[0_12px_40px_-12px_rgba(168,85,247,0.25)]",
  },
};

/** Moves the card's spotlight to the pointer position. */
function trackPointer(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
}

export function BuildCard({ build }: { build: Build }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const name = isRtl ? build.name_ar : build.name_en;
  const description = isRtl ? build.description_ar : build.description_en;
  const meta = CATEGORY_META[build.category] ?? CATEGORY_META["high-end"];
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <Link
      to={`/build/${build.id}`}
      onMouseMove={trackPointer}
      className={[
        "spotlight group block h-full overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]",
        "transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]",
        "hover:-translate-y-1 hover:border-[var(--color-red)]/60 active:translate-y-0 active:scale-[0.99]",
        meta.glow,
      ].join(" ")}
    >
      {/* Image area */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-surface-2)]">
        {build.image_url ? (
          <img
            src={build.image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--color-ink-faint)]">
            <Cpu size={32} className="transition-transform duration-500 group-hover:rotate-90 group-hover:text-[var(--color-red)]" />
            <span className="font-mono text-xs">MGX(PC)</span>
          </div>
        )}

        {/* Bottom fade overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--color-surface)]/90 to-transparent" />

        {/* Category badge */}
        <span
          className={[
            "absolute bottom-3 start-3 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm rtl:tracking-normal",
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
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-faint)] transition-colors duration-200 ${meta.hoverText}`}>
          {t("home.viewBuild")}
          <Arrow
            size={13}
            className="transition-transform duration-300 ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          />
        </div>
      </div>

      {/* Bottom red accent line, grows from the reading start side */}
      <div className="h-[2px] w-full scale-x-0 bg-[var(--color-red)] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-100 ltr:origin-left rtl:origin-right" />
    </Link>
  );
}
