import { supabase } from "./supabase";
import { AppError, toAppError } from "./errors";
import { toComponent, toNum, toOffers } from "./rows";
import { createBuild } from "./api";
import type {
  AdvisorAnswers, Build, Category, Lang, UserBuild, UserBuildItemWithComponent,
  UserBuildStatus, UserBuildWithItems,
} from "../types";

type Row = Record<string, unknown>;

// ---------- Public: submit ----------

export interface SubmitUserBuildPayload {
  items: { component_id: string; quantity: number }[];
  label?: string | null;
  lang?: Lang | null;
  answers?: AdvisorAnswers | null;
  /** Honeypot field value; must be empty for real visitors. */
  website?: string | null;
}

/**
 * Sends a visitor build to the admin inbox via the submit_user_build RPC.
 * Returns the inbox row id (null when the honeypot tripped — treat as success).
 * Errors: AppError rate_limited | invalid_items | unknown_component | invalid_answers | generic.
 */
export async function submitUserBuild(payload: SubmitUserBuildPayload): Promise<string | null> {
  const { data, error } = await supabase.rpc("submit_user_build", {
    p_items: payload.items.map((i) => ({ component_id: i.component_id, quantity: i.quantity })),
    p_label: payload.label?.trim() ? payload.label.trim().slice(0, 80) : null,
    p_lang: payload.lang ?? null,
    p_answers: payload.answers ?? null,
    p_website: payload.website ?? null,
  });
  if (error) throw toAppError(error);
  return (data as string | null) ?? null;
}

// ---------- Admin: inbox ----------

const STATUS_ORDER: Record<UserBuildStatus, number> = { new: 0, reviewed: 1, published: 2, archived: 3 };

function toUserBuild(row: Row): UserBuild {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    status: row.status as UserBuildStatus,
    label: (row.label as string | null) ?? null,
    lang: (row.lang as Lang | null) ?? null,
    advisor_answers: (row.advisor_answers as AdvisorAnswers | null) ?? null,
    total_snapshot: toNum(row.total_snapshot),
    priced_count: toNum(row.priced_count),
    items_count: toNum(row.items_count),
    submit_count: toNum(row.submit_count) ?? 1,
    published_build_id: (row.published_build_id as string | null) ?? null,
    first_submitted_at: String(row.first_submitted_at),
    last_submitted_at: String(row.last_submitted_at),
  };
}

function toUserBuildItem(row: Row): UserBuildItemWithComponent | null {
  const comp = row.components as Row | null | undefined;
  if (!comp) return null;
  return {
    user_build_id: String(row.user_build_id),
    component_id: String(row.component_id),
    quantity: toNum(row.quantity) ?? 1,
    component: toComponent(comp),
    offers: toOffers(comp.component_offers),
  };
}

/** Inbox sorted by status (new first), then most recent submission. */
export async function fetchUserBuilds(status?: UserBuildStatus): Promise<UserBuildWithItems[]> {
  let q = supabase
    .from("user_builds")
    .select("*, user_build_items(*, components(*, component_offers(*)))")
    .order("last_submitted_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw toAppError(error);
  return (data ?? [])
    .map((row: Row) => ({
      ...toUserBuild(row),
      items: (Array.isArray(row.user_build_items) ? row.user_build_items : [])
        .map((r) => toUserBuildItem(r as Row))
        .filter((i): i is UserBuildItemWithComponent => i !== null),
    }))
    .sort((a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      b.last_submitted_at.localeCompare(a.last_submitted_at));
}

/** Count for the admin tab badge. */
export async function countNewUserBuilds(): Promise<number> {
  const { count, error } = await supabase
    .from("user_builds")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) throw toAppError(error);
  return count ?? 0;
}

export async function updateUserBuildStatus(id: string, status: UserBuildStatus): Promise<void> {
  const { error } = await supabase.from("user_builds").update({ status }).eq("id", id);
  if (error) throw toAppError(error);
}

export async function deleteUserBuild(id: string): Promise<void> {
  const { error } = await supabase.from("user_builds").delete().eq("id", id);
  if (error) throw toAppError(error);
}

export interface PublishUserBuildInput {
  name_ar: string;
  name_en: string;
  category: Category;
}

/**
 * Creates a published build from a visitor build, copies its items and marks
 * the visitor build as published. If copying items fails the new build is
 * deleted again so no half-empty build is left public.
 */
export async function publishUserBuildAsBuild(userBuildId: string, input: PublishUserBuildInput): Promise<Build> {
  const { data: items, error: itemsError } = await supabase
    .from("user_build_items")
    .select("component_id, quantity")
    .eq("user_build_id", userBuildId);
  if (itemsError) throw toAppError(itemsError);
  if (!items || items.length === 0) throw new AppError("invalid_items");

  const build = await createBuild({
    name_ar: input.name_ar.trim(),
    name_en: input.name_en.trim(),
    category: input.category,
    image_url: null,
    description_ar: null,
    description_en: null,
    console_target: null,
    price_vs_console: null,
    perf_vs_console: null,
    is_published: true,
  });

  const { error: copyError } = await supabase.from("build_items").insert(
    items.map((i, index) => ({
      build_id: build.id,
      component_id: i.component_id,
      quantity: i.quantity,
      sort_order: index,
    })),
  );
  if (copyError) {
    await supabase.from("builds").delete().eq("id", build.id);
    throw toAppError(copyError);
  }

  const { error: statusError } = await supabase
    .from("user_builds")
    .update({ status: "published", published_build_id: build.id })
    .eq("id", userBuildId);
  if (statusError) throw toAppError(statusError);
  return build;
}
