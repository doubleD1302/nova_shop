-- ====================================================================
-- Migration: Lịch sử trò chuyện với Nova AI
-- Ngày tạo: 20/11/2026
-- Mô tả: lưu các cuộc trò chuyện và tin nhắn Nova AI của tài khoản đã đăng nhập.
-- Khách chưa đăng nhập không được lưu lịch sử.
-- Chạy được nhiều lần (CREATE TABLE IF NOT EXISTS), không sửa bảng cũ.
-- ====================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Chủ cuộc trò chuyện',
  title VARCHAR(120) NOT NULL COMMENT 'Tiêu đề lấy từ câu hỏi đầu tiên',
  message_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số tin nhắn đã lưu',
  last_message_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tin nhắn cuối UTC',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_ai_conv_user_time (user_id, last_message_at),
  CONSTRAINT fk_ai_conv_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cuộc trò chuyện với Nova AI';

CREATE TABLE IF NOT EXISTS ai_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  role ENUM('user', 'assistant') NOT NULL COMMENT 'Người gửi: khách hoặc Nova AI',
  content TEXT NOT NULL COMMENT 'Nội dung tin nhắn',
  intent VARCHAR(50) NULL COMMENT 'Ý định Nova AI nhận diện (chỉ có ở tin của assistant)',
  metadata JSON NULL COMMENT 'Thẻ sản phẩm và gợi ý đi kèm câu trả lời',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_ai_msg_conv (conversation_id, id),
  CONSTRAINT fk_ai_msg_conv FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tin nhắn trong cuộc trò chuyện Nova AI';
