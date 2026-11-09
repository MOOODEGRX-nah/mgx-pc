import { supabase } from "./supabase";
import { toAppError } from "./errors";
import { byNumberThenText, toComponent, toNum, toOffers, toVideo } from "./rows";
import type {
  Build, BuildFull, BuildItemWithComponent, BuildVideo, BuildWithSummary,
  Category, PriceSummary,
} from "../types";

type Row = Record<string, unknown>;

function toBuild(row: Row): Build {
  return { ...(row as unknown as Build), is_published: row.is_published !== false };
}

function toSummary(row: Row): PriceSummary {
  return {
    build_id: String(row.build_id),
    total_best: toNum(row.total_best) ?? 0,
    items_count: toNum(row.items_count) ?? 0,
    priced_count: toNum(row.priced_count) ?? 0,
    accessories_total_best: toNum(row.accessories_total_best) ?? 0,
    last_price_update: (row.last_price_update as string | null) ?? null,
  };
}

// ---------- Read ----------

/** Builds (newest first) with their price summary from the build_price_summary view. */
export async function fetchBuildsWithSummary(category?: Category): Promise<BuildWithSummary[]> {
  let buildsQuery = supabase.from("builds").select("*").order("created_at", { ascending: false });
  if (category) buildsQuery = buildsQuery.eq("category", category);

  const [buildsRes, summaryRes] = await Promise.all([
    buildsQuery,
    supabase.from("build_price_summary").select("*"),
  ]);
  if (buildsRes.error) throw toAppError(buildsRes.error);
  if (summaryRes.error) throw toAppError(summaryRes.error);

  const summaries = new Map<string, PriceSummary>();
  for (const row of summaryRes.data ?? []) {
    const s = toSummary(row as Row);
    summaries.set(s.build_id, s);
  }
  return (buildsRes.data ?? []).map((row) => {
    const build = toBuild(row as Row);
    return { ...build, summary: summaries.get(build.id) ?? null };
  });
}

function toBuildItem(row: Row): BuildItemWithComponent | null {
  const comp = row.components as Row | null | undefined;
  // Inactive components are hidden from visitors by RLS → the embed is null.
  if (!comp) return null;
  return {
    id: String(row.id),
    build_id: String(row.build_id),
    component_id: String(row.component_id),
    quantity: toNum(row.quantity) ?? 1,
    sort_order: toNum(row.sort_order) ?? 0,
    component: toComponent(comp),
    offers: toOffers(comp.component_offers),
  };
}

/** One request: build + items (component + offers) + videos. */
export async function fetchBuildFull(id: string): Promise<BuildFull | null> {
  const { data, error } = await supabase
    .from("builds")
    .select("*, build_items(*, components(*, component_offers(*))), build_videos(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;

  const row = data as Row;
  const items = (Array.isArray(row.build_items) ? row.build_items : [])
    .map((r) => toBuildItem(r as Row))
    .filter((i): i is BuildItemWithComponent => i !== null)
    .sort(byNumberThenText((i) => i.sort_order, (i) => i.component.name));
  const videos = (Array.isArray(row.build_videos) ? row.build_videos : [])
    .map((r) => toVideo(r as Row))
    .sort(byNumberThenText((v) => v.sort_order, (v) => v.created_at));

  const rest = { ...row };
  delete rest.build_items;
  delete rest.build_videos;
  return { ...toBuild(rest), items, videos };
}

// ---------- Build items ----------

export interface BuildItemInput {
  component_id: string;
  quantity: number;
  sort_order?: number;
}

/**
 * Replaces a build's items with `items` using a diff: rows no longer present
 * are deleted, the rest are upserted on (build_id, component_id).
 */
export async function saveBuildItems(buildId: string, items: BuildItemInput[]): Promise<void> {
  // last entry wins if a component appears twice
  const unique = [...new Map(items.map((i) => [i.component_id, i])).values()];
  const seen = new Set(unique.map((i) => i.component_id));
  const rows = unique.map((i, index) => ({
    build_id: buildId,
    component_id: i.component_id,
    quantity: Math.min(8, Math.max(1, Math.round(i.quantity))),
    sort_order: i.sort_order ?? index,
  }));

  const { data: existing, error: readError } = await supabase
    .from("build_items")
    .select("id, component_id")
    .eq("build_id", buildId);
  if (readError) throw toAppError(readError);

  const removeIds = (existing ?? [])
    .filter((e) => !seen.has(String(e.component_id)))
    .map((e) => String(e.id));
  if (removeIds.length > 0) {
    const { error } = await supabase.from("build_items").delete().in("id", removeIds);
    if (error) throw toAppError(error);
  }
  if (rows.length > 0) {
    const { error } = await supabase
      .from("build_items")
      .upsert(rows, { onConflict: "build_id,component_id" });
    if (error) throw toAppError(error);
  }
}

// ---------- Videos ----------

export type VideoInput = Omit<BuildVideo, "id" | "created_at">;

export async function createVideo(input: VideoInput): Promise<BuildVideo> {
  const { data, error } = await supabase.from("build_videos").insert(input).select().single();
  if (error) throw toAppError(error);
  return toVideo(data);
}

export async function updateVideo(id: string, patch: Partial<VideoInput>): Promise<BuildVideo> {
  const { data, error } = await supabase.from("build_videos").update(patch).eq("id", id).select().single();
  if (error) throw toAppError(error);
  return toVideo(data);
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase.from("build_videos").delete().eq("id", id);
  if (error) throw toAppError(error);
}

/** Persists a new order (index in `ids` becomes sort_order). */
export async function reorderVideos(ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, index) => supabase.from("build_videos").update({ sort_order: index }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw toAppError(failed.error);
}
