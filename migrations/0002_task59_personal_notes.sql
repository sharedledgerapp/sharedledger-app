-- Task #59: Personal Notes (private, per-user)
-- Applied: 2026-04-12
-- Safe to re-run: uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS personal_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
