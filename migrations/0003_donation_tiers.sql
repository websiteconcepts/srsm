-- Donation tiers, editable from the admin UI.
-- Donors see these as predefined amount buttons on /donate; the custom-amount
-- field always remains available regardless of how many tiers exist.
CREATE TABLE donation_tiers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_donation_tiers_order ON donation_tiers(sort_order, id);

-- Seed the original four tiers so existing setups keep working.
INSERT INTO donation_tiers (label, amount, sort_order) VALUES
  ('Dharmasevak',    5001,    10),
  ('Dharmadoot',     10001,   20),
  ('Dharmaratna',    50001,   30),
  ('Dharmabhaskar',  100001,  40);
