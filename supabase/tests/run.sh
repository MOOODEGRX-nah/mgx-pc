#!/usr/bin/env bash
# Tests supabase/*.sql on a throw-away local Postgres database (never on the real project).
#
# Needs a Postgres 15+ superuser, e.g. with Docker:
#   docker run -d --name mgx-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
# then:
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash supabase/tests/run.sh
#
# Checks: fresh install (schema.sql + v2), legacy install (+ old migrations + edge-case data),
# re-running v2 changes nothing, and every RLS / RPC rule in rls_test.sql.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-mgx_v2_test}

psql_db() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
fresh_db() {
  psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
  psql_db -v DBNAME="$DB" -f tests/stub.sql
  psql_db -f schema.sql
}
apply_v2() { sed "s/OWNER_EMAIL_HERE/owner@example.com/" v2_catalog.sql | psql_db -t -A 2>/dev/null | tail -n 1; }
check_counts() { # admins|legacy_parts|migrated_parts|legacy_tools|migrated_tools|components|offers
  IFS='|' read -r admins lp mp lt mt comps offers <<<"$1"
  [ "$admins" -ge 1 ] || { echo "FAIL: no admin row"; exit 1; }
  [ "$lp" = "$mp" ] || { echo "FAIL: legacy parts $lp != migrated $mp"; exit 1; }
  [ "$lt" = "$mt" ] || { echo "FAIL: legacy tools $lt != migrated $mt"; exit 1; }
  echo "  counts ok: admins=$admins parts=$lp tools=$lt components=$comps offers=$offers"
}

echo "== fresh install: schema.sql + v2_catalog.sql"
fresh_db
check_counts "$(apply_v2)"

echo "== legacy install: + old migrations + edge-case data, then v2 twice"
fresh_db
psql_db -f add_part_images.sql
psql_db -f add_console_category.sql
psql_db -f tests/legacy_data.sql
first=$(apply_v2); check_counts "$first"
[ "$first" = "1|21|21|4|4|19|3" ] || { echo "FAIL: unexpected counts $first (expected 1|21|21|4|4|19|3)"; exit 1; }
second=$(apply_v2)
[ "$first" = "$second" ] || { echo "FAIL: re-run changed counts: $first -> $second"; exit 1; }
echo "  re-run is a no-op"

echo "== RLS / RPC"
if ! out=$(psql_db -f tests/rls_test.sql 2>&1); then
  echo "$out" | grep -E "FAILED|ERROR" | head -n 5
  exit 1
fi
echo "  $(echo "$out" | grep -c 'ok:') checks passed"
echo "ALL DATABASE TESTS PASSED"
