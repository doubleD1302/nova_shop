import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'file:///d:/download/nova_shop-main/nova_shop-main/data-api/node_modules/mysql2/promise.js';

const UPLOAD_DIR = path.resolve('d:/download/nova_shop-main/nova_shop-main/backend/uploads');
const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const PRODUCTS = [
  // ==================== 1. THỜI TRANG NAM (category_id: 1) ====================
  {
    shop_id: 1,
    category_id: 1,
    name: "Quần Jeans Nam Levi's 501 Cổ Điển Form Straight Fit",
    price: 1250000,
    originalPrice: 1650000,
    stock: 45,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: "Quần jeans nam Levi's 501 Original Fit biểu tượng, chất liệu denim 100% cotton dệt chéo dày dặn. Form ống suông thẳng cổ điển tôn dáng, đinh tán gia cố và cúc cài kim loại bền bỉ đặc trưng.",
    specs: { 'Thương hiệu': "Levi's", 'Dòng sản phẩm': '501 Original', 'Chất liệu': '100% Cotton Denim', 'Kiểu ống': 'Ống đứng (Straight)', 'Xuất xứ': 'Mỹ / Nhập khẩu' },
    files: [
      { title: 'File:501xx-front.jpg', role: 'Ảnh 1: Góc chụp chính mặt trước' },
      { title: 'File:501xx-back.jpg', role: 'Ảnh 2: Góc chụp mặt sau quần' },
      { title: 'File:501xx-red-tab-one-side.jpg', role: 'Ảnh 3: Cận cảnh tem đỏ Levi\'s Red Tab' },
      { title: 'File:501xx-rivet-back.jpg', role: 'Ảnh 4: Chi tiết đinh tán đồng gia cố túi trong' },
    ]
  },
  {
    shop_id: 1,
    category_id: 1,
    name: 'Áo Sơ Mi Nam Cổ Điển Dài Tay Vải Dệt Cotton Oxford',
    price: 395000,
    originalPrice: 520000,
    stock: 50,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Áo sơ mi nam chất vải dệt Oxford Cotton 100% dày dặn đứng form, bề mặt dệt mắt nổi thoáng khí. Cổ bẻ cài khuy button-down lịch sự, đường may cuộn tỉ mỉ thích hợp cho môi trường công sở.',
    specs: { 'Chất liệu': '100% Cotton Oxford', 'Kiểu tay': 'Dài tay', 'Form dáng': 'Regular Fit', 'Màu sắc': 'Trắng kem tự nhiên' },
    files: [
      { title: 'File:Shirt, man\'s (AM 1737-1).jpg', role: 'Ảnh 1: Góc chụp chính toàn thân áo' },
      { title: 'File:Shirt, man\'s (AM 1737-3).jpg', role: 'Ảnh 2: Góc chụp mặt sau lưng áo' },
      { title: 'File:Shirt, man\'s (AM 1737-6).jpg', role: 'Ảnh 3: Cận cảnh cổ bẻ và nẹp khuy' },
      { title: 'File:Shirt, man\'s (AM 1737-8).jpg', role: 'Ảnh 4: Chi tiết đường chỉ may và cổ tay áo' },
    ]
  },
  {
    shop_id: 2,
    category_id: 1,
    name: 'Áo Khoác Nam Dáng Dài Frock Coat Vải Dạ Cao Cấp',
    price: 890000,
    originalPrice: 1200000,
    stock: 25,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Áo khoác nam dáng dài phong cách cổ điển sang trọng, may từ chất liệu dạ pha len dày dặn cản gió giữ ấm tốt. Thiết kế ve áo đứng, cúc kim loại khắc họa tiết tinh tế.',
    specs: { 'Kiểu dáng': 'Frock Coat dáng dài', 'Chất liệu': 'Dạ pha len', 'Lớp lót': 'Lụa satin mềm mượt', 'Mùa thích hợp': 'Thu Đông' },
    files: [
      { title: 'File:Frock coat (AM 1970.272-2).jpg', role: 'Ảnh 1: Mặt trước dáng áo đứng' },
      { title: 'File:Uniform (AM 1970.272-3).jpg', role: 'Ảnh 2: Góc nghiêng thân áo' },
      { title: 'File:Frock coat (AM 1970.272-6).jpg', role: 'Ảnh 3: Cận cảnh vạt áo và khuy kim loại' },
      { title: 'File:Uniform (AM 1970.272-2).jpg', role: 'Ảnh 4: Chi tiết ve cổ và lót trong' },
    ]
  },

  // ==================== 2. THỜI TRANG NỮ (category_id: 3) ====================
  {
    shop_id: 2,
    category_id: 3,
    name: 'Đầm Nữ Dáng Suông Shirt Dress Vải Linen Tự Nhiên',
    price: 460000,
    originalPrice: 590000,
    stock: 35,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Đầm sơ mi nữ (Shirt Dress) dáng suông thoải mái, chất liệu linen sợi tự nhiên thoáng mát và thấm hút mồ hôi. Hàng cúc trước thanh lịch, có túi xẻ hông tiện lợi.',
    specs: { 'Kiểu dáng': 'Shirt Dress dáng suông', 'Chất liệu': 'Linen tự nhiên', 'Độ dài': 'Ngang bắp chân (Midi)' },
    files: [
      { title: 'File:Dress "shirt dress" (AM 2019.18.2-1).jpg', role: 'Ảnh 1: Toàn cảnh mặt trước đầm' },
      { title: 'File:Dress "shirt dress" (AM 2019.18.2-2).jpg', role: 'Ảnh 2: Góc chụp mặt sau lưng' },
      { title: 'File:Dress "shirt dress" (AM 2019.18.2-3).jpg', role: 'Ảnh 3: Cận cảnh cổ áo và hàng cúc' },
      { title: 'File:Dress "shirt dress" (AM 2019.18.2-4).jpg', role: 'Ảnh 4: Chi tiết tà váy và đường may gấu' },
    ]
  },
  {
    shop_id: 2,
    category_id: 3,
    name: 'Áo Blazer Nữ Phong Cách Hàn Quốc Dáng Lửng Thanh Lịch',
    price: 520000,
    originalPrice: 680000,
    stock: 40,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Áo khoác blazer nữ dáng lửng trẻ trung, form áo đứng dáng tôn eo nhẹ nhàng. Chất vải tuyết mưa cao cấp ít nhăn, phối cùng chân váy hay quần suông đều sang trọng.',
    specs: { 'Chất liệu': 'Vải tuyết mưa 2 lớp', 'Form dáng': 'Blazer lửng ôm nhẹ', 'Phong cách': 'Công sở Hàn Quốc' },
    files: [
      { title: 'File:Jacket (AM 15166-1).jpg', role: 'Ảnh 1: Mặt trước cài cúc' },
      { title: 'File:Jacket (AM 15166-4).jpg', role: 'Ảnh 2: Mặt sau lưng áo' },
      { title: 'File:Jacket (AM 15166-5).jpg', role: 'Ảnh 3: Cận cảnh ve áo và túi áo' },
      { title: 'File:Jacket (AM 15166-6).jpg', role: 'Ảnh 4: Chi tiết lót trong và nẹp áo' },
    ]
  },
  {
    shop_id: 2,
    category_id: 3,
    name: 'Đầm Dạ Hội Nữ Thắt Eo Dáng Xòe Đi Tiệc Cao Cấp',
    price: 780000,
    originalPrice: 990000,
    stock: 30,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Đầm dạ hội nữ thiết kế chiết eo thắt nơ tôn dáng quyến rũ, tùng váy xòe bồng bềnh nhiều lớp. Thích hợp cho các buổi tiệc cưới, sự kiện quan trọng hay dạ tiệc tối.',
    specs: { 'Kiểu dáng': 'Đầm dạ tiệc chiết eo xòe', 'Chất liệu': 'Lụa satin cao cấp', 'Họa tiết': 'Dệt nổi chìm tinh xảo' },
    files: [
      { title: 'File:Dress MET DP-14594-003.jpg', role: 'Ảnh 1: Mặt trước trên ma-nơ-canh' },
      { title: 'File:Dress MET DP-14594-004.jpg', role: 'Ảnh 2: Góc nhìn từ phía sau lưng' },
      { title: 'File:Dress MET DP-14594-005.jpg', role: 'Ảnh 3: Cận cảnh chất liệu vải và họa tiết' },
      { title: 'File:Dress MET DP-14594-006.jpg', role: 'Ảnh 4: Chi tiết thắt eo và viền ren' },
    ]
  },

  // ==================== 3. ĐIỆN THOẠI & PHỤ KIỆN (category_id: 2) ====================
  {
    shop_id: 1,
    category_id: 2,
    name: 'Điện Thoại Apple iPhone 13 Pro 128GB Màu Sierra Blue',
    price: 13990000,
    originalPrice: 16990000,
    stock: 20,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Điện thoại Apple iPhone 13 Pro màn hình Super Retina XDR ProMotion 120Hz mượt mà. Hệ thống 3 camera chuyên nghiệp góc siêu rộng, camera chính và tele 3x hỗ trợ chụp đêm Night Mode đỉnh cao.',
    specs: { 'Hãng': 'Apple', 'Màn hình': '6.1 inch OLED 120Hz', 'Vi xử lý': 'Apple A15 Bionic', 'Bộ nhớ trong': '128GB', 'Màu sắc': 'Sierra Blue' },
    files: [
      { title: 'File:Apple iPhone 13 Pro on MacBook Pro 02.jpg', role: 'Ảnh 1: Mặt lưng cụm 3 camera' },
      { title: 'File:Apple iPhone 13 Pro on MacBook Pro 05.jpg', role: 'Ảnh 2: Mặt trước màn hình OLED' },
      { title: 'File:Apple iPhone 13 Pro on MacBook Pro 06.jpg', role: 'Ảnh 3: Cận cảnh khung viền thép không gỉ' },
      { title: 'File:Apple iPhone 13 Pro on MacBook Pro 07.jpg', role: 'Ảnh 4: Cạnh dưới loa và cổng Lightning' },
    ]
  },
  {
    shop_id: 1,
    category_id: 2,
    name: 'Pin Sạc Dự Phòng Anker PowerCore Siêu Nhẹ 10000mAh',
    price: 490000,
    originalPrice: 650000,
    stock: 65,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Pin sạc dự phòng Anker PowerCore dung lượng 10000mAh thiết kế siêu nhỏ gọn bỏ túi. Công nghệ sạc nhanh thông minh PowerIQ và VoltageBoost đảm bảo an toàn tuyệt đối cho thiết bị.',
    specs: { 'Thương hiệu': 'Anker', 'Dung lượng pin': '10000mAh', 'Cổng sạc': 'USB-A và Type-C', 'Bảo hành': '18 tháng' },
    files: [
      { title: 'File:17-11-13-Powerbank-Anker RR79813.jpg', role: 'Ảnh 1: Mặt trước logo Anker' },
      { title: 'File:17-11-13-Powerbank-Anker RR79814.jpg', role: 'Ảnh 2: Mặt sau thông số kỹ thuật' },
      { title: 'File:17-11-13-Powerbank-Anker RR79815.jpg', role: 'Ảnh 3: Cận cảnh cổng USB-A và Type-C' },
      { title: 'File:17-11-13-Powerbank-Anker RR79816.jpg', role: 'Ảnh 4: Góc cạnh bên và nút nguồn LED' },
    ]
  },
  {
    shop_id: 1,
    category_id: 2,
    name: 'Tai Nghe Bluetooth Chụp Tai Sony WH-1000XM3 Chống Ồn Chủ Động',
    price: 4890000,
    originalPrice: 6200000,
    stock: 18,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Tai nghe chống ồn đỉnh cao Sony WH-1000XM3 với bộ xử lý QN1 triệt tiêu tiếng ồn môi trường xuất sắc. Thời lượng pin lên đến 30 giờ, công nghệ âm thanh Hi-Res Audio và cảm ứng trượt thông minh.',
    specs: { 'Thương hiệu': 'Sony', 'Kết nối': 'Bluetooth 5.0, NFC, Jack 3.5mm', 'Thời lượng pin': '30 giờ (bật chống ồn)', 'Khối lượng': '255g' },
    files: [
      { title: 'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.2.jpg', role: 'Ảnh 1: Góc chụp chính mặt trước' },
      { title: 'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.3.jpg', role: 'Ảnh 2: Góc nghiêng cúp tai và đệm đầu' },
      { title: 'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.4.jpg', role: 'Ảnh 3: Cận cảnh củ tai cảm ứng và logo Sony' },
      { title: 'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.5.jpg', role: 'Ảnh 4: Góc gập gọn bỏ vào hộp đựng' },
    ]
  },
  {
    shop_id: 1,
    category_id: 2,
    name: 'Tai Nghe True Wireless Bose QuietComfort Ultra Earbuds Chống Ồn',
    price: 5490000,
    originalPrice: 6990000,
    stock: 22,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Tai nghe không dây Bose QuietComfort Ultra Earbuds trang bị công nghệ CustomTune cá nhân hóa âm thanh và chống ồn theo vòm tai. Tính năng Bose Immersive Audio mang lại không gian âm thanh 3D sống động.',
    specs: { 'Hãng sản xuất': 'Bose', 'Chống ồn': 'Active Noise Cancelling thế hệ mới', 'Kháng nước': 'IPX4', 'Thời gian nghe': '6 giờ (hộp sạc thêm 18 giờ)' },
    files: [
      { title: 'File:Bose QuietComfort Ultra Earbuds - 1.jpg', role: 'Ảnh 1: Cặp tai nghe trong hộp sạc' },
      { title: 'File:Bose QuietComfort Ultra Earbuds - 2.jpg', role: 'Ảnh 2: Hai củ tai nghe đặt cạnh nhau' },
      { title: 'File:Bose QuietComfort Ultra Earbuds - 3.jpg', role: 'Ảnh 3: Cận cảnh củ loa và núm tai silicon' },
      { title: 'File:Bose QuietComfort Ultra Earbuds - 4.jpg', role: 'Ảnh 4: Mặt sau hộp sạc và cổng sạc' },
    ]
  },

  // ==================== 4. MÁY TÍNH & LAPTOP (category_id: 9) ====================
  {
    shop_id: 1,
    category_id: 9,
    name: 'Laptop Apple MacBook Pro 14 inch 2021 M1 Pro Xám Không Gian',
    price: 26500000,
    originalPrice: 32000000,
    stock: 12,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Apple MacBook Pro 14 inch 2021 chip Apple M1 Pro mạnh mẽ vượt trội. Màn hình Liquid Retina XDR độ sáng 1000 nits cực đỉnh, bàn phím cơ chế cắt kéo Magic Keyboard êm ái cùng đầy đủ cổng kết nối chuyên nghiệp.',
    specs: { 'Vi xử lý': 'Apple M1 Pro 8-core CPU / 14-core GPU', 'RAM': '16GB Unified', 'SSD': '512GB NVMe', 'Màn hình': '14.2 inch Liquid Retina XDR 120Hz' },
    files: [
      { title: 'File:Apple Macbook Pro 14" 2021 - Keyboard.png', role: 'Ảnh 1: Mặt mở hiển thị bàn phím và màn hình' },
      { title: 'File:Apple Macbook Pro 14" 2021 - Back cover.png', role: 'Ảnh 2: Mặt nắp lưng nhôm nguyên khối' },
      { title: 'File:Apple Macbook Pro 14" 2021 - Ports on the left side.png', role: 'Ảnh 3: Cận cảnh cổng MagSafe và Thunderbolt' },
      { title: 'File:Apple Macbook Pro 14" 2021 - Ports on the right side.png', role: 'Ảnh 4: Cận cảnh cổng HDMI và khe thẻ nhớ SD' },
    ]
  },
  {
    shop_id: 1,
    category_id: 9,
    name: 'Laptop Lenovo ThinkPad X220 Doanh Nhân Siêu Bền',
    price: 4200000,
    originalPrice: 5500000,
    stock: 15,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Laptop huyền thoại Lenovo ThinkPad X220 với bàn phím gõ êm nhất thế giới 7-row classic. Khung máy hợp kim Magie đạt chuẩn độ bền quân đội Mỹ, có TrackPoint đỏ tiện dụng.',
    specs: { 'Hãng': 'Lenovo', 'Dòng máy': 'ThinkPad X-Series', 'Màn hình': '12.5 inch IPS HD', 'Tính năng': 'Bàn phím chống tràn, TrackPoint' },
    files: [
      { title: 'File:Open Lenovo ThinkPad X220 with Norwegian (NO) Chicony keyboard FRU 45N2161.jpg', role: 'Ảnh 1: Màn hình mở và bàn phím' },
      { title: 'File:Top cover of a closed Lenovo ThinkPad X220 laptop.jpg', role: 'Ảnh 2: Mặt nắp máy khi gập' },
      { title: 'File:Bottom view of a closed Lenovo ThinkPad X220 laptop.jpg', role: 'Ảnh 3: Mặt đáy tản nhiệt và đế docking' },
      { title: 'File:ThinkPad X220 closed, x201 on top.jpg', role: 'Ảnh 4: Góc cạnh bên các cổng kết nối' },
    ]
  },
  {
    shop_id: 1,
    category_id: 9,
    name: 'Chuột Không Dây Cao Cấp Logitech MX Master 3S Công Thái Học',
    price: 2190000,
    originalPrice: 2690000,
    stock: 45,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Chuột công thái học cao cấp Logitech MX Master 3S trang bị nút bấm Silent Touch giảm 90% tiếng ồn. Con lăn điện từ MagSpeed cuộn 1000 dòng/giây siêu tốc, cảm biến Darkfield 8000 DPI di chuyển trên mọi bề mặt kể cả mặt kính.',
    specs: { 'Cảm biến': 'Darkfield 8000 DPI', 'Kết nối': 'Bluetooth Low Energy & Logi Bolt USB', 'Thời lượng pin': 'Lên đến 70 ngày', 'Khối lượng': '141g' },
    files: [
      { title: 'File:Logitech MX Master 3S HS01.jpg', role: 'Ảnh 1: Mặt trên con lăn MagSpeed' },
      { title: 'File:Logitech MX Master 3S HS02.jpg', role: 'Ảnh 2: Góc bên hông tựa ngón tay cái' },
      { title: 'File:Logitech MX Master 3S HS03.jpg', role: 'Ảnh 3: Mặt đáy cảm biến 8000 DPI' },
      { title: 'File:Logitech MX Master 3S HS04.jpg', role: 'Ảnh 4: Góc nhìn từ phía trước cổng sạc USB-C' },
    ]
  },
  {
    shop_id: 1,
    category_id: 9,
    name: 'Bàn Phím Cơ Không Dây Keychron K8 TKL Nhôm Bluetooth',
    price: 1850000,
    originalPrice: 2290000,
    stock: 35,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Bàn phím cơ không dây Keychron K8 layout Tenkeyless (TKL) khung nhôm cứng cáp. Kết nối linh hoạt tới 3 thiết bị qua Bluetooth hoặc cáp Type-C, tương thích hoàn hảo cả Mac và Windows.',
    specs: { 'Layout': 'Tenkeyless 87 phím', 'Khung viền': 'Nhôm Anode cao cấp', 'Pin': '4000mAh dùng 240 giờ', 'Tương thích': 'macOS / Windows / Android' },
    files: [
      { title: 'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard.jpg', role: 'Ảnh 1: Góc chụp chính layout 87 phím' },
      { title: 'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard (closeup).jpg', role: 'Ảnh 2: Cận cảnh keycap và switch' },
      { title: 'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard - 52772912798.jpg', role: 'Ảnh 3: Góc nghiêng cạnh phím và cổng USB' },
      { title: 'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard - 52772428371.jpg', role: 'Ảnh 4: Góc nhìn toàn cảnh thực tế' },
    ]
  },

  // ==================== 5. GIÀY DÉP (category_id: 4) ====================
  {
    shop_id: 2,
    category_id: 4,
    name: 'Giày Bốt Nam Da Bò Cao Cổ Dr. Martens 1460 8 Lỗ Xỏ',
    price: 3650000,
    originalPrice: 4500000,
    stock: 28,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Bốt da nam cổ cao Dr. Martens 1460 Smooth Leather biểu tượng phong cách Rock & Roll đường phố. Thiết kế 8 lỗ xỏ kim loại, viền chỉ vàng Goodyear trứ danh và đế cao su đệm khí AirWair êm ái chống trơn trượt.',
    specs: { 'Chất liệu da': 'Smooth Leather 100% da bò tự nhiên', 'Đế giày': 'AirWair cao su đệm khí kháng dầu mỡ', 'Phương pháp may': 'Goodyear Welted bền bỉ trọn đời' },
    files: [
      { title: 'File:Dr. Martens 1460 01.jpg', role: 'Ảnh 1: Mặt trước dây buộc' },
      { title: 'File:Dr. Martens 1460 02.jpg', role: 'Ảnh 2: Góc nghiêng thân bốt và chỉ vàng' },
      { title: 'File:Dr. Martens 1460 03.jpg', role: 'Ảnh 3: Cận cảnh quai kéo AirWair gót giày' },
      { title: 'File:Dr. Martens 1460 04.jpg', role: 'Ảnh 4: Mặt đế cao su chống trượt' },
    ]
  },
  {
    shop_id: 2,
    category_id: 4,
    name: 'Giày Thể Thao Nam Tennis Da Trắng Cổ Thấp Cổ Điển',
    price: 850000,
    originalPrice: 1100000,
    stock: 40,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Giày sneaker nam cổ thấp phong cách quần vợt cổ điển (Classic Tennis Shoes), chất liệu da tự nhiên mềm mại, đế cao su đúc nguyên khối tăng độ bám và độ đàn hồi khi di chuyển.',
    specs: { 'Chất liệu': 'Da bò thật kết hợp đế cao su', 'Kiểu dáng': 'Low-top Tennis Sneaker', 'Màu sắc': 'Trắng cổ điển' },
    files: [
      { title: 'File:Shoes, leather tennis (pair) (AM 2017.30.1-3).jpg', role: 'Ảnh 1: Góc nghiêng cạnh ngoài' },
      { title: 'File:Shoes, leather tennis (pair) (AM 2017.30.1-12).jpg', role: 'Ảnh 2: Mặt trên dây buộc và lưỡi gà' },
      { title: 'File:Shoes, leather tennis (pair) (AM 2017.30.1-13).jpg', role: 'Ảnh 3: Góc mặt sau gót giày' },
      { title: 'File:Shoes, leather tennis (pair) (AM 2017.30.1-18).jpg', role: 'Ảnh 4: Chi tiết mặt đế giày bám sân' },
    ]
  },
  {
    shop_id: 2,
    category_id: 4,
    name: 'Giày Cao Gót Nữ Mũi Nhọn Da Thật Gót Nhọn 7cm',
    price: 650000,
    originalPrice: 850000,
    stock: 35,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Giày cao gót nữ thiết kế mũi nhọn thanh thoát giúp kéo dài đôi chân, gót cao 7cm tôn dáng chuẩn mực. Đệm lót da cừu êm chân đi cả ngày không mỏi.',
    specs: { 'Độ cao gót': '7 cm', 'Kiểu mũi': 'Mũi nhọn (Pointed Toe)', 'Chất liệu': 'Da thật cao cấp' },
    files: [
      { title: 'File:Shoes, pair woman\'s (AM 1992.163-1).jpg', role: 'Ảnh 1: Mặt trước mũi giày' },
      { title: 'File:Shoes, pair woman\'s (AM 1992.163-2).jpg', role: 'Ảnh 2: Góc nghiêng thân giày' },
      { title: 'File:Shoes, pair woman\'s (AM 1992.163-4).jpg', role: 'Ảnh 3: Cận cảnh gót nhọn thanh mảnh' },
      { title: 'File:Shoes, pair woman\'s (AM 1992.163-5).jpg', role: 'Ảnh 4: Chi tiết lòng giày lót da êm ái' },
    ]
  },
  {
    shop_id: 2,
    category_id: 4,
    name: 'Giày Bốt Nữ Cổ Cao Da Mềm Khóa Kéo Thời Trang',
    price: 920000,
    originalPrice: 1250000,
    stock: 25,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Bốt nữ da mềm cao cổ sang trọng, khóa kéo hông tiện dụng dễ xỏ. Đế đúc cao su cao 4cm chắc chắn, phù hợp phối cùng váy ngắn hay quần jean mùa thu đông.',
    specs: { 'Chất liệu': 'Da mềm mịn cao cấp', 'Chiều cao cổ': '20cm', 'Gót': 'Đế vuông cao 4cm' },
    files: [
      { title: 'File:Boots, pair woman\'s (AM 1992.157-3).jpg', role: 'Ảnh 1: Mặt trước thân bốt cao' },
      { title: 'File:Boots, pair woman\'s (AM 1992.157-4).jpg', role: 'Ảnh 2: Góc nhìn từ phía sau thân bốt' },
      { title: 'File:Boots, pair woman\'s (AM 1992.157-5).jpg', role: 'Ảnh 3: Cận cảnh mũi bốt và đường viền chỉ' },
      { title: 'File:Boots, pair woman\'s (AM 1992.157-9).jpg', role: 'Ảnh 4: Chi tiết đế bốt và gót chống trượt' },
    ]
  },
  {
    shop_id: 2,
    category_id: 4,
    name: 'Giày Bốt Leo Núi Chuyên Dụng Dã Ngoại Chống Nước',
    price: 1450000,
    originalPrice: 1950000,
    stock: 30,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Giày leo núi và đi phượt chuyên dụng, chất liệu da chống thấm kết hợp đế gai cao su bám đá chống trượt tuyệt đối. Cổ giày đệm mút ôm chặt bảo vệ cổ chân khi trekking địa hình phức tạp.',
    specs: { 'Công năng': 'Trekking, Leo núi, Dã ngoại', 'Chất liệu': 'Da bò chống thấm + Màng thở', 'Đế ngoài': 'Cao su gai sâu bám đường' },
    files: [
      { title: 'File:Boots, mountaineering (AM 2014.7.95-4).jpg', role: 'Ảnh 1: Mặt trước dây buộc mountaineering' },
      { title: 'File:Boots, mountaineering (AM 2014.7.95-5).jpg', role: 'Ảnh 2: Góc nghiêng thân bốt da lộn' },
      { title: 'File:Boots, mountaineering (AM 2014.7.95-6).jpg', role: 'Ảnh 3: Cận cảnh móc khóa dây kim loại' },
      { title: 'File:Boots, mountaineering (AM 2014.7.95-7).jpg', role: 'Ảnh 4: Chi tiết đế gai cao su bám đá' },
    ]
  },

  // ==================== 6. TÚI XÁCH (category_id: 5) ====================
  {
    shop_id: 1,
    category_id: 5,
    name: 'Balo Du Lịch Đi Học Đi Làm Chống Thấm Nước 20L',
    price: 580000,
    originalPrice: 750000,
    stock: 50,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Balo đa năng dung tích 20L đựng vừa laptop 15.6 inch, chất vải dù dệt tổ ong trượt nước bề mặt. Đệm lưng thoáng khí chống nóng lưng, quai đeo trợ lực giảm mỏi vai.',
    specs: { 'Dung tích': '20 Lít', 'Kích thước': '43 x 30 x 15 cm', 'Ngăn laptop': 'Vừa laptop 15.6 inch' },
    files: [
      { title: 'File:Backpack (AM 2014.66.1-1).jpg', role: 'Ảnh 1: Mặt trước balo' },
      { title: 'File:Backpack (AM 2014.66.1-8).jpg', role: 'Ảnh 2: Mặt sau đệm lưng và quai đeo' },
      { title: 'File:Backpack (AM 2014.66.1-12).jpg', role: 'Ảnh 3: Cận cảnh khóa kéo và ngăn phụ' },
      { title: 'File:Backpack (AM 2014.66.1-16).jpg', role: 'Ảnh 4: Chi tiết quai xách và đường may gia cố' },
    ]
  },
  {
    shop_id: 2,
    category_id: 5,
    name: 'Túi Xách Tay Nữ Da Thật Đeo Vai Thanh Lịch',
    price: 850000,
    originalPrice: 1150000,
    stock: 35,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Túi xách tay nữ chất liệu da bò tự nhiên dập vân hạt sang trọng, khóa gài kim loại mạ vàng không gỉ sét. Không gian rộng rãi chứa thoải mái điện thoại, ví tiền và đồ trang điểm.',
    specs: { 'Chất liệu': 'Da thật cao cấp', 'Kích thước': '26 x 18 x 9 cm', 'Kiểu đeo': 'Xách tay hoặc đeo chéo vai' },
    files: [
      { title: 'File:Purse (AM 13345-1).jpg', role: 'Ảnh 1: Mặt trước thân túi' },
      { title: 'File:Purse (AM 13345-2).jpg', role: 'Ảnh 2: Mặt sau túi da' },
      { title: 'File:Purse (AM 13345-3).jpg', role: 'Ảnh 3: Cận cảnh khóa kim loại mạ vàng' },
      { title: 'File:Purse (AM 13345-4).jpg', role: 'Ảnh 4: Chi tiết đáy túi và góc bo viền' },
    ]
  },
  {
    shop_id: 2,
    category_id: 5,
    name: 'Ví Cầm Tay Nữ Da Cao Cấp Có Khóa Bấm Mini',
    price: 320000,
    originalPrice: 450000,
    stock: 60,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Ví nữ cầm tay dáng gập đôi nhỏ gọn, trang bị khóa bấm kim loại chắc chắn. Nhiều ngăn để thẻ ngân hàng, tiền mặt và ảnh lưu niệm gọn gàng trong túi xách.',
    specs: { 'Kích thước': '11 x 9 x 2 cm', 'Số ngăn': '6 khe thẻ, 1 ngăn tiền mặt, 1 ngăn khóa kéo' },
    files: [
      { title: 'File:Purse (AM 66957-1).jpg', role: 'Ảnh 1: Mặt trước ví gập' },
      { title: 'File:Purse (AM 66957-2).jpg', role: 'Ảnh 2: Mặt sau ví' },
      { title: 'File:Purse (AM 66957-3).jpg', role: 'Ảnh 3: Cận cảnh nẹp kim loại miệng ví' },
      { title: 'File:Purse (AM 66957-4).jpg', role: 'Ảnh 4: Chi tiết bên trong các ngăn đựng thẻ' },
    ]
  },
  {
    shop_id: 2,
    category_id: 5,
    name: 'Túi Đeo Chéo Nữ Họa Tiết Đính Đá Thủ Công Độc Bản',
    price: 690000,
    originalPrice: 950000,
    stock: 20,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Túi xách đeo chéo nữ kết cườm và đính đá thủ công tinh xảo, tạo điểm nhấn lấp lánh khi tham dự dạ tiệc và lễ hội.',
    specs: { 'Chất liệu': 'Hạt cườm thủ công trên nền vải gấm', 'Kiểu dáng': 'Túi xách dạ tiệc cầm tay' },
    files: [
      { title: 'File:Bag, woman\'s (AM 5059-1).jpg', role: 'Ảnh 1: Toàn cảnh mặt trước' },
      { title: 'File:Bag, woman\'s (AM 5059-3).jpg', role: 'Ảnh 2: Mặt sau túi' },
      { title: 'File:Bag, woman\'s (AM 5059-4).jpg', role: 'Ảnh 3: Cận cảnh hạt đính và hoa văn' },
      { title: 'File:Bag, woman\'s (AM 5059-5).jpg', role: 'Ảnh 4: Chi tiết miệng túi và quai xách' },
    ]
  },

  // ==================== 7. MỸ PHẨM (category_id: 6) ====================
  {
    shop_id: 2,
    category_id: 6,
    name: 'Nước Hoa Thủy Tinh Cao Cấp Hương Hoa Cỏ Thiên Nhiên 50ml',
    price: 1350000,
    originalPrice: 1750000,
    stock: 40,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Nước hoa nữ hương hoa cỏ tự nhiên tinh tế với thiết kế chai thủy tinh ngọc bích chạm khắc hoa văn thủ công sang trọng. Hương thơm lưu hương từ 8 đến 12 tiếng.',
    specs: { 'Dung tích': '50ml', 'Nồng độ': 'Eau de Parfum (EDP)', 'Độ lưu hương': '8 - 12 giờ', 'Nhóm hương': 'Floral & Green (Hoa cỏ phương đông)' },
    files: [
      { title: 'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 01.jpg', role: 'Ảnh 1: Chính diện chai nước hoa' },
      { title: 'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 02.jpg', role: 'Ảnh 2: Góc nghiêng điêu khắc nổi' },
      { title: 'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 03.jpg', role: 'Ảnh 3: Cận cảnh nắp xịt pha lê tinh xảo' },
      { title: 'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 04.jpg', role: 'Ảnh 4: Chi tiết đáy chai và khúc xạ ánh sáng' },
    ]
  },
  {
    shop_id: 2,
    category_id: 6,
    name: 'Vòng Tay Lắc Vàng 18K Đính Ngọc Trai Bonbonnière Nữ Tính',
    price: 2450000,
    originalPrice: 3100000,
    stock: 25,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Lắc tay nữ mạ vàng 18K kết hợp quả chuông bonbonnière tinh xảo tạo âm thanh êm dịu, là món quà trang sức hoàn hảo tôn vinh nét duyên dáng phụ nữ.',
    specs: { 'Chất liệu': 'Hợp kim mạ vàng 18K cao cấp', 'Chiều dài': '18cm có mắt nối điều chỉnh' },
    files: [
      { title: 'File:Bracelet with bonbonnière (AM 1932.233-2).jpg', role: 'Ảnh 1: Toàn cảnh vòng tay' },
      { title: 'File:Bracelet with bonbonnière (AM 1932.233-8).jpg', role: 'Ảnh 2: Góc nghiêng các mắt xích vàng' },
      { title: 'File:Bracelet with bonbonnière (AM 1932.233-11).jpg', role: 'Ảnh 3: Cận cảnh quả chuông bonbonnière' },
      { title: 'File:Bracelet with bonbonnière (AM 1932.233-12).jpg', role: 'Ảnh 4: Chi tiết khóa cài chắc chắn' },
    ]
  },

  // ==================== 8. NHÀ CỬA & ĐỜI SỐNG (category_id: 7) ====================
  {
    shop_id: 1,
    category_id: 7,
    name: 'Cốc Sứ Giữ Nhiệt Uống Trà Cà Phê Men Gốm Cổ Điển',
    price: 185000,
    originalPrice: 240000,
    stock: 55,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Cốc gốm sứ uống trà và cà phê nung ở nhiệt độ 1300 độ C loại bỏ hoàn toàn tạp chất, men bóng mờ tự nhiên chống bám ố vàng. Quai cầm đúc liền vừa vặn lòng bàn tay.',
    specs: { 'Dung tích': '380ml', 'Chất liệu': 'Gốm sứ cao cấp nung nhiệt độ cao', 'Sử dụng': 'An toàn với lò vi sóng và máy rửa bát' },
    files: [
      { title: 'File:Mug (AM 12396-1).jpg', role: 'Ảnh 1: Góc chụp chính quai cốc' },
      { title: 'File:Mug (AM 12396-2).jpg', role: 'Ảnh 2: Mặt đối diện họa tiết men' },
      { title: 'File:Mug (AM 12396-3).jpg', role: 'Ảnh 3: Cận cảnh miệng cốc và lòng trong' },
      { title: 'File:Mug (AM 12396-4).jpg', role: 'Ảnh 4: Chi tiết đáy cốc đóng dấu thủ công' },
    ]
  },
  {
    shop_id: 1,
    category_id: 7,
    name: 'Ấm Trà Thủy Tinh Gốm Sứ Cao Cấp Chịu Nhiệt Cao',
    price: 420000,
    originalPrice: 560000,
    stock: 35,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Ấm pha trà gốm sứ cao cấp với lưới lọc trà lỗ mịn ngăn cặn lá trà hiệu quả. Giữ nhiệt lâu giúp trà giữ trọn hương vị đậm đà trong suốt buổi thưởng trà.',
    specs: { 'Dung tích': '650ml', 'Khả năng chịu nhiệt': '-20°C đến 150°C' },
    files: [
      { title: 'File:Teapot MET DP-12448-044.jpg', role: 'Ảnh 1: Toàn cảnh thân ấm và vòi rót' },
      { title: 'File:Teapot MET DP-12448-047.jpg', role: 'Ảnh 2: Góc nhìn từ phía quai ấm' },
      { title: 'File:Teapot MET DP-12448-052.jpg', role: 'Ảnh 3: Cận cảnh nắp ấm và núm cầm cách nhiệt' },
      { title: 'File:Teapot MET DP-12448-053.jpg', role: 'Ảnh 4: Chi tiết miệng vòi và đáy ấm' },
    ]
  },
  {
    shop_id: 1,
    category_id: 7,
    name: 'Đồng Hồ Đeo Tay Mạ Vàng Cổ Điển Kim Rốn Dây Kim Loại',
    price: 1890000,
    originalPrice: 2450000,
    stock: 25,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Đồng hồ đeo tay thiết kế mạ vàng phong cách vintage, mặt số cọc vạch La Mã sang trọng cùng kim rốn đếm giây độc đáo. Bộ máy Quartz Nhật Bản vận hành chuẩn xác.',
    specs: { 'Đường kính mặt': '39mm', 'Độ dày': '8mm', 'Chống nước': '3 ATM đi mưa rửa tay' },
    files: [
      { title: 'File:Watch, Gold (48708661002).jpg', role: 'Ảnh 1: Mặt trước mặt số La Mã' },
      { title: 'File:Watch, Gold (48708161258).jpg', role: 'Ảnh 2: Góc nghiêng núm vặn mạ vàng' },
      { title: 'File:Watch, Gold (48708158563).jpg', role: 'Ảnh 3: Mặt sau nắp lưng khắc họa tiết' },
      { title: 'File:Watch, Gold (48708080673).jpg', role: 'Ảnh 4: Chi tiết khóa dây bấm kim loại' },
    ]
  },

  // ==================== 9. THIẾT BỊ GIA DỤNG & NHÀ BẾP (category_id: 10) ====================
  {
    shop_id: 1,
    category_id: 10,
    name: 'Ấm Pha Cà Phê Moka Ý Bialetti Mini Express Nhôm Cao Cấp',
    price: 790000,
    originalPrice: 990000,
    stock: 35,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Ấm đun cà phê áp suất hơi nước Bialetti Mini Express sản xuất chuẩn Ý. Vòi rót trực tiếp vào 2 tách espresso nóng hổi với lớp bọt crema béo ngậy chuẩn gu cà phê nguyên bản.',
    specs: { 'Thương hiệu': 'Bialetti', 'Xuất xứ': 'Ý (Made in Italy)', 'Chất liệu': 'Hợp kim nhôm an toàn thực phẩm', 'Dung tích': '2 tách espresso (90ml)' },
    files: [
      { title: 'File:Bialetti moka mini express 1 tazza 01.jpg', role: 'Ảnh 1: Góc chụp chính diện ấm' },
      { title: 'File:Bialetti moka mini express 1 tazza 02.jpg', role: 'Ảnh 2: Góc nhìn nghiêng vòi rót đôi' },
      { title: 'File:Bialetti moka mini express 1 tazza 03.jpg', role: 'Ảnh 3: Cận cảnh khay để ly và van an toàn' },
      { title: 'File:Bialetti moka mini express 1 tazza 04.jpg', role: 'Ảnh 4: Chi tiết đáy bình đun áp suất cao' },
    ]
  },
  {
    shop_id: 1,
    category_id: 10,
    name: 'Dụng Cụ Pha Cà Phê Ép Cầm Tay Dã Ngoại AeroPress Go Tiện Lợi',
    price: 950000,
    originalPrice: 1200000,
    stock: 40,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Dụng cụ pha cà phê ép khí cầm tay AeroPress Go gọn nhẹ chuyên dành cho người yêu du lịch và cắm trại. Chiết xuất cà phê êm mượt, không đắng gắt chỉ trong 1 phút.',
    specs: { 'Thương hiệu': 'AeroPress (USA)', 'Trọng lượng': '320g', 'Bao gồm': 'Cốc đậy, piston ép, phễu đong và 350 màng lọc vi sinh' },
    files: [
      { title: 'File:Aeropress Go (49770779481).jpg', role: 'Ảnh 1: Toàn bộ bộ dụng cụ xếp gọn trong cốc' },
      { title: 'File:Aeropress Go (49770781286).jpg', role: 'Ảnh 2: Các bộ phận piston, ống hãm và phễu' },
      { title: 'File:Aeropress Go (49770783416).jpg', role: 'Ảnh 3: Cận cảnh nắp lọc và màng lọc vi mô' },
      { title: 'File:Aeropress Go (49771112987).jpg', role: 'Ảnh 4: Thao tác ép cà phê áp suất thực tế' },
    ]
  },
  {
    shop_id: 1,
    category_id: 10,
    name: 'Máy Hút Bụi Dyson DC01 Công Nghệ Hút Lốc Xoáy Không Cần Túi',
    price: 3890000,
    originalPrice: 4900000,
    stock: 20,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Máy hút bụi gia đình Dyson DC01 ứng dụng công nghệ Dual Cyclone độc quyền của James Dyson, hút sạch 99.9% bụi mịn và phấn hoa mà không bao giờ suy giảm lực hút.',
    specs: { 'Thương hiệu': 'Dyson (UK)', 'Công nghệ': 'Dual Cyclone lốc xoáy ly tâm', 'Dung tích hộp bụi': '2.5 Lít', 'Bộ lọc': 'HEPA kháng khuẩn' },
    files: [
      { title: 'File:Dyson DC01. 01.jpg', role: 'Ảnh 1: Góc chụp chính diện đứng thẳng' },
      { title: 'File:Dyson DC01. 02.jpg', role: 'Ảnh 2: Góc nghiêng hộp chứa bụi trong suốt' },
      { title: 'File:Dyson DC01. 03.jpg', role: 'Ảnh 3: Cận cảnh đầu hút sàn và khớp nối xoay' },
      { title: 'File:A Dyson vacuum cleaner.jpg', role: 'Ảnh 4: Toàn bộ thân máy trong không gian thực tế' },
    ]
  },

  // ==================== 10. PHỤ KIỆN CÔNG NGHỆ (category_id: 8) ====================
  {
    shop_id: 1,
    category_id: 8,
    name: 'Đồng Hồ Thông Minh Apple Watch Series 8 GPS 45mm Nhôm Đen',
    price: 6890000,
    originalPrice: 8990000,
    stock: 25,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Apple Watch Series 8 màn hình Always-On Retina sắc nét, cảm biến đo nhiệt độ cơ thể, theo dõi giấc ngủ nâng cao và phát hiện va chạm xe thông minh. Kháng nước 50m bơi lội thoải mái.',
    specs: { 'Hãng': 'Apple', 'Kích cỡ mặt': '45 mm', 'Chất liệu viền': 'Nhôm tái chế 100%', 'Tính năng sức khỏe': 'Đo oxy máu SpO2, Điện tâm đồ ECG, Đo nhiệt độ' },
    files: [
      { title: 'File:Apple Watch 8.jpg', role: 'Ảnh 1: Mặt trước màn hình Always-On Retina' },
      { title: 'File:Apple Watch 8 with Box.jpg', role: 'Ảnh 2: Góc chụp đầy đủ phụ kiện hộp và dây đeo' },
      { title: 'File:Apple Watch back sensors.jpg', role: 'Ảnh 3: Mặt sau cụm cảm biến đo nhịp tim và ECG' },
      { title: 'File:Close Up of Apple Watch 8.jpg', role: 'Ảnh 4: Cận cảnh núm xoay Digital Crown và nút sườn' },
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Tay Cầm Chơi Game Không Dây Sony DualSense PS5 Màu Midnight Black',
    price: 1590000,
    originalPrice: 1990000,
    stock: 45,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Tay cầm chơi game không dây DualSense của Sony PlayStation 5 màu đen huyền bí. Công nghệ phản hồi rung Haptic Feedback chân thực và cò bấm thích ứng Adaptive Triggers mô phỏng lực kéo căng của dây cung.',
    specs: { 'Thương hiệu': 'Sony PlayStation', 'Kết nối': 'Bluetooth không dây hoặc USB-C', 'Tương thích': 'PS5, PC Windows, iOS, Android' },
    files: [
      { title: 'File:Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (front).jpg', role: 'Ảnh 1: Mặt trước phím bấm' },
      { title: 'File:Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (rear).jpg', role: 'Ảnh 2: Mặt sau lưng và cổng sạc Type-C' },
      { title: 'File:Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (detail of joysticks).jpg', role: 'Ảnh 3: Cận cảnh cần điều khiển analog joysticks' },
      { title: 'File:PlayStation 5 and DualSense (2).jpg', role: 'Ảnh 4: Bối cảnh đặt cùng máy chơi game thực tế' },
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Máy Chơi Game Cầm Tay Nintendo Switch Thế Hệ Mới Đa Năng',
    price: 6990000,
    originalPrice: 8500000,
    stock: 20,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Máy chơi game lai console Nintendo Switch cho phép chuyển đổi tức thì giữa chế độ cầm tay (Handheld Mode), chế độ để bàn (Tabletop) và kết nối tivi phòng khách (TV Mode).',
    specs: { 'Hãng sản xuất': 'Nintendo', 'Chế độ chơi': 'TV Mode / Tabletop / Handheld', 'Thời lượng pin': '4.5 - 9.0 giờ tùy tựa game' },
    files: [
      { title: 'File:Nintendo Switch 2 in Handheld Mode.jpg', role: 'Ảnh 1: Chế độ cầm tay màn hình sắc nét' },
      { title: 'File:Nintendo Switch 2 in Docking Console.jpg', role: 'Ảnh 2: Chế độ cắm dock xuất màn hình tivi' },
      { title: 'File:Nintendo Switch 2-Konsole von hinten 20250605 HOF4680-HDR RAW-Export.png', role: 'Ảnh 3: Mặt sau máy và chân chống kickstand' },
      { title: 'File:Nintendo Switch 2 von oben 20250605 HOF4734-HDR RAW-Export.png', role: 'Ảnh 4: Cạnh trên phím nguồn, khe băng game' },
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Máy Tính Nhúng Mini Raspberry Pi 4 Model B 4GB RAM Chuẩn ARM',
    price: 1450000,
    originalPrice: 1850000,
    stock: 35,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Máy tính mini nhúng Raspberry Pi 4 Model B trang bị CPU Broadcom BCM2711 4 nhân 64-bit 1.5GHz. Hỗ trợ xuất 2 màn hình 4K qua micro-HDMI, kết nối mạng LAN Gigabit và USB 3.0 tốc độ cao.',
    specs: { 'Bộ xử lý': 'Broadcom BCM2711 Quad-core Cortex-A72 1.5GHz', 'RAM': '4GB LPDDR4', 'Kết nối': 'Dual-band Wi-Fi, Bluetooth 5.0, Gigabit Ethernet' },
    files: [
      { title: 'File:Raspberry Pi 4 Model B - Top.jpg', role: 'Ảnh 1: Mặt trên vi mạch, CPU Broadcom và RAM' },
      { title: 'File:Raspberry Pi 4 Model B - Side.jpg', role: 'Ảnh 2: Cận cảnh các cổng USB 3.0 và Ethernet Gigabit' },
      { title: 'File:Raspberry Pi 4 Computer.jpg', role: 'Ảnh 3: Góc nghiêng 2 cổng micro-HDMI 4K' },
      { title: 'File:Box-package Raspberry Pi 4 model B 4GB RAM.jpg', role: 'Ảnh 4: Bao bì hộp đựng chính hãng' },
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Máy Đọc Sách Amazon Kindle Paperwhite 5 Màn Hình E-Ink 6.8 inch',
    price: 3290000,
    originalPrice: 3990000,
    stock: 30,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Máy đọc sách Kindle Paperwhite thế hệ mới (11th Gen) với màn hình 6.8 inch phẳng chống lóa 300 ppi sắc nét như trang sách giấy thật. Đèn nền vàng ấm điều chỉnh được bảo vệ mắt tối ưu vào ban đêm.',
    specs: { 'Màn hình': '6.8 inch E-Ink Carta 1200, 300 ppi', 'Dung lượng': '8GB', 'Thời lượng pin': 'Lên đến 10 tuần', 'Kháng nước': 'IPX8' },
    files: [
      { title: 'File:2023 Amazon Kindle Paperwhite (1).jpg', role: 'Ảnh 1: Mặt trước màn hình hiển thị trang sách rõ nét' },
      { title: 'File:2023 Amazon Kindle Paperwhite (2).jpg', role: 'Ảnh 2: Góc chụp nghiêng cạnh dưới và cổng USB-C' },
      { title: 'File:2023 Amazon Kindle Paperwhite (3).jpg', role: 'Ảnh 3: Cận cảnh bề mặt nắp lưng chống trơn' },
      { title: 'File:Amazon Kindle Paperwhite 5 Eleventh Generation (C2V2L3) 6-inch e-reader in etui.jpg', role: 'Ảnh 4: Máy đặt trong bao da bảo vệ sang trọng' },
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Máy Ảnh Không Gương Lật Fujifilm FinePix X100 Cổ Điển Ống Kính 23mm F2',
    price: 18500000,
    originalPrice: 22000000,
    stock: 10,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Máy ảnh chụp đường phố danh tiếng Fujifilm X100 phong cách Rangefinder hoài cổ, cảm biến APS-C CMOS lớn và ống kính cố định Fujinon 23mm F2 cho bokeh mịn màng cùng màu giả lập phim kinh điển.',
    specs: { 'Cảm biến': 'APS-C CMOS 12.3MP', 'Ống kính': 'Fujinon 23mm F2 (tương đương 35mm full-frame)', 'Kính ngắm': 'Hybrid Viewfinder quang học & điện tử' },
    files: [
      { title: 'File:Fujifilm FinePix X100 01.jpg', role: 'Ảnh 1: Chính diện máy ảnh phong cách retro' },
      { title: 'File:Fujifilm FinePix X100 03.jpg', role: 'Ảnh 2: Góc nhìn từ phía trên bánh xe chỉnh tốc độ' },
      { title: 'File:Fujifilm FinePix X100 04.jpg', role: 'Ảnh 3: Mặt sau màn hình LCD và kính ngắm Hybrid' },
      { title: 'File:Fujifilm FinePix X100 05.jpg', role: 'Ảnh 4: Cận cảnh ống kính Fujinon 23mm F2 sắc sảo' },
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Máy Ảnh Chuyên Nghiệp Nikon D850 Full-Frame 45.7MP Chống Thời Tiết',
    price: 45000000,
    originalPrice: 55000000,
    stock: 8,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Nikon D850 là mẫu máy ảnh DSLR đỉnh cao của Nikon với cảm biến BSI CMOS Full-frame độ phân giải siêu cao 45.7 Megapixel, hệ thống lấy nét 153 điểm và quay phim 4K UHD không crop.',
    specs: { 'Cảm biến': 'Full-frame BSI CMOS 45.7 Megapixels', 'Hệ thống lấy nét': '153 điểm AF (99 điểm cross-type)', 'Khung máy': 'Hợp kim Magie chống chịu thời tiết khắc nghiệt' },
    files: [
      { title: 'File:20171009 D850 front.jpg', role: 'Ảnh 1: Mặt trước thân máy và ngàm F kim loại' },
      { title: 'File:20171009 D850 rear.jpg', role: 'Ảnh 2: Mặt sau màn hình cảm ứng nghiêng và cụm phím' },
      { title: 'File:Nikon DSLR camera D850 lateral rear view.jpg', role: 'Ảnh 3: Góc nghiêng báng cầm sâu đệm cao su' },
      { title: 'File:Nikon D850 sensor.jpg', role: 'Ảnh 4: Cận cảnh cảm biến BSI CMOS Full-frame cao cấp' },
    ]
  },
];

async function fetchMetadata(titles) {
  const map = {};
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40);
    const params = new URLSearchParams({
      action: 'query', format: 'json', titles: chunk.join('|'),
      prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '800'
    });
    const res = await fetch(COMMONS_API_URL + '?' + params, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const json = await res.json();
    const pages = Object.values(json.query?.pages || {});
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (info) {
        map[p.title] = {
          title: p.title,
          url: info.thumburl || info.url,
          author: (info.extmetadata?.Artist?.value || 'Wikimedia Commons').replace(/<[^>]+>/g, '').trim().slice(0, 300),
          licenseName: (info.extmetadata?.LicenseShortName?.value || 'CC BY-SA 4.0').trim().slice(0, 100),
          licenseUrl: info.extmetadata?.LicenseUrl?.value || 'https://creativecommons.org/licenses/by-sa/4.0/',
          sourcePageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`
        };
      }
    }
  }
  return map;
}

async function run() {
  console.log('--- 1. Fetching Metadata for all 152 files ---');
  const allTitles = PRODUCTS.flatMap(p => p.files.map(f => f.title));
  const metaMap = await fetchMetadata(allTitles);
  console.log(`Fetched metadata for ${Object.keys(metaMap).length}/${allTitles.length} files.`);

  console.log('--- 2. Connecting to MySQL shopnova_dev ---');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'shopnova_data_api',
    password: 'ShopNovaDev2026StrongPass',
    database: 'shopnova_dev'
  });

  // Ensure shops 1 and 2 are active and mall
  await conn.query('UPDATE shops SET is_mall = 1 WHERE id IN (1, 2)');

  // Clean existing products and images to ensure zero mismatch
  console.log('--- 3. Cleaning old products to replace with verified exact-image products ---');
  await conn.query('DELETE FROM product_images');
  await conn.query('DELETE FROM product_variants');
  await conn.query('DELETE FROM products');

  console.log(`--- 4. Seeding ${PRODUCTS.length} products with exactly 4 verified photos of the SAME model ---`);
  let successCount = 0;

  for (let idx = 0; idx < PRODUCTS.length; idx++) {
    const p = PRODUCTS[idx];
    console.log(`\n[${idx + 1}/${PRODUCTS.length}] ${p.name}`);

    // Download 4 images
    const savedUrls = [];
    let hasError = false;

    for (let fIdx = 0; fIdx < p.files.length; fIdx++) {
      const f = p.files[fIdx];
      const meta = metaMap[f.title];
      if (!meta || !meta.url) {
        console.error(`  ❌ Missing metadata for: ${f.title}`);
        hasError = true;
        break;
      }

      const uuid = crypto.randomUUID();
      const ext = meta.url.includes('.png') ? 'png' : 'jpg';
      const filename = `${uuid}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      try {
        const res = await fetch(meta.url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buf);
        savedUrls.push({
          url: `/uploads/${filename}`,
          altText: `${p.name} - ${f.role}`,
          author: meta.author,
          licenseName: meta.licenseName,
          licenseUrl: meta.licenseUrl,
          sourcePageUrl: meta.sourcePageUrl,
          role: f.role
        });
        console.log(`  ✓ Image ${fIdx + 1}/4 [${f.role}]: saved ${filename} (${buf.byteLength} bytes)`);
      } catch (err) {
        console.error(`  ❌ Failed to download ${f.title}:`, err.message);
        hasError = true;
        break;
      }
    }

    if (hasError || savedUrls.length !== 4) {
      console.error(`  ⚠️ Skipped ${p.name}: could not verify all 4 photos.`);
      continue;
    }

    // Insert Product
    const slug = `${toSlug(p.name)}-${crypto.randomBytes(4).toString('hex')}`;
    const [res] = await conn.query(
      `INSERT INTO products (shop_id, category_id, slug, name, description, specs, badges, status, is_featured, is_flash_sale, free_shipping)
       VALUES (?, ?, ?, ?, ?, ?, JSON_ARRAY(), 'active', ?, ?, ?)`,
      [
        p.shop_id,
        p.category_id,
        slug,
        p.name,
        p.description,
        JSON.stringify(p.specs || {}),
        p.is_featured ? 1 : 0,
        p.is_flash_sale ? 1 : 0,
        p.free_shipping ? 1 : 0
      ]
    );
    const productId = res.insertId;

    // Insert Default Variant
    const sku = `SN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    await conn.query(
      `INSERT INTO product_variants (product_id, sku, variant_key, name, attributes, price, original_price, stock_qty, is_active)
       VALUES (?, ?, 'default', 'Mặc định', '{}', ?, ?, ?, 1)`,
      [productId, sku, p.price, p.originalPrice || null, p.stock]
    );

    // Insert Exactly 4 Images with sort_order 0, 1, 2, 3
    for (let sortOrder = 0; sortOrder < 4; sortOrder++) {
      const img = savedUrls[sortOrder];
      await conn.query(
        `INSERT INTO product_images (product_id, url, alt_text, sort_order, source_page_url, author, license_name, license_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          img.url,
          img.altText,
          sortOrder,
          img.sourcePageUrl,
          img.author,
          img.licenseName,
          img.licenseUrl
        ]
      );
    }

    successCount++;
    console.log(`  🎉 Product #${productId} successfully created with 4 verified angle photos!`);
  }

  // Summary
  const [pCount] = await conn.query("SELECT COUNT(*) as total FROM products WHERE status = 'active'");
  const [iCount] = await conn.query('SELECT COUNT(*) as total FROM product_images');
  console.log('\n=============================================================');
  console.log(`Done! Created ${successCount} products.`);
  console.log(`Total active products in database: ${pCount[0].total}`);
  console.log(`Total product images in database: ${iCount[0].total}`);
  console.log(`Average images per product: ${iCount[0].total / pCount[0].total}`);

  await conn.end();
}

run().catch(console.error);

