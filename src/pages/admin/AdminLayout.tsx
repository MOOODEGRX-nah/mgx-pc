import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const TABS = [
  { to: "builds", key: "builds" },
  { to: "components", key: "components" },
  { to: "prices", key: "prices" },
  { to: "stores", key: "stores" },
  { to: "settings", key: "settings" },
] as const;

/** Owner area shell: title, sign out, tab navigation and the active tab's page. */
export function AdminLayout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-[var(--font-display)] text-2xl font-black text-[var(--color-ink)]">{t("admin.dashboard")}</h1>
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-red)]"
        >
          <LogOut size={14} className="rtl:-scale-x-100" />
          {t("admin.logout")}
        </button>
      </div>

      <nav aria-label={t("admin.dashboard")} className="mb-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-[var(--color-line)]">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm transition-colors ${
                  isActive
                    ? "border-[var(--color-red)] text-[var(--color-ink)]"
                    : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`
              }
            >
              {t(`admin.nav.${tab.key}`)}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
