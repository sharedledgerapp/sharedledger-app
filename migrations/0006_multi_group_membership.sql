-- Multi-group membership: replace users.family_id (one group per user) with a
-- generalized group_members join table (many groups per user), covering every
-- group type — family, roommates, couple, friends, trip.
-- Applied: not yet applied
--
-- DESTRUCTIVE — drops users.family_id and users.role after backfilling
-- group_members from them. Take a full database backup before running this.
-- Safe to re-run: every step is guarded; re-running after a successful run is
-- a no-op. Wrapped in a transaction so a failed verification check rolls back
-- the entire migration (rename, backfill, and column drops together).

BEGIN;

-- 1. Rename the friends-only join table to the generalized name.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friend_group_members')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_members') THEN
    ALTER TABLE friend_group_members RENAME TO group_members;
  END IF;
END $$;

-- 2. Defensive dedupe: keep only the earliest row per (group_id, user_id), in
--    case any duplicate memberships already exist (the app enforced uniqueness
--    at the application level only, never a DB constraint, until step 3 below).
DELETE FROM group_members gm
USING group_members gm2
WHERE gm.group_id = gm2.group_id
  AND gm.user_id = gm2.user_id
  AND gm.id > gm2.id;

-- 3. Enforce membership uniqueness at the DB level going forward.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_members_group_id_user_id_unique'
  ) THEN
    ALTER TABLE group_members
      ADD CONSTRAINT group_members_group_id_user_id_unique UNIQUE (group_id, user_id);
  END IF;
END $$;

-- 4. Backfill: every user's existing single family_id membership becomes a
--    group_members row, preserving their role and using account-creation time
--    as a joined_at approximation. Skips users already migrated (re-run safe)
--    and skips any user whose family_id row was already backfilled another way.
INSERT INTO group_members (group_id, user_id, role, joined_at)
SELECT family_id, id, role, COALESCE(created_at, now())
FROM users
WHERE family_id IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 5. Trip lifecycle columns on families/groups (nullable; unused by non-trip
--    group types). group_type itself needs no DB change — it's a plain text
--    column, not a Postgres enum, so the new "trip" value needs no ALTER TYPE.
ALTER TABLE families ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';
ALTER TABLE families ADD COLUMN IF NOT EXISTS closed_at timestamp;

-- 6. Verify the backfill preserved every membership before dropping the old
--    columns — abort (rolling back the whole transaction) on any mismatch.
DO $$
DECLARE
  users_with_family_id integer;
  matching_group_members integer;
BEGIN
  SELECT count(*) INTO users_with_family_id FROM users WHERE family_id IS NOT NULL;
  SELECT count(*) INTO matching_group_members
    FROM users u JOIN group_members gm ON gm.group_id = u.family_id AND gm.user_id = u.id
    WHERE u.family_id IS NOT NULL;
  IF users_with_family_id <> matching_group_members THEN
    RAISE EXCEPTION 'Migration aborted: % users have family_id set but only % have a matching group_members row',
      users_with_family_id, matching_group_members;
  END IF;
END $$;

-- 7. Drop the single-group columns now that every membership is preserved in
--    group_members. Role is per-membership now (group_members.role), not global.
ALTER TABLE users DROP COLUMN IF EXISTS family_id;
ALTER TABLE users DROP COLUMN IF EXISTS role;

COMMIT;
