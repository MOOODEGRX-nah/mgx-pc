import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { to: "/", key: "home", end: true },
  { to: "/advisor", key: "advisor", end: false },
  { to: "/builder", key: "builder", end: false },
] as const;

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { session, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Close the mobile menu whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) { setLastPath(pathname); setMenuOpen(false); }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleLanguage() {
    // Changing the language never resets page state (no navigation, no remount).
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-10 items-center rounded-md px-3 text-sm transition-colors ${
      isActive ? "text-[var(--color-ink)] bg-[var(--color-surface-2)]" : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
    }`;
  const chipCls = "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-red)] hover:text-[var(--color-ink)] active:scale-95";

  return (
    <header
      className={[
        "sticky top-0 z-30 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 print:hidden",
        scrolled || menuOpen
          ? "border-[var(--color-line)] bg-[var(--color-bg)]/90 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)]"
          : "border-transparent bg-[var(--color-bg)]/60",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link to="/" className="group flex items-baseline gap-0.5">
          <span className="font-display text-xl font-black tracking-tight text-[var(--color-ink)] transition-colors group-hover:text-white">
            MGX
          </span>
          <span className="font-display text-xl font-black tracking-tight text-[var(--color-red)] drop-shadow-[0_0_8px_rgba(225,6,0,0.6)] transition-[filter] duration-300 group-hover:drop-shadow-[0_0_14px_rgba(255,43,31,0.9)]">
            (PC)
          </span>
        </Link>

        {/* Desktop links */}
        <nav aria-label={t("nav.main")} className="hidden flex-1 items-center gap-1 ps-4 md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{t(`nav.${l.key}`)}</NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleLanguage} className={chipCls} aria-label={`${t("common.language")} — ${t("nav.switchLanguage")}`}>
            <span className="font-mono text-[10px] font-bold tracking-widest">{t("common.language")}</span>
          </button>
          <Link to={session && isAdmin ? "/admin" : "/admin/login"} className={`${chipCls} hidden sm:inline-flex`}>
            {session && isAdmin ? t("nav.dashboard") : t("nav.admin")}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            className="grid h-10 w-10 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-muted)] md:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav id="mobile-menu" aria-label={t("nav.main")} className="animate-fade-in border-t border-[var(--color-line)] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{t(`nav.${l.key}`)}</NavLink>
            ))}
            <NavLink to={session && isAdmin ? "/admin" : "/admin/login"} className={linkCls}>
              {session && isAdmin ? t("nav.dashboard") : t("nav.admin")}
            </NavLink>
          </div>
        </nav>
      )}
    </header>
  );
}
