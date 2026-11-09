-- Security and RPC tests for v2_catalog.sql. Fails (non-zero exit) on the first broken expectation.
-- Run by run.sh after the migration has been applied.
\set ON_ERROR_STOP 1

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

-- The statement must fail with an error message matching `pattern`.
create function pg_temp.expect_error(stmt text, pattern text, what text) returns void language plpgsql as $$
declare succeeded boolean := false;
begin
  begin
    execute stmt;
    succeeded := true;
  exception when others then
    if sqlerrm !~* pattern then raise exception 'FAILED: % (expected error /%/, got: %)', what, pattern, sqlerrm; end if;
  end;
  if succeeded then raise exception 'FAILED: % (statement succeeded, expected error /%/)', what, pattern; end if;
  raise notice 'ok: %', what;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------- setup (as superuser) ----------
select string_agg(id::text, ',' order by type) as ids
  from (select distinct on (type) id, type from components where type in ('cpu','motherboard','ram') order by type, name) s \gset
select split_part(:'ids', ',', 1) as cpu, split_part(:'ids', ',', 2) as board, split_part(:'ids', ',', 3) as ram \gset
update builds set is_published = false where category = 'high-end';

-- ---------- anonymous visitor ----------
set role anon;
set request.headers = '{"x-forwarded-for":"1.2.3.4, 10.0.0.1"}';
select pg_temp.expect((select count(*) from builds) = 2, 'anon sees only published builds');
select pg_temp.expect(not exists (select 1 from build_items bi where not exists (select 1 from builds b where b.id = bi.build_id)),
  'anon cannot see items of unpublished builds');
select pg_temp.expect((select count(*) from build_items) > 0, 'anon sees items of published builds');
select pg_temp.expect((select count(*) from build_price_summary) = 2, 'price summary limited to published builds');
select pg_temp.expect((select count(*) from user_builds) = 0, 'anon cannot read visitor builds');
select pg_temp.expect((select count(*) from admins) = 0, 'anon cannot read admins');
select pg_temp.expect((select count(*) from submission_log) = 0, 'anon cannot read submission_log');
select pg_temp.expect(not public.is_admin(), 'anon is not admin');
select pg_temp.expect_error($$insert into components (type, name) values ('cpu', 'hack')$$, 'row-level security', 'anon cannot insert components');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('build-images', 'x')$$, 'row-level security', 'anon cannot upload images');
with u as (update builds set name_en = 'x' returning 1) select count(*) as n from u \gset
select pg_temp.expect(:n = 0, 'anon update of builds changes nothing');
with d as (delete from build_items returning 1) select count(*) as n from d \gset
select pg_temp.expect(:n = 0, 'anon delete of build_items changes nothing');

-- submit_user_build
select submit_user_build(jsonb_build_array(
  jsonb_build_object('component_id', :'cpu'),
  jsonb_build_object('component_id', upper(:'board'), 'quantity', 2)), 'My build', 'ar', '{"budget":5000}') as id1 \gset
select pg_temp.expect(:'id1' <> '', 'visitor build accepted');
select pg_temp.expect(submit_user_build(jsonb_build_array(
  jsonb_build_object('component_id', :'board', 'quantity', '2'),
  jsonb_build_object('component_id', :'cpu', 'quantity', 1)), null, 'fr') = :'id1'::uuid,
  'same configuration (other order/case/quantity form) is deduplicated');
select pg_temp.expect(submit_user_build('[]'::jsonb, null, null, null, 'http://spam') is null, 'honeypot returns null');
select pg_temp.expect_error($$select submit_user_build('[{"component_id":"nope"},{"component_id":"nope2"}]')$$, 'invalid_items', 'malformed ids rejected');
select pg_temp.expect_error(format($$select submit_user_build('[{"component_id":"%s"}]')$$, :'cpu'), 'invalid_items', 'single item rejected');
select pg_temp.expect_error(format($$select submit_user_build('[{"component_id":"%s"},{"component_id":"%s"}]')$$, :'cpu', :'cpu'), 'invalid_items', 'duplicate items rejected');
select pg_temp.expect_error(format($$select submit_user_build('[{"component_id":"%s"},{"component_id":"%s"}]')$$, :'cpu', gen_random_uuid()), 'unknown_component', 'unknown component rejected');
select pg_temp.expect_error(format($$select submit_user_build('[{"component_id":"%s"},{"component_id":"%s","quantity":9}]')$$, :'cpu', :'ram'), 'invalid_items', 'quantity > 8 rejected');
select pg_temp.expect_error(format($$select submit_user_build('[{"component_id":"%s"},{"component_id":"%s"}]', null, null, '[1,2]')$$, :'cpu', :'ram'), 'invalid_answers', 'non-object answers rejected');
-- 2 submissions so far from this client; 8 more are allowed, the 11th is rate limited
select pg_temp.expect(bool_and(submit_user_build(jsonb_build_array(
  jsonb_build_object('component_id', :'cpu'), jsonb_build_object('component_id', :'ram', 'quantity', q))) is not null),
  '10 submissions per hour allowed') from generate_series(1, 8) q;
select pg_temp.expect_error(format($$select submit_user_build('[{"component_id":"%s"},{"component_id":"%s"}]')$$, :'board', :'ram'), 'rate_limited', '11th submission in an hour is rate limited');
set request.headers = '{"x-forwarded-for":"5.6.7.8"}';
select pg_temp.expect(submit_user_build(jsonb_build_array(
  jsonb_build_object('component_id', :'board'), jsonb_build_object('component_id', :'ram'))) is not null, 'another client is not affected');
reset role;

-- ---------- logged-in stranger (not in admins) ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect(not public.is_admin(), 'stranger is not admin');
select pg_temp.expect_error($$insert into components (type, name) values ('cpu', 'hack')$$, 'row-level security', 'stranger cannot insert components');
select pg_temp.expect_error($$insert into app_settings values ('x', '1')$$, 'row-level security', 'stranger cannot change settings');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('part-images', 'x')$$, 'row-level security', 'stranger cannot upload images');
select pg_temp.expect((select count(*) from user_builds) = 0, 'stranger cannot read visitor builds');
with u as (update stores set name = 'pwned' returning 1) select count(*) as n from u \gset
select pg_temp.expect(:n = 0, 'stranger update of stores changes nothing');
reset role;

-- ---------- admin ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect(public.is_admin(), 'owner is admin');
select pg_temp.expect((select count(*) from builds) = 3, 'admin sees unpublished builds');
insert into components (type, name, specs) values ('psu', 'Test PSU 750', '{"wattage":750}');
insert into component_offers (component_id, url, price, in_stock, price_updated_at) values (:'cpu', 'https://a.example/cpu', 999.50, true, now());
insert into component_offers (component_id, url, price, in_stock) values (:'cpu', 'https://b.example/cpu', 500, false);
select pg_temp.expect((select submit_count from user_builds where id = :'id1') = 2, 'admin sees submit_count 2 for the deduplicated build');
select pg_temp.expect((select count(*) from user_builds) = 10, 'admin sees every visitor build (1 deduplicated + 8 + 1 other client)');
select pg_temp.expect((select max(total_best) from build_price_summary) = 999.50, 'best price ignores out-of-stock offers');
select pg_temp.expect_error(format($$delete from components where id = '%s'$$, :'cpu'), 'foreign key', 'component used in a build cannot be deleted');
insert into storage.objects (bucket_id, name) values ('part-images', 'ok');
reset role;

\echo 'ALL RLS/RPC TESTS PASSED'
