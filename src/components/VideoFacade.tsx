import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { pickLang } from "../lib/i18nData";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "../lib/youtube";
import type { BuildVideo } from "../types";

/**
 * Click-to-load YouTube player: shows a thumbnail and only creates the iframe
 * (youtube-nocookie.com) after the visitor presses play.
 */
export function VideoFacade({ video }: { video: BuildVideo }) {
  const { t, i18n } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const ownTitle = pickLang(video, "title", i18n.language);
  const title = ownTitle || video.game || t("videos.untitled");
  // When the game is already used as the title, do not repeat it in the details line.
  const details = [ownTitle ? video.game : null, video.resolution, video.settings].filter(Boolean).join(" · ");

  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(video.youtube_id, video.start_seconds, { autoplay: true })}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={t("videos.play", { title })}
            className="group absolute inset-0 grid place-items-center"
          >
            <img
              src={youtubeThumbnailUrl(video.youtube_id)}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition-[opacity,transform] duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
            />
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[var(--color-red)] text-white shadow-[0_0_30px_rgba(225,6,0,0.5)] transition-transform duration-300 group-hover:scale-110">
              <Play size={22} className="ms-0.5 fill-current" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="flex flex-wrap items-start justify-between gap-2 p-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--color-ink)]">{title}</span>
          {details && <span dir="auto" className="block text-xs text-[var(--color-ink-muted)]">{details}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {video.approx_fps && (
            <span className="rounded-full border border-[var(--color-red-dim)] bg-[var(--color-red-dim)]/20 px-2.5 py-0.5 text-xs font-bold text-[var(--color-ink)]">
              <bdi>{t("videos.fps", { n: video.approx_fps })}</bdi>
            </span>
          )}
          <a href={youtubeWatchUrl(video.youtube_id, video.start_seconds)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-red)]">
            {t("videos.openYoutube")}
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
