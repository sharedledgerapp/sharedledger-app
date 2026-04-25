-- Task #89: Let users pin favourite notes so they always appear at the top
-- Applied: 2026-04-25
-- Safe to re-run: uses IF NOT EXISTS

ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
