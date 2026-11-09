# MGX(PC) redesign — handoff (status, remaining tasks, required tests)

Last updated: 2026-11-09. Written when work moved from a cloud session to the owner's computer.
The full specification is [`docs/redesign-plan.md`](redesign-plan.md) ("the plan"); section numbers below refer to it.

---

## 1. Start here (local setup)

```bash
git clone https://github.com/MOOODEGRX-nah/mgx-pc.git
cd mgx-pc
git checkout claude/new-session-cjt9rc      # all new work lives on this branch (not merged yet)
npm ci                                      # needs Node 22+ (vitest 5)
cp .env.example .env                        # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                                 # http://localhost:5173/mgx-pc/
```

The two values for `.env` are in Supabase → Project Settings → API (Project URL, anon/publishable key).
They are public by design; never put any other key in a `VITE_*` variable.

Checks to run before every commit (CI runs the same ones):

```bash
npm run lint
npm run lint:i18n
npm test
npm run build
```

---

## 2. Current state

### 2.1 Done (on branch `claude/new-session-cjt9rc`, not yet on `main`)

| Commit | What |
|---|---|
| `7d41dbc` Phase 0 | vitest, `scripts/check-i18n.mjs` (`npm run lint:i18n`), CI runs lint + i18n + tests before build, CI Node 20 → 22, 404 page i18n |
| `a392eba` Phase 1 | `supabase/v2_catalog.sql`, `supabase/README.md`; types; `catalogApi`, `buildsApi`, `userBuildsApi`, `settingsApi`; `pricing`, `compatibility`, `youtube`, `format`, `i18nData`, `specSchema`, `url`, `errors`, `rows`; i18n `partTypes.psu/accessory`, `compat.*`, `errors.*`, `specs.*`, `specOptions.*`; 59 unit tests |
| `f7b9733` | Home hero glow caused horizontal scroll on phones (`overflow-x-clip`) |
| `eaf48c6` | Admin (old UI): English part names truncated from the start in Arabic; LTR/RTL direction on name/description/link inputs |
| `1aec665` | Animations and polish on public pages (CSS only; `Reveal`, `PageTransition` components; scroll-to-top on navigation; BuildCard hover colour bug; console-equiv colour; Arabic letter-spacing) |
| (this commit) | Handoff docs, `CLAUDE.md`, `supabase/tests/` (automated DB tests) |

No UI uses the new catalog yet: Home, BuildDetail and the admin still read the legacy `parts`/`tools` tables
through `src/lib/api.ts`. That is expected until Phase 3.

### 2.2 Production (Supabase project + GitHub Pages)

- `v2_catalog.sql` **has been run on production** (2026-11-09). Verification output:
  `admins_count=1, legacy_part_rows=18, migrated_part_qty=18, legacy_tool_rows=1, migrated_tool_qty=1, components_count=19, offers_count=8`.
  `app_settings.legacy_migrated_at` is set, so re-running the file will not re-import legacy rows.
- Owner admin account: `admin@mgxpc.com` (only row in `admins` besides the test account below).
- "Allow new users to sign up" was switched off by the owner. **Owner: confirm it stayed off after a page refresh.**
- **Test admin account `claude-test@mgxpc.com` still exists. Its password was written in a chat, so delete it**
  (Supabase → Authentication → Users → the account → Delete user; this also removes its `admins` row).
  Create a new one only if needed, and never paste passwords into chats or files.
- Live site (`https://mooodegrx-nah.github.io/mgx-pc/`) still runs `main`. All deploys of `main` succeeded.
  Verified on the live site: all public pages AR/EN, phone/desktop, no JS errors; full admin flow
  (login, create build, parts, part image upload, tool, composite image, edit, delete) works with the v2 policies.
  Anonymous visitors cannot read `admins`, `user_builds`, `submission_log`; `is_admin()` is false for them.

### 2.3 Deviations from the plan (already implemented — keep them)

1. Branches: everything is on `claude/new-session-cjt9rc` (one commit per phase), not `phase-N-*` branches.
2. `v2_catalog.sql` runs in one transaction; the legacy copy (section 6) runs only once (marker `legacy_migrated_at`).
3. Items and videos of unpublished builds are hidden from visitors (policies on `build_items`, `build_videos`).
4. `submit_user_build` validates/normalizes input before casting (uuid format, quantity digits, lowercase ids),
   sanitizes `p_lang`, trims the label, and rejects non-object or >2000-char answers (`invalid_answers`).
5. `build_price_summary` has an extra column `last_price_update`.
6. Legacy duplicate parts in one build become one item with `quantity` = count.
7. Console fields got their check constraints on fresh installs too.
8. `pickLang()` order is `<field>_<lang>` → `<field>` → `<field>_<other>` (so English pages show a component's base name, not its Arabic name).
9. `no_gpu_no_igpu` / `no_cooler` warn only when the CPU spec explicitly says `false` (missing data disables rules).
10. `psu_underpowered` also runs without a GPU (CPU TDP only), but is skipped when a GPU exists without `tdp_w`.
11. Animations were added before Phase 3 (owner request). Reuse the utilities in `src/index.css`
    (`animate-fade-up`, `animate-scale-in`, `animate-pop`, `.stagger` + `--i`, `.shimmer`, `.collapse`, `.spotlight`)
    and the `Reveal` component in the new pages instead of inventing new ones.

---

## 3. Owner decisions still open

| # | Decision | Default if not answered |
|---|---|---|
| D1 | How work reaches the live site: Pull Request that the owner merges, or direct push to `main` | Open a PR; owner merges |
| D2 | Delete `claude-test@mgxpc.com` | Delete now (see 2.2) |
| D3 | Realistic `setup_allowance_sar` for the advisor | 1500 SAR placeholder; owner sets it in `/admin/settings` (Phase 2) |
| D4 | Which Saudi stores to add besides Amazon/AliExpress | Owner adds them in `/admin/stores`; never invent stores |
| D5 | Amazon / AliExpress API credentials for Phase 8 | Phase 8 not started |
| D6 | Dropping legacy `parts`/`tools` (Phase 9, `v3_drop_legacy.sql`) | Keep the tables |

---

## 4. Remaining tasks

Work in order. After each phase: all checks in section 1 green, the phase's tests in section 5 pass, one commit per phase.

### Phase 2 — Admin shell + component catalog + offers (plan 6.4)

- [ ] `AuthContext`: after login call `supabase.rpc('is_admin')`, expose `isAdmin` (+ loading state).
- [ ] `ProtectedRoute`: require session **and** `isAdmin`; logged-in non-admin sees a bilingual "no access" screen with a logout button.
- [ ] `AdminLayout` (tab nav + `<Outlet/>`); routes `/admin` → redirect `/admin/builds`, `/admin/builds`, `/admin/builds/new`, `/admin/builds/:id`, `/admin/components`, `/admin/prices`, `/admin/visitor-builds`, `/admin/stores`, `/admin/settings`. Keep the old dashboard reachable until Phase 3 replaces it.
- [ ] Components tab: chips Case · CPU · GPU · RAM · SSD (nvme+sata) · HDD · CPU Cooler · PSU · Motherboard · Accessories; list with search, thumbnail, name, best price, offers count, active toggle, "used in N builds" (`fetchComponents({ withUsage: true, includeInactive: true })`).
- [ ] Create/edit drawer: type, name, Arabic name, brand, image upload (`part-images`), `perf_tier` (CPU/GPU only, with the tier legend from plan 5.2), dynamic spec inputs driven by `SPEC_SCHEMA` (respect `showIf`, `translateOptions`), `is_active`.
- [ ] Offers editor in the drawer: store, URL (http/https only), price (SAR), in-stock tri-state, last updated, "Price confirmed today" (`touchOfferPrice`), delete, stale badge (`isStale` with `price_stale_days`).
- [ ] "Duplicate component" action (`duplicateComponent`); friendly delete error (`AppError component_in_use` → `errors.component_in_use`).
- [ ] Settings tab: `setup_allowance_sar`, `price_stale_days` (`settingsApi`).
- [ ] Stores tab: existing `StoresManager`, logical direction classes, i18n parity.
- [ ] i18n: `nav.*`, `admin.components.*`, `admin.settings.*`; fix hardcoded strings: console options in `BuildForm.tsx` (Arabic), toolbar/status text in `CompositeEditor.tsx` (English: "parts", "layers", "selected", "BG", "PNG", button titles).
- [ ] Dialogs/drawers: focus trap, `Esc` closes, labelled controls (`<label htmlFor>`; current admin labels are not linked to inputs), touch targets ≥ 40 px.
- [ ] Old-admin issues found during testing (fix here or make sure the new UI doesn't repeat them):
  Navbar shows "Owner login" even when logged in (show "Dashboard"/logout instead);
  composite editor canvas is cleared after "save as main image" (the build list reload unmounts it);
  long `name_ar / name_en` titles truncate from the wrong end in RTL;
  the image upload input shows the browser's English "Choose File / No file chosen" (use a styled button with i18n text).

### Phase 3 — Build editor + public pages on the new model

- [ ] Build editor page (`/admin/builds/new`, `/admin/builds/:id`): Basics (existing BuildForm fields + `is_published`), one row per core slot (`CORE_SLOTS`) with a searchable catalog picker (image, name, best price), RAM and Storage allow several items with quantity (`MULTI_ITEM_SLOTS`), Accessories block; sticky summary (live total `computeTotals`, partial notice, per-item prices, `checkCompatibility` warnings, `totalsByStore`); explicit Save (`saveBuildItems`) with unsaved-changes guard; warning when the build's CPU/GPU has no `perf_tier`.
- [ ] `CompositeEditor` adapter: prop becomes `{ id; type; name; image_url }[]` mapped from `build_items → components`; composite generation and "save as main image" must behave exactly as before. Read the whole file first.
- [ ] Builds list tab: image, names, category, published toggle, best total, `priced_count/items_count`, edit/delete.
- [ ] Home + `BuildCard`: `fetchBuildsWithSummary`; total badge (`formatMoney`), "from {{amount}}" when partial, no badge when no prices. Keep the animations.
- [ ] `BuildDetail`: `fetchBuildFull` (one request; the current 3 sequential requests take ~2.5 s), group items by slot (several RAM/storage rows), successor of `SpecRow` with best price + store and an expandable list of all offers; keep copy name / copy link / open store; console block unchanged.
- [ ] Remove every frontend read of `parts`/`tools` (`grep -rn "\"parts\"\|\"tools\"" src` must be empty except legacy types); delete `PartsEditor`/`ToolsEditor` and the legacy API functions once unused. Tables stay in the DB.

### Phase 4 — Prices UI, PDF, copy list, stale queue

- [ ] Prices everywhere in plan 6.5 (per item, totals, accessories subtotal, last update date, per-store comparison).
- [ ] `/admin/prices`: offers ordered by oldest/missing `price_updated_at`, store filter, open store page (`rel="noopener noreferrer"`), inline price + stock + save.
- [ ] `BuildPrintSheet` (`hidden print:block`) + `ExportPdfButton` (`window.print()` + hint "Choose Save as PDF"); `@media print` light theme, hide navbar/buttons, no row splits, **full URLs printed as text**; follows UI language/direction. No PDF library.
- [ ] "Copy shopping list" (plain text, `Name — URL`, section headers, current language).

### Phase 5 — Performance videos

- [ ] Admin: add/remove/reorder videos (paste URL → `parseYouTube`; titles ar/en, game, resolution, settings, approx FPS, start), small preview; invalid links rejected with a translated message.
- [ ] Public: lazy facade (thumbnail via `youtubeThumbnailUrl`, iframe only after click via `youtubeEmbedUrl`, `youtube-nocookie.com`, no autoplay), caption, "≈ N FPS", "Approximate performance — results vary" note.

### Phase 6 — Public builder + visitor submissions inbox

- [ ] `/builder`: slots like the admin, picker dialog with search/type filter/best price/"incompatible" badge (`candidateConflicts`), totals, warnings, Save / Export PDF / Copy list / Reset.
- [ ] Draft in `localStorage` key `mgxpc-draft-build` (versioned JSON, try/catch); prefill from `?budget=&gpuTier=&cpuTier=` and `?from=<buildId>`.
- [ ] Save: optional label ≤ 80, hidden honeypot input `website`, `submitUserBuild`, map errors to `errors.*`, success message, no personal data (say so in the UI). Client-side minimum: CPU + Motherboard + RAM.
- [ ] `/admin/visitor-builds`: inbox (`fetchUserBuilds`), `new` badge on the tab (`countNewUserBuilds`), live total vs `total_snapshot`, answers summary, detail with prices + compat warnings, actions Publish as build (`publishUserBuildAsBuild`, suggest a category), Mark reviewed, Archive, Delete.
- [ ] Navbar: Home · Advisor · Builder + language + admin link, collapses on small screens; language switch must not reset builder/advisor state.

### Phase 7 — Advisor (`/advisor`)

- [ ] `src/lib/advisor.ts` (pure): effective budget (setup allowance), resolution clamp to monitor, GPU tier table, CPU tier rule (+1 for competitive ≥ 144 Hz), study RAM/SSD preference, candidate grouping (complete vs partial prices), ranking (a)/(b)/(c), "you need about X SAR" + builder CTA, accessory suggestions. Exact rules: plan section 7, Phase 7.
- [ ] UI: one question per screen, progress, back button, answers in state + `sessionStorage` key `mgxpc-advisor`; conditional questions 2b and 6.

### Phase 8 — Automatic price sync (only with owner go-ahead and credentials)

- [ ] Verify current Amazon Creators API / AliExpress API eligibility, Saudi marketplace support, limits and terms **before** writing code.
- [ ] Scheduled job (Supabase Edge Function + `pg_cron`, or GitHub Actions cron), store adapters, `price_sync_log` table, last-sync status in `/admin/prices`. Secrets only in function/Actions secrets. No scraping without written permission.

### Phase 9 — Hardening, QA, cleanup

- [ ] Full AR/EN pass at 360 px and desktop, every page including admin (RTL).
- [ ] Lighthouse sanity on Home and Build detail (iframes must not load before click).
- [ ] Bundle size: the JS bundle is > 500 kB; lazy-load admin routes (`React.lazy`) to split it.
- [ ] Update `README.md` and `SETUP.md` (features, SQL run order, env vars, admins row, sign-ups off).
- [ ] Only with owner approval: `supabase/v3_drop_legacy.sql` dropping `parts` and `tools`.

---

## 5. Required tests

### 5.1 Automated (every commit)

| Command | Covers |
|---|---|
| `npm run lint` | ESLint (React hooks rules) |
| `npm run lint:i18n` | `ar.json`/`en.json` identical keys, no empty values, same `{{placeholders}}`. Avoid i18next plural keys (`_one/_other`) — Arabic and English plural forms differ |
| `npm test` | vitest unit tests in `src/lib/__tests__/` (pricing, compatibility, youtube, format/pickLang/url/errors, specSchema, i18n coverage of every rule id / error code / spec key) |
| `npm run build` | `tsc -b` + Vite build (same as CI) |
| `bash supabase/tests/run.sh` | Database: fresh + legacy install, re-run no-op, 36 RLS/RPC checks. Needs a local Postgres (see `supabase/tests/README.md`). Run after **any** change to SQL files |

Unit tests to add as the phases land:
- Phase 3: `saveBuildItems` diff logic (extract the diff into a pure function and test it); slot grouping of items.
- Phase 4: shopping-list text builder (both languages, missing links); totals with accessories only.
- Phase 6: draft serialization/versioning; error-code mapping of `submitUserBuild`; `candidateConflicts` in the picker.
- Phase 7 (required by the plan): tier table, resolution clamping, budget math with/without setup allowance, CPU tier +1 rule, ranking groups, the "no result / you need about X SAR" branch.

### 5.2 Database rules (production)

- **Never run destructive or write probes against the production database** (no test DELETE/UPDATE/INSERT "to see if RLS blocks it"). Write-refusal is proven by `supabase/tests/run.sh` on a local copy.
- Read-only checks that are safe on production with the public key: `rpc/is_admin` → `false`; `select` on `user_builds`, `admins`, `submission_log` → `[]`.
- Any data created while testing the live admin must be named `ZZ-TEST-…` and deleted afterwards, including uploaded images in `part-images` / `build-images`.

### 5.3 Acceptance tests per phase (from the plan, plus findings)

**Phase 2**
- Owner can create/edit one component of each type (Case, CPU, GPU, RAM, SSD, HDD, Cooler, PSU, Motherboard, Accessory), each with ≥ 2 store offers and prices.
- The 19 migrated components appear in the right tabs with their 8 offers.
- Deleting a component used in a build shows "used in N builds"; duplicating works; inactive components disappear from public queries.
- A logged-in non-admin gets the no-access screen (reason about RLS; a second account only with owner agreement).
- Stale badge appears for offers older than `price_stale_days`.

**Phase 3**
- Every existing build (3 on production) renders the same components, links and console block on Home and detail as before.
- A new build can be created only from catalog picks; RAM/storage with several items and quantities display correctly.
- No frontend query touches `parts`/`tools`.
- Composite image: add layers, save as main image, image shows on Home and detail.
- Build detail loads in one request.

**Phase 4**
- A build with mixed priced/unpriced items shows "from X" and the partial notice; accessories excluded from the PC total.
- Chrome print preview readable in Arabic (RTL table alignment) and English, URLs printed in full.
- Copy list works on a phone (iOS Safari + Android Chrome).

**Phase 5**
- Valid YouTube link → preview in admin; invalid → translated error.
- Public page: no request to youtube before click (check the Network tab), plays after click.

**Phase 6**
- Same configuration submitted twice → one inbox row with `submit_count` 2.
- 11 rapid submissions from one client → the 11th shows the translated rate-limit message.
- Visitor build → "Publish as build" → appears publicly in one click.
- Anonymous `select` on `user_builds` returns no rows.
- Language switch keeps builder selections; draft survives reload.

**Phase 7**
- Every answer path (setup yes/no, within budget/separate, each game type, usage, quality, monitor known/unsure) gives sensible output in both languages; the builder CTA pre-fills tiers and budget.

**Phase 8**
- One real store's prices update via the job; failures logged in `price_sync_log` without breaking the site; stale badges follow the sync.

### 5.4 Regression checklist (before every merge to `main`)

Run `npm run build && npm run preview` (or test the deployed site) and check, in **Arabic and English**, at **390 px** and **1366 px**:

- [ ] Home: categories switch, cards appear, no horizontal scroll (`document.documentElement.scrollWidth === clientWidth`).
- [ ] Build detail opened from a scrolled Home starts at the top; parts expand/collapse; copy name/link; store link opens in a new tab.
- [ ] Direct deep links work on GitHub Pages (`/mgx-pc/build/<id>`, `/mgx-pc/admin`): the response code is 404 by design (served from `404.html`), but the page must render.
- [ ] 404 page, admin login page.
- [ ] No console errors.
- [ ] With the OS "reduce motion" setting on: no animations, nothing stays invisible.
- [ ] Arabic text never letter-spaced (no `tracking-*` on Arabic text; use `rtl:tracking-normal`), English names in Arabic layouts are `dir="ltr"`.
- [ ] After merging, the GitHub Actions "Deploy to GitHub Pages" run is green and the live site shows the change.
