# Hệ thống Thông báo Thời gian thực (Push Notifications) & Tác vụ Nền Tự động (Cron Jobs)

Tài liệu kỹ thuật mô tả thiết kế, cơ sở dữ liệu, API và luồng xử lý tự động của 2 phân hệ Backend:
1. **Hệ thống Thông báo Thời gian thực (In-app & FCM Push Notifications)**
2. **Tự động hóa Tác vụ Nền & Định kỳ (Cron Jobs)**

---

## PHẦN 1: HỆ THỐNG THÔNG BÁO THỜI GIAN THỰC (PUSH NOTIFICATIONS)

### 1. Mô hình kiến trúc
- **Thông báo trong ứng dụng (In-app Notifications)**: Lưu trữ lâu dài trong cơ sở dữ liệu, hiển thị trong danh sách chuông thông báo trên Web & App di động.
- **Thông báo đẩy (FCM / Web Push Notifications)**: Gửi thông báo trực tiếp qua Firebase Cloud Messaging (FCM) tới token thiết bị của người dùng ngay cả khi đóng app hoặc tắt trình duyệt.
- **Thông báo Realtime tức thời (WebSocket)**: Đồng thời đẩy qua kết nối WebSocket (`/ws/chat` & notification channel) khi người dùng đang online trên ứng dụng.

### 2. Thiết kế Cơ sở dữ liệu

#### 2.1. Bảng `notifications` (Thông báo trong ứng dụng)
```sql
CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID thông báo',
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Người nhận thông báo',
  title VARCHAR(255) NOT NULL COMMENT 'Tiêu đề thông báo',
  content TEXT NOT NULL COMMENT 'Nội dung chi tiết thông báo',
  type VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT 'Loại: order, chat, promotion, system, voucher',
  link VARCHAR(255) NULL COMMENT 'Link điều hướng trên web/app',
  is_read BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Trạng thái đã đọc',
  read_at DATETIME(3) NULL COMMENT 'Thời điểm đọc',
  metadata JSON NULL COMMENT 'Dữ liệu phụ trợ JSON (orderId, shopId, v.v.)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật UTC',
  PRIMARY KEY (id),
  KEY ix_notifications_user_read_created (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Thông báo in-app cho người dùng';
```

#### 2.2. Bảng `user_device_tokens` (Quản lý Token thiết bị FCM / Web Push)
```sql
CREATE TABLE user_device_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID khóa chính',
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'ID người dùng',
  token VARCHAR(500) NOT NULL COMMENT 'FCM token hoặc Web Push token',
  device_type ENUM('web', 'android', 'ios') NOT NULL DEFAULT 'web' COMMENT 'Loại thiết bị',
  last_used_at DATETIME(3) NULL COMMENT 'Thời gian dùng gần nhất',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_device_token (user_id, token),
  KEY ix_device_tokens_user (user_id),
  CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='FCM device tokens cho Push Notification';
```

---

### 3. Danh sách Endpoints API

| Phương thức | Đường dẫn API | Xác thực | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Bearer Token | Lấy danh sách thông báo của tài khoản (hỗ trợ phân trang `page`, `limit`, và trả kèm `unreadCount`). |
| `PATCH` | `/api/v1/notifications/:id/read` | Bearer Token | Đánh dấu 1 thông báo cụ thể là đã đọc. |
| `PATCH` | `/api/v1/notifications/read-all` | Bearer Token | Đánh dấu tất cả thông báo của tài khoản là đã đọc. |
| `POST` | `/api/v1/notifications/device-token` | Bearer Token | Đăng ký hoặc làm mới token thiết bị FCM (`token`, `deviceType`). |
| `DELETE` | `/api/v1/notifications/device-token` | Bearer Token | Hủy đăng ký token thiết bị (khi người dùng đăng xuất). |

---

### 4. Tự động kích hoạt Thông báo theo Sự kiện Nghiệp vụ
Hệ thống sử dụng service `notifyUser({ userId, title, content, type, link, metadata, sendPush })`:
1. **Người bán có đơn hàng mới cần xử lý**:
   - Khi người mua đặt hàng thành công (`POST /api/v1/orders`), hệ thống tự động bắn Push Notification & In-app Notification tới từng chủ shop (`ownerId`):
     - Tiêu đề: `Đơn hàng mới #[orderId]`
     - Nội dung: `Bạn có 1 đơn hàng mới đang chờ xác nhận từ khách hàng.`
2. **Đơn hàng của người mua chuyển trạng thái**:
   - Khi shop cập nhật đơn sang `shipping`:
     - Tiêu đề: `Đơn hàng đang trên đường giao`
     - Nội dung: `Đơn hàng #[shopOrderId] từ [Tên Shop] đang được giao đến bạn.`
   - Khi shop cập nhật đơn sang `delivered`:
     - Tiêu đề: `Giao hàng thành công`
     - Nội dung: `Đơn hàng #[shopOrderId] từ [Tên Shop] đã được giao thành công. Vui lòng kiểm tra và bấm xác nhận!`
3. **Có tin nhắn mới khi người nhận đang offline**:
   - Hàm `isUserOnline(userId)` kiểm tra xem người nhận có kết nối WebSocket mở hay không. Nếu người nhận offline hoặc đóng app, hệ thống tự động bắn Push Notification thông báo tin nhắn mới kèm tên người gửi và nội dung xem trước.

---

## PHẦN 2: TỰ ĐỘNG HÓA TÁC VỤ NỀN & ĐỊNH KỲ (CRON JOBS)

### 1. Cơ chế Quản trị Tác vụ Nền
- Tệp quản lý tập trung: `backend/src/jobs/cron.manager.js`.
- Khởi động tự động khi Backend start (`startAllCronJobs()`), dọn dẹp dừng timers an toàn khi nhận tín hiệu shutdown (`stopAllCronJobs()`).
- Endpoint kích hoạt thủ công dành cho Quản trị viên (Admin):
  - `POST /api/v1/admin/jobs/run`
  - Body: `{ "job": "auto-cancel-expired-orders" | "auto-complete-orders" | "expire-vouchers" | "clean-orphan-uploads" }`

---

### 2. Chi tiết 4 Tác vụ Nền

#### 2.1. Tự động hủy đơn hàng quá hạn thanh toán (`auto-cancel-expired-orders`)
- **Tần suất chạy**: Mỗi 5 phút (mặc định cấu hình `CRON_CANCEL_EXPIRED_MINUTES=5`).
- **Ngưỡng quá hạn**: 15 phút (mặc định `PAYMENT_EXPIRE_MINUTES=15`).
- **Nghiệp vụ xử lý**:
  - Quét tất cả các đơn hàng có phương thức thanh toán Online (`vnpay`, `momo`, v.v.) chưa hoàn tất thanh toán (`status = 'pending'`, `payments.status = 'unpaid'`).
  - Hủy đơn hàng sang `cancelled`, ghi chú lý do quá hạn thanh toán.
  - Chuyển bản ghi thanh toán sang `void`.
  - **Hoàn lại số lượng tồn kho** cho các mặt hàng tương ứng trong đơn (`stock_qty = stock_qty + qty`, ghi `stock_moves` lý do `cancel`).
  - **Nhả voucher** nếu đơn hàng có áp dụng mã giảm giá.
  - Gửi thông báo In-app & Push cho người mua để thông báo đơn đã hủy do quá hạn.

#### 2.2. Tự động hoàn tất đơn hàng (`auto-complete-orders`)
- **Tần suất chạy**: Mỗi 1 giờ (mặc định `CRON_AUTO_COMPLETE_HOURS=1`).
- **Ngưỡng hoàn tất**: 7 ngày kể từ khi giao hàng (`AUTO_COMPLETE_DAYS=7`).
- **Nghiệp vụ xử lý**:
  - Quét các đơn hàng ở trạng thái `delivered` có `delivered_at <= NOW() - 7 ngày`.
  - Kiểm tra điều kiện loại trừ: Đơn hàng **không** có yêu cầu khiếu nại/trả hàng (`order_returns`) đang ở trạng thái `requested` hoặc `approved`.
  - Chuyển trạng thái đơn sang `completed`, cập nhật `completed_at = UTC_TIMESTAMP(3)`.
  - Ghi lịch sử đơn hàng vào `order_events` (`from_status = 'delivered'`, `to_status = 'completed'`).
  - Gửi thông báo in-app thông báo đơn hàng đã hoàn tất thành công.

#### 2.3. Tự động cập nhật trạng thái Voucher hết hạn (`expire-vouchers`)
- **Tần suất chạy**: Mỗi 30 phút (mặc định `CRON_EXPIRE_VOUCHERS_MINUTES=30`).
- **Nghiệp vụ xử lý**:
  - Quét tất cả các voucher có thời hạn kết thúc `ends_at <= UTC_TIMESTAMP(3)`.
  - Cập nhật đồng loạt: `status = 'expired'`, `is_active = 0`.

#### 2.4. Dọn dẹp ảnh mồ côi (`clean-orphan-uploads`)
- **Tần suất chạy**: Mỗi 24 giờ (mặc định `CRON_CLEAN_UPLOADS_HOURS=24`).
- **Ngưỡng an toàn**: 24 giờ (`UPLOAD_ORPHAN_MAX_AGE_HOURS=24`).
- **Nghiệp vụ xử lý**:
  - Đọc danh sách tất cả file trong thư mục `public/uploads/`.
  - Lấy danh sách toàn bộ các file ảnh đang được tham chiếu trong CSDL từ Data API (`GET /internal/v1/jobs/referenced-images`):
    - `users.avatar_url`
    - `shops.logo_url`, `shops.banner_url`
    - `product_images.url`
    - `review_images.url`
    - `categories.image_url`
    - `marketing_campaigns.banner_url`
    - `order_returns.images`
    - `chat_messages.attachments`
  - Bỏ qua các file mới upload có thời gian tạo `< 24 giờ` (tránh xóa nhầm ảnh người dùng đang upload dở chưa kịp lưu form).
  - Xóa an toàn các file cũ `> 24 giờ` không nằm trong danh sách đang được CSDL tham chiếu.

---

### 3. Kiểm thử Tích hợp & Kết quả
- Script kiểm thử toàn diện: `backend/scripts/test-notifications-and-cron.mjs`.
- Kết quả kiểm thử thực tế trên TiDB Cloud & Backend:
  - `[1/7] In-app Notifications (GET, unreadCount, pagination)`: **PASS**
  - `[2/7] FCM Device Tokens (POST, DELETE)`: **PASS**
  - `[3/7] Mark as read (Single & Read-all)`: **PASS**
  - `[4/7] Auto-trigger notifications (Seller new order, Buyer order shipping/delivered, Chat offline)`: **PASS**
  - `[5/7] Cron Job: Auto-cancel expired online orders (hoàn tồn kho + void thanh toán)`: **PASS**
  - `[6/7] Cron Job: Auto-complete delivered orders (sau 7 ngày) & Expire vouchers`: **PASS**
  - `[7/7] Cron Job: Orphan Upload Cleaner (xóa ảnh mồ côi > 24h, bảo toàn ảnh mới và ảnh đang dùng)`: **PASS**
