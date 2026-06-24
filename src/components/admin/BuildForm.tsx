import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createBuild, updateBuild, uploadImage } from "../../lib/api";
import {
  CATEGORIES, type Build, type Category,
  type ConsoleTarget, type PriceVsConsole, type PerfVsConsole,
} from "../../types";

interface BuildFormProps {
  build?: Build;
  onSaved: (build: Build) => void;
  onCancel: () => void;
}

export function BuildForm({ build, onSaved, onCancel }: BuildFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name_ar:         build?.name_ar ?? "",
    name_en:         build?.name_en ?? "",
    category:        (build?.category ?? "high-end") as Category,
    description_ar:  build?.description_ar ?? "",
    description_en:  build?.description_en ?? "",
    image_url:       build?.image_url ?? "",
    console_target:  (build?.console_target ?? "") as ConsoleTarget | "",
    price_vs_console:(build?.price_vs_console ?? "") as PriceVsConsole | "",
    perf_vs_console: (build?.perf_vs_console ?? "") as PerfVsConsole | "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage("build-images", file);
      setForm((f) => ({ ...f, image_url: url }));
    } finally { setUploading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        console_target:   form.console_target   || null,
        price_vs_console: form.price_vs_console || null,
        perf_vs_console:  form.perf_vs_console  || null,
      };
      const saved = build
        ? await updateBuild(build.id, payload)
        : await createBuild(payload);
      onSaved(saved);
    } finally { setSaving(false); }
  }

  const inp = "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]";
  const lbl = "mb-1 block text-xs text-[var(--color-ink-muted)]";

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={lbl}>{t("admin.nameAr")}</label>
          <input value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>{t("admin.nameEn")}</label>
          <input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>{t("admin.category")}</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
            className={inp}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`categories.${c}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>{t("admin.image")}</label>
          <input type="file" accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
            className="text-xs text-[var(--color-ink-muted)]"
          />
          {uploading && <span className="block text-xs text-[var(--color-ink-faint)]">{t("admin.uploading")}</span>}
          {form.image_url && <img src={form.image_url} alt="" className="mt-1 h-12 w-auto rounded-md" />}
        </div>
        <div>
          <label className={lbl}>{t("admin.descriptionAr")}</label>
          <textarea value={form.description_ar} rows={2}
            onChange={(e) => setForm((f) => ({ ...f, description_ar: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className={lbl}>{t("admin.descriptionEn")}</label>
          <textarea value={form.description_en} rows={2}
            onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))} className={inp} />
        </div>

        {/* ── Console comparison fields (only when category = console-equiv) ── */}
        {form.category === "console-equiv" && (
          <>
            <div>
              <label className={lbl}>{t("admin.consoleTarget")}</label>
              <select value={form.console_target}
                onChange={(e) => setForm((f) => ({ ...f, console_target: e.target.value as ConsoleTarget | "" }))}
                className={inp}
              >
                <option value="">— اختر الكونسول —</option>
                <option value="ps5">PlayStation 5</option>
                <option value="xbox-series-x">Xbox Series X</option>
                <option value="xbox-series-s">Xbox Series S</option>
                <option value="nintendo-switch">Nintendo Switch</option>
              </select>
            </div>
            <div>
              <label className={lbl}>{t("admin.priceVsConsole")}</label>
              <select value={form.price_vs_console}
                onChange={(e) => setForm((f) => ({ ...f, price_vs_console: e.target.value as PriceVsConsole | "" }))}
                className={inp}
              >
                <option value="">— اختر —</option>
                <option value="cheaper">أرخص منه</option>
                <option value="similar">متقارب معه</option>
                <option value="more-expensive">أغلى منه</option>
              </select>
            </div>
            <div>
              <label className={lbl}>{t("admin.perfVsConsole")}</label>
              <select value={form.perf_vs_console}
                onChange={(e) => setForm((f) => ({ ...f, perf_vs_console: e.target.value as PerfVsConsole | "" }))}
                className={inp}
              >
                <option value="">— اختر —</option>
                <option value="stronger">أقوى منه</option>
                <option value="similar">متقارب معه</option>
                <option value="weaker">أضعف منه</option>
              </select>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} disabled={saving || !form.name_ar || !form.name_en}
          className="rounded-lg bg-[var(--color-red)] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          {saving ? t("admin.saving") : t("admin.save")}
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-[var(--color-line)] px-4 py-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          {t("admin.cancel")}
        </button>
      </div>
    </div>
  );
}
