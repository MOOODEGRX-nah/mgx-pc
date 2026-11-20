import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "drawer" slides in from the inline-end edge; "modal" is centered. */
  variant?: "drawer" | "modal";
}

/**
 * Accessible overlay built on the native <dialog> element: showModal() makes the
 * rest of the page inert (focus stays inside), Esc and a backdrop click close it.
 */
export function Sheet({ open, onClose, title, children, footer, variant = "drawer" }: SheetProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close when the component unmounts while open (e.g. route change).
  useEffect(() => () => ref.current?.close(), []);

  return (
    <dialog
      ref={ref}
      className={variant === "drawer" ? "sheet-drawer" : "sheet-modal"}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
            <h2 className="font-display text-lg font-bold text-[var(--color-ink)]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid h-10 w-10 place-items-center rounded-lg text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="border-t border-[var(--color-line)] px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
