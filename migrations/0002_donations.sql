-- Donations: one row per donation request.
-- Status flow:  Pending -> Credit (paid) | Failed
CREATE TABLE donations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_request_id  TEXT UNIQUE,
  payment_id          TEXT,
  buyer_name          TEXT NOT NULL,
  buyer_email         TEXT NOT NULL,
  buyer_phone         TEXT NOT NULL,
  pan                 TEXT NOT NULL,
  full_address        TEXT NOT NULL,
  amount              INTEGER NOT NULL,                -- whole rupees
  currency            TEXT NOT NULL DEFAULT 'INR',
  purpose             TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'Pending'
                       CHECK (status IN ('Pending','Credit','Failed')),
  receipt             TEXT,                            -- e.g. SRSM/2025-26/A/00012
  payout_date         INTEGER,                         -- unixepoch when Instamojo paid out
  transaction_date    INTEGER,                         -- unixepoch from Instamojo created_at
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_donations_status      ON donations(status);
CREATE INDEX idx_donations_created     ON donations(created_at);
CREATE INDEX idx_donations_payment_req ON donations(payment_request_id);

-- One counter row per financial year. Used to allocate receipt numbers
-- atomically with INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
CREATE TABLE donation_fy_counters (
  fy        TEXT PRIMARY KEY,                          -- "2025-26"
  alphabet  TEXT NOT NULL DEFAULT 'A',                 -- segment letter
  count     INTEGER NOT NULL DEFAULT 0
);
