-- ============================================================
-- MGX(PC) — Supabase schema
-- Run this once in your Supabase project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

-- ---------- Tables ----------

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text
);

create table if not exists builds (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  category text not null check (category in ('high-end', 'mid-range', 'budget')),
  image_url text,
  description_ar text,
  description_en text,
  created_at timestamptz not null default now()
);

create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds (id) on delete cascade,
  type text not null check (
    type in (
      'case', 'motherboard', 'cpu', 'cpu_cooler', 'gpu', 'ram',
      'ssd_nvme', 'ssd_sata', 'hdd_2_5', 'hdd_3_5'
    )
  ),
  part_name text not null,
  store_id uuid references stores (id) on delete set null,
  store_link text
);

create table if not exists tools (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds (id) on delete cascade,
  tool_name text not null,
  store_id uuid references stores (id) on delete set null,
  store_link text
);

create index if not exists parts_build_id_idx on parts (build_id);
create index if not exists tools_build_id_idx on tools (build_id);
create index if not exists builds_category_idx on builds (category);

-- ---------- Row Level Security ----------
-- Public visitors can only read. Only an authenticated (logged-in) user —
-- i.e. the site owner — can insert/update/delete.

alter table stores enable row level security;
alter table builds enable row level security;
alter table parts enable row level security;
alter table tools enable row level security;

create policy "Public read stores" on stores for select using (true);
create policy "Public read builds" on builds for select using (true);
create policy "Public read parts" on parts for select using (true);
create policy "Public read tools" on tools for select using (true);

create policy "Authenticated write stores" on stores
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated write builds" on builds
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated write parts" on parts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated write tools" on tools
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- Storage buckets (public read, authenticated write) ----------

insert into storage.buckets (id, name, public)
values ('build-images', 'build-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

create policy "Public read build-images" on storage.objects
  for select using (bucket_id = 'build-images');
create policy "Public read store-logos" on storage.objects
  for select using (bucket_id = 'store-logos');

create policy "Authenticated upload build-images" on storage.objects
  for insert with check (bucket_id = 'build-images' and auth.role() = 'authenticated');
create policy "Authenticated upload store-logos" on storage.objects
  for insert with check (bucket_id = 'store-logos' and auth.role() = 'authenticated');

create policy "Authenticated update build-images" on storage.objects
  for update using (bucket_id = 'build-images' and auth.role() = 'authenticated');
create policy "Authenticated update store-logos" on storage.objects
  for update using (bucket_id = 'store-logos' and auth.role() = 'authenticated');

create policy "Authenticated delete build-images" on storage.objects
  for delete using (bucket_id = 'build-images' and auth.role() = 'authenticated');
create policy "Authenticated delete store-logos" on storage.objects
  for delete using (bucket_id = 'store-logos' and auth.role() = 'authenticated');

-- ---------- Seed data ----------
-- Two starter stores. Upload their logos later from the admin panel
-- (Stores tab) if you want the logo badges to show an image.

insert into stores (name) values ('Amazon') on conflict do nothing;
insert into stores (name) values ('AliExpress') on conflict do nothing;

-- One sample build per category so the homepage isn't empty on first load.
-- Feel free to delete these from the admin dashboard once you add real builds.

with new_build as (
  insert into builds (name_ar, name_en, category, description_ar, description_en)
  values (
    'جهاز الأداء العالي',
    'High-End Rig',
    'high-end',
    'جهاز مخصص للألعاب الثقيلة والمونتاج بأعلى إعدادات.',
    'Built for heavy gaming and rendering at max settings.'
  )
  returning id
)
insert into parts (build_id, type, part_name)
select id, t.type, t.name from new_build, (values
  ('case', 'Lian Li O11 Dynamic'),
  ('motherboard', 'ASUS ROG Strix X670E-E'),
  ('cpu', 'AMD Ryzen 9 7950X'),
  ('cpu_cooler', 'NZXT Kraken X73'),
  ('gpu', 'AMD Radeon RX 7900 XTX'),
  ('ram', '32GB DDR5 6000MHz')
) as t(type, name);

with new_build as (
  insert into builds (name_ar, name_en, category, description_ar, description_en)
  values (
    'جهاز الفئة المتوسطة',
    'Mid-Range Rig',
    'mid-range',
    'توازن ممتاز بين السعر والأداء لمعظم الألعاب الحديثة.',
    'A solid price-to-performance balance for most modern games.'
  )
  returning id
)
insert into parts (build_id, type, part_name)
select id, t.type, t.name from new_build, (values
  ('case', 'NZXT H510'),
  ('motherboard', 'MSI B650 Gaming Plus'),
  ('cpu', 'AMD Ryzen 7 7700'),
  ('cpu_cooler', 'Cooler Master Hyper 212'),
  ('gpu', 'AMD Radeon RX 9060 XT'),
  ('ram', '16GB DDR5 5600MHz')
) as t(type, name);

with new_build as (
  insert into builds (name_ar, name_en, category, description_ar, description_en)
  values (
    'جهاز الميزانية المحدودة',
    'Budget Rig',
    'budget',
    'أفضل قيمة ممكنة للألعاب الخفيفة والاستخدام اليومي.',
    'Best possible value for light gaming and everyday use.'
  )
  returning id
)
insert into parts (build_id, type, part_name)
select id, t.type, t.name from new_build, (values
  ('case', 'Cooler Master MasterBox Q300L'),
  ('motherboard', 'ASRock B450M Pro4'),
  ('cpu', 'AMD Ryzen 5 5500'),
  ('gpu', 'AMD Radeon RX 6600'),
  ('ram', '16GB DDR4 3200MHz')
) as t(type, name);
