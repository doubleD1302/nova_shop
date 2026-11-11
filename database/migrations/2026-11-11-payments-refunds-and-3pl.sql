-- Migration: Kích hoạt ZaloPay, Hoàn tiền tự động và Tích hợp 3PL Logistics
-- Ngày tạo: 11/11/2026

-- 1. Bổ sung ZaloPay và trạng thái refunded cho payment_attempts
ALTER TABLE payment_attempts MODIFY provider ENUM('momo','vnpay','zalopay') NOT NULL;
ALTER TABLE payment_attempts MODIFY status ENUM('pending','paid','failed','review','refunded') NOT NULL DEFAULT 'pending';

-- 2. Bổ sung trạng thái refunded cho payments
ALTER TABLE payments MODIFY status ENUM('unpaid','paid','void','refunded') NOT NULL DEFAULT 'unpaid';

-- 3. Tạo bảng lưu trữ nhật ký hoàn tiền tự động (Automated Refunds)
CREATE TABLE IF NOT EXISTS refund_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID hoàn tiền',
  order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn hàng tổng',
  shop_order_id BIGINT UNSIGNED NULL COMMENT 'Đơn con (nếu hoàn tiền theo shop)',
  payment_attempt_id BIGINT UNSIGNED NULL COMMENT 'Lần thanh toán gốc',
  provider ENUM('vnpay','momo','zalopay','manual') NOT NULL COMMENT 'Cổng thanh toán xử lý hoàn tiền',
  amount DECIMAL(15,0) NOT NULL COMMENT 'Số tiền hoàn trả',
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái hoàn tiền',
  provider_refund_id VARCHAR(100) NULL COMMENT 'Mã hoàn tiền từ đối tác cổng',
  reason VARCHAR(255) NOT NULL COMMENT 'Lý do hoàn tiền (hủy đơn / khiếu nại trả hàng)',
  actor_id BIGINT UNSIGNED NULL COMMENT 'Người thực hiện hoặc hệ thống',
  metadata JSON NULL COMMENT 'Dữ liệu phản hồi chi tiết từ cổng',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY ix_refund_records_order (order_id),
  KEY ix_refund_records_shop_order (shop_order_id),
  KEY ix_refund_records_status (status),
  CONSTRAINT fk_refund_records_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Nhật ký hoàn tiền tự động qua cổng thanh toán';

-- 4. Bổ sung cột lưu trữ mã đơn và lịch bưu tá lấy hàng từ 3PL cho shop_orders (nếu chưa có)
-- shop_orders đã có tracking_code và shipping_name.
