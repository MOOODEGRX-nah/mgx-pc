import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { createTool, deleteTool, fetchToolsForBuild } from "../../lib/api";
import type { Store, Tool } from "../../types";

interface ToolsEditorProps {
  buildId: string;
  stores: Store[];
}

const emptyForm = { tool_name: "", store_id: "", store_link: "" };

export function ToolsEditor({ buildId, stores }: ToolsEditorProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [form, setForm] = useState(emptyForm);

  function reload() {
    fetchToolsForBuild(buildId).then(setTools);
  }

  useEffect(reload, [buildId]);

  async function handleAdd() {
    if (!form.tool_name) return;
    await createTool({
      build_id: buildId,
      tool_name: form.tool_name,
      store_id: form.store_id || null,
      store_link: form.store_link || null,
    });
    setForm(emptyForm);
    reload();
  }

  async function handleDelete(id: string) {
    await deleteTool(id);
    reload();
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--color-line)] p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
        {t("build.tools")}
      </p>

      <div className="mb-3 flex flex-col gap-2">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-surface-2)] px-3 py-1.5 text-sm"
          >
            <span className="flex-1 truncate text-[var(--color-ink)]">
              {tool.tool_name}
            </span>
            <button onClick={() => handleDelete(tool.id)}>
              <Trash2 size={13} className="text-[var(--color-ink-muted)] hover:text-[var(--color-red)]" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <input
          placeholder={t("admin.toolName")}
          value={form.tool_name}
          onChange={(e) => setForm((f) => ({ ...f, tool_name: e.target.value }))}
          className="min-w-[140px] flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-ink)]"
        />
        <select
          value={form.store_id}
          onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
          className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-ink)]"
        >
          <option value="">{t("admin.noStore")}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          placeholder={t("admin.storeLink")}
          value={form.store_link}
          onChange={(e) => setForm((f) => ({ ...f, store_link: e.target.value }))}
          className="min-w-[160px] flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-ink)]"
        />
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-red)] px-3 py-1.5 text-xs font-bold text-white"
        >
          <Plus size={12} />
          {t("admin.addTool")}
        </button>
      </div>
    </div>
  );
}
