-- ==============================================================================
-- Rollback Migration: rollback-2026-10-23-product-approval.sql
-- Hoàn tác các cột phê duyệt sản phẩm nếu có sự cố
-- ==============================================================================

ALTER TABLE products DROP FOREIGN KEY fk_products_reviewer;
ALTER TABLE products
  DROP COLUMN reviewed_at,
  DROP COLUMN reviewed_by,
  DROP COLUMN rejection_reason,
  DROP COLUMN approval_status;

