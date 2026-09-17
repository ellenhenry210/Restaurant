-- 005_audit_log_platform_actions.sql
--
-- audit_log.restaurant_id was NOT NULL, which quietly assumed every
-- audited action is restaurant-scoped. Adding platform_admins (migration
-- 004) breaks that assumption: a denied requirePlatformAdmin check (or
-- any future platform-level action - cross-restaurant analytics,
-- roadmap status changes) has no single restaurant to attach it to.
-- SNAPORDER_AUTHORIZATION.md Part 5 requires authorization decisions be
-- audited generally, not just restaurant-scoped ones, so this relaxes
-- the constraint rather than silently skipping audit logging for
-- platform actions.

ALTER TABLE audit_log ALTER COLUMN restaurant_id DROP NOT NULL;

CREATE INDEX idx_audit_platform ON audit_log(action) WHERE restaurant_id IS NULL;
