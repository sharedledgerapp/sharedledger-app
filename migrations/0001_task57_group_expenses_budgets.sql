-- Task #57: Group recurring expenses & independent group budgets
-- Applied: 2026-04-10
-- Safe to re-run: uses IF NOT EXISTS

ALTER TABLE recurring_expenses
  ADD COLUMN IF NOT EXISTS is_group_shared boolean DEFAULT false NOT NULL;

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS created_by_user_id integer REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by_user_id integer REFERENCES users(id);
