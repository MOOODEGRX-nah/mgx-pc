import { useTranslation } from "react-i18next";
import { CATEGORIES, type Category } from "../types";

interface CategoryToggleProps {
  value: Category;
  onChange: (category: Category) => void;
}

const CATEGORY_META: Record<string, {
  icon: string;
  active: string;
}> = {
  "high-end":      { icon: "⚡", active: "border-yellow-500/70 text-yellow-400 bg-yellow-400/8 shadow-[0_0_14px_rgba(250,204,21,0.15)]" },
  "mid-range":     { icon: "🎮", active: "border-blue-500/70 text-blue-300 bg-blue-400/8 shadow-[0_0_14px_rgba(96,165,250,0.15)]" },
  "budget":        { icon: "💡", active: "border-green-500/70 text-green-400 bg-green-400/8 shadow-[0_0_14px_rgba(74,222,128,0.15)]" },
  "console-equiv": { icon: "🕹️", active: "border-purple-500/70 text-purple-300 bg-purple-400/8 shadow-[0_0_14px_rgba(168,85,247,0.15)]" },
};

export function CategoryToggle({ value, onChange }: CategoryToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {CATEGORIES.map((category) => {
        const active = category === value;
        const meta = CATEGORY_META[category];

        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={[
              "flex items-center gap-2 rounded-xl border px-5 py-3 font-mono text-sm tracking-wide",
              "transition-all duration-200 active:scale-95 select-none",
              active
                ? meta.active
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:border-[var(--color-ink-faint)] hover:text-[var(--color-ink)]",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 shrink-0 rounded-full transition-all",
                active
                  ? "bg-current shadow-[0_0_6px_2px_currentColor]"
                  : "bg-[var(--color-ink-faint)]",
              ].join(" ")}
            />
            <span>{t(`categories.${category}`)}</span>
            {active && <span className="text-base leading-none">{meta.icon}</span>}
          </button>
        );
      })}
    </div>
  );
}
