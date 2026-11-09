# MGX(PC) — Catalog, Pricing, Builder & Advisor Redesign

> Implementation plan for Claude Code. Repository: `MOOODEGRX-nah/mgx-pc`
> Live site: `https://mooodegrx-nah.github.io/mgx-pc/` (GitHub Pages, base path `/mgx-pc/`)
> Owner language: Arabic. **All code, identifiers, comments, commit messages and SQL must be in English.**
> **The website must stay fully bilingual (Arabic RTL default + English LTR)** — see section 4.

---

## 0. How to work (rules of engagement)

1. Read this whole file first, then read the existing code listed in section 1 before changing anything.
2. Work **phase by phase** (section 7). Finish, build, lint and test one phase before starting the next. Commit each phase separately on its own branch (`phase-1-database`, `phase-2-catalog`, …). Never force-push.
3. After every phase run: `npm run lint`, `npm run build` (this is `tsc -b && vite build`, the same command CI runs), and `npm test` once tests exist. Do not leave a phase with failing lint, type errors, or broken routes.
4. Do not add heavy dependencies. Allowed new dev dependency: `vitest` (pure-logic tests). Allowed new runtime dependency: none expected. If you believe one is needed, stop and ask.
5. Do not break existing public pages while migrating. The legacy tables (`parts`, `tools`) stay untouched until the owner explicitly approves dropping them (Phase 9).
6. Never put secrets in `VITE_*` variables or in the repo. Only the Supabase URL and anon key are public. Anything needing a secret goes into a Supabase Edge Function secret or a GitHub Actions secret.
7. When something in this plan conflicts with what you find in the code, trust the code, tell the owner what differs, and propose the smallest adjustment.
8. If a step needs the owner (running SQL in the Supabase dashboard, adding their auth user id, creating API credentials), stop and print exact, numbered instructions for the owner. Do not assume it was done.

---

## 1. Verified facts about the current repository

Collected by reading the repo (2 commits on `main`). Treat as the baseline.

**Stack:** React 19, TypeScript ~6.0, Vite 8 (`base: '/mgx-pc/'`), Tailwind CSS v4 (`@tailwindcss/vite`, tokens declared in `@theme` inside `src/index.css`), `react-router-dom` 7 (`BrowserRouter basename={import.meta.env.BASE_URL}`), `i18next` + `react-i18next`, `lucide-react`, `@supabase/supabase-js` 2. ESLint 10 with `eslint-plugin-react-hooks` (the repo already uses `// eslint-disable-next-line react-hooks/set-state-in-effect` in places).

**Deploy:** `.github/workflows/deploy.yml` builds on push to `main` with Node 20 (`npm ci`, `npm run build`), copies `dist/index.html` to `dist/404.html` for SPA deep links, deploys to GitHub Pages. `vercel.json` has a catch-all rewrite. Secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` are injected at build.

**Routes (`src/App.tsx`):** `/` Home, `/build/:id` BuildDetail, `/admin/login`, `/admin` (ProtectedRoute → AdminDashboard), `*` NotFound. Navbar is global.

**Auth:** `AuthContext` (Supabase email/password). `ProtectedRoute` only checks that a session exists.

**Data model today (`supabase/schema.sql` + two migration files):**
- `stores(id, name, logo_url)`
- `builds(id, name_ar, name_en, category, image_url, description_ar, description_en, console_target, price_vs_console, perf_vs_console, created_at)`; categories `high-end | mid-range | budget | console-equiv`
- `parts(id, build_id, type, part_name, store_id, store_link, image_url)` — parts are **free text per build**; types: `case, motherboard, cpu, cpu_cooler, gpu, ram, ssd_nvme, ssd_sata, hdd_2_5, hdd_3_5`
- `tools(id, build_id, tool_name, store_id, store_link)` — effectively "accessories"
- Buckets: `build-images`, `store-logos`, `part-images`
- RLS: public read; write allowed to **any authenticated user** (`auth.role() = 'authenticated'`).

**Problems found (must be addressed by this plan):**
1. **No price anywhere.** No price columns, no totals.
2. **No component catalog.** The same part is retyped per build; no spec data, so no compatibility checks or recommendations.
3. **No PSU type.** `psu` is missing from `PartType`, the TS arrays, the i18n `partTypes` map, and the SQL `check` constraint.
4. **`BuildDetail` assumes one part per type** (`PART_TYPES.map(type => build.parts.find(...))`). RAM kits and multiple drives cannot be shown.
5. **`schema.sql` is out of sync:** its `category` check constraint lacks `console-equiv` (fixed only by `add_console_category.sql`); `parts.image_url` exists only after `add_part_images.sql`. A fresh install from `schema.sql` alone is broken.
6. **Security gap:** write access = "any authenticated user". If Supabase public sign-ups are enabled (default), any stranger can sign up and edit/delete everything. Phase 1 introduces an `admins` allow-list and `is_admin()`. The owner must also disable public sign-ups in the Supabase Auth settings. **Claude Code cannot verify that dashboard setting — ask the owner to confirm.**
7. **Hardcoded Arabic strings** in `BuildForm.tsx` (console select options) bypass i18n.
8. `BuildDetail` issues 3 sequential queries per build (N+1 style); `Home` fetches builds with no price summary.
9. `CompositeEditor.tsx` (422 lines, canvas-based composite image generator) takes `Part[]` (`type`, `part_name`, `image_url`). It must keep working after parts become catalog components — see Phase 3. **Read it completely before touching it; only its first ~60 lines were reviewed when writing this plan.**

**Conventions to keep:** dark theme tokens (`--color-bg`, `--color-surface`, `--color-surface-2/3`, `--color-line`, `--color-red`, `--color-ink`, `--color-ink-muted`, `--color-ink-faint`), Tajawal + JetBrains Mono fonts, `font-[var(--font-display)]` headings, `trace-divider`, lucide icons, `t("…")` for every user-visible string, existing component styling patterns (`rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]`).

---

## 2. Goals (from the owner)

1. **Admin redesign.** Replace "type parts into each build" with a **component catalog**: separate management for Case, CPU, GPU, RAM, SSD, CPU Cooler, PSU, Motherboard, plus **extra parts / accessories**.
2. **"Add build" page** that composes a build by **picking components from the catalog** (not typing).
3. **Prices.** Show a price per component and a total per build. Support multiple stores per component (Amazon, AliExpress, others). Fallbacks when prices are unavailable: (1) each component keeps its store link; (2) **export a PDF** containing component names and purchase links.
4. **Develop price display/automation** from Amazon, AliExpress and other stores (staged — manual first, automated later).
5. **Advisor page** ("PC capability picker") — a guided question flow instead of browsing around.
6. **Performance videos** on builds (approximate performance).
7. **Visitor builds are stored for the admin**: when any visitor builds a configuration, it is saved so the admin does not have to build each one manually.
8. **Bilingual website** (Arabic + English), full parity.

---

## 3. Target architecture

```
Public site (GitHub Pages, static SPA)
 ├─ /                    Home (builds by category, with total price badge)
 ├─ /build/:id           Build detail (components, prices, videos, PDF/copy list)
 ├─ /builder             Visitor build-your-own (catalog picker, totals, compat warnings, save, PDF)
 ├─ /advisor             Guided questions → matching builds / prefilled builder
 └─ /admin/*             Owner area (guarded by is_admin)
      ├─ /admin/builds            list
      ├─ /admin/builds/new        add-build page
      ├─ /admin/builds/:id        edit build (items, videos, image, publish)
      ├─ /admin/components        catalog (sub-tabs per type) + offers/prices
      ├─ /admin/prices            stale-price queue (manual refresh workflow)
      ├─ /admin/visitor-builds    submissions inbox
      ├─ /admin/stores            stores manager (existing)
      └─ /admin/settings          app settings (setup allowance, stale days)

Supabase: Postgres + RLS + Storage + one RPC (submit_user_build)
Optional later: Edge Function / scheduled job for price sync (Phase 8)
```

Data flow for prices: `component_offers` (per store: url, price, in_stock, updated_at) → best price = cheapest in-stock priced offer → build total = Σ(quantity × best price) over **non-accessory** items. Accessories get their own subtotal and are **not** included in the PC total.

---

## 4. Bilingual requirements (Arabic + English) — applies to every phase

The site already has i18n (`src/i18n/index.ts`: default `ar`, fallback `ar`, storage key `mgxpc-lang`, `<html dir/lang>` updated on change). Keep that mechanism. Additional rules:

1. **Zero hardcoded user-visible strings.** Everything goes through `t()`. Fix the hardcoded Arabic in `BuildForm.tsx`.
2. **Key parity.** `ar.json` and `en.json` must have identical key sets. Add `scripts/check-i18n.mjs` that fails (exit code 1) on any missing/extra key, and an npm script `lint:i18n`. Run it in CI before the build step.
3. **RTL-safe styling.** Use logical Tailwind utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`, `start-*`, `end-*`) instead of `ml/mr/pl/pr/left/right` in all new code. Flip directional icons (arrows/chevrons) when `i18n.dir() === "rtl"`. Keep `dir="ltr"` on technical strings (URLs, part names, model numbers, prices) with `unicode-bidi: isolate` (`<bdi>` or `dir="ltr"` span) so they do not get scrambled inside Arabic sentences.
4. **Bilingual data fields.** Builds already have `name_ar/name_en`, `description_ar/en`. New: `build_videos.title_ar/title_en`; `components.name_ar` optional (used mainly for accessories; fall back to `name`). Add a helper `pickLang(obj, field, lang)` in `src/lib/i18nData.ts` that returns `obj[field_lang] ?? obj[field_other] ?? obj[field]`.
5. **Number/currency formatting.** One helper `formatMoney(value, lang)` in `src/lib/format.ts`:
   `new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 })`.
   `-u-nu-latn` forces Latin digits in Arabic (consistent with part names and store listings). Dates via `Intl.DateTimeFormat` with the same locale rule.
6. **PDF / print** output follows the current UI language and direction.
7. **Admin panel is bilingual too** (UI labels), even though the owner is Arabic-first.
8. **Language toggle** stays in the Navbar; it must not reset page state (builder selections, advisor answers).

### i18n key namespaces to add (both files)

`nav.*`, `partTypes.*` (add `psu`, `accessory`), `price.*`, `builder.*`, `advisor.*`, `videos.*`, `print.*`, `admin.components.*`, `admin.builds.*`, `admin.visitorBuilds.*`, `admin.prices.*`, `admin.settings.*`, `compat.*`, `errors.*`.

---

## 5. Database — new migration `supabase/v2_catalog.sql`

Create a **single, idempotent** SQL file. It must be safe to run whether or not `add_part_images.sql` / `add_console_category.sql` were already applied, and safe to re-run. Also update `supabase/schema.sql` header comment to say "run `v2_catalog.sql` afterwards" (do not rewrite history; keep legacy files). Add `supabase/README.md` explaining run order: `schema.sql` → (legacy migrations if not already applied) → `v2_catalog.sql`.

### 5.1 Specification (write exactly this logic; adjust syntax only if Postgres/Supabase rejects it)

```sql
-- ============================================================
-- MGX(PC) v2: catalog, offers, build items, videos, visitor builds
-- Idempotent. Run in Supabase SQL editor.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 0. Make legacy schema consistent (fresh-install safe) ----------
alter table parts add column if not exists image_url text;
alter table builds add column if not exists console_target text;
alter table builds add column if not exists price_vs_console text;
alter table builds add column if not exists perf_vs_console text;
alter table builds drop constraint if exists builds_category_check;
alter table builds add constraint builds_category_check
  check (category in ('high-end','mid-range','budget','console-equiv'));
alter table builds add column if not exists is_published boolean not null default true;

insert into storage.buckets (id, name, public) values ('part-images','part-images',true)
on conflict (id) do nothing;

-- ---------- 1. Admin allow-list ----------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;  -- no policies: invisible to API roles

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- OWNER ACTION REQUIRED: replace the email, then run. Without an admins row the owner is locked out.
insert into admins (user_id)
select id from auth.users where email = 'OWNER_EMAIL_HERE'
on conflict do nothing;

do $$ begin
  if not exists (select 1 from admins) then
    raise exception 'admins table is empty: set OWNER_EMAIL_HERE to the owner login email and re-run';
  end if;
end $$;

-- ---------- 2. Catalog tables ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists components (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'case','motherboard','cpu','cpu_cooler','gpu','ram',
    'ssd_nvme','ssd_sata','hdd_2_5','hdd_3_5','psu','accessory')),
  name text not null,
  name_ar text,
  brand text,
  image_url text,
  specs jsonb not null default '{}'::jsonb,
  perf_tier smallint check (perf_tier between 1 and 5),   -- cpu/gpu only; used by the advisor
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists components_type_name_uidx on components (type, lower(name));
create index if not exists components_type_idx on components (type);
drop trigger if exists components_touch on components;
create trigger components_touch before update on components
  for each row execute function public.touch_updated_at();

create table if not exists component_offers (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references components(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  url text,
  price numeric(10,2) check (price is null or price >= 0),
  currency text not null default 'SAR',
  in_stock boolean,                                        -- null = unknown
  price_source text not null default 'manual' check (price_source in ('manual','api','scrape')),
  price_updated_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists component_offers_comp_url_uidx
  on component_offers (component_id, url) where url is not null;
create index if not exists component_offers_comp_idx on component_offers (component_id);

create table if not exists build_items (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds(id) on delete cascade,
  component_id uuid not null references components(id) on delete restrict,
  quantity smallint not null default 1 check (quantity between 1 and 8),
  sort_order smallint not null default 0,
  unique (build_id, component_id)
);
create index if not exists build_items_build_idx on build_items (build_id);

create table if not exists build_videos (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds(id) on delete cascade,
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  start_seconds integer check (start_seconds is null or start_seconds >= 0),
  title_ar text,
  title_en text,
  game text,
  resolution text,
  settings text,
  approx_fps integer check (approx_fps is null or approx_fps between 1 and 1000),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists build_videos_build_idx on build_videos (build_id);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value) values
  ('setup_allowance_sar', to_jsonb(1500)),   -- PLACEHOLDER: owner must confirm a realistic value
  ('price_stale_days',    to_jsonb(14))
on conflict (key) do nothing;

-- ---------- 3. Visitor builds (inbox for the admin) ----------
create table if not exists user_builds (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,          -- sha256 of sorted "componentId:qty" pairs (dedupe)
  status text not null default 'new' check (status in ('new','reviewed','published','archived')),
  label text,                                -- optional visitor-chosen name (<= 80 chars)
  lang text check (lang in ('ar','en')),
  advisor_answers jsonb,
  total_snapshot numeric(10,2),              -- computed server-side at submit time (best prices)
  priced_count smallint,
  items_count smallint,
  submit_count integer not null default 1,   -- how many visitors built the exact same config
  published_build_id uuid references builds(id) on delete set null,
  first_submitted_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now()
);
create table if not exists user_build_items (
  user_build_id uuid not null references user_builds(id) on delete cascade,
  component_id uuid not null references components(id) on delete cascade,
  quantity smallint not null default 1 check (quantity between 1 and 8),
  primary key (user_build_id, component_id)
);
create table if not exists submission_log (   -- rate limiting only; purged inside the RPC
  id bigint generated always as identity primary key,
  submitter_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists submission_log_hash_idx on submission_log (submitter_hash, created_at);
alter table submission_log enable row level security;   -- no policies

create or replace function public.submit_user_build(
  p_items   jsonb,
  p_label   text  default null,
  p_lang    text  default null,
  p_answers jsonb default null,
  p_website text  default null          -- honeypot: must stay empty
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip text; v_hash text; v_recent int; v_global int;
  v_n int; v_distinct int; v_found int; v_fp text;
  v_total numeric; v_priced int; v_id uuid; v_inserted boolean;
begin
  if coalesce(p_website, '') <> '' then return null; end if;           -- bot: pretend success

  if jsonb_typeof(p_items) <> 'array' then raise exception 'invalid_items'; end if;
  select count(*), count(distinct e->>'component_id') into v_n, v_distinct
    from jsonb_array_elements(p_items) e;
  if v_n < 2 or v_n > 30 or v_n <> v_distinct then raise exception 'invalid_items'; end if;

  select count(*) into v_found from components c
   where c.is_active and c.id in (select (e->>'component_id')::uuid from jsonb_array_elements(p_items) e);
  if v_found <> v_n then raise exception 'unknown_component'; end if;

  if exists (select 1 from jsonb_array_elements(p_items) e
              where coalesce((e->>'quantity')::int, 1) not between 1 and 8) then
    raise exception 'invalid_items';
  end if;

  -- rate limit: 10 / hour per pseudonymous client hash, 300 / hour globally
  v_ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
  v_hash := encode(digest(trim(v_ip), 'sha256'), 'hex');
  delete from submission_log where created_at < now() - interval '24 hours';
  select count(*) into v_recent from submission_log where submitter_hash = v_hash and created_at > now() - interval '1 hour';
  select count(*) into v_global from submission_log where created_at > now() - interval '1 hour';
  if v_recent >= 10 or v_global >= 300 then raise exception 'rate_limited'; end if;
  insert into submission_log (submitter_hash) values (v_hash);

  select encode(digest(string_agg((e->>'component_id') || ':' || coalesce(e->>'quantity','1'), ',' order by e->>'component_id'), 'sha256'), 'hex')
    into v_fp from jsonb_array_elements(p_items) e;

  select sum(x.qty * m.min_price), count(m.min_price) into v_total, v_priced
    from (select (e->>'component_id')::uuid cid, coalesce((e->>'quantity')::int,1) qty
            from jsonb_array_elements(p_items) e) x
    join components c on c.id = x.cid and c.type <> 'accessory'
    left join (select component_id, min(price) min_price from component_offers
                where price is not null and in_stock is distinct from false group by component_id) m
      on m.component_id = x.cid;

  insert into user_builds (fingerprint, label, lang, advisor_answers, total_snapshot, priced_count, items_count)
  values (v_fp, left(p_label, 80), nullif(p_lang,''), p_answers, v_total, v_priced, v_n)
  on conflict (fingerprint) do update
     set submit_count = user_builds.submit_count + 1,
         last_submitted_at = now(),
         status = case when user_builds.status = 'archived' then 'new' else user_builds.status end
  returning id, (xmax = 0) into v_id, v_inserted;

  if v_inserted then
    insert into user_build_items (user_build_id, component_id, quantity)
    select v_id, (e->>'component_id')::uuid, coalesce((e->>'quantity')::smallint, 1)
      from jsonb_array_elements(p_items) e;
  end if;
  return v_id;
end $$;

revoke all on function public.submit_user_build(jsonb, text, text, jsonb, text) from public;
grant execute on function public.submit_user_build(jsonb, text, text, jsonb, text) to anon, authenticated;

-- ---------- 4. Price summary view (used by Home cards and advisor) ----------
create or replace view public.build_price_summary with (security_invoker = true) as
select bi.build_id,
  coalesce(sum(bi.quantity * m.min_price) filter (where c.type <> 'accessory'), 0) as total_best,
  count(*)               filter (where c.type <> 'accessory') as items_count,
  count(m.min_price)     filter (where c.type <> 'accessory') as priced_count,
  coalesce(sum(bi.quantity * m.min_price) filter (where c.type = 'accessory'), 0) as accessories_total_best
from build_items bi
join components c on c.id = bi.component_id
left join (select component_id, min(price) as min_price from component_offers
            where price is not null and in_stock is distinct from false group by component_id) m
       on m.component_id = bi.component_id
group by bi.build_id;
grant select on public.build_price_summary to anon, authenticated;

-- ---------- 5. Row Level Security ----------
-- Components: public sees active only; admin sees all.
alter table components enable row level security;
drop policy if exists "Public read active components" on components;
create policy "Public read active components" on components for select using (is_active or public.is_admin());
drop policy if exists "Admin write components" on components;
create policy "Admin write components" on components for all using (public.is_admin()) with check (public.is_admin());

-- Standard tables: public read, admin write.
do $$
declare t text;
begin
  foreach t in array array['component_offers','build_items','build_videos','app_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'Public read ' || t, t);
    execute format('create policy %I on %I for select using (true)', 'Public read ' || t, t);
    execute format('drop policy if exists %I on %I', 'Admin write ' || t, t);
    execute format('create policy %I on %I for all using (public.is_admin()) with check (public.is_admin())', 'Admin write ' || t, t);
  end loop;
  -- Visitor builds: admin only (visitors write through the RPC).
  foreach t in array array['user_builds','user_build_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'Admin all ' || t, t);
    execute format('create policy %I on %I for all using (public.is_admin()) with check (public.is_admin())', 'Admin all ' || t, t);
  end loop;
  -- Harden legacy tables: replace "any authenticated user" with is_admin().
  foreach t in array array['stores','builds','parts','tools'] loop
    execute format('drop policy if exists %I on %I', 'Authenticated write ' || t, t);
    execute format('drop policy if exists %I on %I', 'Admin write ' || t, t);
    execute format('create policy %I on %I for all using (public.is_admin()) with check (public.is_admin())', 'Admin write ' || t, t);
  end loop;
end $$;

-- Builds: public sees published only.
drop policy if exists "Public read builds" on builds;
drop policy if exists "Public read published builds" on builds;
create policy "Public read published builds" on builds for select using (is_published or public.is_admin());

-- Storage: replace "authenticated" with is_admin() for the three buckets.
do $$
declare b text;
begin
  foreach b in array array['build-images','store-logos','part-images'] loop
    execute format('drop policy if exists %I on storage.objects', 'Authenticated upload ' || b);
    execute format('drop policy if exists %I on storage.objects', 'Authenticated update ' || b);
    execute format('drop policy if exists %I on storage.objects', 'Authenticated delete ' || b);
    execute format('drop policy if exists %I on storage.objects', 'Admin upload ' || b);
    execute format('drop policy if exists %I on storage.objects', 'Admin update ' || b);
    execute format('drop policy if exists %I on storage.objects', 'Admin delete ' || b);
    execute format('create policy %I on storage.objects for insert with check (bucket_id = %L and public.is_admin())', 'Admin upload ' || b, b);
    execute format('create policy %I on storage.objects for update using (bucket_id = %L and public.is_admin())', 'Admin update ' || b, b);
    execute format('create policy %I on storage.objects for delete using (bucket_id = %L and public.is_admin())', 'Admin delete ' || b, b);
  end loop;
end $$;

-- ---------- 6. Legacy data migration (idempotent; legacy tables are kept) ----------
insert into components (type, name, image_url)
select p.type, min(trim(p.part_name)), (array_agg(p.image_url) filter (where p.image_url is not null))[1]
from parts p
where trim(p.part_name) <> ''
group by p.type, lower(trim(p.part_name))
on conflict (type, lower(name)) do nothing;

insert into component_offers (component_id, store_id, url, price_source)
select distinct on (c.id, p.store_link) c.id, p.store_id, trim(p.store_link), 'manual'
from parts p
join components c on c.type = p.type and lower(c.name) = lower(trim(p.part_name))
where p.store_link is not null and trim(p.store_link) <> ''
on conflict (component_id, url) where url is not null do nothing;

insert into build_items (build_id, component_id)
select distinct on (p.build_id, c.id) p.build_id, c.id
from parts p
join components c on c.type = p.type and lower(c.name) = lower(trim(p.part_name))
on conflict (build_id, component_id) do nothing;

insert into components (type, name)
select 'accessory', min(trim(t.tool_name)) from tools t
where trim(t.tool_name) <> ''
group by lower(trim(t.tool_name))
on conflict (type, lower(name)) do nothing;

insert into component_offers (component_id, store_id, url, price_source)
select distinct on (c.id, t.store_link) c.id, t.store_id, trim(t.store_link), 'manual'
from tools t
join components c on c.type = 'accessory' and lower(c.name) = lower(trim(t.tool_name))
where t.store_link is not null and trim(t.store_link) <> ''
on conflict (component_id, url) where url is not null do nothing;

insert into build_items (build_id, component_id)
select distinct on (t.build_id, c.id) t.build_id, c.id
from tools t
join components c on c.type = 'accessory' and lower(c.name) = lower(trim(t.tool_name))
on conflict (build_id, component_id) do nothing;

-- ---------- 7. Verification (read the output, do not skip) ----------
-- select (select count(*) from parts) as legacy_parts,
--        (select count(*) from build_items bi join components c on c.id = bi.component_id where c.type <> 'accessory') as migrated_part_items,
--        (select count(*) from tools) as legacy_tools,
--        (select count(*) from build_items bi join components c on c.id = bi.component_id where c.type = 'accessory') as migrated_tool_items;
```

### 5.2 Notes and known limitations of the migration

- Legacy parts with a store selected but **no link** lose that store association (offers require a URL to be unique). Acceptable; mention it to the owner after migration.
- Legacy "same name, different link" parts become **multiple offers** of one component (desired).
- `perf_tier` (1–5) and `specs` start empty. The owner (or Claude Code with owner-provided data) must fill CPU/GPU `perf_tier` before the advisor is useful. Define the tiers in the admin UI help text:
  1 = entry / esports at 1080p low-medium; 2 = solid 1080p; 3 = high 1080p / entry 1440p; 4 = strong 1440p / entry 4K; 5 = high-end 4K.
- **Owner steps (print these when Phase 1 completes):** (1) replace `OWNER_EMAIL_HERE`; (2) run the file in the Supabase SQL editor; (3) run the verification query and confirm counts match; (4) in Supabase Auth settings, disable public sign-ups; (5) confirm they can still log in to `/admin`.

### 5.3 Spec fields per component type (stored in `components.specs`)

| Type | Fields (key: type) |
|---|---|
| cpu | `socket: string`, `cores: int`, `threads: int`, `tdp_w: int`, `integrated_gpu: bool`, `includes_cooler: bool` |
| motherboard | `socket: string`, `ram_type: "DDR4"\|"DDR5"`, `form_factor: "ATX"\|"mATX"\|"ITX"`, `m2_slots: int` |
| gpu | `vram_gb: int`, `tdp_w: int`, `length_mm: int` |
| ram | `ram_type: "DDR4"\|"DDR5"`, `capacity_gb: int` (total kit), `speed_mhz: int`, `modules: int` |
| ssd_nvme / ssd_sata / hdd_* | `capacity_gb: int` |
| cpu_cooler | `cooler_kind: "air"\|"aio"`, `sockets: string[]`, `height_mm: int`, `radiator_mm: int` |
| psu | `wattage: int`, `efficiency: string` (e.g. "80+ Gold"), `modular: bool` |
| case | `form_factors: string[]` (supported), `max_gpu_length_mm: int`, `max_cooler_height_mm: int` |
| accessory | `category: "keyboard"\|"mouse"\|"headset"\|"monitor"\|"desk"\|"chair"\|"other"`, optional `resolution`, `refresh_hz` for monitors |

Define these in one config (`src/lib/specSchema.ts`) that drives both the admin form (dynamic inputs) and the compatibility logic. All spec fields are **optional**; missing data disables the related check instead of failing.

---

## 6. Frontend design

### 6.1 Types (`src/types/index.ts`)

- Add `ComponentType` (12 values above), `COMPONENT_TYPES`, `CORE_SLOTS`, `STORAGE_TYPES`, and keep `PartType`/`PART_TYPES` temporarily as deprecated aliases so legacy code compiles until Phase 3 removes it.
- Add `Component`, `ComponentOffer`, `BuildItem`, `BuildItemWithComponent` (item + component + offers), `BuildVideo`, `UserBuild`, `UserBuildItem`, `AppSettings`, `PriceSummary`, `AdvisorAnswers`.
- `Build` gains `is_published: boolean`.

### 6.2 Data access (new files; do NOT create a `src/lib/api/` folder — it would shadow `src/lib/api.ts`)

- `src/lib/catalogApi.ts`: `fetchComponents({type?, search?, includeInactive?})`, `fetchComponentWithOffers(id)`, `createComponent`, `updateComponent`, `deleteComponent` (surface the FK `restrict` error as a friendly i18n message "used in N builds"), `upsertOffer`, `deleteOffer`, `touchOfferPrice(id)`.
- `src/lib/buildsApi.ts`: `fetchBuildsWithSummary(category?)` (builds + `build_price_summary`), `fetchBuildFull(id)` using one nested select: `builds.select('*, build_items(*, components(*, component_offers(*))), build_videos(*)')`, `saveBuildItems(buildId, items)` (diff-based upsert/delete), videos CRUD.
- `src/lib/userBuildsApi.ts`: `submitUserBuild(payload)` → `supabase.rpc('submit_user_build', …)`; admin: `fetchUserBuilds(status?)`, `updateUserBuildStatus`, `deleteUserBuild`, `publishUserBuildAsBuild(userBuildId, {name_ar, name_en, category})` (creates a `builds` row with `is_published=true`, copies items to `build_items`, sets `user_builds.status='published'` and `published_build_id`).
- `src/lib/settingsApi.ts`: `fetchSettings()` (cached in memory for the session), `updateSetting(key, value)`.
- Keep the existing exports in `src/lib/api.ts` working (stores, storage upload). Extend `uploadImage` bucket union only if needed (`part-images` already exists and is used for component images).

### 6.3 Pure logic libraries (unit-tested with vitest)

**`src/lib/pricing.ts`**
```ts
export function bestOffer(offers: ComponentOffer[]): ComponentOffer | null;
  // cheapest offer with price != null and in_stock !== false; ties → most recently updated
export function computeTotals(items: BuildItemWithComponent[]): {
  total: number;            // Σ qty × bestOffer.price, non-accessory items only
  accessoriesTotal: number;
  itemsCount: number;       // non-accessory items
  pricedCount: number;
  missingCount: number;
  isPartial: boolean;       // missingCount > 0
};
export function totalsByStore(items): Array<{ storeId: string | null; total: number; coveredCount: number; itemsCount: number }>;
export function isStale(updatedAt: string | null, staleDays: number): boolean;
```
Keep the logic identical to the SQL view `build_price_summary` and to the RPC's snapshot calculation. Add a comment in all three places pointing to each other.

**`src/lib/compatibility.ts`** — `checkCompatibility(items): CompatWarning[]` — **soft warnings only, never blocking**. A rule runs only if all required spec fields exist.

| Rule id | Condition for warning | Severity |
|---|---|---|
| `socket_mismatch` | cpu.socket ≠ motherboard.socket | error |
| `ram_type_mismatch` | ram.ram_type ≠ motherboard.ram_type | error |
| `case_form_factor` | motherboard.form_factor not in case.form_factors | error |
| `gpu_too_long` | gpu.length_mm > case.max_gpu_length_mm | error |
| `cooler_too_tall` | cooler.height_mm > case.max_cooler_height_mm | error |
| `cooler_socket` | cpu.socket not in cooler.sockets | error |
| `psu_underpowered` | psu.wattage < 1.4 × (cpu.tdp_w + gpu.tdp_w) + 75 | warning |
| `no_gpu_no_igpu` | no gpu and cpu.integrated_gpu ≠ true | warning |
| `no_cooler` | no cooler and cpu.includes_cooler ≠ true | warning |
| `no_storage` | no ssd/hdd item | warning |

Each warning returns `{ id, severity, params }`; the UI translates `compat.<id>` with `params`.

**`src/lib/youtube.ts`** — `parseYouTube(input): { id: string; start?: number } | null` accepting `youtu.be/ID`, `youtube.com/watch?v=ID`, `/shorts/ID`, `/embed/ID`, `&t=90s|90`. Reject anything else. Embed URL is always built as `https://www.youtube-nocookie.com/embed/${id}?start=${start ?? 0}&rel=0` — never use user-supplied URLs in an iframe `src`.

**`src/lib/advisor.ts`** — see Phase 7.

**`src/lib/format.ts`**, **`src/lib/i18nData.ts`** — see section 4.

### 6.4 Admin UI

Replace the single-page `AdminDashboard` with an `AdminLayout` (tab nav + `<Outlet/>`) and nested routes (section 3). `/admin` redirects to `/admin/builds`. Keep `ProtectedRoute`, but change its check from "has session" to "has session **and** `is_admin()` returns true" (call `supabase.rpc('is_admin')` once after login, cache in `AuthContext` as `isAdmin`). A logged-in non-admin sees a bilingual "no access" message and a logout button.

**Components tab (`/admin/components`)**
- Sub-tabs (chips): Case · CPU · GPU · RAM · SSD (nvme + sata) · HDD · CPU Cooler · PSU · Motherboard · Accessories. Each lists its type(s) with search box, image thumbnail, name, best price, offers count, "active" toggle, "used in N builds".
- Create/edit drawer: type, name, optional Arabic name, brand, image upload (`part-images`), `perf_tier` select (CPU/GPU only, with the tier legend), dynamic spec inputs from `specSchema.ts`, `is_active`.
- **Offers editor** inside the drawer: rows of store select, URL, price (SAR), in-stock tri-state, "last updated" label, quick "Price confirmed today" button (sets `price_updated_at = now()`), delete. Validate URL (http/https only). Stale offers (older than `price_stale_days`) show a warning badge.
- "Duplicate component" action (speeds up entering similar items).

**Builds tab (`/admin/builds`)** — list with image, names, category, published toggle, **total price (best)** and `priced_count/items_count`, edit/delete.

**Add/edit build page (`/admin/builds/new`, `/admin/builds/:id`)**
1. *Basics* — existing `BuildForm` fields (move to a section; use i18n for console options), plus `is_published`.
2. *Components* — one row per **core slot** (Case, CPU, GPU, RAM, Storage, CPU Cooler, PSU, Motherboard) with a searchable select backed by the catalog (shows image, name, best price). RAM and Storage rows allow **multiple items with quantity**. Below: an **Accessories** block (multi-select of `accessory` components). Empty slots are allowed (e.g. budget build without a separate cooler).
3. *Summary panel (sticky)* — live total, partial-price notice, per-item prices, compatibility warnings, per-store totals.
4. *Videos* — add/remove/reorder: paste a YouTube URL (parsed by `parseYouTube`), titles (ar/en), game, resolution, settings, approximate FPS, start time. Show a small preview.
5. *Image* — the existing `CompositeEditor` fed from the selected components (adapter, see Phase 3) and plain image upload.
6. Save is explicit (button); show unsaved-changes guard.

**Prices tab (`/admin/prices`)** — queue of offers ordered by oldest/missing `price_updated_at`: store logo, component, "Open store page" (new tab, `rel="noopener noreferrer"`), inline price input + in-stock toggle + Save. Filter by store. This is the manual workflow that works without any API.

**Visitor builds tab (`/admin/visitor-builds`)** — inbox sorted by status (`new` first) then `last_submitted_at`; badge with count of `new` on the tab. Row shows label, `submit_count` ("N visitors built this"), items count, **live recomputed total** vs `total_snapshot`, language, answers summary. Detail view lists components with prices and compat warnings. Actions: *Publish as build* (modal asking `name_ar`, `name_en`, category — suggest a category from total/GPU tier), *Mark reviewed*, *Archive*, *Delete*.

**Settings tab** — `setup_allowance_sar`, `price_stale_days`.

**Stores tab** — existing `StoresManager`, unchanged except i18n parity and logical-direction classes.

### 6.5 Public UI

**Navbar:** Home · Advisor · Builder + language toggle + admin link; responsive (collapses to a menu on small screens).

**Home:** `BuildCard` shows the total badge: `formatMoney(total_best)`; if partial, "from {{amount}}" / "starting at" with a tooltip "some prices missing"; if no prices, no badge. Keep category toggle and console comparison logic. Fetch via `fetchBuildsWithSummary`.

**Build detail:** 
- Components grouped by slot (multiple RAM/storage rows supported). Each row (successor of `SpecRow`, keep copy-name and copy-link buttons): name, best price + store badge, expandable list of **all store offers** (store, price, stock, last updated, open link, copy link).
- Total card: PC total, accessories subtotal (separate), partial warning, last price update date, optional "all from one store" comparison (`totalsByStore`).
- Compatibility warnings (if any specs exist).
- **Videos section** (if any): lazy-loaded facade (thumbnail + play button; iframe created only on click), caption with title, game, resolution, settings, "≈ N FPS", and a visible "Approximate performance — results vary" note (i18n).
- Actions: **Export PDF** (print), **Copy shopping list** (plain text: `Name — URL` per line with section headers, in the current UI language), **Open in builder** (clone this build into `/builder`).
- Console comparison block stays as is.

**PDF export (fallback #2):** browser print, not a PDF library (jsPDF breaks Arabic shaping). Implement `BuildPrintSheet` rendered inside the page as `hidden print:block`; add `@media print` rules in `index.css` that force a light theme (white background, black text), hide navbar/buttons, avoid page-breaks inside rows. Content: logo/site name, build name, date, language-aware headings, a table of **component name · best price · store · full URL as visible text** (URLs must be printed in full, not only as hyperlinks), total, note "Prices may have changed". `ExportPdfButton` calls `window.print()` and shows a hint "Choose 'Save as PDF'". Test in Chrome with both languages (RTL table alignment!).

**Builder (`/builder`)**
- Slots UI mirrors the admin (core slots + extra storage + accessories). Slot opens a picker dialog: search, type filter, image, name, best price, "incompatible" badge when a spec-based rule would fail against current selections (soft — still selectable).
- Right/bottom panel: selected list, totals (partial notice), compat warnings, buttons **Save** (submit to admin), **Export PDF**, **Copy list**, **Reset**.
- Draft persisted in `localStorage` key `mgxpc-draft-build` (try/catch; versioned JSON). Prefill via query `?budget=&gpuTier=&cpuTier=` (from the advisor) and via "Open in builder" (`?from=<buildId>`).
- **Save flow:** optional label (≤80 chars), hidden honeypot input named `website` (`tabindex=-1`, `aria-hidden`, visually hidden, autocomplete off), calls `submitUserBuild`. Map RPC errors (`rate_limited`, `invalid_items`, `unknown_component`) to `errors.*` i18n keys. Success message explains the build was sent for review. **No personal data is collected**; say so in the UI copy.
- Minimum to submit: at least CPU + Motherboard + RAM (enforced client-side; the RPC enforces ≥2 distinct valid items).

**Advisor (`/advisor`)** — see Phase 7.

### 6.6 Accessibility & UX baseline

Keyboard-operable dialogs (focus trap, `Esc` closes), visible `:focus-visible` ring using `--color-red`, `aria-expanded` on accordions, labelled form controls, touch targets ≥ 40px, `prefers-reduced-motion` respected (already in CSS), images have `alt` and `loading="lazy"`, skeleton loaders consistent with existing ones.

---

## 7. Phases (execute in order)

### Phase 0 — Preflight
- Create branch `phase-0-preflight`. Run `npm ci`, `npm run lint`, `npm run build`; record baseline problems (do not fix unrelated ones unless trivial).
- Read fully: `CompositeEditor.tsx`, `ToolsEditor.tsx`, `AdminLogin.tsx`, `NotFound.tsx`, `en.json`.
- Add `vitest` (dev), `npm test` script, `scripts/check-i18n.mjs` + `lint:i18n`, and add both steps to `deploy.yml` before the build step.
- **Done when:** baseline green, i18n check passes on current files, CI workflow updated.

### Phase 1 — Database + types + API layer
- Write `supabase/v2_catalog.sql` (section 5) and `supabase/README.md`.
- Update `src/types/index.ts`, add `src/lib/catalogApi.ts`, `buildsApi.ts`, `userBuildsApi.ts`, `settingsApi.ts`, `pricing.ts`, `compatibility.ts`, `youtube.ts`, `format.ts`, `i18nData.ts`, `specSchema.ts`, with vitest tests for pricing, compatibility, youtube, format.
- Add i18n keys for `partTypes.psu`, `partTypes.accessory` (ar: "مزود الطاقة (باور)", "إكسسوار" / en: "Power Supply (PSU)", "Accessory").
- **STOP and give the owner the 5 owner steps from 5.2.** Do not continue until the owner confirms the SQL ran and verification counts match.
- **Done when:** types compile, tests pass, owner confirmed migration.

### Phase 2 — Admin shell + component catalog + offers
- `AdminLayout`, nested routes, `isAdmin` in `AuthContext`, updated `ProtectedRoute` and no-access screen.
- Components tab with sub-tabs, drawer form (dynamic specs), offers editor, duplicate action, used-in count, friendly delete error.
- Settings tab. Fix i18n strings in existing admin pieces.
- **Done when:** owner can create/edit CPU/GPU/RAM/SSD/Cooler/PSU/Case/Motherboard/Accessory components with several store offers each; migrated legacy components appear; non-admin accounts cannot write (verify with a second test user if the owner agrees, otherwise by reasoning about RLS and say so).

### Phase 3 — Add/edit build page + public pages on the new model
- Build editor page (sections 6.4 items 1–3, 5, 6) with slot pickers, multi-item RAM/storage, accessories, live summary.
- `CompositeEditor` adapter: change its prop to a minimal `{ id; type; name; image_url }[]` shape and map from `build_items → components` (keep behavior identical; verify composite generation and save-as-main-image still work).
- Switch `Home`, `BuildCard`, `BuildDetail` to the new queries (`fetchBuildsWithSummary`, `fetchBuildFull`); fix the one-part-per-type assumption; keep copy/open-link behavior.
- Remove all runtime reads of `parts`/`tools` from the frontend. Keep the tables in the DB.
- **Done when:** every migrated build renders identically (components, links, console block) on Home and detail; owner can create a new build entirely from catalog picks; no frontend query touches `parts`/`tools`.

### Phase 4 — Prices UI, PDF, copy list, stale queue
- Price display everywhere in section 6.5, `/admin/prices` queue, `BuildPrintSheet` + `ExportPdfButton`, copy-shopping-list, per-store totals.
- **Done when:** a build with mixed priced/unpriced components shows a partial total correctly; PDF preview in Chrome is readable in Arabic (RTL) and English (LTR) with full URLs; copy list works on mobile.

### Phase 5 — Performance videos
- `build_videos` admin section and public section (section 6.4/6.5). Facade loading, no autoplay, `youtube-nocookie.com`.
- **Done when:** adding a YouTube link in admin shows a preview; public page lazy-loads the player only on click; invalid links are rejected with a translated message.

### Phase 6 — Public builder + visitor submissions inbox
- `/builder` page, draft persistence, honeypot, RPC integration, error mapping.
- `/admin/visitor-builds` inbox with publish-as-build flow, tab badge.
- **Done when:** submitting the same configuration twice increments `submit_count` instead of creating a duplicate; 11 rapid submissions from one client hit the rate limit with a translated message; a visitor build can be published to a public build in one click; anonymous users cannot read `user_builds` (confirm a direct `select` on it returns no rows).

### Phase 7 — Advisor (`/advisor`)

**Question flow** (one question per screen, progress indicator, back button, answers kept in state + `sessionStorage` key `mgxpc-advisor`):

| # | Key | Question (ar / en) | Answers |
|---|---|---|---|
| 1 | `budget` | كم ميزانيتك؟ / What is your budget? | number input (SAR) + quick presets |
| 2 | `hasSetup` | عندك سيت أب؟ (كيبورد، ماوس، سماعة، شاشة، مكتب وكرسي) / Do you already have a setup? (keyboard, mouse, headset, monitor, desk & chair) | `yes` / `no` |
| 2b | `setupPlan` | (only if `no`) تبي تشتريه ضمن ميزانيتك أو لحاله؟ / Buy it within this budget or separately? | `within_budget` / `separate` |
| 3 | `gameType` | وش نوع الألعاب اللي تلعبها؟ / What kind of games do you play? | `competitive` (shooters/esports), `light`, `aaa` (heavy AAA) |
| 4 | `usage` | للألعاب فقط أو للدراسة كمان؟ / Gaming only, or study too? | `gaming_only` / `study_and_gaming` |
| 5 | `quality` | أي جودة تبيها؟ / What quality do you want? | `1080p`, `1440p`, `4k` |
| 6 | `monitor` | (only if `hasSetup = yes`) وش مواصفات شاشتك؟ / What is your monitor? | resolution `1080p/1440p/4k` + refresh `60/144/240` (+ "not sure") |

**Rules (implement in `src/lib/advisor.ts`, pure + tested):**
1. `effectiveBudget = budget − setup_allowance_sar` when `hasSetup = no` and `setupPlan = within_budget` (allowance from `app_settings`); otherwise `budget`. If `setupPlan = separate`, show a note that setup costs extra.
2. `targetResolution = min(quality, monitorResolution)` when a monitor is known; if clamped, tell the user why.
3. `requiredGpuTier` from this table:

| gameType \ resolution | 1080p | 1440p | 4k |
|---|---|---|---|
| competitive | 2 | 3 | 4 |
| light | 1 | 2 | 3 |
| aaa | 3 | 4 | 5 |

4. `requiredCpuTier = max(1, requiredGpuTier − 1)`, +1 (cap 5) when `gameType = competitive` and refresh ≥ 144.
5. `study_and_gaming` → prefer builds with total RAM ≥ 16 GB and at least one SSD; otherwise rank lower and flag.
6. Candidate builds: published, with `priced_count = items_count` (complete prices). Builds with partial prices go to a separate "price incomplete" group.
7. Ranking: (a) within budget and GPU tier ≥ required and CPU tier ≥ required — closest tier first, then lowest price; (b) within budget but below target — flagged "below your target"; (c) if none in (a), show "to reach your target you need about X SAR" using the cheapest build that meets the tiers, plus a CTA to the builder prefilled with `?budget=…&gpuTier=…&cpuTier=…`.
8. If `hasSetup = no`, optionally list accessory suggestions grouped by `specs.category` that fit the setup allowance.
9. Builds' tiers are derived from their GPU/CPU components' `perf_tier`; a build whose GPU/CPU has no `perf_tier` is excluded from matching and the admin sees a warning on the build editor ("set perf tier").

**Done when:** all answer paths produce sensible output in both languages; unit tests cover the tier table, clamping, budget math, and the "no result" branch.

### Phase 8 — Automatic price sync (optional; needs owner credentials)
Do **not** start without the owner's explicit go-ahead.
- Architecture: scheduled job (Supabase Edge Function + `pg_cron`, or a GitHub Actions cron) → store adapters → updates `component_offers.price / in_stock / price_updated_at` with `price_source = 'api'`. Secrets live only in function/Actions secrets. Add a `price_sync_log` table (offer id, status, message, timestamp) and show last-sync status in `/admin/prices`.
- **Amazon:** the Product Advertising API 5.0 is deprecated; Amazon's replacement is the **Creators API** (REST, OAuth 2.0, `GetItems` returns offers/prices; credentials are created per marketplace in Associates Central and access has eligibility requirements). **Before writing code, verify with current Amazon documentation: eligibility, whether the Saudi marketplace is supported for this account, rate limits and terms.** If not available, keep manual pricing for Amazon.
- **AliExpress:** check the current AliExpress affiliate / open-platform API terms and access; same rule — verify before building.
- **Other stores:** manual pricing through `/admin/prices`. Do **not** scrape sites whose terms or robots rules forbid it. If the owner wants scraping for a specific store, ask for written confirmation that it is allowed and rate-limit it.
- Prices in affiliate APIs may have contractual display/caching rules (e.g. requirements to show last-updated time or to refresh within limited windows) — read the terms and implement what they require. The UI already shows "last updated"; keep it prominent.
- **Done when:** a sync run updates prices for at least one real store, failures are logged without breaking the site, and stale-price badges reflect the sync.

### Phase 9 — Hardening, QA, cleanup
- Full pass in Arabic and English on a 360px phone viewport and desktop. RTL layout check of every new page (admin included).
- `lint`, `lint:i18n`, `test`, `build` all green; Lighthouse sanity on Home and Build detail (no regressions from videos: iframes must not load until click).
- Update `README.md` (feature list, run order for SQL, env vars) and `SETUP.md` (new admin steps: `admins` row, disable sign-ups).
- **Only with explicit owner approval:** a follow-up SQL file `supabase/v3_drop_legacy.sql` dropping `parts` and `tools`. Never include it in earlier phases.

---

## 8. Decisions that need the owner (use these defaults unless told otherwise)

1. **Setup allowance** used by the advisor when the user buys the setup within budget: placeholder **1500 SAR** — owner must set a realistic number in `/admin/settings`.
2. **Price staleness threshold:** 14 days.
3. **Accessories excluded from the PC total** and shown as a separate subtotal.
4. **Currency:** SAR only for now (the `currency` column exists for later).
5. **Which stores** to seed beyond Amazon and AliExpress (Saudi retailers): owner adds them in `/admin/stores`; do not invent store names or URLs.
6. **Amazon/AliExpress API access** (Phase 8): the owner must confirm they have/qualify for credentials.
7. **Visitor submission storage:** only the build, optional label, language and advisor answers are stored, plus a pseudonymous rate-limit hash purged after 24 hours. If the owner wants to collect contact details later, that needs a separate privacy review.

---

## 9. Non-goals

No checkout/cart/payments, no visitor accounts, no live price scraping by default, no server of our own (stay on GitHub Pages + Supabase), no new CSS framework, no image generation features beyond the existing composite editor.

---

## 10. Global acceptance checklist (final)

- [ ] Admin can manage all 9 component groups (Case, CPU, GPU, RAM, SSD, CPU Cooler, PSU, Motherboard, Accessories/extra parts), each with multi-store offers and prices.
- [ ] A build is created by picking catalog components; totals update live; accessories are separate.
- [ ] Public pages show per-component and total prices, with partial-price handling and last-updated dates.
- [ ] Fallbacks work: store link per component; PDF export with names + full purchase links (Arabic and English).
- [ ] Videos attach to builds and load lazily.
- [ ] Visitor builds are stored (deduplicated with counts), rate-limited, visible only to the admin, and publishable as builds in one click.
- [ ] Advisor flow works end-to-end and prefills the builder.
- [ ] Whole site works in Arabic (RTL) and English (LTR) with key parity enforced by CI.
- [ ] Only `admins` can write (RLS + storage), public sign-ups disabled (owner-confirmed).
- [ ] `npm run lint`, `lint:i18n`, `test`, `build` pass; deployment to GitHub Pages still works including deep links (`404.html` fallback).
