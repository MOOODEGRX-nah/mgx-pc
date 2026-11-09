import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import ar from "../../i18n/locales/ar.json";
import { COMPONENT_TYPES } from "../../types";
import { SPEC_SCHEMA } from "../specSchema";
import type { CompatRuleId } from "../compatibility";
import type { AppErrorCode } from "../errors";

// Every id produced by the logic libraries must have a translation in both languages.
const COMPAT_IDS: CompatRuleId[] = [
  "socket_mismatch", "ram_type_mismatch", "case_form_factor", "gpu_too_long", "cooler_too_tall",
  "cooler_socket", "psu_underpowered", "no_gpu_no_igpu", "no_cooler", "no_storage",
];
const ERROR_CODES: AppErrorCode[] = [
  "generic", "rate_limited", "invalid_items", "unknown_component", "invalid_answers",
  "component_in_use", "duplicate_component", "duplicate_offer_url", "invalid_url", "not_allowed",
];

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

const required = [
  ...COMPONENT_TYPES.map((t) => `partTypes.${t}`),
  ...COMPAT_IDS.map((id) => `compat.${id}`),
  ...ERROR_CODES.map((c) => `errors.${c}`),
  ...COMPONENT_TYPES.flatMap((t) => SPEC_SCHEMA[t].flatMap((f) => [
    `specs.${f.key}`,
    ...(f.translateOptions ? (f.options ?? []).map((o) => `specOptions.${f.key}.${o}`) : []),
  ])),
];

describe("i18n coverage for logic ids", () => {
  it.each([["en", en], ["ar", ar]] as const)("%s has every required key", (_lang, dict) => {
    const missing = [...new Set(required)].filter((k) => typeof get(dict, k) !== "string");
    expect(missing).toEqual([]);
  });
});
