import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft, ArrowRight, Info, RotateCcw, Sparkles, Wrench } from "lucide-react";
import { BuildCard } from "../components/BuildCard";
import { fetchAdvisorCandidates } from "../lib/buildsApi";
import { fetchComponents } from "../lib/catalogApi";
import { fetchSettings, DEFAULT_SETTINGS } from "../lib/settingsApi";
import { recommend, suggestAccessories, type AdvisorCandidate, type RankedCandidate } from "../lib/advisor";
import { ADVISOR_KEY } from "../lib/builderDraft";
import { formatMoney } from "../lib/format";
import { pickLang } from "../lib/i18nData";
import { bestOffer } from "../lib/pricing";
import type { AdvisorAnswers, BuildWithSummary, ComponentWithOffers } from "../types";

type StepKey = "budget" | "hasSetup" | "setupPlan" | "gameType" | "usage" | "quality" | "monitor";
const STEP_KEY = "mgxpc-advisor-step";
const BUDGET_PRESETS = [3000, 5000, 8000, 12000];

function load<T>(key: string, fallback: T): T {
  try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function store(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

function stepsFor(a: AdvisorAnswers): StepKey[] {
  const steps: StepKey[] = ["budget", "hasSetup"];
  if (a.hasSetup === "no") steps.push("setupPlan");
  steps.push("gameType", "usage", "quality");
  if (a.hasSetup === "yes") steps.push("monitor");
  return steps;
}

function answered(step: StepKey, a: AdvisorAnswers): boolean {
  switch (step) {
    case "budget": return typeof a.budget === "number" && a.budget >= 500;
    case "monitor": return !!a.monitorResolution && !!a.monitorRefresh;
    default: return a[step] !== undefined;
  }
}

export function AdvisorPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fid = useId();
  const rtl = i18n.dir() === "rtl";
  const Next = rtl ? ArrowLeft : ArrowRight;
  const Back = rtl ? ArrowRight : ArrowLeft;

  const [answers, setAnswers] = useState<AdvisorAnswers>(() => load(ADVISOR_KEY, {}));
  const [stepIndex, setStepIndex] = useState<number>(() => load(STEP_KEY, 0));
  const [candidates, setCandidates] = useState<AdvisorCandidate<BuildWithSummary>[] | null>(null);
  const [accessories, setAccessories] = useState<ComponentWithOffers[]>([]);
  const [allowance, setAllowance] = useState(DEFAULT_SETTINGS.setup_allowance_sar);

  useEffect(() => { store(ADVISOR_KEY, answers); }, [answers]);
  useEffect(() => { store(STEP_KEY, stepIndex); }, [stepIndex]);
  useEffect(() => {
    fetchSettings().then((s) => setAllowance(s.setup_allowance_sar));
    fetchAdvisorCandidates().then(setCandidates).catch(() => setCandidates([]));
    fetchComponents({ type: "accessory" }).then(setAccessories).catch(() => setAccessories([]));
  }, []);

  const steps = stepsFor(answers);
  const done = stepIndex >= steps.length;
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const set = (patch: Partial<AdvisorAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  // Choice questions advance automatically; budget and monitor use the Next button.
  function choose(patch: Partial<AdvisorAnswers>) {
    const next = { ...answers, ...patch };
    setAnswers(next);
    setStepIndex((i) => Math.min(i + 1, stepsFor(next).length));
  }

  const result = useMemo(
    () => (done && candidates ? recommend(answers, allowance, candidates) : null),
    [done, candidates, answers, allowance],
  );
  const accessoryPicks = useMemo(
    () => suggestAccessories(accessories.map((c) => ({ component: c, price: bestOffer(c.offers)?.price ?? null })), allowance),
    [accessories, allowance],
  );

  const choiceBtn = (selected: boolean) =>
    `flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition-all active:scale-[0.99] ${
      selected ? "border-[var(--color-red)] bg-[var(--color-red-dim)]/25 text-[var(--color-ink)]" : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:border-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
    }`;

  function options<K extends keyof AdvisorAnswers>(key: K, values: NonNullable<AdvisorAnswers[K]>[], withHint = false) {
    return (
      <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby={`${fid}-q`}>
        {values.map((v, i) => (
          <button
            key={String(v)} type="button" role="radio" aria-checked={answers[key] === v}
            onClick={() => choose({ [key]: v } as Partial<AdvisorAnswers>)}
            className={`${choiceBtn(answers[key] === v)} stagger animate-fade-up`}
            style={{ "--i": i } as CSSProperties}
          >
            <span>
              <span className="block text-sm font-bold">{t(`advisor.options.${String(key)}.${String(v)}`)}</span>
              {withHint && <span className="block text-xs text-[var(--color-ink-faint)]">{t(`advisor.hints.${String(key)}.${String(v)}`)}</span>}
            </span>
            <Next size={16} className="shrink-0 opacity-50" />
          </button>
        ))}
      </div>
    );
  }

  const builderLink = result
    ? `/builder?budget=${result.effectiveBudget}&gpuTier=${result.gpuTier}&cpuTier=${result.cpuTier}`
    : "/builder";

  const card = (c: RankedCandidate<BuildWithSummary>, index: number, badge?: string) => (
    <div key={c.build.id} className="stagger animate-fade-up" style={{ "--i": index } as CSSProperties}>
      {badge && <p className="mb-1.5 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-red)]"><Sparkles size={12} /> {badge}</p>}
      {/* plain wrapper: BuildCard is h-full, which would otherwise push the caption out of this box */}
      <div><BuildCard build={c.build} /></div>
      <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
        {t("advisor.result.tiers", { gpu: c.gpuTier, cpu: c.cpuTier })}
        {!c.studyFit && <span className="ms-2 text-yellow-400">{t("advisor.result.studyWarning")}</span>}
      </p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <div className="mb-6 animate-fade-up">
        <h1 className="font-[var(--font-display)] text-3xl font-black text-[var(--color-ink)] sm:text-4xl">{t("advisor.title")}</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{t("advisor.intro")}</p>
      </div>

      {!done ? (
        <section key={step} className="animate-fade-up rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
          {/* Progress */}
          <div className="mb-5">
            <div className="mb-1.5 flex justify-between text-[11px] text-[var(--color-ink-faint)]">
              <span>{t("advisor.progress", { current: stepIndex + 1, total: steps.length })}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={stepIndex + 1}>
              <div className="h-full rounded-full bg-[var(--color-red)] transition-[width] duration-500 ease-[var(--ease-out-expo)]" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
            </div>
          </div>

          <h2 id={`${fid}-q`} className="mb-4 font-[var(--font-display)] text-xl font-bold text-[var(--color-ink)]">{t(`advisor.questions.${step}`)}</h2>

          {step === "budget" && (
            <div>
              <label htmlFor={`${fid}-budget`} className="mb-1 block text-xs text-[var(--color-ink-muted)]">{t("advisor.budgetLabel")}</label>
              <input
                id={`${fid}-budget`} type="number" inputMode="numeric" dir="ltr" min={500} step={100}
                value={answers.budget ?? ""} onChange={(e) => set({ budget: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-lg font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-red)]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((v) => (
                  <button key={v} type="button" onClick={() => set({ budget: v })} className={`min-h-10 rounded-lg border px-3 text-sm ${answers.budget === v ? "border-[var(--color-red)] text-[var(--color-ink)]" : "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"}`}>
                    <bdi>{formatMoney(v, lang)}</bdi>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === "hasSetup" && (<><p className="-mt-2 mb-4 text-xs text-[var(--color-ink-faint)]">{t("advisor.setupItems")}</p>{options("hasSetup", ["yes", "no"])}</>)}
          {step === "setupPlan" && (<><p className="-mt-2 mb-4 text-xs text-[var(--color-ink-faint)]">{t("advisor.setupAllowanceNote", { amount: formatMoney(allowance, lang) })}</p>{options("setupPlan", ["within_budget", "separate"])}</>)}
          {step === "gameType" && options("gameType", ["competitive", "light", "aaa"], true)}
          {step === "usage" && options("usage", ["gaming_only", "study_and_gaming"])}
          {step === "quality" && options("quality", ["1080p", "1440p", "4k"], true)}
          {step === "monitor" && (
            <div className="flex flex-col gap-4">
              <fieldset>
                <legend className="mb-2 text-xs text-[var(--color-ink-muted)]">{t("advisor.monitorResolution")}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["1080p", "1440p", "4k", "unsure"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={answers.monitorResolution === v} onClick={() => set({ monitorResolution: v })} className={choiceBtn(answers.monitorResolution === v)}>
                      <span className="text-sm font-bold">{v === "unsure" ? t("advisor.unsure") : v}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs text-[var(--color-ink-muted)]">{t("advisor.monitorRefresh")}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([60, 144, 240, "unsure"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={answers.monitorRefresh === v} onClick={() => set({ monitorRefresh: v })} className={choiceBtn(answers.monitorRefresh === v)}>
                      <span dir="ltr" className="text-sm font-bold">{v === "unsure" ? t("advisor.unsure") : `${v} Hz`}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30">
              <Back size={15} /> {t("advisor.back")}
            </button>
            {(step === "budget" || step === "monitor" || answered(step, answers)) && (
              <button type="button" onClick={() => setStepIndex((i) => i + 1)} disabled={!answered(step, answers)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--color-red)] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                {stepIndex === steps.length - 1 ? t("advisor.showResults") : t("advisor.next")} <Next size={15} />
              </button>
            )}
          </div>
        </section>
      ) : !result ? (
        <div className="shimmer h-64 rounded-2xl" />
      ) : (
        <section className="flex flex-col gap-6">
          {/* What we looked for */}
          <div className="animate-fade-up rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-[var(--color-ink)]">{t("advisor.result.lookingFor")}</h2>
            <ul className="flex flex-col gap-1.5 text-sm text-[var(--color-ink-muted)]">
              <li>{t("advisor.result.budget")}: <bdi className="font-bold text-[var(--color-ink)]">{formatMoney(result.effectiveBudget, lang)}</bdi>
                {result.effectiveBudget !== result.budget && <span className="ms-1 text-xs">{t("advisor.result.afterSetup", { amount: formatMoney(allowance, lang) })}</span>}
              </li>
              <li>{t("advisor.result.resolution")}: <span dir="ltr" className="font-bold text-[var(--color-ink)]">{result.resolution}</span></li>
              <li>{t("advisor.result.required", { gpu: result.gpuTier, cpu: result.cpuTier })}</li>
            </ul>
            {result.resolutionClamped && <p className="mt-3 flex items-start gap-1.5 text-xs text-yellow-400"><Info size={13} className="mt-0.5 shrink-0" /> {t("advisor.result.clamped", { monitor: answers.monitorResolution, quality: answers.quality })}</p>}
            {result.setupSeparate && <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-ink-muted)]"><Info size={13} className="mt-0.5 shrink-0" /> {t("advisor.result.setupExtra")}</p>}
          </div>

          {/* (a) matches */}
          {result.matches.length > 0 && (
            <div>
              <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-[var(--color-ink)]">{t("advisor.result.matches")}</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {result.matches.map((c, i) => card(c, i, i === 0 ? t("advisor.result.bestMatch") : undefined))}
              </div>
            </div>
          )}

          {/* (c) nothing matches */}
          {result.matches.length === 0 && (
            <div className="animate-fade-up rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5">
              <p className="flex items-start gap-2 text-sm text-[var(--color-ink)]"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
                {result.cheapestMeetingTarget && result.needAbout != null
                  ? <span>{t("advisor.result.needAbout", { amount: formatMoney(result.needAbout, lang) })}</span>
                  : <span>{t("advisor.result.noneYet")}</span>}
              </p>
              {result.cheapestMeetingTarget && (
                <div className="mt-4 max-w-sm">{card(result.cheapestMeetingTarget, 0, t("advisor.result.cheapestForTarget"))}</div>
              )}
            </div>
          )}

          <Link to={builderLink} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-red)] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90">
            <Wrench size={16} /> {t("advisor.result.openBuilder")}
          </Link>

          {/* (b) below target */}
          {result.belowTarget.length > 0 && (
            <div>
              <h2 className="mb-1 font-[var(--font-display)] text-lg font-bold text-[var(--color-ink)]">{t("advisor.result.belowTarget")}</h2>
              <p className="mb-3 text-xs text-[var(--color-ink-faint)]">{t("advisor.result.belowTargetHint")}</p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{result.belowTarget.map((c, i) => card(c, i))}</div>
            </div>
          )}

          {/* price incomplete */}
          {result.priceIncomplete.length > 0 && (
            <div>
              <h2 className="mb-1 font-[var(--font-display)] text-lg font-bold text-[var(--color-ink)]">{t("advisor.result.priceIncomplete")}</h2>
              <p className="mb-3 text-xs text-[var(--color-ink-faint)]">{t("advisor.result.priceIncompleteHint")}</p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{result.priceIncomplete.map((c, i) => card(c, i))}</div>
            </div>
          )}

          {result.excludedNoTier > 0 && (
            <p className="text-xs text-[var(--color-ink-faint)]">{t("advisor.result.notRated", { n: result.excludedNoTier })}</p>
          )}

          {/* Setup suggestions */}
          {answers.hasSetup === "no" && accessoryPicks.picks.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-[var(--color-ink)]">{t("advisor.result.setupTitle")}</h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {accessoryPicks.picks.map((p) => (
                  <li key={p.category} className="flex items-baseline justify-between gap-2">
                    <span className="text-[var(--color-ink-muted)]">{t(`specOptions.category.${p.category}`)}: <bdi className="text-[var(--color-ink)]">{pickLang(p.component, "name", lang)}</bdi></span>
                    <bdi className="shrink-0 text-[var(--color-ink)]">{formatMoney(p.price, lang)}</bdi>
                  </li>
                ))}
              </ul>
              <p className={`mt-3 text-xs ${accessoryPicks.fits ? "text-green-400" : "text-yellow-400"}`}>
                {t(accessoryPicks.fits ? "advisor.result.setupFits" : "advisor.result.setupOver", { total: formatMoney(accessoryPicks.total, lang), allowance: formatMoney(allowance, lang) })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStepIndex(steps.length - 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              <Back size={15} /> {t("advisor.changeAnswers")}
            </button>
            <button type="button" onClick={() => { setAnswers({}); setStepIndex(0); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-4 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
              <RotateCcw size={14} /> {t("advisor.startOver")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
