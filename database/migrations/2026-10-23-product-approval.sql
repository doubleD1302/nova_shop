-- ==============================================================================
-- Migration: 2026-10-23-product-approval.sql
-- Thêm quy trình kiểm duyệt sản phẩm cho NOVA SHOP:
-- - approval_status: 'pending' (chờ duyệt), 'approved' (đã duyệt), 'rejected' (từ chối)
-- - rejection_reason: Lưu lý do từ chối kiểm duyệt
-- - reviewed_by: ID Admin thực hiện duyệt/từ chối
-- - reviewed_at: Thời gian duyệt/từ chối
-- ==============================================================================

ALTER TABLE products
  ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending' AFTER status,
  ADD COLUMN rejection_reason VARCHAR(1000) NULL DEFAULT NULL AFTER approval_status,
  ADD COLUMN reviewed_by BIGINT UNSIGNED NULL DEFAULT NULL AFTER rejection_reason,
  ADD COLUMN reviewed_at DATETIME(3) NULL DEFAULT NULL AFTER reviewed_by,
  ADD CONSTRAINT fk_products_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id);

-- Bảo toàn 39 sản phẩm gốc hiện tại của sàn đã hoạt động: đặt approval_status = 'approved'
UPDATE products SET approval_status = 'approved', reviewed_at = CURRENT_TIMESTAMP(3) WHERE status = 'active';

