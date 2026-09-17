#!/usr/bin/env bash
# Regenerates supabase/setup.sql: every migration plus the seed concatenated
# into one file you can paste into the Supabase Dashboard SQL Editor.
# Run this after adding or changing anything under supabase/migrations/.

set -euo pipefail
cd "$(dirname "$0")/.."

OUT=supabase/setup.sql

{
  echo "-- GENERATED FILE — do not edit. Regenerate with scripts/build-setup-sql.sh"
  echo "-- Applies the full schema + seed in one shot (Supabase Dashboard SQL Editor)."
  echo "-- Safe on a FRESH project only: migrations are not idempotent."
  echo
  for f in supabase/migrations/*.sql supabase/seed.sql; do
    echo "-- ============================================================"
    echo "-- $f"
    echo "-- ============================================================"
    cat "$f"
    echo
  done
} > "$OUT"

echo "wrote $OUT"
