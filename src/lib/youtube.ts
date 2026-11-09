/*
 * YouTube link parsing for build performance videos.
 * Only the 11-character video id and a start time are kept; iframes are always
 * built from youtubeEmbedUrl(), never from user-supplied URLs.
 */

export interface YouTubeRef {
  id: string;
  start?: number;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtube-nocookie.com", "www.youtube-nocookie.com",
  "youtu.be", "www.youtu.be",
]);

export function isYouTubeId(id: string): boolean {
  return ID_RE.test(id);
}

/** Parses "90", "90s", "1m30s", "1h2m3s" into seconds. */
function parseTime(value: string | null): number | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (/^\d+s?$/.test(v)) return parseInt(v, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

/**
 * Accepts youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID
 * (optionally with t= / start=). Returns null for anything else.
 */
export function parseYouTube(input: string): YouTubeRef | null {
  let raw = input.trim();
  if (raw === "") return null;
  if (!/^https?:\/\//i.test(raw)) {
    if (!/^(www\.|m\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i.test(raw)) return null;
    raw = `https://${raw}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  if (host.endsWith("youtu.be")) {
    if (segments.length === 1) id = segments[0];
  } else if (segments.length === 1 && segments[0] === "watch") {
    id = url.searchParams.get("v") ?? undefined;
  } else if (segments.length === 2 && ["shorts", "embed"].includes(segments[0])) {
    id = segments[1];
  }
  if (!id || !isYouTubeId(id)) return null;

  const start = parseTime(url.searchParams.get("t")) ?? parseTime(url.searchParams.get("start"));
  return start && start > 0 ? { id, start } : { id };
}

/** Privacy-enhanced embed URL. Throws on an invalid id (defensive; ids come from the DB check constraint). */
export function youtubeEmbedUrl(id: string, start?: number | null): string {
  if (!isYouTubeId(id)) throw new Error("invalid YouTube id");
  const s = start && start > 0 ? Math.floor(start) : 0;
  return `https://www.youtube-nocookie.com/embed/${id}?start=${s}&rel=0`;
}

/** Static thumbnail for the click-to-load facade. */
export function youtubeThumbnailUrl(id: string): string {
  if (!isYouTubeId(id)) throw new Error("invalid YouTube id");
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Canonical watch URL (for "open on YouTube" links and copy). */
export function youtubeWatchUrl(id: string, start?: number | null): string {
  if (!isYouTubeId(id)) throw new Error("invalid YouTube id");
  return start && start > 0 ? `https://www.youtube.com/watch?v=${id}&t=${Math.floor(start)}s` : `https://www.youtube.com/watch?v=${id}`;
}
