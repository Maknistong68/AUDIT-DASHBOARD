#!/usr/bin/env bash
# validate-db.sh — apply the harness, migrations, seed, and smoke tests
# against a local Postgres 15+ instance in a throwaway database.
#
# Usage:
#   PGHOST=<host-or-socket-dir> PGUSER=postgres ./scripts/validate-db.sh
#
# The connection must be a superuser (or a role allowed to create roles and
# databases) — the harness creates the anon/authenticated/service_role shims.

set -euo pipefail
cd "$(dirname "$0")/.."

DB="audit_dashboard_validate_$$"

createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

run() {
  psql -X -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"
  echo "ok: $1"
}

run supabase/tests/harness.sql
for f in supabase/migrations/*.sql; do
  run "$f"
done
run supabase/seed.sql
run supabase/tests/smoke_test.sql

echo "database validation passed"
