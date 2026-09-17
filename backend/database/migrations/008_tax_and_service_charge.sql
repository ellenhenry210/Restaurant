-- 008_tax_and_service_charge.sql
--
-- orders.tax and orders.service_charge existed as columns since the
-- initial schema but nothing ever computed them (POST /v1/orders left
-- them out entirely, total_amount === subtotal). No rate was defined
-- anywhere to compute them FROM — this adds it, per-restaurant rather
-- than a single global rate, consistent with the white-label
-- customizability requirement (a restaurant's tax rate is a fact about
-- that restaurant/jurisdiction, not a platform-wide constant, and not
-- every restaurant charges a service charge at all).
--
-- Stored as a fraction (0.075 = 7.5%), not a whole percentage, so
-- computing the actual charge is a plain multiplication with no /100
-- step to get wrong. Nigeria's VAT is 7.5% — not set as the DEFAULT
-- here though: defaulting to 0 means a restaurant's total is never
-- silently inflated by an assumed rate it never configured.

ALTER TABLE restaurants
  ADD COLUMN tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0,
  ADD COLUMN service_charge_rate DECIMAL(5, 4) NOT NULL DEFAULT 0;

ALTER TABLE restaurants
  ADD CONSTRAINT chk_restaurants_tax_rate CHECK (tax_rate BETWEEN 0 AND 1),
  ADD CONSTRAINT chk_restaurants_service_charge_rate CHECK (service_charge_rate BETWEEN 0 AND 1);
