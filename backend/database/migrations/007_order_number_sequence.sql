-- 007_order_number_sequence.sql
--
-- orders.order_number (e.g. "ORD-2026-00147", SNAPORDER_API_CONTRACTS.md)
-- was a plain UNIQUE varchar with nothing generating it. A single global
-- sequence, not counting existing rows at insert time (SELECT COUNT(*)
-- + 1 races under concurrent orders — two guests ordering at the same
-- moment could compute the same "next" number before either commits;
-- a SEQUENCE is atomic across concurrent transactions by design).
--
-- Simplification, stated plainly rather than left to look like it isn't
-- one: this sequence does NOT reset at the start of each year. The
-- year in the formatted number is just the current year at issue time
-- ("ORD-2027-00151" can immediately follow "ORD-2026-00150") — a true
-- per-year reset would need a per-year sequence (or a reset job), which
-- isn't built here.

CREATE SEQUENCE order_number_seq START 1;
