import type {
  BuildVideo, Component, ComponentOffer, ComponentSpecs, PerfTier,
} from "../types";

/*
 * Row normalizers for data coming back from PostgREST. Numeric columns can
 * arrive as strings, jsonb can be null, embedded relations can be missing;
 * these functions give the rest of the app a predictable shape.
 */

type Row = Record<string, unknown>;

export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toOffer(row: Row): ComponentOffer {
  return {
    id: String(row.id),
    component_id: String(row.component_id),
    store_id: (row.store_id as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    price: toNum(row.price),
    currency: (row.currency as string) ?? "SAR",
    in_stock: typeof row.in_stock === "boolean" ? row.in_stock : null,
    price_source: (row.price_source as ComponentOffer["price_source"]) ?? "manual",
    price_updated_at: (row.price_updated_at as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
  };
}

export function toComponent(row: Row): Component {
  const tier = toNum(row.perf_tier);
  const specs = row.specs && typeof row.specs === "object" && !Array.isArray(row.specs)
    ? (row.specs as ComponentSpecs)
    : {};
  return {
    id: String(row.id),
    type: row.type as Component["type"],
    name: String(row.name ?? ""),
    name_ar: (row.name_ar as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    specs,
    perf_tier: tier !== null && tier >= 1 && tier <= 5 ? (tier as PerfTier) : null,
    is_active: row.is_active !== false,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function toOffers(value: unknown): ComponentOffer[] {
  return Array.isArray(value) ? value.map((r) => toOffer(r as Row)) : [];
}

/** Reads an embedded `relation(count)` result: [{ count: n }]. */
export function embeddedCount(value: unknown): number {
  if (Array.isArray(value) && value.length > 0) return toNum((value[0] as Row).count) ?? 0;
  return 0;
}

export function toVideo(row: Row): BuildVideo {
  return {
    id: String(row.id),
    build_id: String(row.build_id),
    youtube_id: String(row.youtube_id),
    start_seconds: toNum(row.start_seconds),
    title_ar: (row.title_ar as string | null) ?? null,
    title_en: (row.title_en as string | null) ?? null,
    game: (row.game as string | null) ?? null,
    resolution: (row.resolution as string | null) ?? null,
    settings: (row.settings as string | null) ?? null,
    approx_fps: toNum(row.approx_fps),
    sort_order: toNum(row.sort_order) ?? 0,
    created_at: String(row.created_at ?? ""),
  };
}

export const byNumberThenText = <T>(num: (x: T) => number, text: (x: T) => string) =>
  (a: T, b: T) => num(a) - num(b) || text(a).localeCompare(text(b));
