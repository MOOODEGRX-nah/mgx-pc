import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteBuild, fetchBuildById, fetchBuilds,
  fetchStores, updateBuild, uploadBlob,
} from "../lib/api";
import { BuildForm } from "../components/admin/BuildForm";
import { PartsEditor } from "../components/admin/PartsEditor";
import { ToolsEditor } from "../components/admin/ToolsEditor";
import { CompositeEditor } from "../components/CompositeEditor";
import type { Build, BuildWithRelations, Store } from "../types";

/**
 * Builds tab (legacy editor: free-text parts and tools). Replaced by the catalog-based
 * build editor in Phase 3.
 */
export function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | "new" | null>(null);
  const [activeFull, setActiveFull] = useState<BuildWithRelations | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    setLoading(true);
    Promise.all([fetchBuilds(), fetchStores()])
      .then(([b, s]) => { setBuilds(b); setStores(s); })
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(reload, []);

  // Refresh full build when activeId changes
  useEffect(() => {
    if (activeId && activeId !== "new") {
      fetchBuildById(activeId).then(setActiveFull);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFull(null);
    }
  }, [activeId]);

  // Called by PartsEditor after any add/delete/image update
  const handlePartsChanged = useCallback(() => {
    if (activeId && activeId !== "new") {
      fetchBuildById(activeId).then(setActiveFull);
    }
  }, [activeId]);

  async function handleDelete(id: string) {
    if (!confirm(t("admin.confirmDelete"))) return;
    await deleteBuild(id);
    if (activeId === id) setActiveId(null);
    reload();
  }

  async function handleSaveComposite(buildId: string, blob: Blob) {
    setSaving(true);
    try {
      const url = await uploadBlob("build-images", blob);
      await updateBuild(buildId, { image_url: url });
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div>
          {loading && builds.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-ink-faint)]">
              {t("common.loading")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {builds.map((build) => (
                <div key={build.id}>
                  {/* Build row */}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
                    {build.image_url && (
                      <img
                        src={build.image_url}
                        alt=""
                        className="h-10 w-14 shrink-0 rounded-lg border border-[var(--color-line)] object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--color-ink)]">
                        {i18n.language === "ar" ? build.name_ar : build.name_en}
                      </p>
                      <p className="truncate text-[11px] text-[var(--color-ink-faint)]">
                        {i18n.language === "ar" ? build.name_en : build.name_ar}
                      </p>
                      <span className="font-mono text-[10px] text-[var(--color-red)]">
                        {t(`categories.${build.category}`)}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button onClick={() => setActiveId(activeId === build.id ? null : build.id)}>
                        <Pencil size={15} className="text-[var(--color-ink-muted)] hover:text-[var(--color-red)]" />
                      </button>
                      <button onClick={() => handleDelete(build.id)}>
                        <Trash2 size={15} className="text-[var(--color-ink-muted)] hover:text-[var(--color-red)]" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded editor */}
                  {activeId === build.id && (
                    <div className="mt-2 flex flex-col gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
                      {/* Build form — full width */}
                      <BuildForm
                        build={build}
                        onSaved={(saved) => {
                          setBuilds((bs) => bs.map((b) => (b.id === saved.id ? saved : b)));
                          fetchBuildById(saved.id).then(setActiveFull);
                        }}
                        onCancel={() => setActiveId(null)}
                      />

                      {/* Parts + Composite editor side by side */}
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                        {/* Left: parts + tools */}
                        <div className="flex flex-1 flex-col gap-3">
                          <PartsEditor
                            buildId={build.id}
                            stores={stores}
                            onPartsChanged={handlePartsChanged}
                          />
                          <ToolsEditor buildId={build.id} stores={stores} />
                        </div>

                        {/* Right: composite editor (updates live with activeFull.parts) */}
                        <div className="lg:w-[46%] lg:shrink-0">
                          <CompositeEditor
                            parts={activeFull?.parts ?? []}
                            onSave={async (blob) => {
                              await handleSaveComposite(build.id, blob);
                            }}
                          />
                          {saving && (
                            <p className="mt-1 text-center text-xs text-[var(--color-ink-faint)]">
                              {t("admin.saving")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new build */}
              {activeId === "new" ? (
                <BuildForm
                  onSaved={(saved) => {
                    setBuilds((bs) => [saved, ...bs]);
                    setActiveId(saved.id);
                  }}
                  onCancel={() => setActiveId(null)}
                />
              ) : (
                <button
                  onClick={() => setActiveId("new")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-red)] hover:text-[var(--color-ink)]"
                >
                  <Plus size={14} />
                  {t("admin.addBuild")}
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
