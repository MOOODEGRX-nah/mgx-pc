-- Minimal Supabase-like environment so the migrations can be tested on plain Postgres (15+).
-- Creates the roles, auth/storage schemas and helper functions the SQL files rely on.
-- Run as a superuser, with psql variable DBNAME set (see run.sh).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema extensions;
create extension pgcrypto schema extensions;
create schema auth;
create schema storage;
create table auth.users (id uuid primary key default extensions.gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default extensions.gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage, extensions to anon, authenticated;
grant execute on all functions in schema auth, extensions to anon, authenticated;
grant all on storage.objects to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter database :"DBNAME" set search_path = public, extensions;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner@Example.com'),   -- becomes admin (case-insensitive match)
  ('00000000-0000-0000-0000-00000000000b', 'stranger@example.com'); -- logged-in non-admin
