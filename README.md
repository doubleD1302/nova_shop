# ShopNova — Sàn Thương Mại Điện Tử Đa Người Bán

ShopNova là nền tảng thương mại điện tử đa người bán (Multi-vendor Marketplace), hỗ trợ trải nghiệm người dùng trên cả nền tảng Web và Mobile App.

---

## 1. Cấu Trúc Tổng Thể Dự Án

```text
nova_shop/
├── src/                         # Ứng dụng Web (React 19 + Vite 6 + Tailwind CSS v4)
├── app/                         # Ứng dụng Di Động (Flutter / Dart SDK ^3.13.4)
├── backend/                     # Máy chủ Backend API (Node.js + Express 5)
├── docs/                        # Tài liệu kỹ thuật dự án
│   └── backend/
│       ├── ARCHITECTURE.md      # Thiết kế kiến trúc phân tầng (Frontend -> Backend -> Data API -> MySQL)
│       └── API_INVENTORY.md     # Danh mục và kế hoạch triển khai API
├── .agent/                      # Quy tắc, bối cảnh và workflow phát triển
└── AGENTS.md                    # Hướng dẫn quy chuẩn làm việc dự án
```

---

## 2. Công Nghệ Sử Dụng (Tech Stack)

### A. Web Frontend (`src/`)
- **Framework:** React 19 (`^19.1.0`), ReactDOM 19
- **Build Tool:** Vite 6 (`^6.3.5`), `@vitejs/plugin-react`
- **Styling:** Tailwind CSS v4 (`^4.1.8`), `@tailwindcss/vite`
- **Routing:** React Router DOM v7 (`^7.6.2`)
- **State Management:** React Context API (`AuthContext`, `CartContext`, `CatalogContext`, `OrderContext`, `ToastContext`)
- **Persistence:** LocalStorage qua `storage.js` (tiền tố `shopnova:`) kết hợp bộ dữ liệu mẫu tiếng Việt phong phú

### B. Mobile App (`app/`)
- **Framework:** Flutter (Dart SDK `^3.13.4`)
- **Nền tảng mục tiêu:** Android, iOS, Web, Windows, macOS, Linux
- **Thư viện chính:** `cupertino_icons`, `intl`
- **Cấu trúc:** Phân tách theo `screens/`, `widgets/`, `models/`, `theme/`, `data/`

### C. Backend Server (`backend/`)
- **Runtime:** Node.js (Mục tiêu: Node 24 LTS)
- **Framework:** Express 5 (`^5.0.1`), JavaScript ES Modules (`"type": "module"`)
- **Bảo mật & Tiện ích:** `helmet`, `cors`, `dotenv`
- **Kiến trúc dữ liệu:** Backend không kết nối trực tiếp MySQL; trong các giai đoạn sau, Backend sẽ giao tiếp với Data API nội bộ qua HTTP Client tập trung

---

## 3. Các Luồng Nghiệp Vụ Chính (Core Flows)

### A. Luồng Người mua (Buyer Flow)
1. **Duyệt & Tìm kiếm:** Xem banner trang chủ, Flash Sale, danh mục ngành hàng; tìm kiếm sản phẩm với bộ lọc khoảng giá, vị trí địa lý, đánh giá sao.
2. **Chi tiết sản phẩm:** Xem hình ảnh, thông số kỹ thuật, đánh giá khách hàng, chọn biến thể/màu sắc/kích cỡ và số lượng.
3. **Giỏ hàng đa shop:** Sản phẩm được gom nhóm tự động theo từng shop bán hàng riêng biệt, hỗ trợ chọn sản phẩm thanh toán và áp mã giảm giá.
4. **Thanh toán & Đơn hàng:** Nhập địa chỉ nhận hàng, chọn phương thức thanh toán (COD, Chuyển khoản, Ví), theo dõi trạng thái đơn hàng (Chờ xác nhận, Đang giao, Đã giao, Đã hủy).

### B. Luồng Người bán (Seller Flow - Kênh Người Bán `/nguoi-ban`)
1. **Dashboard:** Theo dõi doanh thu, số đơn chờ xử lý, cảnh báo tồn kho và sản phẩm bán chạy.
2. **Quản lý sản phẩm:** Xem danh sách, thêm mới và cập nhật giá, tồn kho, ảnh, mô tả sản phẩm.
3. **Quản lý đơn hàng:** Tiếp nhận và cập nhật trạng thái các đơn hàng thuộc shop của mình (không can thiệp vào đơn của shop khác).
4. **Cài đặt gian hàng:** Chỉnh sửa thông tin shop, logo, banner đại diện.

---

## 4. Hướng Dẫn Chạy Môi Trường Phát Triển

### A. Khởi chạy Web Frontend
```bash
# Cài đặt dependencies
npm install

# Chạy dev server tại http://localhost:5173
npm run dev

# Build kiểm tra sản phẩm
npm run build
```

### B. Khởi chạy Backend Server
```bash
cd backend

# Cài đặt dependencies
npm install

# Tạo cấu hình môi trường từ mẫu
cp .env.example .env    # Linux/macOS
# hoặc trên PowerShell: Copy-Item .env.example .env

# Chạy kiểm thử tự động (Smoke Test)
npm run smoke

# Chạy server ở chế độ phát triển
npm run dev
```

### C. Khởi chạy Mobile App (Flutter)
```bash
cd app
flutter pub get
flutter run
```
