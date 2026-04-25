-- Task #82: Show who last edited a shared note and when
-- Applied: 2026-04-25
-- Safe to re-run: uses IF NOT EXISTS / column existence check

ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER REFERENCES users(id);
