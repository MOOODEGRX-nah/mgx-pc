import { useEffect, useId, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft, ArrowRight, ImagePlus } from "lucide-react";
import { BuildSlots } from "../../components/BuildSlots";
import { BuildSummary } from "../../components/BuildSummary";
import { CompositeEditor, type CompositePart } from "../../components/CompositeEditor";
import { btnGhost, btnPrimary, cardCls, hintCls, inputCls, labelCls } from "../../components/admin/ui";
import { fetchComponents } from "../../lib/catalogApi";
import { fetchBuildFull, saveBuildItems } from "../../lib/buildsApi";
import { createBuild, fetchStores, updateBuild, uploadBlob, uploadImage } from "../../lib/api";
import { toAppError } from "../../lib/errors";
import {
  CATEGORIES,
  type Build, type Category, type ComponentWithOffers, type ConsoleTarget, type ItemWithComponent,
  type PerfVsConsole, type PriceVsConsole, type Store,
} from "../../types";

const CONSOLE_TARGETS: ConsoleTarget[] = ["ps5", "xbox-series-x", "xbox-series-s", "nintendo-switch"];
const PRICE_VS: PriceVsConsole[] = ["cheaper", "similar", "more-expensive"];
const PERF_VS: PerfVsConsole[] = ["stronger", "similar", "weaker"];

interface Basics {
  name_ar: string;
  name_en: string;
  category: Category;
  description_ar: string;
  description_en: string;
  image_url: string;
  console_target: ConsoleTarget | "";
  price_vs_console: PriceVsConsole | "";
  perf_vs_console: PerfVsConsole | "";
  is_published: boolean;
}

function toBasics(b?: Build | null): Basics {
  return {
    name_ar: b?.name_ar ?? "",
    name_en: b?.name_en ?? "",
    category: b?.category ?? "mid-range",
    description_ar: b?.description_ar ?? "",
    description_en: b?.description_en ?? "",
    image_url: b?.image_url ?? "",
    console_target: b?.console_target ?? "",
    price_vs_console: b?.price_vs_console ?? "",
    perf_vs_console: b?.perf_vs_console ?? "",
    is_published: b?.is_published ?? true,
  };
}

const snapshotOf = (basics: Basics, items: ItemWithComponent[]) =>
  JSON.stringify({ basics, items: items.map((i) => [i.component_id, i.quantity]) });

export function BuildEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = (location.state as { created?: boolean } | null)?.created === true;
  const { t, i18n } = useTranslation();
  const fid = useId();
  const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft;

  const [status, setStatus] = useState<"loading" | "ready" | "notFound">("loading");
  const [catalog, setCatalog] = useState<ComponentWithOffers[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [basics, setBasics] = useState<Basics>(toBasics());
  const [items, setItems] = useState<ItemWithComponent[]>([]);
  const [saved, setSaved] = useState(() => snapshotOf(toBasics(), []));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    () => (justCreated ? { ok: true, text: t("admin.builds.saved") } : null),
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchComponents({ includeInactive: true }),
      fetchStores(),
      id ? fetchBuildFull(id) : Promise.resolve(null),
    ]).then(([cat, st, build]) => {
      if (!active) return;
      setCatalog(cat);
      setStores(st);
      if (id && !build) { setStatus("notFound"); return; }
      const b = toBasics(build);
      const its: ItemWithComponent[] = build?.items ?? [];
      setBasics(b);
      setItems(its);
      setSaved(snapshotOf(b, its));
      setStatus("ready");
    }).catch((err) => {
      if (!active) return;
      const e = toAppError(err);
      setMessage({ ok: false, text: t(e.i18nKey, e.params) });
      setStatus("ready");
    });
    return () => { active = false; };
  }, [id, t]);

  const dirty = snapshotOf(basics, items) !== saved;

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Basics>(key: K, value: Basics[K]) => {
    setBasics((b) => ({ ...b, [key]: value }));
    setMessage(null);
  };

  const missingTier = useMemo(
    () => items.some((i) => (i.component.type === "cpu" || i.component.type === "gpu") && !i.component.perf_tier),
    [items],
  );
  const compositeParts: CompositePart[] = items.map((i) => ({
    id: i.component_id, type: i.component.type, name: i.component.name, image_url: i.component.image_url,
  }));

  async function save() {
    if (!basics.name_ar.trim() || !basics.name_en.trim()) {
      setMessage({ ok: false, text: t("admin.builds.nameRequired") });
      return;
    }
    setSaving(true); setMessage(null);
    try {
      const isConsole = basics.category === "console-equiv";
      const payload = {
        name_ar: basics.name_ar.trim(),
        name_en: basics.name_en.trim(),
        category: basics.category,
        description_ar: basics.description_ar.trim() || null,
        description_en: basics.description_en.trim() || null,
        image_url: basics.image_url || null,
        console_target: isConsole ? basics.console_target || null : null,
        price_vs_console: isConsole ? basics.price_vs_console || null : null,
        perf_vs_console: isConsole ? basics.perf_vs_console || null : null,
        is_published: basics.is_published,
      };
      const build = id ? await updateBuild(id, payload) : await createBuild(payload);
      await saveBuildItems(build.id, items.map((i) => ({ component_id: i.component_id, quantity: i.quantity })));
      setSaved(snapshotOf(basics, items));
      setMessage({ ok: true, text: t("admin.builds.saved") });
      // The page remounts on its new URL; pass the success message along.
      if (!id) navigate(`/admin/builds/${build.id}`, { replace: true, state: { created: true } });
    } catch (err) {
      const e = toAppError(err);
      setMessage({ ok: false, text: t(e.i18nKey, e.params) });
    } finally { setSaving(false); }
  }

  async function uploadMainImage(file: File) {
    setUploading(true);
    try { set("image_url", await uploadImage("build-images", file)); }
    catch (err) { const e = toAppError(err); setMessage({ ok: false, text: t(e.i18nKey, e.params) }); }
    finally { setUploading(false); }
  }

  async function saveComposite(blob: Blob) {
    const url = await uploadBlob("build-images", blob);
    setBasics((b) => ({ ...b, image_url: url }));
    if (id) {
      // Existing build: store the new main image right away, like the old editor did.
      await updateBuild(id, { image_url: url });
      setSaved((s) => { const parsed = JSON.parse(s); parsed.basics.image_url = url; return JSON.stringify(parsed); });
    }
    setMessage({ ok: true, text: id ? t("admin.builds.imageSaved") : t("admin.builds.imageSetSaveBuild") });
  }

  function leave(e: React.MouseEvent) {
    if (dirty && !confirm(t("admin.builds.leaveConfirm"))) e.preventDefault();
  }

  if (status === "loading") return <div className="shimmer h-96 rounded-xl" />;
  if (status === "notFound") {
    return (
      <div className={`${cardCls} py-14 text-center`}>
        <p className="text-sm text-[var(--color-ink-muted)]">{t("build.notFound")}</p>
        <Link to="/admin/builds" className="mt-3 inline-block text-sm text-[var(--color-red)]">{t("admin.builds.backToList")}</Link>
      </div>
    );
  }

  const field = (key: keyof Basics, label: string, opts: { dir?: "rtl" | "ltr"; multiline?: boolean } = {}) => (
    <div>
      <label htmlFor={`${fid}-${key}`} className={labelCls}>{label}</label>
      {opts.multiline ? (
        <textarea id={`${fid}-${key}`} dir={opts.dir} rows={3} value={String(basics[key])} onChange={(e) => set(key, e.target.value as never)} className={inputCls} />
      ) : (
        <input id={`${fid}-${key}`} dir={opts.dir} value={String(basics[key])} onChange={(e) => set(key, e.target.value as never)} className={inputCls} />
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/builds" onClick={leave} className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-red)]">
            <BackIcon size={13} /> {t("admin.builds.backToList")}
          </Link>
          <h2 className="font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
            {id ? t("admin.editBuild") : t("admin.addBuild")}
          </h2>
        </div>
        {dirty && <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">{t("admin.builds.unsaved")}</span>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Basics */}
          <section className={`${cardCls} p-4`}>
            <h3 className="mb-3 text-sm font-bold text-[var(--color-ink)]">{t("admin.builds.basics")}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("name_ar", t("admin.nameAr"), { dir: "rtl" })}
              {field("name_en", t("admin.nameEn"), { dir: "ltr" })}
              <div>
                <label htmlFor={`${fid}-category`} className={labelCls}>{t("admin.category")}</label>
                <select id={`${fid}-category`} value={basics.category} onChange={(e) => set("category", e.target.value as Category)} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
                </select>
              </div>
              <label className="flex min-h-10 cursor-pointer items-start gap-2 self-end pb-1">
                <input type="checkbox" checked={basics.is_published} onChange={(e) => set("is_published", e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-red)]" />
                <span>
                  <span className="block text-sm text-[var(--color-ink)]">{t("admin.builds.isPublished")}</span>
                  <span className={hintCls}>{t("admin.builds.isPublishedHint")}</span>
                </span>
              </label>
              {field("description_ar", t("admin.descriptionAr"), { dir: "rtl", multiline: true })}
              {field("description_en", t("admin.descriptionEn"), { dir: "ltr", multiline: true })}
              {basics.category === "console-equiv" && (
                <>
                  <div>
                    <label htmlFor={`${fid}-console`} className={labelCls}>{t("admin.consoleTarget")}</label>
                    <select id={`${fid}-console`} value={basics.console_target} onChange={(e) => set("console_target", e.target.value as ConsoleTarget | "")} className={inputCls}>
                      <option value="">{t("admin.chooseConsole")}</option>
                      {CONSOLE_TARGETS.map((c) => <option key={c} value={c}>{t(`consoleTarget.${c}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${fid}-pvc`} className={labelCls}>{t("admin.priceVsConsole")}</label>
                    <select id={`${fid}-pvc`} value={basics.price_vs_console} onChange={(e) => set("price_vs_console", e.target.value as PriceVsConsole | "")} className={inputCls}>
                      <option value="">{t("admin.choose")}</option>
                      {PRICE_VS.map((v) => <option key={v} value={v}>{t(`priceVsConsole.${v}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${fid}-pfc`} className={labelCls}>{t("admin.perfVsConsole")}</label>
                    <select id={`${fid}-pfc`} value={basics.perf_vs_console} onChange={(e) => set("perf_vs_console", e.target.value as PerfVsConsole | "")} className={inputCls}>
                      <option value="">{t("admin.choose")}</option>
                      {PERF_VS.map((v) => <option key={v} value={v}>{t(`perfVsConsole.${v}`)}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Components */}
          <section className={`${cardCls} p-4`}>
            <h3 className="mb-1 text-sm font-bold text-[var(--color-ink)]">{t("admin.builds.components")}</h3>
            <p className={`${hintCls} mb-3`}>{t("admin.builds.componentsHint")}</p>
            {missingTier && (
              <p className="mb-3 flex items-start gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t("admin.builds.perfTierWarning")}
              </p>
            )}
            <BuildSlots catalog={catalog} value={items} onChange={(next) => { setItems(next); setMessage(null); }} />
          </section>

          {/* Image */}
          <section className={`${cardCls} p-4`}>
            <h3 className="mb-3 text-sm font-bold text-[var(--color-ink)]">{t("admin.image")}</h3>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="grid h-20 w-32 place-items-center overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]">
                {basics.image_url ? <img src={basics.image_url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={20} className="text-[var(--color-ink-faint)]" />}
              </div>
              <label className={`${btnGhost} cursor-pointer`}>
                {uploading ? t("admin.uploading") : t("admin.builds.uploadImage")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMainImage(f); e.target.value = ""; }} />
              </label>
              {basics.image_url && <button type="button" onClick={() => set("image_url", "")} className={btnGhost}>{t("admin.components.removeImage")}</button>}
            </div>
            <p className={`${hintCls} mb-2`}>{t("admin.builds.compositeHint")}</p>
            <CompositeEditor parts={compositeParts} onSave={saveComposite} />
          </section>
        </div>

        {/* Summary */}
        <aside className={`${cardCls} p-4 lg:sticky lg:top-20`}>
          <BuildSummary items={items} stores={stores}>
            {message && (
              <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-400" : "text-[var(--color-red-glow)]"}`}>{message.text}</p>
            )}
            <button type="button" onClick={save} disabled={saving || !dirty} className={`${btnPrimary} w-full`}>
              {saving ? t("admin.saving") : t("admin.builds.saveBuild")}
            </button>
            {id && basics.is_published && (
              <Link to={`/build/${id}`} target="_blank" className="text-center text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-red)]">
                {t("admin.builds.viewPublic")}
              </Link>
            )}
          </BuildSummary>
        </aside>
      </div>
    </div>
  );
}
