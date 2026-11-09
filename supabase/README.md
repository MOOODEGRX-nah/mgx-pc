# Supabase SQL files

Run these in the Supabase dashboard: **SQL Editor → New query → paste → Run**.

## Run order

| Step | File | When |
|---|---|---|
| 1 | `schema.sql` | Fresh project only (creates the v1 tables, buckets and sample data). Skip if your project already has the `builds` table. |
| 2 | `add_part_images.sql`, `add_console_category.sql` | Optional. Legacy migrations; `v2_catalog.sql` repairs everything they add, so you can skip them on a fresh install. |
| 3 | `v2_catalog.sql` | Required. Component catalog, store offers and prices, build items, videos, visitor builds, settings, and the admin-only write policies. |

## Before running `v2_catalog.sql`

1. Open the file and replace `OWNER_EMAIL_HERE` with the email you use to log in to `/admin`
   (it must already exist under **Authentication → Users**).
2. The script runs in a single transaction. If the email is wrong it stops with
   `admins table is empty …` and changes nothing; fix the email and run it again.

## After running it

1. Read the result table at the bottom of the output. `admins_count` must be at least 1.
   On the first run, `legacy_part_rows` must equal `migrated_part_qty` and
   `legacy_tool_rows` must equal `migrated_tool_qty`.
2. **Authentication → Sign In / Providers** (older dashboards: **Authentication → Settings**):
   turn off **Allow new users to sign up**.
   Writes are already limited to the `admins` table, but there is no reason to allow
   strangers to create accounts.
3. Log in to `/admin` and confirm you can still edit builds.

## Re-running

`v2_catalog.sql` is idempotent. The one-time copy of legacy `parts`/`tools` rows into
the catalog is recorded in `app_settings.legacy_migrated_at` and is skipped on re-runs,
so it never undoes edits you made in the new admin. To repeat the copy deliberately,
delete that row first.

## Known limitations of the legacy copy

- A legacy part that had a store selected but **no link** loses its store association
  (store offers are keyed by URL). Re-add those offers in the admin.
- Parts with the same name (case-insensitive) become one catalog component. Different
  links for that name become separate store offers of the same component.
- Listing the same part twice in one build becomes one item with quantity 2.
- `specs` and `perf_tier` start empty; fill them in the admin for compatibility checks
  and the advisor.

## Managing admins

```sql
-- add another admin
insert into admins (user_id) select id from auth.users where lower(email) = lower('someone@example.com');
-- remove one
delete from admins where user_id = (select id from auth.users where lower(email) = lower('someone@example.com'));
```

The legacy tables `parts` and `tools` are kept untouched for now. They will be dropped
only after the owner approves it (a separate `v3_drop_legacy.sql`).
