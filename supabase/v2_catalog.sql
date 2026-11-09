-- ============================================================
-- MGX(PC) v2: catalog, offers, build items, videos, visitor builds
-- Idempotent. Run in the Supabase SQL editor AFTER schema.sql
-- (and after the legacy migrations, if they were not applied yet —
-- this file also repairs what they would have added).
--
-- BEFORE RUNNING: replace OWNER_EMAIL_HERE (section 1) with the email
-- you use to log in to /admin. The whole script runs in one
-- transaction: if anything fails, nothing is changed.
--
-- Safe to re-run. The legacy parts/tools -> catalog copy (section 6)
-- runs only once; a marker row in app_settings prevents re-imports
-- from undoing later edits made in the new admin.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ---------- 0. Make legacy schema consistent (fresh-install safe) ----------
alter table parts add column if not exists image_url text;
alter table builds add column if not exists console_target text;
alter table builds add column if not exists price_vs_console text;
alter table builds add column if not exists perf_vs_console text;
alter table builds drop constraint if exists builds_category_check;
alter table builds add constraint builds_category_check
  check (category in ('high-end','mid-range','budget','console-equiv'));
alter table builds drop constraint if exists builds_console_target_check;
alter table builds add constraint builds_console_target_check
  check (console_target in ('ps5','xbox-series-x','xbox-series-s','nintendo-switch'));
alter table builds drop constraint if exists builds_price_vs_console_check;
alter table builds add constraint builds_price_vs_console_check
  check (price_vs_console in ('cheaper','similar','more-expensive'));
alter table builds drop constraint if exists builds_perf_vs_console_check;
alter table builds add constraint builds_perf_vs_console_check
  check (perf_vs_console in ('stronger','similar','weaker'));
alter table builds add column if not exists is_published boolean not null default true;

insert into storage.buckets (id, name, public) values ('part-images','part-images',true)
on conflict (id) do nothing;

drop policy if exists "Public read part-images" on storage.objects;
create policy "Public read part-images" on storage.objects
  for select using (bucket_id = 'part-images');

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
select id from auth.users where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict do nothing;

do $$ begin
  if not exists (select 1 from admins) then
    raise exception 'admins table is empty: set OWNER_EMAIL_HERE to the owner login email and re-run';
  end if;
end $$;

-- ---------- 2. Catalog tables ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
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
create index if not exists build_items_component_idx on build_items (component_id);

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
create index if not exists user_builds_status_idx on user_builds (status, last_submitted_at desc);

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

-- Price logic: keep identical to src/lib/pricing.ts (computeTotals) and to
-- the build_price_summary view below. "Best price" = cheapest offer that has
-- a price and is not marked out of stock; accessories are not in the PC total.
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
  v_items jsonb;
begin
  if coalesce(p_website, '') <> '' then return null; end if;           -- bot: pretend success

  -- Shape validation (before any cast, so bad input maps to invalid_items).
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'invalid_items'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e->>'component_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or (e ? 'quantity' and coalesce(e->>'quantity', '') !~ '^[0-9]{1,2}$')
  ) then
    raise exception 'invalid_items';
  end if;

  -- Normalized items: canonical lowercase uuid + integer quantity.
  select jsonb_agg(jsonb_build_object(
           'component_id', lower(e->>'component_id'),
           'quantity', coalesce((e->>'quantity')::int, 1)))
    into v_items
    from jsonb_array_elements(p_items) e;

  select count(*), count(distinct e->>'component_id') into v_n, v_distinct
    from jsonb_array_elements(v_items) e;
  if v_n < 2 or v_n > 30 or v_n <> v_distinct then raise exception 'invalid_items'; end if;

  if exists (select 1 from jsonb_array_elements(v_items) e
              where (e->>'quantity')::int not between 1 and 8) then
    raise exception 'invalid_items';
  end if;

  select count(*) into v_found from components c
   where c.is_active and c.id in (select (e->>'component_id')::uuid from jsonb_array_elements(v_items) e);
  if v_found <> v_n then raise exception 'unknown_component'; end if;

  if p_answers is not null and (jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 2000) then
    raise exception 'invalid_answers';
  end if;

  -- rate limit: 10 / hour per pseudonymous client hash, 300 / hour globally
  v_ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
  v_hash := encode(digest(trim(v_ip), 'sha256'), 'hex');
  delete from submission_log where created_at < now() - interval '24 hours';
  select count(*) into v_recent from submission_log where submitter_hash = v_hash and created_at > now() - interval '1 hour';
  select count(*) into v_global from submission_log where created_at > now() - interval '1 hour';
  if v_recent >= 10 or v_global >= 300 then raise exception 'rate_limited'; end if;
  insert into submission_log (submitter_hash) values (v_hash);

  select encode(digest(string_agg((e->>'component_id') || ':' || (e->>'quantity'), ',' order by e->>'component_id'), 'sha256'), 'hex')
    into v_fp from jsonb_array_elements(v_items) e;

  select sum(x.qty * m.min_price), count(m.min_price) into v_total, v_priced
    from (select (e->>'component_id')::uuid cid, (e->>'quantity')::int qty
            from jsonb_array_elements(v_items) e) x
    join components c on c.id = x.cid and c.type <> 'accessory'
    left join (select component_id, min(price) min_price from component_offers
                where price is not null and in_stock is distinct from false group by component_id) m
      on m.component_id = x.cid;

  insert into user_builds (fingerprint, label, lang, advisor_answers, total_snapshot, priced_count, items_count)
  values (v_fp,
          nullif(left(trim(coalesce(p_label, '')), 80), ''),
          case when p_lang in ('ar','en') then p_lang end,
          p_answers, v_total, v_priced, v_n)
  on conflict (fingerprint) do update
     set submit_count = user_builds.submit_count + 1,
         last_submitted_at = now(),
         status = case when user_builds.status = 'archived' then 'new' else user_builds.status end
  returning id, (xmax = 0) into v_id, v_inserted;

  if v_inserted then
    insert into user_build_items (user_build_id, component_id, quantity)
    select v_id, (e->>'component_id')::uuid, (e->>'quantity')::smallint
      from jsonb_array_elements(v_items) e;
  end if;
  return v_id;
end $$;

revoke all on function public.submit_user_build(jsonb, text, text, jsonb, text) from public;
grant execute on function public.submit_user_build(jsonb, text, text, jsonb, text) to anon, authenticated;

-- ---------- 4. Price summary view (used by Home cards and advisor) ----------
-- Keep identical to src/lib/pricing.ts (computeTotals) and submit_user_build above.
create or replace view public.build_price_summary with (security_invoker = true) as
select bi.build_id,
  coalesce(sum(bi.quantity * m.min_price) filter (where c.type <> 'accessory'), 0) as total_best,
  count(*)               filter (where c.type <> 'accessory') as items_count,
  count(m.min_price)     filter (where c.type <> 'accessory') as priced_count,
  coalesce(sum(bi.quantity * m.min_price) filter (where c.type = 'accessory'), 0) as accessories_total_best,
  max(m.last_update) as last_price_update
from build_items bi
join components c on c.id = bi.component_id
left join (select component_id, min(price) as min_price, max(price_updated_at) as last_update
             from component_offers
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

-- Items and videos of unpublished builds stay hidden too (the subquery on
-- builds is itself filtered by the builds policy above).
drop policy if exists "Public read build_items" on build_items;
create policy "Public read build_items" on build_items for select
  using (exists (select 1 from builds b where b.id = build_items.build_id));
drop policy if exists "Public read build_videos" on build_videos;
create policy "Public read build_videos" on build_videos for select
  using (exists (select 1 from builds b where b.id = build_videos.build_id));

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

-- ---------- 6. Legacy data migration (runs once; legacy tables are kept) ----------
do $$
begin
  if exists (select 1 from app_settings where key = 'legacy_migrated_at') then
    raise notice 'legacy parts/tools already migrated; skipping section 6';
    return;
  end if;

  insert into components (type, name, image_url)
  select p.type, min(trim(p.part_name)), (array_agg(p.image_url) filter (where p.image_url is not null))[1]
  from parts p
  where trim(p.part_name) <> ''
  group by p.type, lower(trim(p.part_name))
  on conflict (type, lower(name)) do nothing;

  insert into component_offers (component_id, store_id, url, price_source)
  select distinct on (c.id, trim(p.store_link)) c.id, p.store_id, trim(p.store_link), 'manual'
  from parts p
  join components c on c.type = p.type and lower(c.name) = lower(trim(p.part_name))
  where p.store_link is not null and trim(p.store_link) <> ''
  on conflict (component_id, url) where url is not null do nothing;

  -- The same part listed twice in one build (e.g. two RAM sticks) becomes quantity 2.
  insert into build_items (build_id, component_id, quantity)
  select p.build_id, c.id, least(count(*), 8)
  from parts p
  join components c on c.type = p.type and lower(c.name) = lower(trim(p.part_name))
  group by p.build_id, c.id
  on conflict (build_id, component_id) do nothing;

  insert into components (type, name)
  select 'accessory', min(trim(t.tool_name)) from tools t
  where trim(t.tool_name) <> ''
  group by lower(trim(t.tool_name))
  on conflict (type, lower(name)) do nothing;

  insert into component_offers (component_id, store_id, url, price_source)
  select distinct on (c.id, trim(t.store_link)) c.id, t.store_id, trim(t.store_link), 'manual'
  from tools t
  join components c on c.type = 'accessory' and lower(c.name) = lower(trim(t.tool_name))
  where t.store_link is not null and trim(t.store_link) <> ''
  on conflict (component_id, url) where url is not null do nothing;

  insert into build_items (build_id, component_id, quantity)
  select t.build_id, c.id, least(count(*), 8)
  from tools t
  join components c on c.type = 'accessory' and lower(c.name) = lower(trim(t.tool_name))
  group by t.build_id, c.id
  on conflict (build_id, component_id) do nothing;

  insert into app_settings (key, value) values ('legacy_migrated_at', to_jsonb(now()));
end $$;

commit;

-- ---------- 7. Verification (read the output, do not skip) ----------
-- Expected on the first run: admins_count >= 1, legacy_part_rows = migrated_part_qty
-- and legacy_tool_rows = migrated_tool_qty (they can differ only if one build
-- listed the same part more than 8 times). Once builds are added in the new
-- admin, the migrated_* numbers grow; that is expected.
select (select count(*) from admins) as admins_count,
       (select count(*) from parts where trim(part_name) <> '') as legacy_part_rows,
       (select coalesce(sum(bi.quantity), 0) from build_items bi join components c on c.id = bi.component_id where c.type <> 'accessory') as migrated_part_qty,
       (select count(*) from tools where trim(tool_name) <> '') as legacy_tool_rows,
       (select coalesce(sum(bi.quantity), 0) from build_items bi join components c on c.id = bi.component_id where c.type = 'accessory') as migrated_tool_qty,
       (select count(*) from components) as components_count,
       (select count(*) from component_offers) as offers_count;
