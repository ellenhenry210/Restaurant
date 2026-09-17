-- 002_add_users_and_auth.sql
--
-- Adds a central `users` table for login credentials, separate from
-- restaurant_staff's restaurant-scoped role assignment. One user can be
-- staff at multiple restaurants (e.g. an Owner with more than one
-- location) without needing a separate login/password per restaurant.
--
-- This is a new migration, not an edit to 001_initial_schema.sql —
-- 001 is already applied. Once a migration has run, it's immutable;
-- schema changes from here on are always new numbered files.

-- ============================================================
-- users: login identity, independent of any restaurant.
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- restaurant_staff: now points at a user's identity instead of
-- carrying its own email/credentials directly.
-- ============================================================

-- No existing rows to backfill (schema was only just created, never
-- populated), so we can add the column and make it NOT NULL in one go.
-- If this ran against a database with real staff rows, you'd add it
-- nullable, backfill user_id for each row, then SET NOT NULL after.
ALTER TABLE restaurant_staff
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE restaurant_staff
  ALTER COLUMN user_id SET NOT NULL;

-- email + its uniqueness constraint move to users.email; replaced here
-- by "one role per user per restaurant" (a person CAN be staff at more
-- than one restaurant, each with its own row, but not hold two roles
-- at the same restaurant simultaneously).
ALTER TABLE restaurant_staff DROP CONSTRAINT unique_restaurant_email;
ALTER TABLE restaurant_staff DROP COLUMN email;
ALTER TABLE restaurant_staff ADD CONSTRAINT unique_user_per_restaurant UNIQUE (restaurant_id, user_id);

CREATE INDEX idx_staff_user ON restaurant_staff(user_id);
