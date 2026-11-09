import { supabase } from "./supabase";
import { toAppError } from "./errors";
import { toNum } from "./rows";
import type { AppSettingKey, AppSettings } from "../types";

/** Defaults used when a row is missing (match the seed values in v2_catalog.sql). */
export const DEFAULT_SETTINGS: AppSettings = {
  setup_allowance_sar: 1500,
  price_stale_days: 14,
};

let cache: Promise<AppSettings> | null = null;

async function load(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) throw toAppError(error);
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) {
    const key = row.key as string;
    if (key in DEFAULT_SETTINGS) {
      const n = toNum(row.value);
      if (n !== null && n >= 0) settings[key as AppSettingKey] = n;
    }
  }
  return settings;
}

/** App settings, fetched once per page load. Falls back to defaults on error. */
export function fetchSettings(): Promise<AppSettings> {
  if (!cache) {
    cache = load().catch((err) => {
      cache = null; // retry next time
      console.warn("Failed to load app settings, using defaults", err);
      return { ...DEFAULT_SETTINGS };
    });
  }
  return cache;
}

export async function updateSetting<K extends AppSettingKey>(key: K, value: AppSettings[K]): Promise<void> {
  if (!Number.isFinite(value) || value < 0) throw toAppError(new Error("invalid setting"));
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw toAppError(error);
  cache = null;
}
