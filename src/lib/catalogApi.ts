import { supabase } from "./supabase";
import { AppError, toAppError } from "./errors";
import { cleanUrl, isHttpUrl } from "./url";
import { normalizeSpecs } from "./specSchema";
import { embeddedCount, toComponent, toOffer, toOffers } from "./rows";
import type {
  Component, ComponentOffer, ComponentType, ComponentWithOffers,
} from "../types";

// ---------- Components ----------

export interface ComponentQuery {
  type?: ComponentType | ComponentType[];
  /** Case-insensitive match on name, Arabic name or brand. */
  search?: string;
  /** Admin only: include inactive components (RLS hides them from visitors anyway). */
  includeInactive?: boolean;
  /** Admin only: also count how many builds use each component. */
  withUsage?: boolean;
}

/** Quotes a value for a PostgREST `or=(…)` filter. */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Escapes LIKE wildcards so the search term is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function fetchComponents(query: ComponentQuery = {}): Promise<ComponentWithOffers[]> {
  const select: string = query.withUsage ? "*, component_offers(*), build_items(count)" : "*, component_offers(*)";
  let q = supabase.from("components").select(select).order("type").order("name");

  if (query.type) {
    q = Array.isArray(query.type) ? q.in("type", query.type) : q.eq("type", query.type);
  }
  if (!query.includeInactive) q = q.eq("is_active", true);

  const term = query.search?.trim();
  if (term) {
    const pattern = quoteFilterValue(`%${escapeLike(term)}%`);
    q = q.or(`name.ilike.${pattern},name_ar.ilike.${pattern},brand.ilike.${pattern}`);
  }

  const { data, error } = await q;
  if (error) throw toAppError(error);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    ...toComponent(row),
    offers: toOffers(row.component_offers),
    ...(query.withUsage ? { used_in_builds: embeddedCount(row.build_items) } : {}),
  }));
}

export async function fetchComponentWithOffers(id: string): Promise<ComponentWithOffers | null> {
  const { data, error } = await supabase
    .from("components")
    .select("*, component_offers(*), build_items(count)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...toComponent(row),
    offers: toOffers(row.component_offers),
    used_in_builds: embeddedCount(row.build_items),
  };
}

export type ComponentInput = Pick<Component, "type" | "name"> &
  Partial<Pick<Component, "name_ar" | "brand" | "image_url" | "specs" | "perf_tier" | "is_active">>;

function cleanComponentInput<T extends Partial<ComponentInput>>(input: T, type: ComponentType | undefined): T {
  const out: Record<string, unknown> = { ...input };
  if (typeof input.name === "string") out.name = input.name.trim();
  if ("name_ar" in input) out.name_ar = input.name_ar?.trim() || null;
  if ("brand" in input) out.brand = input.brand?.trim() || null;
  if ("specs" in input && type) out.specs = normalizeSpecs(type, input.specs);
  if ("perf_tier" in input && type && type !== "cpu" && type !== "gpu") out.perf_tier = null;
  return out as T;
}

function mapWriteError(err: unknown): AppError {
  const e = err as { code?: string };
  if (e?.code === "23505") return new AppError("duplicate_component", {}, err);
  return toAppError(err);
}

export async function createComponent(input: ComponentInput): Promise<Component> {
  const { data, error } = await supabase
    .from("components")
    .insert(cleanComponentInput(input, input.type))
    .select()
    .single();
  if (error) throw mapWriteError(error);
  return toComponent(data);
}

export async function updateComponent(id: string, patch: Partial<ComponentInput>): Promise<Component> {
  let type = patch.type;
  if (!type && ("specs" in patch || "perf_tier" in patch)) {
    const { data, error } = await supabase.from("components").select("type").eq("id", id).single();
    if (error) throw toAppError(error);
    type = (data as { type: ComponentType }).type;
  }
  const { data, error } = await supabase
    .from("components")
    .update(cleanComponentInput(patch, type))
    .eq("id", id)
    .select()
    .single();
  if (error) throw mapWriteError(error);
  return toComponent(data);
}

/** Number of builds that include the component. */
export async function countBuildsUsingComponent(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("build_items")
    .select("id", { count: "exact", head: true })
    .eq("component_id", id);
  if (error) throw toAppError(error);
  return count ?? 0;
}

/**
 * Deletes a component. Components used in builds are protected by the
 * foreign key (on delete restrict); that case becomes
 * AppError("component_in_use", { count }).
 */
export async function deleteComponent(id: string): Promise<void> {
  const { error } = await supabase.from("components").delete().eq("id", id);
  if (!error) return;
  if (error.code === "23503") {
    const count = await countBuildsUsingComponent(id).catch(() => 0);
    throw new AppError("component_in_use", { count }, error);
  }
  throw toAppError(error);
}

/**
 * Copies a component's fields under a new name. Offers are not copied:
 * store URLs point at one specific product.
 */
export async function duplicateComponent(source: ComponentWithOffers, newName: string): Promise<Component> {
  return createComponent({
    type: source.type,
    name: newName,
    name_ar: source.name_ar,
    brand: source.brand,
    image_url: source.image_url,
    specs: source.specs,
    perf_tier: source.perf_tier,
    is_active: source.is_active,
  });
}

// ---------- Offers ----------

export type OfferInput = Partial<Pick<ComponentOffer, "store_id" | "url" | "price" | "currency" | "in_stock" | "price_updated_at">> & {
  id?: string;
  component_id: string;
};

/**
 * Inserts (no id) or updates (with id) a store offer.
 * URLs must be http(s). Setting a price stamps price_updated_at = now
 * unless the caller passes price_updated_at explicitly.
 */
export async function upsertOffer(input: OfferInput): Promise<ComponentOffer> {
  const row: Record<string, unknown> = { ...input };
  delete row.id;

  if ("url" in input) {
    const url = cleanUrl(input.url);
    if (url !== null && !isHttpUrl(url)) throw new AppError("invalid_url");
    row.url = url;
  }
  if ("price" in input) {
    const price = input.price;
    if (price !== null && price !== undefined && (!Number.isFinite(price) || price < 0)) {
      throw new AppError("generic");
    }
    if (!("price_updated_at" in input)) {
      row.price_updated_at = price === null || price === undefined ? null : new Date().toISOString();
    }
    row.price_source = "manual";
  }

  const query = input.id
    ? supabase.from("component_offers").update(row).eq("id", input.id)
    : supabase.from("component_offers").insert(row);
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === "23505") throw new AppError("duplicate_offer_url", {}, error);
    throw toAppError(error);
  }
  return toOffer(data);
}

export async function deleteOffer(id: string): Promise<void> {
  const { error } = await supabase.from("component_offers").delete().eq("id", id);
  if (error) throw toAppError(error);
}

/** "Price confirmed today": marks the current price as checked now. */
export async function touchOfferPrice(id: string): Promise<ComponentOffer> {
  const { data, error } = await supabase
    .from("component_offers")
    .update({ price_updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw toAppError(error);
  return toOffer(data);
}
