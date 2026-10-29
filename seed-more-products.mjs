import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'file:///d:/download/nova_shop-main/nova_shop-main/data-api/node_modules/mysql2/promise.js';

const UPLOAD_DIR = path.resolve('d:/download/nova_shop-main/nova_shop-main/backend/uploads');

// Helper to convert Vietnamese string to ASCII slug
function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const NEW_PRODUCTS = [
  // ==================== THỜI TRANG NAM (category_id: 1) ====================
  {
    shop_id: 1,
    category_id: 1,
    name: 'Áo Sơ Mi Nam Oxford Dài Tay Form Regular Fit',
    price: 385000,
    originalPrice: 480000,
    stock: 45,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Áo sơ mi nam chất liệu vải Oxford 100% cotton dệt đôi dày dặn, đứng form và hạn chế nhăn. Cổ bẻ cài khuy button-down hiện đại, phù hợp cho cả đi làm công sở và gặp gỡ bạn bè. Đường chỉ may cuộn tỉ mỉ, cúc áo khắc laser sang trọng.',
    specs: { 'Chất liệu': 'Cotton Oxford', 'Kiểu dáng': 'Regular Fit', 'Tay áo': 'Dài tay', 'Xuất xứ': 'Việt Nam' },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1620012253295-c15c429f66bf?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 1,
    name: 'Quần Jeans Nam Slim Fit Co Giãn Denim Xanh Đậm',
    price: 450000,
    originalPrice: 590000,
    stock: 50,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Quần jeans nam form Slim Fit ôm gọn tôn dáng, chất vải denim cotton pha spandex co giãn 4 chiều vận động thoải mái. Màu xanh chàm wash nhẹ tự nhiên, bền màu qua nhiều lần giặt. Khóa kéo đồng YKK cao cấp chống kẹt gỉ.',
    specs: { 'Chất liệu': 'Denim 98% Cotton 2% Spandex', 'Form dáng': 'Slim Fit', 'Màu sắc': 'Xanh Indigo Wash' },
    images: [
      'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1582552938357-32b906df40cb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 1,
    name: 'Áo Khoác Gió Nam 2 Lớp Chống Nước Chống Bụi Thể Thao',
    price: 420000,
    originalPrice: 550000,
    stock: 35,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Áo khoác dù nam 2 lớp cao cấp với công nghệ trượt nước bề mặt Nano chống thấm mưa phùn và cản gió tuyệt đối. Lớp lót lưới bên trong thoáng khí chống bí mồ hôi. Túi áo có khóa kéo tiện lợi kèm mũ trùm đầu giấu gáy.',
    specs: { 'Chất liệu': 'Polyester trượt nước', 'Lớp lót': 'Lưới thoáng khí', 'Mùa thích hợp': 'Thu Đông, Mưa gió' },
    images: [
      'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 1,
    name: 'Áo Polo Nam Pique Cotton Phối Bo Cổ Cổ Điển',
    price: 320000,
    originalPrice: 390000,
    stock: 55,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Áo polo nam chất liệu dệt cá sấu Pique Cotton dệt mắt chim tổ ong thoáng mát. Bo cổ và tay áo dệt sợi spandex đàn hồi giữ form cứng cáp không nhăn quăn. Phong cách lịch lãm, thích hợp cho cả công sở và dã ngoại cuối tuần.',
    specs: { 'Chất liệu': '100% Cotton Pique', 'Họa tiết': 'Trơn phối viền bo', 'Form': 'Regular Fit' },
    images: [
      'https://images.unsplash.com/photo-1625910513413-7422b1660d5b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618354691792-d1d42acfd860?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== THỜI TRANG NỮ (category_id: 3) ====================
  {
    shop_id: 2,
    category_id: 3,
    name: 'Đầm Nữ Dáng Xòe Voan Hoa Nhí Cổ Vuông Dịu Dàng',
    price: 390000,
    originalPrice: 490000,
    stock: 30,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Váy đầm nữ dáng xòe tiểu thư chất liệu voan tơ mềm mại kèm lớp lót lụa habutai cao cấp kín đáo. Họa tiết hoa nhí vintage trang nhã, thiết kế cổ vuông khéo léo khoe xương quai xanh quyến rũ. Chiết eo chun nhẹ nhàng tạo hiệu ứng eo thon thả.',
    specs: { 'Chất liệu': 'Voan tơ lót lụa', 'Dáng váy': 'Xòe chữ A', 'Họa tiết': 'Hoa nhí', 'Màu': 'Be hoa nhí' },
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 3,
    name: 'Áo Blazer Nữ Tay Lỡ Phong Cách Hàn Quốc Thanh Lịch',
    price: 490000,
    originalPrice: 650000,
    stock: 28,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Áo khoác blazer nữ 2 lớp phom suông vừa vặn, đệm vai nhẹ tự nhiên định hình form áo chuẩn đẹp. Chất vải tuyết mưa cao cấp dày dặn chống nhăn nhàu, cúc cài giả sừng sang trọng. Rất dễ phối cùng áo hai dây, chân váy hoặc quần tây công sở.',
    specs: { 'Chất liệu': 'Tuyết mưa cao cấp', 'Kiểu áo': 'Blazer 2 lớp', 'Màu sắc': 'Nâu be / Đen' },
    images: [
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 3,
    name: 'Quần Tây Nữ Ống Suông Cạp Cao Hack Dáng Tinh Tế',
    price: 290000,
    originalPrice: 380000,
    stock: 40,
    is_featured: 0,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Quần tây nữ công sở dáng suông rộng cạp cao tôn dáng kéo dài chân. Chất liệu vải tuyết hàn mịn lì, có độ rủ tự nhiên không bám lông bụi. Đường xếp ly trước may nổi tạo điểm nhấn chỉn chu và lịch sự trong mọi hoàn cảnh.',
    specs: { 'Chất liệu': 'Tuyết hàn', 'Form': 'Ống suông cạp cao', 'Khóa kéo': 'Khóa trước cài khuy ẩn' },
    images: [
      'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 3,
    name: 'Áo Len Nữ Cổ Lọ Dệt Kim Sợi Mềm Mịn Thu Đông',
    price: 310000,
    originalPrice: 390000,
    stock: 35,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Áo len nữ dệt kim sợi len cừu tổng hợp siêu nhẹ, giữ ấm cơ thể tối ưu mà không gây cộm ngứa rát da. Cổ lọ dệt tăm ôm vừa vặn, giữ ấm cổ khi trời trở lạnh. Tone màu pastel thanh lịch dễ kết hợp cùng áo dạ hoặc măng tô.',
    specs: { 'Chất liệu': 'Sợi len dệt kim mềm', 'Cổ áo': 'Cổ lọ 5cm', 'Mùa': 'Thu Đông' },
    images: [
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 3,
    name: 'Chân Váy Xếp Ly Midi Dáng Dài Tôn Dáng Nữ Tính',
    price: 265000,
    originalPrice: 330000,
    stock: 45,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Chân váy xếp ly dáng dài qua gối chất vải voan lụa 2 lớp bồng bềnh nữ tính. Các nếp gấp ly được ép nhiệt công nghệ cao chống bung nếp khi giặt máy. Cạp chun co giãn ôm khít vòng eo thoải mái suốt ngày dài.',
    specs: { 'Chất liệu': 'Voan lụa dập ly', 'Dài váy': 'Midi 78cm', 'Kiểu eo': 'Cạp chun co giãn' },
    images: [
      'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== ĐIỆN THOẠI & PHỤ KIỆN (category_id: 2) ====================
  {
    shop_id: 1,
    category_id: 2,
    name: 'Điện Thoại Apple iPhone 13 128GB Chính Hãng VNA',
    price: 13990000,
    originalPrice: 17990000,
    stock: 20,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Điện thoại iPhone 13 màn hình Super Retina XDR OLED 6.1 inch rực rỡ, chip xử lý A15 Bionic đỉnh cao tiết kiệm pin. Cụm camera kép 12MP đặt chéo với chế độ quay phim Điện ảnh Cinematic Mode chuyên nghiệp. Kháng nước bụi chuẩn IP68.',
    specs: { 'Màn hình': '6.1 inch OLED Super Retina XDR', 'Chip': 'Apple A15 Bionic', 'Bộ nhớ': '128 GB', 'Pin': '3240 mAh' },
    images: [
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 2,
    name: 'Củ Sạc Nhanh Anker 65W GaNPrime 3 Cổng Sạc Type-C & USB',
    price: 790000,
    originalPrice: 990000,
    stock: 40,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Củ sạc nhanh Anker công nghệ bán dẫn GaNPrime thế hệ mới siêu nhỏ gọn. Công suất tối đa 65W sạc được cho cả laptop MacBook, iPad và điện thoại iPhone/Samsung cùng lúc qua 2 cổng Type-C và 1 cổng USB-A. Công nghệ bảo vệ nhiệt độ PowerIQ 4.0 thông minh.',
    specs: { 'Công suất': '65W Max', 'Cổng sạc': '2 x USB-C, 1 x USB-A', 'Công nghệ': 'GaNPrime, PowerIQ 4.0' },
    images: [
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 2,
    name: 'Pin Sạc Dự Phòng Anker PowerCore 20000mAh Sạc Nhanh 22.5W',
    price: 650000,
    originalPrice: 850000,
    stock: 35,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Pin dự phòng Anker dung lượng khủng 20.000mAh sạc đầy điện thoại 4-5 lần. Hỗ trợ sạc nhanh chuẩn PD 20W và SCP 22.5W sạc 50% pin chỉ trong 30 phút. Vỏ ngoài phủ vân chống trượt chống xước cao cấp, đạt chứng nhận an toàn hàng không.',
    specs: { 'Dung lượng': '20.000 mAh / 74Wh', 'Công suất': '22.5W Max', 'Cổng': 'USB-C In/Out, USB-A Out' },
    images: [
      'https://images.unsplash.com/photo-1609592424364-4e33989c9e8d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 2,
    name: 'Cáp Sạc Type-C to Lightning Bọc Dù Chống Đứt 1.2m Chuẩn MFi',
    price: 195000,
    originalPrice: 260000,
    stock: 80,
    is_featured: 0,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Dây cáp sạc nhanh Type-C sang Lightning đạt chứng chỉ Apple MFi tương thích 100% với các thiết bị iPhone/iPad. Lớp vỏ bọc sợi nylon bện kép siêu bền chịu được hơn 30.000 lần uốn gập. Đầu cắm hợp kim nhôm chống oxy hóa.',
    specs: { 'Độ dài': '1.2 mét', 'Chuẩn sạc': 'PD Fast Charge 20W', 'Chứng chỉ': 'Apple MFi' },
    images: [
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1609592424364-4e33989c9e8d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== MÁY TÍNH & LAPTOP (category_id: 9) ====================
  {
    shop_id: 1,
    category_id: 9,
    name: 'Laptop Apple MacBook Air M1 8GB 256GB Retina 13.3 inch',
    price: 17890000,
    originalPrice: 22490000,
    stock: 15,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'MacBook Air M1 thiết kế nhôm nguyên khối siêu mỏng nhẹ chỉ 1.29kg. Hiệu năng vượt trội với chip Apple M1 8 nhân CPU và 7 nhân GPU, xử lý mượt mà tác vụ đồ họa và văn phòng. Thời lượng pin ấn tượng lên đến 18 giờ làm việc liên tục.',
    specs: { 'Màn hình': '13.3 inch Retina 2560x1600', 'CPU': 'Apple M1 8-core', 'RAM': '8 GB', 'SSD': '256 GB' },
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 9,
    name: 'Bàn Phím Cơ Không Dây Keychron K2 RGB Hot-swap Bluetooth',
    price: 1850000,
    originalPrice: 2200000,
    stock: 25,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Bàn phím cơ không dây layout 75% 84 phím nhỏ gọn, switch Gateron G Pro gõ cực êm. Hỗ trợ thay thế switch nóng (Hot-swap) dễ dàng tùy biến cảm giác gõ. Kết nối linh hoạt qua Bluetooth 5.1 cùng lúc 3 thiết bị hoặc cáp Type-C.',
    specs: { 'Layout': '75% (84 phím)', 'Switch': 'Gateron G Pro Red / Brown', 'Đèn LED': 'RGB 18 chế độ', 'Pin': '4000 mAh' },
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 9,
    name: 'Chuột Không Dây Logitech MX Master 3S Công Thái Học Chống Ồn',
    price: 2190000,
    originalPrice: 2690000,
    stock: 30,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Chuột không dây công thái học đỉnh cao cho dân văn phòng và sáng tạo nội dung. Cảm biến Darkfield 8000 DPI di chuyển mượt mà trên mọi bề mặt kể cả mặt kính. Con lăn điện từ MagSpeed cuộn 1000 dòng trong 1 giây cực êm ái.',
    specs: { 'Độ phân giải': '8000 DPI Darkfield', 'Kết nối': 'Bluetooth & Logi Bolt USB', 'Pin sạc': 'Dùng tới 70 ngày' },
    images: [
      'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 9,
    name: 'Ổ Cứng Di Động SSD Samsung T7 Shield 1TB Chống Nước Va Đập',
    price: 2450000,
    originalPrice: 2990000,
    stock: 22,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Ổ cứng SSD gắn ngoài Samsung T7 Shield tốc độ đọc ghi lên tới 1050 MB/s qua chuẩn USB 3.2 Gen 2. Vỏ cao su bọc ngoài đạt tiêu chuẩn kháng nước bụi IP65 và chống rơi vỡ từ độ cao 3 mét. Bảo mật mã hóa phần cứng AES 256-bit an toàn.',
    specs: { 'Dung lượng': '1 TB', 'Tốc độ': 'Đọc 1050MB/s - Ghi 1000MB/s', 'Độ bền': 'Chống nước IP65, rơi 3m' },
    images: [
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== GIÀY DÉP (category_id: 4) ====================
  {
    shop_id: 1,
    category_id: 4,
    name: 'Giày Chạy Bộ Nam Nike Air Zoom Pegasus 40 Êm Ái Bền Bỉ',
    price: 2850000,
    originalPrice: 3490000,
    stock: 25,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Giày thể thao chạy bộ Nike Pegasus 40 phiên bản kỷ niệm 40 năm dòng giày huyền thoại. Đệm bọt React siêu nhẹ kết hợp 2 túi khí Zoom Air ở bàn chân trước và gót chân mang lại độ nảy êm ái tối đa. Lưới kỹ thuật thân giày thoáng khí vượt trội.',
    specs: { 'Công nghệ': 'Nike React + Zoom Air', 'Trọng lượng': '285g (size 42)', 'Mục đích': 'Chạy bộ, Gym, Daily' },
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 4,
    name: 'Giày Lười Nam Da Bò Loafer Đế Cao Su Êm Chân',
    price: 690000,
    originalPrice: 890000,
    stock: 35,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Giày mọi loafer nam chế tác từ 100% da bò lớp đầu tiên mềm mại, bóng mịn tự nhiên. Lót giày mút xốp đục lỗ thoáng khí khử mùi hiệu quả. Đế cao su nguyên khối có rãnh xẻ ma sát cao chống trơn trượt trên sàn gạch men ướt.',
    specs: { 'Chất liệu': '100% Da bò thật', 'Đế giày': 'Cao su non đúc', 'Kiểu dáng': 'Penny Loafer' },
    images: [
      'https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 4,
    name: 'Giày Cao Gót Nữ Mũi Nhọn 7cm Da Mềm Cao Cấp',
    price: 360000,
    originalPrice: 450000,
    stock: 40,
    is_featured: 0,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Giày cao gót nữ gót nhọn thanh mảnh cao 7cm tôn dáng chuẩn chỉnh. Chất liệu da tổng hợp mềm mại ôm chân, đệm lót êm ái chống đau mỏi gót chân khi di chuyển nhiều. Thiết kế mũi nhọn thanh thoát phù hợp dự tiệc và công sở.',
    specs: { 'Độ cao gót': '7 cm', 'Kiểu mũi': 'Mũi nhọn bít mũi', 'Màu sắc': 'Đen / Nude' },
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 4,
    name: 'Dép Quai Ngang Unisex Đúc Nguyên Khối Chống Trơn Trượt',
    price: 120000,
    originalPrice: 160000,
    stock: 70,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Dép bánh mì quai ngang unisex chất liệu EVA đúc nguyên khối siêu nhẹ, chống nước và nhanh khô. Lòng dép uốn lượn theo hõm bàn chân giúp phân bổ áp lực đều. Đế dép dày 3.5cm êm ái thích hợp đi trong nhà, dạo phố hoặc đi biển.',
    specs: { 'Chất liệu': 'Nhựa EVA đúc nguyên khối', 'Độ dày đế': '3.5 cm', 'Đặc tính': 'Siêu nhẹ, chống trượt' },
    images: [
      'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== TÚI XÁCH & BALO (category_id: 5) ====================
  {
    shop_id: 2,
    category_id: 5,
    name: 'Túi Đeo Chéo Nữ Da PU Khóa Kim Loại Tinh Tế',
    price: 285000,
    originalPrice: 380000,
    stock: 35,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Túi xách đeo chéo nữ phong cách tối giản thời thượng. Chất liệu da PU hạt cao cấp chống xước, bề mặt lì bóng nhẹ. Khóa kim loại mạ vàng không gỉ sáng bóng, dây đeo có thể điều chỉnh độ dài để đeo vai hoặc đeo chéo linh hoạt.',
    specs: { 'Chất liệu': 'Da PU hạt cao cấp', 'Kích thước': '20 x 14 x 7 cm', 'Số ngăn': '1 ngăn chính + 1 ngăn thẻ' },
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 5,
    name: 'Túi Xách Tay Nữ Tote Da Thật Đựng Vừa Laptop 14 inch',
    price: 750000,
    originalPrice: 950000,
    stock: 20,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Túi tote công sở nữ phom rộng rãi chứa vừa vặn laptop 14 inch, tài liệu A4 cùng đồ trang điểm cá nhân. Đường may chỉ nổi tinh tế, miệng túi có khóa kéo bảo đảm an toàn. Đáy túi có chân kim loại bảo vệ bề mặt da khỏi trầy xước.',
    specs: { 'Kích thước': '36 x 28 x 12 cm', 'Chứa vừa': 'Laptop 14 inch, A4', 'Quai xách': 'Quai kẹp nách và đeo vai' },
    images: [
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 5,
    name: 'Balo Nam Laptop Du Lịch Đa Năng Có Cổng Sạc USB',
    price: 460000,
    originalPrice: 590000,
    stock: 45,
    is_featured: 0,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Balo laptop nam thời trang công sở dung tích 25L tích hợp cổng sạc USB bên ngoài. Ngăn đựng laptop chuyên biệt có đệm chống sốc tổ ong êm ái đựng vừa máy 15.6 inch. Chất liệu vải Oxford chống thấm nước và quai đeo phân tán trọng lực vai.',
    specs: { 'Chất liệu': 'Vải Oxford 900D chống thấm', 'Kích thước': '44 x 30 x 15 cm', 'Ngăn laptop': 'Tối đa 15.6 inch' },
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 5,
    name: 'Ví Cầm Tay Nam Da Bò Mini Đựng Thẻ và Tiền Gọn Gàng',
    price: 220000,
    originalPrice: 290000,
    stock: 50,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Ví da nam mini phom đứng nhỏ gọn đút vừa túi quần trước không cộm. Gia công từ 100% da sáp bò thật vintage càng dùng càng bóng đẹp. Thiết kế thông minh gồm 6 khe thẻ ATM, 1 ngăn ảnh trong suốt và 1 ngăn tiền mặt thẳng.',
    specs: { 'Chất liệu': 'Da sáp bò tự nhiên', 'Kích thước': '11 x 8.5 x 1.5 cm', 'Sức chứa': '8 thẻ + 30 tờ tiền' },
    images: [
      'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1606503829069-0fa0956f18f9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== MỸ PHẨM (category_id: 6) ====================
  {
    shop_id: 2,
    category_id: 6,
    name: 'Nước Tẩy Trang Micellar Water Dịu Nhẹ Cho Da Nhạy Cảm 400ml',
    price: 185000,
    originalPrice: 230000,
    stock: 50,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Nước tẩy trang công nghệ Micellar chứa các hạt phân tử siêu nhỏ hút sạch bụi mịn PM2.5, bã nhờn và lớp trang điểm chống trôi mà không cần chà xát mạnh. Chiết xuất hoa cúc và lô hội làm dịu da tức thì, không gây cay rát mắt môi.',
    specs: { 'Dung tích': '400 ml', 'Loại da': 'Mọi loại da, da nhạy cảm', 'Công nghệ': 'Micellar Water' },
    images: [
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1608248597249-c976906e6188?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 6,
    name: 'Kem Chống Nắng Quang Phổ Rộng Kiềm Dầu SPF50+ PA++++ 50ml',
    price: 275000,
    originalPrice: 350000,
    stock: 40,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Kem chống nắng vật lý lai hóa học màng lọc quang phổ rộng bảo vệ da toàn diện trước tia UVA/UVB và ánh sáng xanh. Kết cấu gel sữa mỏng nhẹ thấm nhanh sau 10 giây, kiềm dầu đến 8 giờ và nâng tông nhẹ nhàng tự nhiên không vệt trắng.',
    specs: { 'Chỉ số chống nắng': 'SPF50+ PA++++', 'Dung tích': '50 ml', 'Finish': 'Lì mịn, kiềm dầu' },
    images: [
      'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 6,
    name: 'Sữa Rửa Mặt Tạo Bọt Chiết Xuất Tràm Trà Ngừa Mụn 150ml',
    price: 145000,
    originalPrice: 190000,
    stock: 60,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Sữa rửa mặt dạng bọt bông xốp chứa tinh dầu tràm trà hữu cơ và BHA tự nhiên 0.5% giúp làm sạch sâu lỗ chân lông, kháng khuẩn và hỗ trợ giảm mụn sưng viêm. Độ pH 5.5 lý tưởng duy trì độ ẩm tự nhiên của da.',
    specs: { 'Dung tích': '150 ml', 'Thành phần': 'Tràm trà hữu cơ, BHA 0.5%', 'Độ pH': '5.5 cân bằng' },
    images: [
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1608248597249-c976906e6188?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 2,
    category_id: 6,
    name: 'Son Lì Mịn Môi Dưỡng Ẩm Chiết Xuất Bơ Hạt Mỡ Tự Nhiên',
    price: 210000,
    originalPrice: 280000,
    stock: 50,
    is_featured: 0,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Son môi lì mịn màng kết cấu nhung mịn nhung (velvet) nhẹ tênh không gây nặng môi hay lộ vân môi. Bổ sung dầu hạt mắc ca và bơ hạt mỡ dưỡng ẩm liên tục, giữ màu chuẩn đẹp suốt 6-8 giờ ăn uống nhẹ nhàng.',
    specs: { 'Chất son': 'Lì mịn velvet', 'Trọng lượng': '3.8g', 'Bảng màu': 'Đỏ cam đất / Đỏ chili' },
    images: [
      'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== THIẾT BỊ GIA DỤNG & NHÀ CỬA (category_id: 10 / 7) ====================
  {
    shop_id: 1,
    category_id: 10,
    name: 'Nồi Chiên Không Dầu Điện Tử Dung Tích 5.5L Cảm Ứng Đa Năng',
    price: 1290000,
    originalPrice: 1890000,
    stock: 20,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Nồi chiên không dầu điện tử công suất 1800W làm nóng đối lưu khí nóng Rapid Air 360 độ giúp thực phẩm chín vàng giòn rụm bên ngoài và mềm mọng bên trong, giảm đến 85% lượng dầu mỡ thừa. Màn hình cảm ứng LED 8 chế độ nấu cài sẵn tiện lợi.',
    specs: { 'Dung tích': '5.5 Lít', 'Công suất': '1800W', 'Công nghệ': 'Rapid Air 360', 'Chống dính': 'Ceramic an toàn' },
    images: [
      'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 10,
    name: 'Máy Xay Sinh Tố Cầm Tay Mini 6 Lưỡi Dao Sạc USB Tiện Lợi',
    price: 235000,
    originalPrice: 320000,
    stock: 45,
    is_featured: 0,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Máy xay sinh tố cá nhân mini tích hợp cối xay kiêm bình nước thể thao 380ml tiện mang theo đi làm, tập gym. Lưỡi dao 6 cánh inox 304 sắc bén quay 22.000 vòng/phút xay nhuyễn đá bào và hoa quả chỉ trong 30 giây. Pin sạc qua cổng Type-C tiện lợi.',
    specs: { 'Dung tích cối': '380 ml', 'Lưỡi dao': '6 cánh Inox 304', 'Dung lượng pin': '2000 mAh' },
    images: [
      'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 7,
    name: 'Đèn Bàn LED Chống Cận Thị Điều Chỉnh 3 Chế Độ Ánh Sáng',
    price: 195000,
    originalPrice: 280000,
    stock: 50,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Đèn học để bàn công nghệ LED không nhấp nháy, chống lóa mắt và bảo vệ thị lực đạt tiêu chuẩn quốc gia. Cần đèn uốn dẻo 360 độ tùy chỉnh góc chiếu. Bảng điều khiển cảm ứng một chạm điều chỉnh 3 màu ánh sáng (trắng, vàng, tự nhiên) và độ sáng vô cấp.',
    specs: { 'Công suất': '7W LED', 'Chế độ sáng': '3 màu ánh sáng', 'Chỉ số hoàn màu': 'CRI > 90', 'Nguồn điện': 'USB 5V' },
    images: [
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 10,
    name: 'Máy Hút Bụi Cầm Tay Không Dây Lực Hút Mạnh 12000Pa',
    price: 680000,
    originalPrice: 890000,
    stock: 25,
    is_featured: 1,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Máy hút bụi mini không dây động cơ không chổi than lực hút siêu mạnh 12.000Pa dọn sạch bụi mịn, vụn bánh, lông thú cưng trên giường nệm, sofa và ghế ô tô. Bộ lọc HEPA lọc sạch 99.97% hạt bụi kích thước 0.3 micromet, có thể tháo rời rửa sạch bằng nước.',
    specs: { 'Lực hút': '12.000 Pa', 'Dung tích hộc bụi': '0.5 Lít', 'Thời lượng pin': '35 phút liên tục' },
    images: [
      'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
    ]
  },

  // ==================== PHỤ KIỆN CÔNG NGHỆ (category_id: 8) ====================
  {
    shop_id: 1,
    category_id: 8,
    name: 'Đồng Hồ Thông Minh Smartwatch Theo Dõi Sức Khỏe Đo Nhịp Tim',
    price: 990000,
    originalPrice: 1490000,
    stock: 30,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Đồng hồ thông minh mặt kính cong 2.5D màn hình AMOLED sắc nét 1.43 inch. Cảm biến sinh học thế hệ mới đo nhịp tim, SpO2 nồng độ oxy trong máu và theo dõi giấc ngủ 24/7. Hỗ trợ hơn 100 chế độ tập luyện thể thao và nhận thông báo cuộc gọi tin nhắn.',
    specs: { 'Màn hình': '1.43 inch AMOLED', 'Chống nước': '5 ATM (50 mét)', 'Pin': 'Lên đến 12 ngày' },
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Giá Đỡ Laptop Nhôm Tản Nhiệt Gấp Gọn Điều Chỉnh Độ Cao',
    price: 185000,
    originalPrice: 250000,
    stock: 60,
    is_featured: 0,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Chân đế kê laptop bằng hợp kim nhôm nguyên khối cắt CNC anodized sang trọng. Cấu trúc tam giác vững chãi chịu tải trọng đến 20kg, có 6 nấc chỉnh độ cao công thái học chống mỏi cổ vai gáy. Đệm silicon chống trầy xước máy và hỗ trợ tản nhiệt đáy máy tối ưu.',
    specs: { 'Chất liệu': 'Hợp kim nhôm cao cấp', 'Tương thích': 'Laptop & Tablet 10 - 16 inch', 'Trọng lượng': '260g' },
    images: [
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Hub Chuyển Đổi Type-C 7 trong 1 Xuất HDMI 4K và Khe Thẻ Nhớ',
    price: 360000,
    originalPrice: 480000,
    stock: 40,
    is_featured: 0,
    is_flash_sale: 0,
    free_shipping: 1,
    description: 'Bộ mở rộng cổng kết nối USB Type-C đa năng 7 trong 1: cổng HDMI hỗ trợ xuất hình ảnh 4K@30Hz siêu nét, cổng sạc Type-C PD 100W, 3 cổng USB 3.0 tốc độ cao 5Gbps, cùng khe cắm thẻ nhớ SD và TF tiện dụng. Vỏ kim loại tản nhiệt nhanh an toàn.',
    specs: { 'Cổng kết nối': '1 HDMI 4K, 1 USB-C PD 100W, 3 USB 3.0, 1 SD, 1 TF', 'Vỏ ngoài': 'Hợp kim nhôm xám không gian' },
    images: [
      'https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    shop_id: 1,
    category_id: 8,
    name: 'Loa Bluetooth Mini Chống Nước IPX7 Âm Bass Trầm Ấm 10W',
    price: 380000,
    originalPrice: 490000,
    stock: 35,
    is_featured: 1,
    is_flash_sale: 1,
    free_shipping: 1,
    description: 'Loa không dây di động kích thước nắm tay nhỏ gọn tích hợp màng loa cộng hưởng bass thụ động cho âm thanh sống động, âm trầm sâu ấm. Tiêu chuẩn chống nước chuẩn IPX7 có thể ngâm nước 1 mét trong 30 phút. Thời lượng pin 12 giờ nghe nhạc liên tục.',
    specs: { 'Công suất': '10W RMS', 'Chống nước': 'IPX7 ngâm nước an toàn', 'Pin': '2500 mAh (12 giờ chơi)' },
    images: [
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    ]
  }
];

async function seedProducts() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'shopnova_data_api',
    password: 'ShopNovaDev2026StrongPass',
    database: 'shopnova_dev',
  });

  console.log('Connected to MySQL. Updating shops to Mall status...');
  // Update shop 1 and 2 to Mall status with nice taglines
  await conn.query(`
    UPDATE shops 
    SET is_mall = 1,
        logo_url = 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=90',
        banner_url = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        tagline = 'ShopNova Official Mall - Công nghệ & Đời sống chính hãng'
    WHERE id = 1
  `);
  await conn.query(`
    UPDATE shops 
    SET is_mall = 1,
        logo_url = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=90',
        banner_url = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
        tagline = 'Nova Beauty & Fashion - 100% Thuần chay & Thời trang xu hướng'
    WHERE id = 2
  `);

  console.log('Shops updated to Mall.');

  // Clean up old draft seed products (1 to 8)
  await conn.query(`DELETE FROM product_images WHERE product_id IN (1, 2, 3, 4, 5, 6, 7, 8)`);
  await conn.query(`DELETE FROM product_variants WHERE product_id IN (1, 2, 3, 4, 5, 6, 7, 8)`);
  await conn.query(`DELETE FROM products WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8)`);
  console.log('Cleaned up placeholder seed drafts (id 1-8).');

  let addedCount = 0;

  for (let idx = 0; idx < NEW_PRODUCTS.length; idx++) {
    const p = NEW_PRODUCTS[idx];
    console.log(`\n[${idx + 1}/${NEW_PRODUCTS.length}] Processing: ${p.name}`);

    // Download 4 images and save to backend/uploads
    const uploadedUrls = [];
    for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
      const url = p.images[imgIdx];
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const uuid = crypto.randomUUID();
        const filename = `${uuid}.jpg`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
        uploadedUrls.push(`/uploads/${filename}`);
      } catch (err) {
        console.error(`  Failed to download image ${imgIdx + 1} (${url}):`, err.message);
        // Fallback to one of previous verified images
        const fallback = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80';
        const res = await fetch(fallback);
        const buffer = Buffer.from(await res.arrayBuffer());
        const uuid = crypto.randomUUID();
        const filename = `${uuid}.jpg`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
        uploadedUrls.push(`/uploads/${filename}`);
      }
    }

    if (uploadedUrls.length !== 4) {
      console.error(`  Skipping: not enough images (${uploadedUrls.length}/4)`);
      continue;
    }

    // Insert Product
    const slug = `${toSlug(p.name)}-${crypto.randomBytes(5).toString('hex')}`;
    const [insertResult] = await conn.query(
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
        p.free_shipping ? 1 : 0,
      ]
    );

    const productId = insertResult.insertId;

    // Insert Variant
    const sku = `SN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    await conn.query(
      `INSERT INTO product_variants (product_id, sku, variant_key, name, attributes, price, original_price, stock_qty, is_active)
       VALUES (?, ?, 'default', 'Mặc định', '{}', ?, ?, ?, 1)`,
      [productId, sku, p.price, p.originalPrice || null, p.stock]
    );

    // Insert 4 Images with sort_order 0, 1, 2, 3
    for (let sortOrder = 0; sortOrder < 4; sortOrder++) {
      await conn.query(
        `INSERT INTO product_images (product_id, url, alt_text, sort_order, source_page_url, author, license_name, license_url)
         VALUES (?, ?, ?, ?, NULL, 'Ảnh do người bán tải lên', 'Ảnh do người bán cung cấp', NULL)`,
        [productId, uploadedUrls[sortOrder], p.name, sortOrder]
      );
    }

    addedCount++;
    console.log(`  ✓ Product #${productId} inserted with 4 verified photos!`);
  }

  // Count active products
  const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM products WHERE status = 'active'`);
  console.log(`\n==================================================`);
  console.log(`Successfully seeded ${addedCount} new products!`);
  console.log(`Total active products in database now: ${countRows[0].total}`);

  await conn.end();
}

seedProducts().catch(console.error);

