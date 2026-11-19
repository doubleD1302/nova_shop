-- Lưu giá gốc khi áp giá khuyến mãi của chiến dịch để hoàn lại chính xác khi chiến dịch kết thúc.
-- Chạy một lần; chạy lại sẽ báo cột đã tồn tại. Code Data API bỏ qua việc áp giá cho đến khi cột applied_at có mặt.
ALTER TABLE campaign_registrations
  ADD COLUMN price_snapshot TEXT NULL COMMENT 'JSON giá gốc các biến thể trước khi áp giá khuyến mãi',
  ADD COLUMN applied_at DATETIME(3) NULL COMMENT 'Thời điểm áp giá khuyến mãi',
  ADD COLUMN reverted_at DATETIME(3) NULL COMMENT 'Thời điểm hoàn lại giá gốc';
