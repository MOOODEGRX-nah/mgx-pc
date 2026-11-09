import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  }

  return (
    <header
      className={[
        "sticky top-0 z-30 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-[var(--color-line)] bg-[var(--color-bg)]/85 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)]"
          : "border-transparent bg-[var(--color-bg)]/60",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-baseline gap-0.5 group">
          <span className="font-[var(--font-display)] text-xl font-black tracking-tight text-[var(--color-ink)] transition-colors group-hover:text-white">
            MGX
          </span>
          <span className="font-[var(--font-display)] text-xl font-black tracking-tight text-[var(--color-red)] drop-shadow-[0_0_8px_rgba(225,6,0,0.6)] transition-[filter] duration-300 group-hover:drop-shadow-[0_0_14px_rgba(255,43,31,0.9)]">
            (PC)
          </span>
        </Link>

        {/* Nav actions */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-95"
          >
            <span className="text-[10px] font-mono font-bold tracking-widest">
              {t("common.language")}
            </span>
          </button>
          {/* Admin link */}
          <Link
            to={session ? "/admin" : "/admin/login"}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-95"
          >
            {t("nav.admin")}
          </Link>
        </div>
      </div>
    </header>
  );
}
