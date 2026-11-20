import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchSettings, updateSetting } from "../../lib/settingsApi";
import { toAppError } from "../../lib/errors";
import { btnPrimary, cardCls, hintCls, inputCls, labelCls } from "../../components/admin/ui";
import type { AppSettingKey, AppSettings } from "../../types";

const FIELDS: { key: AppSettingKey; min: number; max: number; unit: string }[] = [
  { key: "setup_allowance_sar", min: 0, max: 100000, unit: "SAR" },
  { key: "price_stale_days", min: 1, max: 365, unit: "" },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const id = useId();
  const [values, setValues] = useState<Record<AppSettingKey, string> | null>(null);
  const [saved, setSaved] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchSettings().then((s) => {
      setSaved(s);
      setValues({ setup_allowance_sar: String(s.setup_allowance_sar), price_stale_days: String(s.price_stale_days) });
    });
  }, []);

  async function handleSave() {
    if (!values || !saved) return;
    setSaving(true); setMessage(null);
    try {
      for (const f of FIELDS) {
        const n = Number(values[f.key]);
        if (!Number.isFinite(n) || n < f.min || n > f.max) {
          setMessage({ ok: false, text: t("admin.settings.invalid", { field: t(`admin.settings.${f.key}`) }) });
          return;
        }
        if (n !== saved[f.key]) await updateSetting(f.key, n);
      }
      const fresh = await fetchSettings();
      setSaved(fresh);
      setMessage({ ok: true, text: t("admin.settings.saved") });
    } catch (err) {
      const e = toAppError(err);
      setMessage({ ok: false, text: t(e.i18nKey, e.params) });
    } finally { setSaving(false); }
  }

  if (!values) return <div className="shimmer h-48 rounded-xl" />;

  return (
    <div className={`${cardCls} max-w-xl p-5`}>
      <h2 className="mb-5 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">{t("admin.settings.title")}</h2>
      <div className="flex flex-col gap-5">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`${id}-${f.key}`} className={labelCls}>
              {t(`admin.settings.${f.key}`)}
              {f.unit && <span dir="ltr" className="ms-1 text-[var(--color-ink-faint)]">({f.unit})</span>}
            </label>
            <input
              id={`${id}-${f.key}`} type="number" dir="ltr" inputMode="numeric" min={f.min} max={f.max}
              value={values[f.key]}
              onChange={(e) => { setValues({ ...values, [f.key]: e.target.value }); setMessage(null); }}
              className={inputCls}
            />
            <p className={hintCls}>{t(`admin.settings.${f.key}_hint`)}</p>
          </div>
        ))}
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-400" : "text-[var(--color-red-glow)]"}`}>{message.text}</p>
        )}
        <div>
          <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary}>
            {saving ? t("admin.saving") : t("admin.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
