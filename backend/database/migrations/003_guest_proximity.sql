-- 003_guest_proximity.sql
--
-- Enforces the product's core "physically at the restaurant" requirement
-- technically, not just as a UX assumption: a QR scan alone isn't proof
-- of presence (a photographed/leaked QR code could otherwise be scanned
-- from anywhere), so the guest's actual location at scan time is checked
-- against the restaurant's location. See routes/guestSession.js and
-- src/geo.js for the enforcement; this migration just adds the data it
-- needs.

-- ============================================================
-- restaurants: physical location, needed to compute distance.
-- ============================================================
ALTER TABLE restaurants
  ADD COLUMN latitude DECIMAL(9, 6),
  ADD COLUMN longitude DECIMAL(9, 6),
  -- How close a guest must be, in meters, to be granted a session at
  -- this restaurant. Per-restaurant rather than one global constant —
  -- a restaurant with a large parking lot/outdoor seating area
  -- reasonably wants a bigger radius than one on a single storefront —
  -- consistent with the white-label customizability requirement.
  ADD COLUMN max_guest_distance_meters INT NOT NULL DEFAULT 150;

ALTER TABLE restaurants
  ADD CONSTRAINT chk_restaurants_lat CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  ADD CONSTRAINT chk_restaurants_lon CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  ADD CONSTRAINT chk_restaurants_max_distance CHECK (max_guest_distance_meters > 0);

-- ============================================================
-- guest_sessions: issued after a successful proximity check at scan
-- time. This is deliberately its own table rather than a bare stateless
-- JWT: it gives an audit trail of exactly where/when each session was
-- granted (useful for security review, and for spotting abuse patterns
-- like GPS spoofing attempts), and a place to revoke a session if ever
-- needed. guest_profile_id stays NULL until the guest actually places an
-- order (guest_profiles are created "on first order", per the existing
-- design — not at scan time).
-- ============================================================
CREATE TABLE guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  guest_profile_id UUID REFERENCES guest_profiles(id) ON DELETE SET NULL,

  -- Where the guest actually was, and how far that was from the
  -- restaurant, at the moment the session was granted. Kept even though
  -- the request already succeeded, specifically so this table is a real
  -- audit trail (SNAPORDER_AUTHORIZATION.md Part 5), not just a token
  -- store.
  scan_latitude DECIMAL(9, 6) NOT NULL,
  scan_longitude DECIMAL(9, 6) NOT NULL,
  distance_meters DECIMAL(10, 2) NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  CONSTRAINT chk_guest_sessions_lat CHECK (scan_latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_guest_sessions_lon CHECK (scan_longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_guest_sessions_table ON guest_sessions(table_id);
CREATE INDEX idx_guest_sessions_restaurant ON guest_sessions(restaurant_id);

-- Not a partial index on "expires_at > now()" — CURRENT_TIMESTAMP isn't
-- IMMUTABLE, so Postgres rejects it as an index predicate. The per-
-- request validity check (authenticateGuest) looks up by id, which the
-- primary key already covers; this index is for cleanup/reporting
-- queries (e.g. a future job deleting long-expired sessions).
CREATE INDEX idx_guest_sessions_expires ON guest_sessions(expires_at);
