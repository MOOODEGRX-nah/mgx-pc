/**
 * Error codes surfaced to users. Each code has a translation under `errors.<code>`.
 * `params` are passed to t() for interpolation.
 */
export type AppErrorCode =
  | "generic"
  | "rate_limited"
  | "invalid_items"
  | "unknown_component"
  | "invalid_answers"
  | "component_in_use"
  | "duplicate_component"
  | "duplicate_offer_url"
  | "invalid_url"
  | "not_allowed";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly params: Record<string, string | number>;

  constructor(code: AppErrorCode, params: Record<string, string | number> = {}, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "AppError";
    this.code = code;
    this.params = params;
  }

  /** i18n key for this error. */
  get i18nKey(): string {
    return `errors.${this.code}`;
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

const RPC_CODES: AppErrorCode[] = ["rate_limited", "invalid_items", "unknown_component", "invalid_answers"];

/** Maps a Supabase/PostgREST error (or anything thrown) to an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = (err ?? {}) as PostgrestLikeError;
  const message = typeof e.message === "string" ? e.message : "";
  const rpc = RPC_CODES.find((c) => message === c || message.includes(c));
  if (rpc) return new AppError(rpc, {}, err);
  // 42501 = insufficient_privilege; RLS violations also use it.
  if (e.code === "42501" || /row-level security/i.test(message)) return new AppError("not_allowed", {}, err);
  return new AppError("generic", {}, err);
}
