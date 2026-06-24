import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-baseline gap-0.5 group">
          <span className="font-[var(--font-display)] text-xl font-black tracking-tight text-[var(--color-ink)] transition-colors group-hover:text-white">
            MGX
          </span>
          <span className="font-[var(--font-display)] text-xl font-black tracking-tight text-[var(--color-red)] drop-shadow-[0_0_8px_rgba(225,6,0,0.6)]">
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
