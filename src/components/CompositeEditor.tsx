import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Layers, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Part } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────
interface Layer {
  id: string;
  partType: string;
  partName: string;
  imageUrl: string;
  x: number; // % of canvas width  (0–100)
  y: number; // % of canvas height (0–100)
  w: number; // % of canvas width  (5–100)
  h: number; // % of canvas height (5–100)
  zIndex: number;
}

type Handle = "nw" | "ne" | "sw" | "se";

interface DragState {
  type: "drag";
  layerId: string;
  startMouseX: number;
  startMouseY: number;
  origX: number;
  origY: number;
}

interface ResizeState {
  type: "resize";
  layerId: string;
  handle: Handle;
  startMouseX: number;
  startMouseY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

type Interaction = DragState | ResizeState;

interface CompositeEditorProps {
  parts: Part[];
  onSave?: (blob: Blob) => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

async function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

const HANDLE_CLS: Record<Handle, string> = {
  nw: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
  ne: "top-0 right-0  translate-x-1/2 -translate-y-1/2 cursor-ne-resize",
  sw: "bottom-0 left-0 -translate-x-1/2  translate-y-1/2 cursor-sw-resize",
  se: "bottom-0 right-0  translate-x-1/2  translate-y-1/2 cursor-se-resize",
};

const HANDLES: Handle[] = ["nw", "ne", "sw", "se"];

// ── Component ──────────────────────────────────────────────────────────────
export function CompositeEditor({ parts, onSave }: CompositeEditorProps) {
  const { t } = useTranslation();
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bg, setBg] = useState("#0a0a0c");
  const [iact, setIact] = useState<Interaction | null>(null);
  const [saving, setSaving] = useState(false);

  const partsWithImages = parts.filter((p) => p.image_url);

  // ── Layer ops ─────────────────────────────────────────────────────────
  function addLayer(part: Part) {
    if (!part.image_url) return;
    const layerId = `${part.id}-${Date.now()}`;
    const imgUrl = part.image_url;
    const pType = part.type;
    const pName = part.part_name;
    setLayers((prev) => {
      const newLayer: Layer = {
        id: layerId,
        partType: pType,
        partName: pName,
        imageUrl: imgUrl,
        x: 25, y: 20, w: 50, h: 60,
        zIndex: prev.length + 1,
      };
      return [...prev, newLayer];
    });
    setSelectedId(layerId);
  }

  function deleteSelected() {
    if (!selectedId) return;
    setLayers((prev) => prev.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  }

  function bringForward() {
    setLayers((prev) => {
      const layer = prev.find((l) => l.id === selectedId);
      if (!layer) return prev;
      return prev.map((l) => {
        if (l.id === selectedId) return { ...l, zIndex: l.zIndex + 1 };
        if (l.zIndex === layer.zIndex + 1) return { ...l, zIndex: l.zIndex - 1 };
        return l;
      });
    });
  }

  function sendBackward() {
    setLayers((prev) => {
      const layer = prev.find((l) => l.id === selectedId);
      if (!layer || layer.zIndex <= 1) return prev;
      return prev.map((l) => {
        if (l.id === selectedId) return { ...l, zIndex: Math.max(1, l.zIndex - 1) };
        if (l.zIndex === layer.zIndex - 1) return { ...l, zIndex: l.zIndex + 1 };
        return l;
      });
    });
  }

  // ── Mouse events ──────────────────────────────────────────────────────
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!iact || !canvasAreaRef.current) return;
      e.preventDefault();
      const rect = canvasAreaRef.current.getBoundingClientRect();
      const dx = ((e.clientX - iact.startMouseX) / rect.width) * 100;
      const dy = ((e.clientY - iact.startMouseY) / rect.height) * 100;

      setLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== iact.layerId) return layer;

          if (iact.type === "drag") {
            return {
              ...layer,
              x: clamp(iact.origX + dx, 0, 100 - layer.w),
              y: clamp(iact.origY + dy, 0, 100 - layer.h),
            };
          }

          // Resize
          let nx = iact.origX, ny = iact.origY;
          let nw = iact.origW, nh = iact.origH;
          const h = iact.handle;

          if (h === "se" || h === "ne") nw = clamp(iact.origW + dx, 5, 100 - iact.origX);
          if (h === "sw" || h === "nw") {
            nx = clamp(iact.origX + dx, 0, iact.origX + iact.origW - 5);
            nw = iact.origX + iact.origW - nx;
          }
          if (h === "sw" || h === "se") nh = clamp(iact.origH + dy, 5, 100 - iact.origY);
          if (h === "nw" || h === "ne") {
            ny = clamp(iact.origY + dy, 0, iact.origY + iact.origH - 5);
            nh = iact.origY + iact.origH - ny;
          }
          return { ...layer, x: nx, y: ny, w: nw, h: nh };
        })
      );
    },
    [iact]
  );

  const onMouseUp = useCallback(() => setIact(null), []);

  function onLayerMouseDown(e: React.MouseEvent, layer: Layer) {
    e.stopPropagation();
    setSelectedId(layer.id);
    setIact({
      type: "drag", layerId: layer.id,
      startMouseX: e.clientX, startMouseY: e.clientY,
      origX: layer.x, origY: layer.y,
    });
  }

  function onHandleMouseDown(e: React.MouseEvent, layer: Layer, handle: Handle) {
    e.stopPropagation();
    e.preventDefault();
    setIact({
      type: "resize", layerId: layer.id, handle,
      startMouseX: e.clientX, startMouseY: e.clientY,
      origX: layer.x, origY: layer.y,
      origW: layer.w, origH: layer.h,
    });
  }

  // Delete key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedId) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      deleteSelected();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]); // eslint-disable-line

  // ── Export ─────────────────────────────────────────────────────────────
  async function exportCanvas(action: "save" | "download") {
    if (layers.length === 0) return;
    setSaving(true);
    try {
      const W = 1200, H = 630;
      const cvs = document.createElement("canvas");
      cvs.width = W; cvs.height = H;
      const ctx = cvs.getContext("2d")!;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
      for (const l of sorted) {
        const img = await loadImg(l.imageUrl);
        if (img) ctx.drawImage(img, l.x / 100 * W, l.y / 100 * H, l.w / 100 * W, l.h / 100 * H);
      }

      if (action === "download") {
        const a = document.createElement("a");
        a.href = cvs.toDataURL("image/png", 0.92);
        a.download = "mgxpc-build.png";
        a.click();
      } else {
        cvs.toBlob(async (blob) => {
          if (blob && onSave) await onSave(blob);
        }, "image/png", 0.92);
      }
    } finally {
      setSaving(false);
    }
  }

  const selected = layers.find((l) => l.id === selectedId);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-line)] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-red)]">
          {t("admin.imageEditor")}
        </span>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
          {/* BG colour */}
          <label className="flex cursor-pointer items-center gap-1 rounded border border-[var(--color-line)] px-1.5 py-1 text-[10px] text-[var(--color-ink-muted)] hover:border-[var(--color-red)]">
            <span>BG</span>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)}
              className="h-4 w-4 cursor-pointer rounded border-0 p-0 bg-transparent" />
          </label>

          {/* Layer order (shown only when a layer is selected) */}
          {selected && (
            <>
              <button onClick={bringForward} title="Bring forward"
                className="rounded border border-[var(--color-line)] px-1.5 py-1 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                ↑
              </button>
              <button onClick={sendBackward} title="Send backward"
                className="rounded border border-[var(--color-line)] px-1.5 py-1 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                ↓
              </button>
              <button onClick={deleteSelected} title="Delete selected"
                className="flex items-center gap-0.5 rounded border border-[var(--color-red-dim)] px-1.5 py-1 text-[10px] text-[var(--color-red)] hover:bg-[var(--color-red-dim)]">
                <Trash2 size={10} />
              </button>
            </>
          )}

          {/* Clear */}
          <button onClick={() => { setLayers([]); setSelectedId(null); }}
            title="Clear canvas"
            className="flex items-center gap-0.5 rounded border border-[var(--color-line)] px-1.5 py-1 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            <RotateCcw size={10} />
          </button>

          {/* Download PNG */}
          <button onClick={() => exportCanvas("download")}
            disabled={layers.length === 0}
            className="flex items-center gap-1 rounded border border-[var(--color-line)] px-2 py-1 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-40">
            <Download size={10} />
            PNG
          </button>

          {/* Save as build image */}
          {onSave && (
            <button onClick={() => exportCanvas("save")}
              disabled={layers.length === 0 || saving}
              className="flex items-center gap-1 rounded bg-[var(--color-red)] px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90 disabled:opacity-50">
              <Save size={10} />
              {saving ? "..." : t("admin.saveCompositeAsMain")}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex gap-2 p-3" style={{ minHeight: "240px" }}>
        {/* Left sidebar: part thumbnails */}
        <div className="flex w-[100px] shrink-0 flex-col gap-1.5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">
            {partsWithImages.length > 0 ? `${partsWithImages.length} parts` : t("admin.noPartImages")}
          </p>
          <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: "300px" }}>
            {partsWithImages.map((part) => (
              <button key={part.id} onClick={() => addLayer(part)}
                title={`Add ${part.part_name}`}
                className="group relative overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] transition-all hover:border-[var(--color-red)]">
                <img src={part.image_url!} alt="" className="h-14 w-full object-contain p-1" />
                <div className="absolute inset-x-0 bottom-0 bg-[var(--color-bg)]/80 px-1 py-0.5">
                  <p className="truncate text-center font-mono text-[7px] uppercase text-[var(--color-ink-faint)]">
                    {part.type}
                  </p>
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus size={14} className="text-[var(--color-red)]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div
          ref={canvasAreaRef}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={() => setSelectedId(null)}
          className="relative flex-1 select-none overflow-hidden rounded-lg"
          style={{
            aspectRatio: "1200/630",
            backgroundColor: bg,
            cursor: iact ? "grabbing" : "default",
          }}
        >
          {/* Placeholder when empty */}
          {layers.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-ink-faint)]">
              <Layers size={28} className="opacity-20" />
              <p className="text-xs">{t("admin.addToCanvas")}</p>
            </div>
          )}

          {/* Layers */}
          {[...layers].sort((a, b) => a.zIndex - b.zIndex).map((layer) => {
            const isSelected = selectedId === layer.id;
            return (
              <div
                key={layer.id}
                style={{
                  position: "absolute",
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: `${layer.w}%`,
                  height: `${layer.h}%`,
                  zIndex: layer.zIndex,
                  outline: isSelected ? "2px solid #e10600" : "1px solid transparent",
                  outlineOffset: "1px",
                  cursor: iact?.layerId === layer.id && iact.type === "drag"
                    ? "grabbing" : "grab",
                }}
                onMouseDown={(e) => onLayerMouseDown(e, layer)}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={layer.imageUrl}
                  alt={layer.partName}
                  draggable={false}
                  className="pointer-events-none h-full w-full object-contain"
                />
                {/* Part label */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[var(--color-bg)]/60 px-1 py-0.5">
                  <p className="truncate text-center font-mono text-[7px] uppercase text-white/60">
                    {layer.partType}
                  </p>
                </div>

                {/* Resize handles */}
                {isSelected &&
                  HANDLES.map((handle) => (
                    <div
                      key={handle}
                      onMouseDown={(e) => onHandleMouseDown(e, layer, handle)}
                      className={[
                        "absolute h-3 w-3 rounded-sm border-2 border-[#e10600] bg-white",
                        HANDLE_CLS[handle],
                      ].join(" ")}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="border-t border-[var(--color-line)] px-3 py-1.5">
        <p className="font-mono text-[9px] text-[var(--color-ink-faint)]">
          {layers.length} layer{layers.length !== 1 ? "s" : ""}
          {selected ? ` · selected: ${selected.partType} · ${selected.w.toFixed(0)}%×${selected.h.toFixed(0)}%` : ""}
        </p>
      </div>
    </div>
  );
}
