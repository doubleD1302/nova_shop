-- Migration: Counterfeit Product Reports and Shop Suspension Flow
-- Date: 2026-10-23

-- 1. Backup tables before migration
CREATE TABLE IF NOT EXISTS shops_backup_20261023 AS SELECT * FROM shops;
CREATE TABLE IF NOT EXISTS abuse_reports_backup_20261023 AS SELECT * FROM abuse_reports;

-- 2. Enhance shops table with suspension metadata
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(1000) NULL COMMENT 'Lý do khóa shop' AFTER status,
  ADD COLUMN IF NOT EXISTS suspended_by BIGINT UNSIGNED NULL COMMENT 'Admin thực hiện khóa' AFTER suspension_reason,
  ADD COLUMN IF NOT EXISTS suspended_at DATETIME(3) NULL COMMENT 'Thời điểm khóa' AFTER suspended_by;

ALTER TABLE shops
  ADD CONSTRAINT fk_shops_suspended_by
    FOREIGN KEY (suspended_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- 3. Enhance abuse_reports table with shop linkage, details, evidence and extended statuses
ALTER TABLE abuse_reports
  DROP CONSTRAINT IF EXISTS ck_abuse_reports_resolution;

ALTER TABLE abuse_reports
  MODIFY COLUMN status ENUM('open', 'investigating', 'confirmed_violation', 'dismissed', 'resolved') NOT NULL DEFAULT 'open';

ALTER TABLE abuse_reports
  ADD COLUMN IF NOT EXISTS shop_id BIGINT UNSIGNED NULL COMMENT 'Shop liên kết (nếu là sản phẩm/shop)' AFTER target_id,
  ADD COLUMN IF NOT EXISTS details TEXT NULL COMMENT 'Mô tả chi tiết vi phạm' AFTER reason,
  ADD COLUMN IF NOT EXISTS evidence_url VARCHAR(1024) NULL COMMENT 'Đường dẫn ảnh bằng chứng' AFTER details;

ALTER TABLE abuse_reports
  ADD KEY IF NOT EXISTS ix_abuse_reports_shop (shop_id);

ALTER TABLE abuse_reports
  ADD CONSTRAINT fk_abuse_reports_shop
    FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE SET NULL;

