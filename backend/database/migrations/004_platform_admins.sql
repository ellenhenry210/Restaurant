-- 004_platform_admins.sql
--
-- Backs the System Admin role (SNAPORDER_AUTHORIZATION.md Part 1) —
-- SnapOrder's own team, platform-level, not scoped to any one
-- restaurant. Separate from restaurant_staff, same way restaurant_staff
-- is separate from users: a platform_admins row grants elevated,
-- cross-restaurant access on top of an existing users identity, it
-- isn't itself a login.
--
-- A user CAN be both a platform admin and restaurant staff somewhere
-- (e.g. a SnapOrder team member piloting their own test restaurant) —
-- these aren't mutually exclusive, so there's no FK/constraint linking
-- this to restaurant_staff.

CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Who granted this, for accountability — PAM requires privileged grants
  -- be traceable (SNAPORDER_AUTHORIZATION.md Part 7), not just doable.
  -- Nullable: the very first platform admin has no one to point to.
  granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_admins_user ON platform_admins(user_id);
