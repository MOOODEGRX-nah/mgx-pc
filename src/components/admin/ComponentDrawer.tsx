import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ImagePlus, Trash2 } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { SpecFields } from "./SpecFields";
import { OffersEditor } from "./OffersEditor";
import { btnDanger, btnGhost, btnPrimary, hintCls, inputCls, labelCls } from "./ui";
import {
  createComponent, deleteComponent, duplicateComponent, updateComponent,
} from "../../lib/catalogApi";
import { uploadImage } from "../../lib/api";
import { toAppError } from "../../lib/errors";
import { hasPerfTier, normalizeSpecs, specsToDraft, type SpecDraft } from "../../lib/specSchema";
import {
  COMPONENT_TYPES, PERF_TIERS,
  type ComponentType, type ComponentWithOffers, type PerfTier, type Store,
} from "../../types";

interface FormState {
  type: ComponentType;
  name: string;
  name_ar: string;
  brand: string;
  image_url: string;
  perf_tier: string;
  is_active: boolean;
  specs: SpecDraft;
}

function toForm(c: ComponentWithOffers | null, defaultType: ComponentType): FormState {
  return {
    type: c?.type ?? defaultType,
    name: c?.name ?? "",
    name_ar: c?.name_ar ?? "",
    brand: c?.brand ?? "",
    image_url: c?.image_url ?? "",
    perf_tier: c?.perf_tier ? String(c.perf_tier) : "",
    is_active: c?.is_active ?? true,
    specs: specsToDraft(c?.specs),
  };
}

interface ComponentDrawerProps {
  /** Component being edited; null to create a new one. */
  component: ComponentWithOffers | null;
  defaultType: ComponentType;
  stores: Store[];
  staleDays: number;
  onClose: () => void;
  /** Called after any change so the list can refresh. */
  onChanged: () => void;
}

export function ComponentDrawer({ component, defaultType, stores, staleDays, onClose, onChanged }: ComponentDrawerProps) {
  const { t } = useTranslation();
  const id = useId();
  const [current, setCurrent] = useState<ComponentWithOffers | null>(component);
  const [form, setForm] = useState<FormState>(() => toForm(component, defaultType));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setNotice(null);
  };

  function showError(err: unknown) {
    const e = toAppError(err);
    setError(t(e.i18nKey, e.params));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError(t("admin.components.nameRequired")); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        type: form.type,
        name: form.name,
        name_ar: form.name_ar,
        brand: form.brand,
        image_url: form.image_url || null,
        perf_tier: hasPerfTier(form.type) && form.perf_tier ? (Number(form.perf_tier) as PerfTier) : null,
        is_active: form.is_active,
        specs: normalizeSpecs(form.type, form.specs),
      };
      const saved = current ? await updateComponent(current.id, payload) : await createComponent(payload);
      const next: ComponentWithOffers = { ...saved, offers: current?.offers ?? [], used_in_builds: current?.used_in_builds ?? 0 };
      setCurrent(next);
      setForm(toForm(next, defaultType));
      setNotice(current ? t("admin.components.saved") : t("admin.components.createdAddOffers"));
      onChanged();
    } catch (err) { showError(err); } finally { setSaving(false); }
  }

  async function handleImage(file: File) {
    setUploading(true); setError(null);
    try { set("image_url", await uploadImage("part-images", file)); }
    catch (err) { showError(err); }
    finally { setUploading(false); }
  }

  async function handleDuplicate() {
    if (!current) return;
    setSaving(true); setError(null);
    try {
      const copy = await duplicateComponent(current, `${current.name} ${t("admin.components.copySuffix")}`);
      const opened: ComponentWithOffers = { ...copy, offers: [], used_in_builds: 0 };
      setCurrent(opened);
      setForm(toForm(opened, defaultType));
      setNotice(t("admin.components.duplicated"));
      onChanged();
    } catch (err) { showError(err); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!current || !confirm(t("admin.confirmDelete"))) return;
    setSaving(true); setError(null);
    try {
      await deleteComponent(current.id);
      onChanged();
      onClose();
    } catch (err) { showError(err); } finally { setSaving(false); }
  }

  const title = current ? t("admin.components.editTitle") : t("admin.components.newTitle");

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary}>
            {saving ? t("admin.saving") : t("admin.save")}
          </button>
          <button type="button" onClick={onClose} className={btnGhost}>{t("common.close")}</button>
          {current && (
            <div className="ms-auto flex gap-2">
              <button type="button" onClick={handleDuplicate} disabled={saving} className={btnGhost}>
                <Copy size={14} /> {t("admin.components.duplicate")}
              </button>
              <button type="button" onClick={handleDelete} disabled={saving} className={btnDanger} aria-label={t("admin.components.delete")} title={t("admin.components.delete")}>
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {(error || notice) && (
          <p role={error ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-[var(--color-red-dim)] bg-[var(--color-red-dim)]/20 text-[var(--color-red-glow)]" : "border-green-500/30 bg-green-500/10 text-green-400"}`}>
            {error ?? notice}
          </p>
        )}

        {/* Basics */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-type`} className={labelCls}>{t("admin.components.type")}</label>
            <select
              id={`${id}-type`}
              value={form.type}
              disabled={!!current && (current.used_in_builds ?? 0) > 0}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ComponentType, specs: {} }))}
              className={inputCls}
            >
              {COMPONENT_TYPES.map((type) => <option key={type} value={type}>{t(`partTypes.${type}`)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-brand`} className={labelCls}>{t("admin.components.brand")}</label>
            <input id={`${id}-brand`} dir="ltr" value={form.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-name`} className={labelCls}>{t("admin.components.name")}</label>
            <input id={`${id}-name`} dir="ltr" required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="AMD Ryzen 5 7600" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-name-ar`} className={labelCls}>{t("admin.components.nameAr")}</label>
            <input id={`${id}-name-ar`} dir="rtl" value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} className={inputCls} />
            <p className={hintCls}>{t("admin.components.nameArHint")}</p>
          </div>
        </section>

        {/* Image */}
        <section>
          <p className={labelCls}>{t("admin.components.image")}</p>
          <div className="flex items-center gap-3">
            <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]">
              {form.image_url
                ? <img src={form.image_url} alt="" className="h-full w-full object-contain p-1" />
                : <ImagePlus size={20} className="text-[var(--color-ink-faint)]" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={`${btnGhost} cursor-pointer`}>
                {uploading ? t("admin.uploading") : t("admin.components.uploadImage")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ""; }} />
              </label>
              {form.image_url && (
                <button type="button" onClick={() => set("image_url", "")} className={btnGhost}>{t("admin.components.removeImage")}</button>
              )}
            </div>
          </div>
        </section>

        {/* Performance tier (CPU/GPU) */}
        {hasPerfTier(form.type) && (
          <section>
            <label htmlFor={`${id}-tier`} className={labelCls}>{t("admin.components.perfTier")}</label>
            <select id={`${id}-tier`} value={form.perf_tier} onChange={(e) => set("perf_tier", e.target.value)} className={inputCls}>
              <option value="">{t("admin.components.perfTierNone")}</option>
              {PERF_TIERS.map((tier) => <option key={tier} value={tier}>{tier} — {t(`admin.components.tiers.${tier}`)}</option>)}
            </select>
            <p className={hintCls}>{t("admin.components.perfTierHint")}</p>
          </section>
        )}

        {/* Specs */}
        <section>
          <h3 className="mb-1 text-sm font-bold text-[var(--color-ink)]">{t("admin.components.specs")}</h3>
          <p className={`${hintCls} mb-3`}>{t("admin.components.specsHint")}</p>
          <SpecFields type={form.type} value={form.specs} onChange={(specs) => set("specs", specs)} />
        </section>

        {/* Visibility */}
        <label className="flex min-h-10 cursor-pointer items-start gap-3">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-red)]" />
          <span>
            <span className="block text-sm text-[var(--color-ink)]">{t("admin.components.isActive")}</span>
            <span className={hintCls}>{t("admin.components.isActiveHint")}</span>
          </span>
        </label>

        {/* Offers */}
        <section>
          <h3 className="mb-3 text-sm font-bold text-[var(--color-ink)]">{t("admin.offers.title")}</h3>
          {current ? (
            <OffersEditor
              componentId={current.id}
              offers={current.offers}
              stores={stores}
              staleDays={staleDays}
              onChange={(offers) => { setCurrent({ ...current, offers }); onChanged(); }}
            />
          ) : (
            <p className="text-xs text-[var(--color-ink-faint)]">{t("admin.components.saveFirstForOffers")}</p>
          )}
        </section>
      </div>
    </Sheet>
  );
}
