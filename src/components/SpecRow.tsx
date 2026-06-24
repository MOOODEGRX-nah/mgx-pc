import { useState } from "react";
import { ChevronDown, ExternalLink, Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StoreBadge } from "./StoreBadge";
import type { Store } from "../types";

interface SpecRowProps {
  label?: string;
  valueName: string;
  storeLink: string | null;
  store: Store | null | undefined;
}

export function SpecRow({ label, valueName, storeLink, store }: SpecRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedName, setCopiedName] = useState(false);

  async function copyText(text: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 1500);
    } catch { /* ignore */ }
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border transition-all duration-200 ${
        open
          ? "border-[var(--color-red)]/40 bg-[var(--color-surface-2)] shadow-[0_0_12px_rgba(225,6,0,0.06)]"
          : "border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-surface-3)]"
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start"
        aria-expanded={open}
      >
        {label && (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)] min-w-[80px]">
            {label}
          </span>
        )}
        <span className="flex flex-1 items-center justify-end gap-2 truncate">
          <span className="truncate text-sm font-medium text-[var(--color-ink)]">
            {valueName}
          </span>
          <ChevronDown
            size={15}
            className={`shrink-0 text-[var(--color-ink-faint)] transition-transform duration-200 ${open ? "rotate-180 text-[var(--color-red)]" : ""}`}
          />
        </span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] px-4 py-3">
          {storeLink ? (
            <a
              href={storeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-3)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-red)] hover:bg-[var(--color-red-dim)]/20"
            >
              <StoreBadge store={store} />
              <ExternalLink size={12} className="text-[var(--color-ink-muted)]" />
              <span>{t("build.openStore")}</span>
            </a>
          ) : (
            <span className="text-xs text-[var(--color-ink-faint)]">
              {t("build.noLink")}
            </span>
          )}

          {storeLink && (
            <button
              type="button"
              onClick={() => copyText(storeLink, setCopiedLink)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-3)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-95"
            >
              {copiedLink ? (
                <Check size={12} className="text-[var(--color-red)]" />
              ) : (
                <Copy size={12} />
              )}
              {copiedLink ? t("build.copied") : t("build.copyLink")}
            </button>
          )}

          <button
            type="button"
            onClick={() => copyText(valueName, setCopiedName)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-3)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-95"
          >
            {copiedName ? (
              <Check size={12} className="text-[var(--color-red)]" />
            ) : (
              <Copy size={12} />
            )}
            {copiedName ? t("build.copied") : t("build.copyName")}
          </button>
        </div>
      )}
    </div>
  );
}
