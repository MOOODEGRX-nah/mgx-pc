import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cpu, Minus, Plus, RefreshCw, X } from "lucide-react";
import { ComponentPicker } from "./ComponentPicker";
import { formatMoney } from "../lib/format";
import { pickLang } from "../lib/i18nData";
import { bestOffer } from "../lib/pricing";
import {
  CORE_SLOTS, MULTI_ITEM_SLOTS, SLOT_TYPES, slotOfType,
  type ComponentType, type ComponentWithOffers, type CoreSlot, type ItemWithComponent,
} from "../types";

type Slot = CoreSlot | "accessory";
const typesOf = (slot: Slot): ComponentType[] => (slot === "accessory" ? ["accessory"] : SLOT_TYPES[slot]);
const isMulti = (slot: Slot) => slot === "accessory" || MULTI_ITEM_SLOTS.includes(slot as CoreSlot);

interface BuildSlotsProps {
  catalog: ComponentWithOffers[];
  value: ItemWithComponent[];
  onChange: (next: ItemWithComponent[]) => void;
  showAccessories?: boolean;
}

interface PickerState {
  slot: Slot;
  /** Item being replaced (single-item slots). */
  replaceId?: string;
}

/** Core slots + accessories. RAM, storage and accessories accept several items with a quantity. */
export function BuildSlots({ catalog, value, onChange, showAccessories = true }: BuildSlotsProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [picker, setPicker] = useState<PickerState | null>(null);
  const slots: Slot[] = showAccessories ? [...CORE_SLOTS, "accessory"] : [...CORE_SLOTS];

  function pick(c: ComponentWithOffers) {
    if (!picker) return;
    const item: ItemWithComponent = { component_id: c.id, quantity: 1, component: c, offers: c.offers };
    if (isMulti(picker.slot)) {
      onChange([...value, item]);
    } else {
      // single slot: replace whatever is in it
      const others = value.filter((i) => slotOfType(i.component.type) !== picker.slot);
      onChange([...others, item]);
    }
    setPicker(null);
  }

  const setQty = (id: string, quantity: number) =>
    onChange(value.map((i) => (i.component_id === id ? { ...i, quantity: Math.min(8, Math.max(1, quantity)) } : i)));
  const remove = (id: string) => onChange(value.filter((i) => i.component_id !== id));

  function itemCard(item: ItemWithComponent, slot: Slot) {
    const best = bestOffer(item.offers);
    const multi = isMulti(slot);
    return (
      <div key={item.component_id} className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2 animate-scale-in">
        <span className="grid h-11 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--color-surface-3)]">
          {item.component.image_url
            ? <img src={item.component.image_url} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
            : <Cpu size={15} className="text-[var(--color-ink-faint)]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span dir="ltr" className="block truncate text-start text-sm text-[var(--color-ink)] rtl:text-right">{pickLang(item.component, "name", lang)}</span>
          <span className="text-[11px] text-[var(--color-ink-faint)]">
            {best?.price != null ? <bdi>{formatMoney(best.price, lang)}</bdi> : t("price.none")}
            {slot === "storage" && <> · {t(`partTypes.${item.component.type}`)}</>}
          </span>
        </span>
        {multi && (
          <span className="flex shrink-0 items-center rounded-lg border border-[var(--color-line)]" role="group" aria-label={t("builder.quantity")}>
            <button type="button" onClick={() => setQty(item.component_id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={t("builder.decrease")} className="grid h-9 w-8 place-items-center text-[var(--color-ink-muted)] disabled:opacity-30"><Minus size={13} /></button>
            <span dir="ltr" className="w-6 text-center text-sm tabular-nums text-[var(--color-ink)]" aria-live="polite">{item.quantity}</span>
            <button type="button" onClick={() => setQty(item.component_id, item.quantity + 1)} disabled={item.quantity >= 8} aria-label={t("builder.increase")} className="grid h-9 w-8 place-items-center text-[var(--color-ink-muted)] disabled:opacity-30"><Plus size={13} /></button>
          </span>
        )}
        {!multi && (
          <button type="button" onClick={() => setPicker({ slot, replaceId: item.component_id })} aria-label={t("builder.change")} title={t("builder.change")} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-ink)]">
            <RefreshCw size={14} />
          </button>
        )}
        <button type="button" onClick={() => remove(item.component_id)} aria-label={t("builder.remove")} title={t("builder.remove")} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-red)]">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {slots.map((slot) => {
        const items = value.filter((i) => slotOfType(i.component.type) === slot);
        const canAdd = isMulti(slot) || items.length === 0;
        return (
          <section key={slot} aria-label={t(`slots.${slot}`)}>
            <h3 className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-faint)] rtl:tracking-normal">
              {t(`slots.${slot}`)}
            </h3>
            <div className="flex flex-col gap-1.5">
              {items.map((item) => itemCard(item, slot))}
              {canAdd && (
                <button
                  type="button"
                  onClick={() => setPicker({ slot })}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-line)] text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-red)] hover:text-[var(--color-ink)]"
                >
                  <Plus size={14} /> {items.length > 0 ? t("builder.addAnother") : t("builder.choose", { slot: t(`slots.${slot}`) })}
                </button>
              )}
            </div>
          </section>
        );
      })}

      {picker && (
        <ComponentPicker
          open
          title={t("builder.choose", { slot: t(`slots.${picker.slot}`) })}
          types={typesOf(picker.slot)}
          catalog={catalog}
          current={value.filter((i) => i.component_id !== picker.replaceId)}
          excludeIds={value.map((i) => i.component_id)}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
