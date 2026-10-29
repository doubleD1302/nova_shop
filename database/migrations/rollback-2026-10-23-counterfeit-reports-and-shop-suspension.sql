-- Rollback: Counterfeit Product Reports and Shop Suspension Flow
-- Date: 2026-10-23

-- 1. Rollback abuse_reports
ALTER TABLE abuse_reports
  DROP FOREIGN KEY IF EXISTS fk_abuse_reports_shop;

ALTER TABLE abuse_reports
  DROP INDEX IF EXISTS ix_abuse_reports_shop;

ALTER TABLE abuse_reports
  DROP COLUMN IF EXISTS evidence_url,
  DROP COLUMN IF EXISTS details,
  DROP COLUMN IF EXISTS shop_id;

ALTER TABLE abuse_reports
  MODIFY COLUMN status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open';

-- 2. Rollback shops
ALTER TABLE shops
  DROP FOREIGN KEY IF EXISTS fk_shops_suspended_by;

ALTER TABLE shops
  DROP COLUMN IF EXISTS suspended_at,
  DROP COLUMN IF EXISTS suspended_by,
  DROP COLUMN IF EXISTS suspension_reason;

