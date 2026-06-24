import type { Store } from "../types";

export function StoreBadge({ store }: { store: Store | null | undefined }) {
  if (!store) return null;

  if (store.logo_url) {
    return (
      <img
        src={store.logo_url}
        alt={store.name}
        className="h-5 w-auto max-w-[88px] object-contain"
      />
    );
  }

  return (
    <span className="rounded border border-[var(--color-line)] px-2 py-0.5 font-mono text-xs text-[var(--color-ink-muted)]">
      {store.name}
    </span>
  );
}
