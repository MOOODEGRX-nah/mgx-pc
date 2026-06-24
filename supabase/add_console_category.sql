-- Migration: Add console-equiv category and comparison fields
-- Run in Supabase SQL Editor

-- 1. Add console comparison columns
ALTER TABLE builds ADD COLUMN IF NOT EXISTS console_target text
  CHECK (console_target IN ('ps5','xbox-series-x','xbox-series-s','nintendo-switch'));
ALTER TABLE builds ADD COLUMN IF NOT EXISTS price_vs_console text
  CHECK (price_vs_console IN ('cheaper','similar','more-expensive'));
ALTER TABLE builds ADD COLUMN IF NOT EXISTS perf_vs_console text
  CHECK (perf_vs_console IN ('stronger','similar','weaker'));

-- 2. Drop old category constraint and add updated one
ALTER TABLE builds DROP CONSTRAINT IF EXISTS builds_category_check;
ALTER TABLE builds ADD CONSTRAINT builds_category_check
  CHECK (category IN ('high-end','mid-range','budget','console-equiv'));

-- Done — existing rows are unaffected (new columns are nullable)
