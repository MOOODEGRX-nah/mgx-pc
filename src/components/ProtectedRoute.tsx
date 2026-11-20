import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/** Owner-only area: needs a session AND an entry in the `admins` table (is_admin()). */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin, adminLoading, signOut } = useAuth();
  const { t } = useTranslation();

  if (loading || adminLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-ink-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md animate-fade-up flex-col items-center px-4 py-24 text-center">
        <ShieldAlert size={40} className="mb-4 text-[var(--color-red)]" />
        <h1 className="font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">{t("admin.noAccessTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{t("admin.noAccessBody")}</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          <LogOut size={14} className="rtl:-scale-x-100" /> {t("admin.logout")}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
