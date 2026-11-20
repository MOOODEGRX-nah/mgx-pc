import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { createVideo, deleteVideo, reorderVideos, updateVideo, type VideoInput } from "../../lib/buildsApi";
import { toAppError } from "../../lib/errors";
import { pickLang } from "../../lib/i18nData";
import { parseYouTube, youtubeThumbnailUrl, youtubeWatchUrl } from "../../lib/youtube";
import type { BuildVideo } from "../../types";
import { btnGhost, btnPrimary, hintCls, inputCls, labelCls } from "./ui";

interface Draft {
  id?: string;
  url: string;
  title_ar: string;
  title_en: string;
  game: string;
  resolution: string;
  settings: string;
  approx_fps: string;
  start: string;
}

const emptyDraft: Draft = { url: "", title_ar: "", title_en: "", game: "", resolution: "", settings: "", approx_fps: "", start: "" };

const toDraft = (v: BuildVideo): Draft => ({
  id: v.id,
  url: youtubeWatchUrl(v.youtube_id, v.start_seconds),
  title_ar: v.title_ar ?? "",
  title_en: v.title_en ?? "",
  game: v.game ?? "",
  resolution: v.resolution ?? "",
  settings: v.settings ?? "",
  approx_fps: v.approx_fps ? String(v.approx_fps) : "",
  start: v.start_seconds ? String(v.start_seconds) : "",
});

interface VideosEditorProps {
  buildId: string;
  videos: BuildVideo[];
  onChange: (videos: BuildVideo[]) => void;
}

/** Performance videos of a build. Changes are saved immediately (separately from the build form). */
export function VideosEditor({ buildId, videos, onChange }: VideosEditorProps) {
  const { t, i18n } = useTranslation();
  const fid = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = draft ? parseYouTube(draft.url) : null;

  const set = (k: keyof Draft, v: string) => { setDraft((d) => (d ? { ...d, [k]: v } : d)); setError(null); };

  async function save() {
    if (!draft) return;
    if (!parsed) { setError(t("videos.invalidUrl")); return; }
    const fps = draft.approx_fps.trim() === "" ? null : Number(draft.approx_fps);
    const start = draft.start.trim() === "" ? parsed.start ?? null : Number(draft.start);
    if (fps !== null && (!Number.isInteger(fps) || fps < 1 || fps > 1000)) { setError(t("videos.invalidFps")); return; }
    if (start !== null && (!Number.isInteger(start) || start < 0)) { setError(t("videos.invalidStart")); return; }
    const input: VideoInput = {
      build_id: buildId,
      youtube_id: parsed.id,
      start_seconds: start,
      title_ar: draft.title_ar.trim() || null,
      title_en: draft.title_en.trim() || null,
      game: draft.game.trim() || null,
      resolution: draft.resolution.trim() || null,
      settings: draft.settings.trim() || null,
      approx_fps: fps,
      sort_order: draft.id ? videos.find((v) => v.id === draft.id)?.sort_order ?? 0 : videos.length,
    };
    setBusy(true); setError(null);
    try {
      const savedVideo = draft.id ? await updateVideo(draft.id, input) : await createVideo(input);
      onChange(draft.id ? videos.map((v) => (v.id === savedVideo.id ? savedVideo : v)) : [...videos, savedVideo]);
      setDraft(null);
    } catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
    finally { setBusy(false); }
  }

  async function remove(v: BuildVideo) {
    if (!confirm(t("videos.confirmDelete"))) return;
    setBusy(true);
    try { await deleteVideo(v.id); onChange(videos.filter((x) => x.id !== v.id)); }
    catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
    finally { setBusy(false); }
  }

  async function move(index: number, delta: number) {
    const next = [...videos];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    const reordered = next.map((v, i) => ({ ...v, sort_order: i }));
    onChange(reordered);
    try { await reorderVideos(reordered.map((v) => v.id)); }
    catch (err) { const e = toAppError(err); setError(t(e.i18nKey, e.params)); }
  }

  const input = (k: keyof Draft, label: string, opts: { dir?: "ltr" | "rtl"; type?: string; placeholder?: string } = {}) => (
    <div>
      <label htmlFor={`${fid}-${k}`} className={labelCls}>{label}</label>
      <input id={`${fid}-${k}`} type={opts.type ?? "text"} dir={opts.dir} placeholder={opts.placeholder} value={draft?.[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={inputCls} />
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {videos.length === 0 && !draft && <p className="text-xs text-[var(--color-ink-faint)]">{t("videos.empty")}</p>}
      {videos.map((v, index) => (
        <div key={v.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <img src={youtubeThumbnailUrl(v.youtube_id)} alt="" loading="lazy" className="h-12 w-20 shrink-0 rounded-md bg-black object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-[var(--color-ink)]">{pickLang(v, "title", i18n.language) || v.game || v.youtube_id}</span>
            <span dir="auto" className="block truncate text-[11px] text-[var(--color-ink-faint)]">
              {[v.game, v.resolution, v.settings, v.approx_fps ? t("videos.fps", { n: v.approx_fps }) : null].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button type="button" disabled={index === 0 || busy} onClick={() => move(index, -1)} aria-label={t("videos.moveUp")} className="grid h-9 w-9 place-items-center rounded-md text-[var(--color-ink-muted)] disabled:opacity-30"><ArrowUp size={14} /></button>
          <button type="button" disabled={index === videos.length - 1 || busy} onClick={() => move(index, 1)} aria-label={t("videos.moveDown")} className="grid h-9 w-9 place-items-center rounded-md text-[var(--color-ink-muted)] disabled:opacity-30"><ArrowDown size={14} /></button>
          <button type="button" disabled={busy} onClick={() => setDraft(toDraft(v))} aria-label={t("admin.edit")} className="grid h-9 w-9 place-items-center rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"><Pencil size={14} /></button>
          <button type="button" disabled={busy} onClick={() => remove(v)} aria-label={t("videos.delete")} className="grid h-9 w-9 place-items-center rounded-md text-[var(--color-ink-muted)] hover:text-[var(--color-red)]"><Trash2 size={14} /></button>
        </div>
      ))}

      {draft ? (
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              {input("url", t("videos.url"), { dir: "ltr", placeholder: "https://youtu.be/…" })}
              <p className={hintCls}>{t("videos.urlHint")}</p>
            </div>
            <div className="grid aspect-video place-items-center overflow-hidden rounded-md bg-black text-[10px] text-[var(--color-ink-faint)]">
              {parsed ? <img src={youtubeThumbnailUrl(parsed.id)} alt={t("videos.preview")} className="h-full w-full object-cover" /> : draft.url ? t("videos.invalidUrl") : t("videos.preview")}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {input("title_ar", t("videos.titleAr"), { dir: "rtl" })}
            {input("title_en", t("videos.titleEn"), { dir: "ltr" })}
            {input("game", t("videos.game"), { dir: "ltr", placeholder: "Cyberpunk 2077" })}
            {input("resolution", t("videos.resolution"), { dir: "ltr", placeholder: "1440p" })}
            {input("settings", t("videos.settings"), { placeholder: t("videos.settingsExample") })}
            <div className="grid grid-cols-2 gap-3">
              {input("approx_fps", t("videos.approxFps"), { dir: "ltr", type: "number" })}
              {input("start", t("videos.start"), { dir: "ltr", type: "number" })}
            </div>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-[var(--color-red-glow)]">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={save} className={btnPrimary}>{busy ? t("admin.saving") : t("admin.save")}</button>
            <button type="button" onClick={() => { setDraft(null); setError(null); }} className={btnGhost}>{t("admin.cancel")}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setDraft({ ...emptyDraft })} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-line)] text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-red)] hover:text-[var(--color-ink)]">
          <Plus size={14} /> {t("videos.add")}
        </button>
      )}
      {!draft && error && <p role="alert" className="text-xs text-[var(--color-red-glow)]">{error}</p>}
    </div>
  );
}
