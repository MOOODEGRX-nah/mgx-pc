import { STORAGE_TYPES, slotOfType, type ComponentType, type CoreSlot } from "../types";

/** Order of slots on public pages (matches the order builds were shown in before the catalog). */
export const DISPLAY_SLOTS: (CoreSlot | "accessory")[] = [
  "case", "motherboard", "cpu", "cpu_cooler", "gpu", "ram", "storage", "psu", "accessory",
];

const typeRank = (type: ComponentType) => (STORAGE_TYPES.includes(type) ? STORAGE_TYPES.indexOf(type) : 0);

export interface SlotGroup<T> {
  slot: CoreSlot | "accessory";
  items: T[];
}

/**
 * Groups items by slot in DISPLAY_SLOTS order. Inside a slot: storage by drive type
 * (NVMe, SATA, 2.5", 3.5"), then sort_order, then name. Empty slots are omitted.
 */
export function groupItemsBySlot<T extends { sort_order?: number; component: { type: ComponentType; name: string } }>(
  items: T[],
): SlotGroup<T>[] {
  return DISPLAY_SLOTS.map((slot) => ({
    slot,
    items: items
      .filter((i) => slotOfType(i.component.type) === slot)
      .sort((a, b) =>
        typeRank(a.component.type) - typeRank(b.component.type) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.component.name.localeCompare(b.component.name)),
  })).filter((g) => g.items.length > 0);
}

export interface ItemRef {
  component_id: string;
  quantity: number;
}

export interface ItemsDiff {
  /** Existing row ids to delete. */
  remove: string[];
  /** Rows to insert or update (keyed by component id), with their final order. */
  upsert: { component_id: string; quantity: number; sort_order: number }[];
}

/**
 * Computes how to turn the stored items into `next`. Duplicate component ids in
 * `next` collapse into one (the last wins); quantities are clamped to 1–8.
 */
export function diffBuildItems(existing: { id: string; component_id: string }[], next: ItemRef[]): ItemsDiff {
  const unique = [...new Map(next.map((i) => [i.component_id, i])).values()];
  const keep = new Set(unique.map((i) => i.component_id));
  return {
    remove: existing.filter((e) => !keep.has(e.component_id)).map((e) => e.id),
    upsert: unique.map((i, index) => ({
      component_id: i.component_id,
      quantity: Math.min(8, Math.max(1, Math.round(i.quantity) || 1)),
      sort_order: index,
    })),
  };
}
