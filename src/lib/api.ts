import { supabase } from "./supabase";
import type { Build, Store } from "../types";

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

export type NewBuild = Omit<Build, "id" | "created_at" | "is_published"> & {
  is_published?: boolean;
};

export async function createBuild(build: NewBuild) {
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
