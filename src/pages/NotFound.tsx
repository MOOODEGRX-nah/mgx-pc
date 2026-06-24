import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cpu } from "lucide-react";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Cpu size={56} className="text-[var(--color-red)] drop-shadow-[0_0_16px_rgba(225,6,0,0.4)]" />
      <p className="font-mono text-6xl font-black text-[var(--color-red)]">404</p>
      <p className="text-sm text-[var(--color-ink-muted)]">الصفحة غير موجودة</p>
      <Link
        to="/"
        className="mt-2 rounded-lg border border-[var(--color-red)] px-5 py-2 text-sm font-medium text-[var(--color-red)] transition-all hover:bg-[var(--color-red)] hover:text-white active:scale-95"
      >
        {t("build.back")}
      </Link>
    </div>
  );
}
