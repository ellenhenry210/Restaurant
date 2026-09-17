-- 009_staff_display_name_and_table_assignment.sql
--
-- Two related additions, both from an explicit user request: "I want
-- the name to be customizable as well, the guest should know the staff
-- that is assigned to serving them."

-- ============================================================
-- restaurant_staff.display_name — a customizable, guest-facing name,
-- separate from the required legal/full `name`. NULL means "just show
-- `name`" (see routes/guestSession.js, routes/orders.js) — a staff
-- member isn't forced to set one.
-- ============================================================
ALTER TABLE restaurant_staff ADD COLUMN display_name VARCHAR(255);

-- ============================================================
-- table_assignments — which staff member is currently serving a table,
-- with history (not just a single overwritten column on `tables`) for
-- the same reason `shifts` (table 18) is its own table rather than a
-- flag: "who served this table, and when" is worth keeping.
-- ============================================================
CREATE TABLE table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES restaurant_staff(id) ON DELETE CASCADE,

  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at TIMESTAMP,  -- NULL = currently assigned

  CONSTRAINT chk_assignment_times CHECK (unassigned_at IS NULL OR unassigned_at > assigned_at)
);

CREATE INDEX idx_assignments_staff ON table_assignments(staff_id);

-- High-traffic query: "who's currently assigned to this table?" (every
-- guest session / order status lookup wants this). Mirrors shifts'
-- idx_shifts_restaurant_active pattern.
CREATE INDEX idx_assignments_table_active ON table_assignments(table_id) WHERE unassigned_at IS NULL;

-- A table can only have one active (not-yet-unassigned) assignment at a
-- time — reassigning ends the previous one first (see routes/tables.js),
-- it doesn't stack.
CREATE UNIQUE INDEX unique_active_assignment_per_table ON table_assignments(table_id) WHERE unassigned_at IS NULL;
