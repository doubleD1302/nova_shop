/**
 * Nội dung tĩnh của trang chủ (mock) — banner, icon tiện ích, cam kết, footer.
 */

export const navLinks = [
  { label: 'Trang Chủ', to: '/' },
  { label: 'Nova Mall', to: '/tim-kiem?mall=1' },
  { label: 'Flash Sale', to: '/tim-kiem?flash=1' },
  { label: 'Mã Giảm Giá', to: '/tim-kiem?sort=discount' },
  { label: 'Thời Trang', to: '/tim-kiem?category=thoi-trang-nam' },
  { label: 'Điện Tử & Công Nghệ', to: '/tim-kiem?category=dien-thoai' },
  { label: 'Nhà Cửa & Đời Sống', to: '/tim-kiem?category=nha-cua-doi-song' },
  { label: 'Sắc Đẹp', to: '/tim-kiem?category=my-pham' },
]

export const heroBanners = [
  {
    id: 'b1',
    title: 'MUA SẮM ĐA NGÀNH HÀNG',
    subtitle: 'Khám phá sản phẩm và ưu đãi đang có trên ShopNova.',
    from: '#F5E7D4',
    to: '#F4E6D2',
    emojis: '🛍️',
    image: '/images/banners/banner-fashion-collection.jpg',
    showOverlayText: false,
    to_link: '/tim-kiem',
  },
  {
    id: 'b2',
    title: 'THỜI TRANG',
    subtitle: 'Tìm phong cách phù hợp với bạn.',
    from: '#80513B',
    to: '#BD6E49',
    emojis: '👗',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=85',
    to_link: '/tim-kiem?category=thoi-trang-nam',
  },
  {
    id: 'b3',
    title: 'LÀM ĐẸP',
    subtitle: 'Khám phá sản phẩm chăm sóc cá nhân.',
    from: '#BD6E49',
    to: '#A95532',
    emojis: '✨',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=85',
    to_link: '/tim-kiem?category=my-pham',
  },
  {
    id: 'b4',
    title: 'NOVA MALL',
    subtitle: 'Xem các gian hàng được gắn nhãn Mall.',
    from: '#80513B',
    to: '#49352D',
    emojis: '💎',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=85',
    to_link: '/tim-kiem?mall=1',
  },
  {
    id: 'b5',
    title: 'FLASH SALE',
    subtitle: 'Xem sản phẩm đang tham gia Flash Sale.',
    from: '#BD6E49',
    to: '#A95532',
    emojis: '⚡',
    image: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=600&q=85',
    to_link: '/tim-kiem?flash=1',
  },
]

/** Icon tiện ích ngay dưới banner */
export const quickLinks = [
  { id: 'flash', label: 'Flash Sale', emoji: '⚡', bg: 'bg-[#F5E7D4]', to: '/tim-kiem?flash=1' },
  { id: 'voucher', label: 'Đang giảm giá', emoji: '🎟️', bg: 'bg-[#F4E6D2]', to: '/tim-kiem?sort=discount' },
  { id: 'freeship', label: 'Sản phẩm Freeship', emoji: '🚚', bg: 'bg-[#F5E7D4]', to: '/tim-kiem?freeship=1' },
  { id: 'mall', label: 'Gian hàng Mall', emoji: '💎', bg: 'bg-[#F4E6D2]', to: '/tim-kiem?mall=1' },
  { id: 'global', label: 'Hàng mới nhất', emoji: '✨', bg: 'bg-[#F5E7D4]', to: '/tim-kiem?sort=newest' },
  { id: 'topup', label: 'Công nghệ', emoji: '📱', bg: 'bg-[#F4E6D2]', to: '/tim-kiem?category=phu-kien-cong-nghe' },
  { id: 'budget', label: 'Giá thấp trước', emoji: '🛒', bg: 'bg-[#F5E7D4]', to: '/tim-kiem?sort=price-asc' },
  { id: 'trend', label: 'Phổ biến', emoji: '🔎', bg: 'bg-[#F4E6D2]', to: '/tim-kiem?sort=popular' },
]

/** 4 cam kết cuối trang chủ */
export const commitments = [
  {
    id: 'c1',
    title: 'Đa dạng ngành hàng',
    desc: 'Khám phá danh mục sản phẩm đang bán',
    emoji: '🏅',
    bg: 'bg-[#F5E7D4]',
  },
  {
    id: 'c2',
    title: 'Nhiều gian hàng',
    desc: 'Xem thông tin từ từng người bán',
    emoji: '↩️',
    bg: 'bg-[#F5E7D4]',
  },
  {
    id: 'c3',
    title: 'Theo dõi đơn hàng',
    desc: 'Quản lý đơn sau khi đăng nhập',
    emoji: '🚚',
    bg: 'bg-[#F5E7D4]',
  },
  {
    id: 'c4',
    title: 'Thông tin sản phẩm',
    desc: 'Ảnh, giá và tồn kho từ danh mục',
    emoji: '🎧',
    bg: 'bg-[#F5E7D4]',
  },
]

/** Tabs khu vực "Gợi ý hôm nay" */
export const suggestTabs = [
  { id: 'suggest', label: 'GỢI Ý HÔM NAY' },
  { id: 'freeship', label: 'FREESHIP' },
  { id: 'sale50', label: 'ĐANG GIẢM GIÁ' },
  { id: 'outlet', label: 'MỚI NHẤT' },
]

export const footerColumns = [
  {
    title: 'CHĂM SÓC KHÁCH HÀNG',
    links: [
      { label: 'Trung Tâm Trợ Giúp ShopNova' },
      { label: 'Hướng Dẫn Mua Hàng & Đặt Hàng' },
      { label: 'Hướng Dẫn Bán Hàng Cho Người Bán' },
      { label: 'Chính Sách Đổi Trả & Hoàn Tiền' },
    ],
  },
  {
    title: 'VỀ SHOPNOVA',
    links: [
      { label: 'Giới Thiệu Nền Tảng ShopNova' },
      { label: 'Cơ Hội Nghệ Nghiệp & Tuyển Dụng' },
      { label: 'Quy Chế Hoạt Động Sàn TMĐT' },
      { label: 'Chính Sách Bảo Mật Thông Tin' },
    ],
  },
]

export const paymentMethods = [
  { name: 'VISA', color: 'text-[#1a1f71]' },
  { name: 'Master', color: 'text-[#eb001b]' },
  { name: 'JCB', color: 'text-[#0e4c96]' },
  { name: 'MoMo', color: 'text-[#a50064]' },
  { name: 'ZaloPay', color: 'text-[#0068ff]' },
  { name: 'COD', color: 'text-[#547653]' },
]

export const followChannels = [
  { name: 'Facebook Global', icon: 'f' },
  { name: 'Instagram Community', icon: '◎' },
  { name: 'TikTok Shop Channel', icon: '♪' },
  { name: 'LinkedIn Corporate', icon: 'in' },
]

/** Phương thức thanh toán dùng ở trang Đặt hàng */
export const checkoutPayments = [
  { id: 'cod', name: 'Thanh toán khi nhận hàng (COD)', emoji: '💵' },
]

/** Đơn vị vận chuyển mock */
export const shippingUnits = [
  { id: 'nhanh', name: 'Hoả Tốc ShopNova', note: 'Nhận hàng trong 2 giờ', fee: 32000, emoji: '⚡' },
  { id: 'tietkiem', name: 'Tiết Kiệm', note: 'Nhận hàng 3-5 ngày', fee: 16500, emoji: '📦' },
  { id: 'hoatoc', name: 'Nhanh', note: 'Nhận hàng 1-2 ngày', fee: 22000, emoji: '🚀' },
]
