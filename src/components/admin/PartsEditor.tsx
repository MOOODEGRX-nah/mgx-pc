import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, Plus, Trash2, Upload } from "lucide-react";
import {
  createPart, deletePart, fetchPartsForBuild,
  updatePart, uploadImage,
} from "../../lib/api";
import { PART_TYPES, type Part, type PartType, type Store } from "../../types";

interface PartsEditorProps {
  buildId: string;
  stores: Store[];
  onPartsChanged?: () => void; // called after any add/delete/image update
}

const emptyForm = {
  type: PART_TYPES[0] as PartType,
  part_name: "",
  store_id: "",
  store_link: "",
};

export function PartsEditor({ buildId, stores, onPartsChanged }: PartsEditorProps) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [addingPart, setAddingPart] = useState(false);

  function reload() {
    fetchPartsForBuild(buildId).then((data) => {
      setParts(data);
      onPartsChanged?.();
    });
  }

  useEffect(reload, [buildId]); // eslint-disable-line

  async function handleAdd() {
    if (!form.part_name) return;
    setAddingPart(true);
    try {
      await createPart({
        build_id: buildId,
        type: form.type,
        part_name: form.part_name,
        store_id: form.store_id || null,
        store_link: form.store_link || null,
        image_url: null,
      });
      setForm(emptyForm);
      reload();
    } finally {
      setAddingPart(false);
    }
  }

  async function handleDelete(id: string) {
    await deletePart(id);
    reload();
  }

  async function handleImageUpload(partId: string, file: File) {
    setUploadingId(partId);
    try {
      const url = await uploadImage("part-images", file);
      await updatePart(partId, { image_url: url });
      reload();
    } finally {
      setUploadingId(null);
    }
  }

  async function handleRemoveImage(partId: string) {
    await updatePart(partId, { image_url: null });
    reload();
  }

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
        {t("admin.parts")}
      </p>

      {/* Parts list */}
      <div className="mb-3 flex flex-col gap-2">
        {parts.map((part) => {
          const hasImage = !!part.image_url;
          return (
            <div
              key={part.id}
              className={[
                "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                hasImage
                  ? "border border-green-500/30 bg-green-500/5"
                  : "bg-[var(--color-surface-2)]",
              ].join(" ")}
            >
              {/* Green check / upload icon */}
              <div className="shrink-0 w-5 flex items-center justify-center">
                {hasImage ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-[var(--color-ink-faint)]" />
                )}
              </div>

              {/* Type badge */}
              <span className="shrink-0 rounded-md border border-[var(--color-line)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--color-ink-faint)]">
                {t(`partTypes.${part.type}`)}
              </span>

              {/* Name */}
              <span className="flex-1 truncate text-xs font-medium text-[var(--color-ink)]">
                {part.part_name}
              </span>

              {/* Thumbnail or upload button */}
              <div className="flex shrink-0 items-center gap-1.5">
                {hasImage ? (
                  <>
                    <img
                      src={part.image_url!}
                      alt=""
                      className="h-9 w-12 rounded-md border border-green-500/30 object-contain bg-[var(--color-surface-2)]"
                    />
                    <button
                      onClick={() => handleRemoveImage(part.id)}
                      title="Remove image"
                      className="text-[10px] text-[var(--color-ink-faint)] hover:text-[var(--color-red)] transition-colors"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <label className="flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-[var(--color-line)] px-2 py-1 text-[10px] text-[var(--color-ink-faint)] transition-colors hover:border-[var(--color-red)] hover:text-[var(--color-red)]">
                    {uploadingId === part.id ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      <>
                        <Upload size={10} />
                        {t("admin.partImage")}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(part.id, f);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(part.id)}
                className="shrink-0 text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-red)]"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add part form */}
      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--color-line)] pt-3">
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PartType }))}
          className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]"
        >
          {PART_TYPES.map((type) => (
            <option key={type} value={type}>{t(`partTypes.${type}`)}</option>
          ))}
        </select>
        <input
          placeholder={t("admin.partName")}
          value={form.part_name}
          onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="min-w-[130px] flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]"
        />
        <select
          value={form.store_id}
          onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
          className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-ink)]"
        >
          <option value="">{t("admin.noStore")}</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          placeholder={t("admin.storeLink")}
          value={form.store_link}
          onChange={(e) => setForm((f) => ({ ...f, store_link: e.target.value }))}
          className="min-w-[140px] flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]"
        />
        <button
          onClick={handleAdd}
          disabled={!form.part_name || addingPart}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-red)] px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          <Plus size={12} />
          {t("admin.addPart")}
        </button>
      </div>
    </div>
  );
}
