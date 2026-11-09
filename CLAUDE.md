# MGX(PC) — instructions for Claude Code

Bilingual (Arabic RTL default + English LTR) PC-build catalog. React 19 + TypeScript + Vite + Tailwind v4 +
Supabase, deployed to GitHub Pages from `main` (base path `/mgx-pc/`).

## Read first
1. `docs/HANDOFF.md`: current state, open owner decisions, remaining tasks (Phases 2–9) and required tests.
2. `docs/redesign-plan.md`: the full specification. When the plan and the code disagree, trust the code,
   tell the owner, and propose the smallest adjustment.

## Rules
- Talk to the owner in Arabic (simple Saudi dialect). Code, identifiers, comments, commit messages and SQL in English.
- **Commits and pull requests must not mention Claude**: no `Co-Authored-By: Claude…`, no `Claude-Session` or
  "Generated with Claude Code" lines. Commit as the owner's git identity. (Owner's explicit request.)
- Never push to `main` or merge without the owner's explicit approval; never force-push.
- Before every commit: `npm run lint`, `npm run lint:i18n`, `npm test`, `npm run build` must pass.
  After any SQL change also `bash supabase/tests/run.sh` (local Postgres, see `supabase/tests/README.md`).
- Every user-visible string goes through `t()`, with the same key in `ar.json` and `en.json`. No plural keys.
- RTL-safe CSS: logical utilities (`ms-/me-/ps-/pe-/start-/end-/text-start`), `ltr:`/`rtl:` variants when needed,
  `dir="ltr"` on part names, URLs, prices and model numbers, no letter-spacing on Arabic text (`rtl:tracking-normal`).
- Reuse the motion utilities in `src/index.css` and `src/components/Reveal.tsx`; respect `prefers-reduced-motion`.
- No new runtime dependencies without asking. Dev dependency allowed: vitest.
- Never put secrets in `VITE_*` variables or in the repo. Only the Supabase URL and anon key are public.
- Never run write/delete probes against the production database. Test data on the live site must be named
  `ZZ-TEST-…` and removed afterwards (rows and uploaded images).
- Do not create `src/lib/api/` (it would shadow `src/lib/api.ts`).
- Steps that need the owner (running SQL in Supabase, dashboard settings, credentials): stop and give exact,
  numbered instructions in Arabic; do not assume they were done.
