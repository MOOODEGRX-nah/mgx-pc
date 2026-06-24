import { supabase } from "./supabase";
import type {
  Build,
  BuildWithRelations,
  Category,
  Part,
  Store,
  Tool,
} from "../types";

// ---------- Stores ----------

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Store[];
}

export async function createStore(store: Omit<Store, "id">): Promise<Store> {
  const { data, error } = await supabase
    .from("stores").insert(store).select().single();
  if (error) throw error;
  return data as Store;
}

export async function updateStore(id: string, store: Partial<Omit<Store, "id">>): Promise<Store> {
  const { data, error } = await supabase
    .from("stores").update(store).eq("id", id).select().single();
  if (error) throw error;
  return data as Store;
}

export async function deleteStore(id: string): Promise<void> {
  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Builds ----------

export async function fetchBuilds(category?: Category): Promise<Build[]> {
  let query = supabase
    .from("builds").select("*").order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return data as Build[];
}

export async function fetchBuildById(id: string): Promise<BuildWithRelations | null> {
  const { data: build, error: buildError } = await supabase
    .from("builds").select("*").eq("id", id).maybeSingle();
  if (buildError) throw buildError;
  if (!build) return null;

  const { data: parts, error: partsError } = await supabase
    .from("parts").select("*").eq("build_id", id);
  if (partsError) throw partsError;

  const { data: tools, error: toolsError } = await supabase
    .from("tools").select("*").eq("build_id", id);
  if (toolsError) throw toolsError;

  return { ...(build as Build), parts: parts as Part[], tools: tools as Tool[] };
}

export async function createBuild(build: Omit<Build, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("builds").insert(build).select().single();
  if (error) throw error;
  return data as Build;
}

export async function updateBuild(id: string, build: Partial<Omit<Build, "id" | "created_at">>) {
  const { data, error } = await supabase
    .from("builds").update(build).eq("id", id).select().single();
  if (error) throw error;
  return data as Build;
}

export async function deleteBuild(id: string): Promise<void> {
  const { error } = await supabase.from("builds").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Parts ----------

export async function fetchPartsForBuild(buildId: string): Promise<Part[]> {
  const { data, error } = await supabase
    .from("parts").select("*").eq("build_id", buildId);
  if (error) throw error;
  return data as Part[];
}

export async function createPart(part: Omit<Part, "id">) {
  const { data, error } = await supabase
    .from("parts").insert(part).select().single();
  if (error) throw error;
  return data as Part;
}

export async function updatePart(id: string, part: Partial<Omit<Part, "id">>) {
  const { data, error } = await supabase
    .from("parts").update(part).eq("id", id).select().single();
  if (error) throw error;
  return data as Part;
}

export async function deletePart(id: string): Promise<void> {
  const { error } = await supabase.from("parts").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Tools ----------

export async function fetchToolsForBuild(buildId: string): Promise<Tool[]> {
  const { data, error } = await supabase
    .from("tools").select("*").eq("build_id", buildId);
  if (error) throw error;
  return data as Tool[];
}

export async function createTool(tool: Omit<Tool, "id">) {
  const { data, error } = await supabase
    .from("tools").insert(tool).select().single();
  if (error) throw error;
  return data as Tool;
}

export async function updateTool(id: string, tool: Partial<Omit<Tool, "id">>) {
  const { data, error } = await supabase
    .from("tools").update(tool).eq("id", id).select().single();
  if (error) throw error;
  return data as Tool;
}

export async function deleteTool(id: string): Promise<void> {
  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Storage (images / logos) ----------

export async function uploadImage(
  bucket: "build-images" | "store-logos" | "part-images",
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Upload a blob (for the canvas-generated composite image)
export async function uploadBlob(
  bucket: "build-images" | "part-images",
  blob: Blob,
  ext = "png"
): Promise<string> {
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: `image/${ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
