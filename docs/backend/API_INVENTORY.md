# ShopNova - Danh Mục & Kế Hoạch API Backend (API Inventory)

> **Tài liệu phối hợp kỹ thuật giữa Backend, Frontend Web, Mobile App và Data API / Database**
> *Mã tác vụ: DB-001-R1 / BE-002A*
> *Trạng thái tài liệu: Bản nháp kỹ thuật (Draft) — Đã đồng bộ với schema thực tế `database/schema.sql`*
> *Kiến trúc áp dụng: Frontend (Web/App) → Backend HTTP API (/api/v1/*) → Data API Nội bộ (/internal/v1/*) → Sequelize 6 + mysql2 → MySQL 8.4*
> *Tham chiếu kiến trúc: Xem tại [ARCHITECTURE.md](./ARCHITECTURE.md) và mô hình dữ liệu tại [DATA_MODEL.md](./DATA_MODEL.md)*
> *Trạng thái triển khai: Backend API `health` và `ready`, HTTP client nội bộ (`backend/src/clients/data.client.js`), và Data API nội bộ (`health`, `ready`) đã implemented (hoàn tất DB-002-R4 và DB-003); xác thực auth đã implemented (BE-003A); 3 API đọc catalog công khai và Data API tương ứng đã implemented (BE-004A); Giỏ hàng Cart API đã implemented (BE-006); các endpoint còn lại (orders, seller) đang ở trạng thái `planned`.*

---

## 1. Bảng Kê Khai Danh Mục API Dự Kiến (API Inventory Table)

| Nhóm chức năng | File frontend / client liên quan | Method & Endpoint dự kiến | Quyền truy cập | Dữ liệu chính cần trao đổi | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hệ thống Backend** | `backend/src/controllers/health.controller.js` | `GET /api/v1/health` | `public` | Trạng thái liveness máy chủ Backend Express | **implemented** |
| **Hệ thống Backend** | `backend/src/controllers/ready.controller.js`<br>`backend/src/clients/data.client.js` | `GET /api/v1/ready` | `public` | Trạng thái readiness Backend, Data API và MySQL | **implemented** |
| **Hệ thống Data API** | `data-api/src/controllers/system.controller.js` | `GET /internal/v1/health` | `x-service-key` | Trạng thái liveness tiến trình Data API | **implemented** |
| **Hệ thống Data API** | `data-api/src/controllers/system.controller.js` | `GET /internal/v1/ready` | `x-service-key` | Trạng thái readiness kết nối CSDL MySQL 8.4 | **implemented** |
| **Auth Data API** | `data-api/src/controllers/auth.controller.js` | `POST /internal/v1/auth/verify-credentials` | `x-service-key` | Xác minh thông tin đăng nhập với MySQL, bcrypt compare | **implemented** (BE-003A) |
| **Auth Data API** | `data-api/src/controllers/auth.controller.js` | `GET /internal/v1/users/:userId/auth-profile` | `x-service-key` | Lấy hồ sơ xác thực và trạng thái role/status thời gian thực | **implemented** (BE-003A) |
| **Auth & Hồ sơ** | `src/context/AuthContext.jsx`<br>`src/pages/LoginPage.jsx` | `POST /api/v1/auth/login` | `public` | Request: `{ username, password }`<br>Response: `{ token, tokenType, expiresIn, user }` (JWT 15 phút, Rate Limit 429) | **implemented** (BE-003A) |
| **Auth & Hồ sơ** | `src/context/AuthContext.jsx`<br>`src/pages/RegisterPage.jsx` | `POST /api/v1/auth/register` | `public` | Request: `{ username, password, fullName, email, phone, role, shopName? }`<br>Response: `{ token, user }` | **implemented** (BE-003A) |
| **Auth & Hồ sơ** | `src/context/AuthContext.jsx`<br>`src/pages/AccountPage.jsx` | `GET /api/v1/auth/me` | `buyer` / `seller` | Response: Thông tin tài khoản đăng nhập và hồ sơ (Bearer JWT) | **implemented** (BE-003A) |
| **Auth & Hồ sơ** | `src/pages/AccountPage.jsx`<br>`app/lib/screens/account/` | `PUT /api/v1/auth/profile` | `buyer` / `seller` | Request: `{ fullName, phone, email, avatarUrl }`<br>Response: Profile cập nhật | **implemented** (BE-003B) |
| **Auth & Hồ sơ** | `src/pages/AccountPage.jsx`<br>`app/lib/screens/account/` | `PUT /api/v1/auth/change-password` | `buyer` / `seller` | Đổi mật khẩu tài khoản (Bearer JWT) | **implemented** (BE-003C) |
| **Sổ địa chỉ** | `app/lib/services/address_service.dart`<br>`src/pages/AccountPage.jsx` | `GET /api/v1/addresses` | `buyer` / `seller` | Lấy danh sách sổ địa chỉ nhận hàng của người dùng | **implemented** (BE-003B) |
| **Sổ địa chỉ** | `app/lib/services/address_service.dart`<br>`src/pages/AccountPage.jsx` | `POST /api/v1/addresses` | `buyer` / `seller` | Thêm địa chỉ nhận hàng mới kèm tùy chọn mặc định | **implemented** (BE-003B) |
| **Sổ địa chỉ** | `app/lib/services/address_service.dart` | `PATCH /api/v1/addresses/:id/default` | `buyer` / `seller` | Đặt địa chỉ làm mặc định | **implemented** (BE-003B) |
| **Sổ địa chỉ** | `app/lib/services/address_service.dart` | `DELETE /api/v1/addresses/:id` | `buyer` / `seller` | Xóa mềm địa chỉ nhận hàng | **implemented** (BE-003B) |
| **Catalog Data API** | `data-api/src/controllers/catalog.controller.js` | `GET /internal/v1/categories` | `x-service-key` | Đọc danh sách tất cả các danh mục đang hoạt động | **implemented** (BE-004A) |
| **Catalog Data API** | `data-api/src/controllers/catalog.controller.js` | `GET /internal/v1/products` | `x-service-key` | Đọc danh sách sản phẩm công khai kèm phân trang và lọc | **implemented** (BE-004A) |
| **Catalog Data API** | `data-api/src/controllers/catalog.controller.js` | `GET /internal/v1/products/:idOrSlug` | `x-service-key` | Chi tiết sản phẩm kèm SKU biến thể, thông số kỹ thuật | **implemented** (BE-004A) |
| **Danh mục (Catalog)** | `src/context/CatalogContext.jsx`<br>`src/data/categories.js` | `GET /api/v1/categories` | `public` | Danh sách cây ngành hàng, slug, icon (Xem Mục 3.1) | **implemented** (BE-004A) |
| **Gian hàng (Shop)** | `src/pages/ShopsPage.jsx`<br>`src/data/shops.js` | `GET /api/v1/shops` | `public` | Danh sách các gian hàng trên sàn kèm rating tính toán, Mall, tỉnh/thành (Xem Mục 3.2) | **implemented** (BE-004B) |
| **Gian hàng (Shop)** | `src/pages/ShopPage.jsx`<br>`src/components/shop/` | `GET /api/v1/shops/:shopId` | `public` | Chi tiết gian hàng: logo, banner, rating tính toán, số followers (Xem Mục 3.3) | **implemented** (BE-004B) |
| **Gian hàng (Shop)** | `src/pages/ShopPage.jsx` | `GET /api/v1/shops/:shopId/products` | `public` | Danh sách sản phẩm thuộc một shop cụ thể, có lọc ngành hàng (Xem Mục 3.4) | **implemented** (BE-004B) |
| **Sản phẩm (Catalog)** | `src/pages/SearchPage.jsx`<br>`src/components/search/` | `GET /api/v1/products` | `public` | Tìm kiếm, lọc theo giá, ngành hàng, sắp xếp, phân trang (Xem Mục 3.5) | **implemented** (BE-004A) |
| **Sản phẩm & Khuyến mãi** | `src/pages/HomePage.jsx`<br>`src/data/homeContent.js` | `GET /api/v1/products/featured` | `public` | Banners, Flash Sale, sản phẩm gợi ý trang chủ | **implemented** (BE-004C) |
| **Đánh giá (Review)** | `app/lib/services/review_service.dart` | `GET /api/v1/products/:productId/reviews` | `public` | Xem danh sách đánh giá sản phẩm, rating trung bình và ảnh | **implemented** (BE-008) |
| **Đánh giá (Review)** | `app/lib/services/review_service.dart` | `POST /api/v1/reviews` | `buyer` | Người mua gửi đánh giá sản phẩm sau khi đã nhận hàng | **implemented** (BE-008) |
| **Yêu thích (Favorites)** | `app/lib/services/favorite_service.dart` | `GET /api/v1/favorites` | `buyer` / `seller` | Lấy danh sách sản phẩm yêu thích của tài khoản | **implemented** (BE-008) |
| **Yêu thích (Favorites)** | `app/lib/services/favorite_service.dart` | `POST /api/v1/favorites/:productId` | `buyer` / `seller` | Thêm sản phẩm vào danh sách yêu thích | **implemented** (BE-008) |
| **Yêu thích (Favorites)** | `app/lib/services/favorite_service.dart` | `DELETE /api/v1/favorites/:productId` | `buyer` / `seller` | Xóa sản phẩm khỏi danh sách yêu thích | **implemented** (BE-008) |
| **Quản lý SP (Seller)** | `src/pages/seller/SellerProductsPage.jsx`<br>`app/lib/services/seller_product_service.dart` | `GET /api/v1/seller/products` | `seller` | Danh sách sản phẩm do chính shop của seller sở hữu | **implemented** (BE-005) |
| **Quản lý SP (Seller)** | `src/pages/seller/SellerProductFormPage.jsx`<br>`app/lib/services/seller_product_service.dart` | `POST /api/v1/seller/products` | `seller` | Thêm mới sản phẩm kèm biến thể SKU và gallery ảnh | **implemented** (BE-005) |
| **Quản lý SP (Seller)** | `src/pages/seller/SellerProductFormPage.jsx`<br>`app/lib/services/seller_product_service.dart` | `PUT /api/v1/seller/products/:id` | `seller` | Cập nhật thông tin, biến thể, giá, tồn kho sản phẩm | **implemented** (BE-005) |
| **Quản lý SP (Seller)** | `src/pages/seller/SellerProductsPage.jsx`<br>`app/lib/services/seller_product_service.dart` | `DELETE /api/v1/seller/products/:id` | `seller` | Chuyển trạng thái sản phẩm sang `archived` | **implemented** (BE-005) |
| **Cài đặt Shop (Seller)** | `src/pages/seller/SellerShopPage.jsx` | `GET /api/v1/seller/shop` | `seller` | Lấy thông tin cấu hình gian hàng của seller đang đăng nhập | **implemented** (BE-005B) |
| **Cài đặt Shop (Seller)** | `src/pages/seller/SellerShopPage.jsx` | `PUT /api/v1/seller/shop` | `seller` | Cập nhật logo, banner, tagline, địa chỉ shop | **implemented** (BE-005B) |
| **Cài đặt Shop (Seller)** | `src/pages/seller/SellerShopPage.jsx` | `POST /api/v1/seller/register-shop` | `buyer` / `seller` | Đăng ký mở gian hàng mới | **implemented** (BE-005B) |
| **Thống kê (Seller)** | `src/pages/seller/SellerDashboardPage.jsx` | `GET /api/v1/seller/dashboard` | `seller` | Doanh thu, số đơn chờ xử lý, cảnh báo tồn kho, số lượng sản phẩm | **implemented** (BE-005B) |
| **Theo dõi Shop** | `src/components/shop/ShopHeader.jsx` | `GET/POST/DELETE /api/v1/shops/:shopId/follow` | `buyer` / `seller` | Kiểm tra, theo dõi hoặc hủy theo dõi gian hàng trên sàn | **implemented** (BE-004B2) |
| **Mã giảm giá (Vouchers)** | `app/lib/screens/account/`<br>`src/pages/CheckoutPage.jsx` | `GET /api/v1/vouchers` | `public` | Danh sách mã voucher toàn sàn khả dụng | **implemented** (BE-009) |
| **Mã giảm giá (Vouchers)** | `app/lib/screens/account/`<br>`src/pages/CheckoutPage.jsx` | `GET /api/v1/vouchers/:code` | `public` | Tra cứu chi tiết một mã voucher cụ thể | **implemented** (BE-009) |
| **Voucher Data API** | `data-api/src/controllers/voucher.controller.js` | `GET /internal/v1/vouchers` | `x-service-key` | Truy vấn danh sách voucher từ MySQL | **implemented** (BE-009) |
| **Voucher Data API** | `data-api/src/controllers/voucher.controller.js` | `GET /internal/v1/vouchers/:code` | `x-service-key` | Tra cứu chi tiết một mã voucher theo code | **implemented** (BE-009) |
| **Giỏ hàng (Cart)** | `src/context/CartContext.jsx`<br>`src/pages/CartPage.jsx` | `GET /api/v1/cart` | `buyer` / `seller` | Giỏ hàng hiện tại của user, gom nhóm theo từng shop | **implemented** (BE-006) |
| **Giỏ hàng (Cart)** | `src/pages/CartPage.jsx`<br>`app/lib/screens/cart/` | `POST /api/v1/cart/items` | `buyer` / `seller` | Thêm SKU vào giỏ: `{ variantId, qty }` | **implemented** (BE-006) |
| **Giỏ hàng (Cart)** | `src/pages/CartPage.jsx` | `PATCH /api/v1/cart/items/:itemId` | `buyer` / `seller` | Cập nhật số lượng (1-99) hoặc trạng thái chọn | **implemented** (BE-006) |
| **Giỏ hàng (Cart)** | `src/pages/CartPage.jsx` | `DELETE /api/v1/cart/items/:itemId` | `buyer` / `seller` | Xóa sản phẩm khỏi giỏ hàng | **implemented** (BE-006) |
| **Đặt hàng (Buyer)** | `src/pages/CheckoutPage.jsx`<br>`src/context/OrderContext.jsx` | `POST /api/v1/orders` | `buyer` | Tạo đơn hàng mới (Master Order + Shop Orders). Tính lại giá và trừ kho | **implemented** (BE-007) |
| **Đơn hàng (Buyer)** | `src/pages/OrdersPage.jsx`<br>`src/pages/OrderDetailPage.jsx` | `GET /api/v1/orders` | `buyer` | Danh sách đơn hàng đã mua của khách, lọc theo status | **implemented** (BE-007) |
| **Đơn hàng (Buyer)** | `src/pages/OrderDetailPage.jsx` | `GET /api/v1/orders/:orderId` | `buyer` | Xem chi tiết tiến trình đơn tổng và các đơn con của shop | **implemented** (BE-007) |
| **Đơn hàng (Buyer)** | `src/pages/OrderDetailPage.jsx` | `PATCH /api/v1/orders/:orderId/cancel` | `buyer` | Hủy đơn hàng khi shop chưa xác nhận giao | **implemented** (BE-007) |
| **Đơn hàng (Seller)** | `src/pages/seller/SellerOrdersPage.jsx`<br>`app/lib/services/seller_order_service.dart` | `GET /api/v1/seller/orders` | `seller` | Danh sách đơn con (`shop_orders`) chứa sản phẩm thuộc shop mình | **implemented** (BE-007B) |
| **Đơn hàng (Seller)** | `src/pages/seller/SellerOrdersPage.jsx`<br>`app/lib/services/seller_order_service.dart` | `PATCH /api/v1/seller/orders/:shopOrderId/status` | `seller` | Đổi trạng thái xử lý đơn (Chờ xác nhận -> Đang giao...) cho riêng shop | **implemented** (BE-007B) |

---

## 2. Ghi Nhận Thực Tế & Định Hướng Xử Lý Theo Schema MySQL 8.4

1. **Định dạng ID công khai:**
   Trong database, các bảng dùng `BIGINT UNSIGNED AUTO_INCREMENT`. Khi trả về qua JSON API, tất cả ID (`id`, `shopId`, `categoryId`, `variantId`) đều được tuần tự hóa thành **Chuỗi (String)** để bảo toàn độ chính xác trên môi trường JavaScript.
2. **Quy chuẩn tiền tệ & Giá bán:**
   Tiền tệ trong MySQL là `DECIMAL(15,0)`. Giá bán thực tế (`price`) và giá gốc tham khảo (`original_price`) nằm tại bảng `product_variants`. Khi trả về API danh sách sản phẩm, giá thể hiện là giá của SKU mặc định hoặc khoảng giá min/max.
3. **Ảnh sản phẩm & Gallery:**
   Ảnh đại diện `imageUrl` lấy từ bảng `product_images` có `sort_order = 0`. Toàn bộ gallery ảnh `images` được lấy từ danh sách URL của `product_images` sắp xếp tăng dần theo `sort_order`.
4. **Địa phương xuất hàng:**
   Lấy từ cột `shops.province` (Tỉnh/thành phố gửi hàng) trong bảng `shops`.
5. **Số liệu thống kê (Rating, Sold, Followers):**
   - Không có cột cache trong bảng `products` hay `shops`.
   - `soldCount`: Tính từ `SUM(order_items.qty)` của các đơn đã giao thành công (`shop_orders.status = 'delivered'`).
   - `rating` và `ratingCount`: Tính toán từ bảng `reviews`.
   - `followers`: Đếm số lượt theo dõi từ bảng `shop_follows`.
6. **Mapping Thông số kỹ thuật (`specs`):**
   Trong MySQL, `products.specs` lưu dưới dạng JSON Object (`{"Chất liệu": "Cotton", "Bảo hành": "12 tháng"}`). Khi trả về qua API, Backend chuyển đổi sang mảng các object `{ label, value }` để Frontend dễ duyệt `map()`.

---

## 3. Đặc Tả Chi Tiết Các API Đọc Catalog

> **Quy chuẩn phong bì JSON (JSON Envelope):**
> - Thành công: `{ "success": true, "message": "...", "data": ..., "meta"?: ... }`
> - Thất bại: `{ "success": false, "message": "...", "error": { "code": "...", "details"?: ... } }`

---

### 3.1. API `GET /api/v1/categories` (Đọc danh sách ngành hàng)
- **Endpoint Data API tương ứng:** `GET /internal/v1/categories` (implemented - BE-004A)
- **Quyền:** `public`
- **Query Parameters:** `parentId` (chuỗi ID cha), `includeChildren` (boolean, mặc định `true`).
- **Response Data:** Mảng các danh mục có `id` (chuỗi), `name`, `slug`, `imageUrl`, `sortOrder`, `children`.

---

### 3.2. API `GET /api/v1/shops` (Đọc danh sách gian hàng trên sàn)
- **Endpoint Data API tương ứng:** `GET /internal/v1/shops` (implemented - BE-004B)
- **Quyền:** `public`
- **Query Parameters:** `mall` (boolean), `keyword` (string), `province` (string), `sort` (`popular` | `rating` | `newest`), `page`, `limit`.
- **Response Data:** Mảng shop gồm `id` (chuỗi), `name`, `slug`, `logoUrl`, `bannerUrl`, `tagline`, `province`, `isMall`, `rating`, `ratingCount`, `followersCount`, `productsCount`.

---

### 3.3. API `GET /api/v1/shops/:shopId` (Chi tiết gian hàng)
- **Endpoint Data API tương ứng:** `GET /internal/v1/shops/:idOrSlug` (implemented - BE-004B)
- **Path Parameter:** `shopId` (chuỗi ID hoặc slug).
- **Response Data:** Thông tin chi tiết shop kèm số liệu thống kê được tính toán từ `reviews` và `shop_follows`.

---

### 3.4. API `GET /api/v1/shops/:shopId/products` (Sản phẩm trong gian hàng)
- **Endpoint Data API tương ứng:** `GET /internal/v1/shops/:idOrSlug/products` (implemented - BE-004B)
- **Path Parameter:** `shopId` (chuỗi ID hoặc slug).
- **Query Parameters:** `categoryId`, `sort`, `page`, `limit`.

---

### 3.5. API `GET /api/v1/products` (Tìm kiếm và lọc danh sách sản phẩm)
- **Endpoint Data API tương ứng:** `GET /internal/v1/products` (implemented - BE-004A)
- **Query Parameters:** `q`, `categoryId`, `shopId`, `minPrice`, `maxPrice`, `province`, `mall`, `freeship`, `sort`, `page`, `limit`.
- **Sắp xếp ổn định (Stable Sort):** Luôn kết hợp secondary sort là `id DESC`.

---

### 3.6. API `GET /api/v1/products/:idOrSlug` (Chi tiết sản phẩm)
- **Endpoint Data API tương ứng:** `GET /internal/v1/products/:idOrSlug` (implemented - BE-004A)
- **Path Parameter:** `idOrSlug` (chuỗi ID số hoặc slug).

---

## 4. Các Ví Dụ JSON Response Chuẩn

### 4.1. Ví dụ Danh sách sản phẩm thành công (HTTP 200)

```json
{
  "success": true,
  "message": "Lấy danh sách sản phẩm thành công.",
  "data": [
    {
      "id": "1",
      "name": "Tai nghe Bluetooth Nova Sound Pro Chống Ồn ANC",
      "slug": "tai-nghe-bluetooth-nova-sound-pro-chong-on-anc-p01",
      "price": 890000,
      "originalPrice": 1850000,
      "discount": 52,
      "imageUrl": "https://cdn.shopnova.vn/products/p01-thumb.jpg",
      "rating": 4.9,
      "ratingCount": 1240,
      "soldCount": 8200,
      "province": "TP. Hồ Chí Minh",
      "isMall": true,
      "freeShipping": true,
      "badges": ["Mall", "Yêu thích"],
      "stock": 150,
      "shop": {
        "id": "1",
        "name": "NovaAudio Official",
        "slug": "novaaudio-official",
        "isMall": true,
        "province": "TP. Hồ Chí Minh"
      },
      "category": {
        "id": "2",
        "name": "Điện thoại & Phụ kiện",
        "slug": "dien-thoai-phu-kien"
      },
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 24,
    "total": 60,
    "totalPages": 3
  }
}
```

### 4.2. Ví dụ Chi tiết sản phẩm thành công (HTTP 200)

```json
{
  "success": true,
  "message": "Lấy chi tiết sản phẩm thành công.",
  "data": {
    "id": "1",
    "name": "Tai nghe Bluetooth Nova Sound Pro Chống Ồn ANC",
    "slug": "tai-nghe-bluetooth-nova-sound-pro-chong-on-anc-p01",
    "description": "Tai nghe Bluetooth Nova Sound Pro chống ồn chủ động ANC đỉnh cao...",
    "price": 890000,
    "originalPrice": 1850000,
    "discount": 52,
    "imageUrl": "https://cdn.shopnova.vn/products/p01-thumb.jpg",
    "images": [
      "https://cdn.shopnova.vn/products/p01-thumb.jpg",
      "https://cdn.shopnova.vn/products/p01-angle1.jpg",
      "https://cdn.shopnova.vn/products/p01-angle2.jpg",
      "https://cdn.shopnova.vn/products/p01-box.jpg"
    ],
    "rating": 4.9,
    "ratingCount": 1240,
    "soldCount": 8200,
    "province": "TP. Hồ Chí Minh",
    "isMall": true,
    "freeShipping": true,
    "badges": ["Mall", "Yêu thích", "Freeship"],
    "stock": 150,
    "specs": [
      { "label": "Thương hiệu", "value": "NovaAudio" },
      { "label": "Xuất xứ", "value": "Việt Nam" },
      { "label": "Bảo hành", "value": "12 tháng" },
      { "label": "Chất liệu", "value": "Hợp kim nhôm & Da cao cấp" }
    ],
    "variants": [
      {
        "id": "1",
        "sku": "NOVA-SP-BLK",
        "variantKey": "color:black",
        "name": "Đen Huyền Bí",
        "attributes": { "color": "Đen" },
        "price": 890000,
        "originalPrice": 1850000,
        "stockQty": 80,
        "isActive": true
      },
      {
        "id": "2",
        "sku": "NOVA-SP-WHT",
        "variantKey": "color:white",
        "name": "Trắng Tinh Khôi",
        "attributes": { "color": "Trắng" },
        "price": 890000,
        "originalPrice": 1850000,
        "stockQty": 70,
        "isActive": true
      }
    ],
    "shop": {
      "id": "1",
      "name": "NovaAudio Official",
      "slug": "novaaudio-official",
      "logoUrl": "https://cdn.shopnova.vn/shops/novaaudio-logo.jpg",
      "bannerUrl": "https://cdn.shopnova.vn/shops/novaaudio-banner.jpg",
      "rating": 4.8,
      "ratingCount": 1280,
      "followers": 15600,
      "isMall": true,
      "province": "TP. Hồ Chí Minh"
    },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-05T10:00:00.000Z"
  }
}
```

---

## 5. Bảng Mapping Dữ Liệu: JSON API ↔ Database (MySQL 8.4) ↔ Frontend (Web/App)

| Tên trường JSON API | Kiểu dữ liệu JSON | Nguồn CSDL MySQL 8.4 / Quy tắc trích xuất | Nền tảng Frontend liên quan | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | `products.id` (`BIGINT UNSIGNED PK`) | React: `p.id`<br>Flutter: `product.id` | Database lưu số tự tăng, API luôn gửi chuỗi (String) để an toàn tuyệt đối với mọi client (tránh tràn số 64-bit JS). |
| `name` | `string` | `products.name` (`VARCHAR(200)`) | React: `p.name`<br>Flutter: `product.name` | Khớp 100%. |
| `slug` | `string` | `products.slug` (`VARCHAR(220) ascii_bin UK`) | React: `p.slug`<br>Flutter: *chưa có trong model* | Dùng làm định danh URL thân thiện SEO. Flutter cần mở rộng model khi tích hợp. |
| `price` | `number` (VND nguyên) | `product_variants.price` (`DECIMAL(15,0)`) | React: `p.price`<br>Flutter: `product.price` | Tiền tệ luôn là số nguyên VND an toàn. Giá lấy từ SKU mặc định hoặc giá thấp nhất. |
| `originalPrice` | `number` (VND nguyên) | `product_variants.original_price` (`DECIMAL(15,0)`) | React: `p.originalPrice`<br>Flutter: `product.originalPrice` | API luôn trả về **`number`**. Trong CSDL cột `original_price` có thể NULL; khi NULL, API trả bằng đúng `price` kèm `discount = 0` để tương thích model Flutter non-nullable. |
| `discount` | `number` (%) | **Tính toán:** `round((originalPrice - price) / originalPrice * 100)` | React: `p.discount`<br>Flutter: `product.discount` | Backend tự tính khi có `originalPrice > price`. Bằng 0 nếu không giảm giá. |
| `imageUrl` | `string` (URL) | `product_images.url` với `sort_order = 0` | React: `p.image` *(khác tên, cần adapter)*<br>Flutter: `product.imageUrl` | Ảnh đại diện chính thức của sản phẩm. React Web hiện đặt tên field là `image`. |
| `images` | `array of string` | `product_images.url ORDER BY sort_order ASC` | React: `p.gallery` *(khác tên, cần adapter)*<br>Flutter: *chưa có trong model* | Danh sách gallery ảnh. React Web dùng `gallery`; Flutter model chưa khai báo (cần mở rộng). |
| `rating` | `number` | **Tính toán:** `ROUND(AVG(reviews.rating), 1)` | React: `p.rating`<br>Flutter: `product.rating` | Tính từ các review hiển thị (`status = 'visible'`). |
| `ratingCount` | `number` | **Tính toán:** `COUNT(reviews.id)` | React: `p.ratingCount`<br>Flutter: *chưa có trong model* | Tổng số lượt đánh giá của sản phẩm. Flutter cần mở rộng model khi cần hiển thị. |
| `soldCount` | `number` (nguyên) | **Tính toán:** `SUM(order_items.qty)` từ đơn giao thành công | React: `p.sold` *(khác tên, cần adapter)*<br>Flutter: `product.soldCount` *(cần adapter format)* | API luôn trả về **số nguyên nguyên thủy** (`int`). React Web dùng `p.sold`; Flutter model khai báo `String` nên cần adapter format chuỗi (ví dụ: "Đã bán 8.2k"). |
| `province` | `string` | `shops.province` (`VARCHAR(120)`) | React: `p.location` *(khác tên, cần adapter)*<br>Flutter: *chưa có trong model* | Nơi gửi hàng (Tỉnh/Thành phố của shop). React Web dùng `p.location`; Flutter model chưa có. |
| `isMall` | `boolean` | `shops.is_mall` (`BOOLEAN`) | React: `p.mall` / `p.shopMall`<br>Flutter: *chưa có trong model* | Cờ shop chính hãng Nova Mall. React Web dùng `p.mall` hoặc `p.tags.includes('mall')`. |
| `freeShipping` | `boolean` | `products.free_shipping` (`BOOLEAN`) | React: `p.freeship`<br>Flutter: *chưa có trong model* | Cờ hỗ trợ chính sách miễn phí vận chuyển. React Web dùng `p.freeship`. |
| `badges` | `array of string` | `products.badges` (`JSON Array`) | React: `p.tags`<br>Flutter: `product.badges` | Mảng nhãn hiển thị: `["Mall", "Yêu thích", "Freeship"]`. Khớp model Flutter. |
| `stock` | `number` | **Tính toán:** `SUM(product_variants.stock_qty)` | React: `p.stock`<br>Flutter: *chưa có trong model* | Tổng tồn kho sẵn sàng bán của tất cả SKU. Flutter cần mở rộng model. |
| `specs` | `array of object` | `products.specs` (`JSON Object` trong DB) | React: `p.specs`<br>Flutter: *chưa có trong model* | Backend chuyển đổi Object `{"Chất liệu": "Cotton"}` sang mảng `[{"label": "Chất liệu", "value": "Cotton"}]`. |
| `variants` | `array of object` | Bảng `product_variants` JOIN theo `product_id` | React: `p.variantGroups` *(cần adapter chuyển đổi)*<br>Flutter: *chưa có trong model* | API trả về danh sách biến thể SKU phẳng `[{ id, sku, variantKey, name, attributes, price, stockQty, isActive }]`. React Web dùng `variantGroups` nhóm theo thuộc tính UI; **bắt buộc cần adapter chuyển đổi, không có mapping trực tiếp 1-1**. |

### Các trường không lưu trong CSDL (Chỉ phục vụ hiển thị / Mock):
1. `emoji` & `hue`: Chỉ dùng tạo banner SVG offline trong môi trường mock; không đưa vào API hay DB.
2. `soldPercent`: Tỷ lệ phần trăm đã bán trên giao diện Flash Sale, tính động: `Math.round((soldCount / (soldCount + stock)) * 100)`.
3. `isFavorite`: Cờ cá nhân hóa phụ thuộc vào phiên người dùng đăng nhập, tính bằng việc tra cứu bảng `product_favorites WHERE user_id = ? AND product_id = ?`.

### Đối chiếu Model Mobile Flutter (`app/lib/models/product.dart`):
- Model `Product` hiện tại trong Flutter định nghĩa đúng **10 trường**: `id`, `name`, `imageUrl`, `price`, `originalPrice`, `discount`, `rating`, `soldCount`, `badges`, `isFavorite`.
- Các trường catalog trong CSDL và Backend API chưa có trong model Flutter (`slug`, `description`, `specs`, `variants`, `shop`, `category`, `freeShipping`, `province`, `stock`) cần adapter hoặc mở rộng model ở tác vụ tích hợp ứng dụng Flutter; không sửa trực tiếp code Flutter trong tác vụ này.

---

## 6. Cơ Chế Giao Tiếp Backend ↔ Data API Nội Bộ

```text
Frontend Web / Mobile App
       │
       │ HTTP API (/api/v1/*)
       ▼
Backend Express (Port 3000)
       │
       │ HTTP Nội bộ (/internal/v1/*)
       │ Header: x-service-key: DATA_API_KEY
       │ Timeout: 5000ms
       ▼
Data API Express (Port 3001 - Implemented System Endpoints: health, ready)
       │
       │ Sequelize 6 + mysql2 (UTC, Pool: max 5, min 0, acquire: 3000ms)
       ▼
MySQL 8.4 Server (Port 3306 - shopnova_dev)
```

- **Môi trường & Cổng:** Backend lắng nghe mặc định tại **Port 3000** (`backend/src/config/env.js`); Data API lắng nghe tại **Port 3001** (`data-api/src/config/env.js`).
- **Hiện trạng kết nối:**
  - **Database MySQL 8.4:** Đã nhập 22 bảng và seed data tại database `shopnova_dev` (kết quả DB-001: đã tạo đủ ràng buộc và kiểm chứng 4 test case vi phạm đại diện đạt chuẩn, không tuyên bố kiểm thử toàn bộ nghiệp vụ/constraint).
  - **Data API Nội bộ (`data-api/`):** Đã hoàn tất khởi tạo runtime tại Port 3001 và hoàn thiện trong DB-002-R4: `GET /internal/v1/health` (liveness) và `GET /internal/v1/ready` (ngân sách 3000ms, quản lý quyền sở hữu connection theo vòng đời, hủy `_pendingAcquires` của `sequelize-pool` khi timeout để chống rò rỉ socket). Bộ test đạt 42 smoke tests PASS, 55 check:timeout tests PASS, 42 check:db tests PASS trên tiến trình production thật với MySQL 8.4.4 (đối chiếu seed trên 3 bảng chính: categories, products, product_variants).
  - **Backend HTTP Client (`backend/src/clients/data.client.js`):** Đã hoàn thành trong DB-003 / BE-002B2 (**implemented**), sử dụng built-in `fetch` gọi Data API `/internal/v1/health` và `/internal/v1/ready` với deadline cố định 5000ms bao phủ kết nối, headers, streaming body và parse JSON; giới hạn 1MiB; mapping lỗi an toàn thành 502/503/504 và hỗ trợ endpoint `GET /api/v1/ready`.
  - **Endpoint nghiệp vụ:** Toàn bộ endpoint nghiệp vụ (catalog, auth, cart, orders) tiếp tục ở trạng thái **planned**.
- **An toàn dữ liệu:** Data API chỉ mở các endpoint nghiệp vụ cố định đã thiết kế; tuyệt đối không mở endpoint nhận câu lệnh SQL tùy ý. Backend tuyệt đối không kết nối trực tiếp MySQL hay import model từ Data API.
