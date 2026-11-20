import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SPEC_SCHEMA, type SpecDraft, type SpecField } from "../../lib/specSchema";
import type { ComponentType } from "../../types";
import { inputCls, labelCls } from "./ui";

function isHidden(field: SpecField, draft: SpecDraft): boolean {
  if (!field.showIf) return false;
  const controlling = draft[field.showIf.key];
  // Shown while the controlling value is unset, hidden once it is set to something else.
  return typeof controlling === "string" && controlling !== "" && controlling !== field.showIf.equals;
}

interface SpecFieldsProps {
  type: ComponentType;
  value: SpecDraft;
  onChange: (next: SpecDraft) => void;
}

/** Dynamic spec inputs for a component type, driven by SPEC_SCHEMA. All fields are optional. */
export function SpecFields({ type, value, onChange }: SpecFieldsProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const fields = SPEC_SCHEMA[type];
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  const optionLabel = (field: SpecField, option: string) =>
    field.translateOptions ? t(`specOptions.${field.key}.${option}`) : option;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.filter((f) => !isHidden(f, value)).map((field) => {
        const id = `${baseId}-${field.key}`;
        const raw = value[field.key];
        const label = (
          <label htmlFor={id} className={labelCls}>
            {t(`specs.${field.key}`)}
            {field.unit && <span dir="ltr" className="ms-1 text-[var(--color-ink-faint)]">({field.unit})</span>}
          </label>
        );

        switch (field.kind) {
          case "int":
            return (
              <div key={field.key}>
                {label}
                <input
                  id={id} type="number" inputMode="numeric" dir="ltr"
                  min={field.min} max={field.max}
                  value={typeof raw === "string" ? raw : ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  className={inputCls}
                />
              </div>
            );
          case "string":
          case "string_list":
            return (
              <div key={field.key}>
                {label}
                <input
                  id={id} dir="ltr"
                  placeholder={field.example}
                  value={Array.isArray(raw) ? raw.join(", ") : typeof raw === "string" ? raw : ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  className={inputCls}
                />
              </div>
            );
          case "bool":
            return (
              <div key={field.key}>
                {label}
                <select id={id} value={typeof raw === "string" ? raw : ""} onChange={(e) => set(field.key, e.target.value)} className={inputCls}>
                  <option value="">{t("common.unknown")}</option>
                  <option value="true">{t("common.yes")}</option>
                  <option value="false">{t("common.no")}</option>
                </select>
              </div>
            );
          case "enum":
            return (
              <div key={field.key}>
                {label}
                <select id={id} value={typeof raw === "string" ? raw : ""} onChange={(e) => set(field.key, e.target.value)} className={inputCls}>
                  <option value="">{t("common.unknown")}</option>
                  {field.options?.map((o) => <option key={o} value={o}>{optionLabel(field, o)}</option>)}
                </select>
              </div>
            );
          case "multi_enum": {
            const selected = Array.isArray(raw) ? raw.map(String) : [];
            return (
              <fieldset key={field.key} className="sm:col-span-2">
                <legend className={labelCls}>{t(`specs.${field.key}`)}</legend>
                <div className="flex flex-wrap gap-2">
                  {field.options?.map((o) => {
                    const checked = selected.includes(o);
                    return (
                      <label
                        key={o}
                        className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${checked ? "border-[var(--color-red)] text-[var(--color-ink)]" : "border-[var(--color-line)] text-[var(--color-ink-muted)]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => set(field.key, checked ? selected.filter((s) => s !== o) : [...selected, o])}
                          className="accent-[var(--color-red)]"
                        />
                        <span dir="ltr">{optionLabel(field, o)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          }
        }
      })}
    </div>
  );
}
