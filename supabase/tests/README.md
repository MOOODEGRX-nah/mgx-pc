# Database tests

Automated tests for the SQL files in `supabase/`. They run on a **throw-away local Postgres**, never on the
real Supabase project. `stub.sql` recreates the small part of Supabase the migrations rely on
(`anon`/`authenticated` roles, `auth.users`, `auth.uid()`, `storage.buckets/objects`).

## What they check

- Fresh install: `schema.sql` + `v2_catalog.sql`.
- Legacy install: `schema.sql` + old migrations + edge-case data (`legacy_data.sql`) + `v2_catalog.sql`,
  with exact expected counts; running `v2_catalog.sql` a second time changes nothing.
- `rls_test.sql` (36 checks): what anonymous visitors, a logged-in non-admin and the admin can read and write,
  hidden unpublished builds, storage uploads, `submit_user_build` validation, dedupe, honeypot and rate limit,
  best-price rules, and the "component in use" delete protection.

## Run

Needs a Postgres 15+ superuser. With Docker:

```bash
docker run -d --name mgx-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash supabase/tests/run.sh
```

On Windows run it from Git Bash or WSL. Expected last line: `ALL DATABASE TESTS PASSED`.
The script drops and recreates the database `mgx_v2_test` (override with `TEST_DB=...`).

Run it after every change to a `.sql` file. When you add tables or policies, add checks to `rls_test.sql`.
