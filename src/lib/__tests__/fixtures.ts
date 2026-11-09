import type { Component, ComponentOffer, ComponentSpecs, ComponentType, ItemWithComponent } from "../../types";

let seq = 0;

export function offer(partial: Partial<ComponentOffer> = {}): ComponentOffer {
  seq++;
  return {
    id: `offer-${seq}`,
    component_id: "c",
    store_id: null,
    url: `https://example.com/${seq}`,
    price: null,
    currency: "SAR",
    in_stock: null,
    price_source: "manual",
    price_updated_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

export function component(type: ComponentType, specs: ComponentSpecs = {}, name = `${type}-${++seq}`): Component {
  return {
    id: `comp-${name}`,
    type,
    name,
    name_ar: null,
    brand: null,
    image_url: null,
    specs,
    perf_tier: null,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

export function item(type: ComponentType, opts: { specs?: ComponentSpecs; offers?: ComponentOffer[]; quantity?: number; name?: string } = {}): ItemWithComponent {
  const c = component(type, opts.specs, opts.name);
  return { component_id: c.id, component: c, quantity: opts.quantity ?? 1, offers: opts.offers ?? [] };
}
