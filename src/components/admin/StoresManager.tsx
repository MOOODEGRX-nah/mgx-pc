import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createStore,
  deleteStore,
  fetchStores,
  updateStore,
  uploadImage,
} from "../../lib/api";
import type { Store } from "../../types";

const emptyForm = { name: "", logo_url: "" };

export function StoresManager() {
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  function reload() {
    setLoading(true);
    fetchStores()
      .then(setStores)
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional refetch-and-reset-loading pattern
  useEffect(reload, []);

  function startEdit(store?: Store) {
    if (store) {
      setEditingId(store.id);
      setForm({ name: store.name, logo_url: store.logo_url ?? "" });
    } else {
      setEditingId("new");
      setForm(emptyForm);
    }
  }

  async function handleLogoUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage("store-logos", file);
      setForm((f) => ({ ...f, logo_url: url }));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (editingId === "new") {
      await createStore(form);
    } else if (editingId) {
      await updateStore(editingId, form);
    }
    setEditingId(null);
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("admin.confirmDelete"))) return;
    await deleteStore(id);
    reload();
  }

  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-ink-faint)]">
        {t("common.loading")}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {stores.map((store) => (
          <div
            key={store.id}
            className="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
          >
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-5 w-auto" />
            ) : null}
            <span className="text-sm text-[var(--color-ink)]">{store.name}</span>
            <button onClick={() => startEdit(store)} className="text-[var(--color-ink-muted)] hover:text-[var(--color-red)]">
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(store.id)} className="text-[var(--color-ink-muted)] hover:text-[var(--color-red)]">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          onClick={() => startEdit()}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-muted)] hover:border-[var(--color-red)] hover:text-[var(--color-ink)]"
        >
          <Plus size={14} />
          {t("admin.addStore")}
        </button>
      </div>

      {editingId && (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--color-ink)]">
              {t("admin.addStore")}
            </span>
            <button onClick={() => setEditingId(null)}>
              <X size={14} className="text-[var(--color-ink-muted)]" />
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-muted)]">
                {t("admin.storeName")}
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-muted)]">
                {t("admin.storeLogo")}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
                className="text-xs text-[var(--color-ink-muted)]"
              />
              {uploading && (
                <span className="block text-xs text-[var(--color-ink-faint)]">
                  {t("admin.uploading")}
                </span>
              )}
              {form.logo_url && (
                <img src={form.logo_url} alt="" className="mt-1 h-6 w-auto" />
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={!form.name}
              className="rounded-md bg-[var(--color-red)] px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {t("admin.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
