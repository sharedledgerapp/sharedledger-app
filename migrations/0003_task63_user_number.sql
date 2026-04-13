-- Task #63: Onboarding confetti & user counter
-- Applied: 2026-04-13
-- Safe to re-run: uses IF NOT EXISTS / column existence check

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_number INTEGER;
