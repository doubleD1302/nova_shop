-- Migration: Returns, Shipping Trackings, and Chat System
-- Date: 2026-10-30
-- Scope: Hậu mãi (Returns), Vận chuyển (Shipping Trackings), Giao tiếp (Chat Conversations & Messages)

-- 1. HẬU MÃI (Returns & Refunds)
CREATE TABLE IF NOT EXISTS order_returns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn hàng tổng',
  shop_order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn con thuộc shop',
  buyer_id BIGINT UNSIGNED NOT NULL COMMENT 'Người mua yêu cầu',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Shop bị yêu cầu trả hàng',
  reason VARCHAR(255) NOT NULL COMMENT 'Lý do yêu cầu trả hàng',
  detail TEXT NULL COMMENT 'Mô tả chi tiết lỗi/sự cố',
  images JSON NULL COMMENT 'Mảng link ảnh/video bằng chứng',
  refund_amount DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Số tiền yêu cầu hoàn lại',
  status ENUM('requested', 'approved', 'rejected', 'completed', 'cancelled') NOT NULL DEFAULT 'requested' COMMENT 'Trạng thái xử lý',
  seller_note VARCHAR(500) NULL COMMENT 'Phản hồi từ người bán',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_order_returns_shop_order (shop_order_id, status),
  KEY ix_order_returns_buyer (buyer_id, created_at),
  KEY ix_order_returns_shop (shop_id, status),
  CONSTRAINT fk_order_returns_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_returns_shop_order FOREIGN KEY (shop_order_id) REFERENCES shop_orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_returns_buyer FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_returns_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Yêu cầu trả hàng và hoàn tiền hậu mãi';

-- 2. VẬN CHUYỂN (Shipment Trackings)
CREATE TABLE IF NOT EXISTS shipment_trackings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn hàng shop tương ứng',
  tracking_code VARCHAR(100) NOT NULL COMMENT 'Mã vận đơn',
  carrier VARCHAR(60) NOT NULL COMMENT 'Đơn vị vận chuyển (GHN, GHTK, Viettel Post...)',
  status ENUM('manifest_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt') NOT NULL COMMENT 'Trạng thái mốc vận chuyển',
  location VARCHAR(150) NULL COMMENT 'Trạm/bưu cục hiện tại',
  description VARCHAR(255) NOT NULL COMMENT 'Mô tả chi tiết mốc hành trình',
  event_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm diễn ra mốc',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_shipment_trackings_order (shop_order_id, event_time),
  KEY ix_shipment_trackings_code (tracking_code, event_time),
  CONSTRAINT fk_shipment_trackings_shop_order FOREIGN KEY (shop_order_id) REFERENCES shop_orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử hành trình bưu kiện vận chuyển';

-- 3. GIAO TIẾP (Chat Conversations & Messages)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  buyer_id BIGINT UNSIGNED NOT NULL COMMENT 'Người mua',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Gian hàng',
  last_message VARCHAR(500) NULL COMMENT 'Trích dẫn tin nhắn gần nhất',
  last_message_at DATETIME(3) NULL COMMENT 'Thời gian tin nhắn cuối cùng',
  buyer_unread_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số tin chưa đọc của buyer',
  seller_unread_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số tin chưa đọc của seller',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_buyer_shop (buyer_id, shop_id),
  KEY ix_chat_buyer_time (buyer_id, last_message_at),
  KEY ix_chat_shop_time (shop_id, last_message_at),
  CONSTRAINT fk_chat_conv_buyer FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_conv_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cuộc trò chuyện giữa người mua và gian hàng';

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL COMMENT 'Hội thoại liên kết',
  sender_id BIGINT UNSIGNED NOT NULL COMMENT 'ID người gửi',
  sender_role ENUM('buyer', 'seller') NOT NULL COMMENT 'Vai trò khi gửi',
  message TEXT NOT NULL COMMENT 'Nội dung tin nhắn',
  attachments JSON NULL COMMENT 'Ảnh hoặc thẻ sản phẩm/đơn hàng đính kèm',
  is_read BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Đã đọc hay chưa',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_chat_msg_conv (conversation_id, created_at, id),
  CONSTRAINT fk_chat_msg_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_msg_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết tin nhắn trong cuộc trò chuyện';
