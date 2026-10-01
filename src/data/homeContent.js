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
  { label: 'Nhà Cửa & Đời Sống', to: '/tim-kiem?category=nha-cua' },
  { label: 'Sắc Đẹp', to: '/tim-kiem?category=sac-dep' },
]

export const heroBanners = [
  {
    id: 'b1',
    title: 'MEGA SALE 9.9',
    subtitle: 'Và đặc quyền Freeship bù Ủ Ủ toàn quốc hôm nay.',
    from: '#f53d2d',
    to: '#ff9f43',
    emojis: '🛍️🎁✨',
    to_link: '/tim-kiem?sort=discount',
    cta: ['Săn Deal Siêu Tốc', 'Nhận Mã 100K'],
  },
  {
    id: 'b2',
    title: 'FREESHIP EXTRA',
    subtitle: 'Giảm thêm 50% phí vận chuyển cho mọi đơn hàng.',
    from: '#ff6b81',
    to: '#ffb199',
    emojis: '🚚📦',
    to_link: '/tim-kiem?freeship=1',
    cta: ['Xem Ưu Đãi'],
  },
  {
    id: 'b3',
    title: 'HÀNG MỚI MỖI NGÀY',
    subtitle: 'Áp dụng cho mọi đơn hàng đầu tiên.',
    from: '#3a3f47',
    to: '#6b7280',
    emojis: '🆕',
    to_link: '/tim-kiem?sort=newest',
    cta: [],
  },
  {
    id: 'b4',
    title: 'NOVA MALL',
    subtitle: 'Hàng hiệu 100% - Chính hãng trả góp 0%',
    from: '#153a9c',
    to: '#3f6ad8',
    emojis: '💎',
    to_link: '/tim-kiem?mall=1',
    cta: [],
    mall: true,
  },
]

/** Icon tiện ích ngay dưới banner */
export const quickLinks = [
  { id: 'flash', label: 'Khung Giờ Flash Sale', emoji: '⚡', bg: 'bg-[#fff1ec]', to: '/tim-kiem?flash=1' },
  { id: 'voucher', label: 'Mã Giảm Giá Sốc', emoji: '🎟️', bg: 'bg-[#ffeef5]', to: '/tim-kiem?sort=discount' },
  { id: 'freeship', label: 'Miễn Phí Vận Chuyển', emoji: '🚚', bg: 'bg-[#e9fbf3]', to: '/tim-kiem?freeship=1' },
  { id: 'mall', label: 'Nova Mall Chính Hãng', emoji: '💎', bg: 'bg-[#ecf1ff]', to: '/tim-kiem?mall=1' },
  { id: 'global', label: 'Hàng Quốc Tế Deal Xịn', emoji: '🌍', bg: 'bg-[#f3ecff]', to: '/tim-kiem?sort=newest' },
  { id: 'topup', label: 'Nạp Thẻ & Dịch Vụ', emoji: '📱', bg: 'bg-[#fff8e6]', to: '/tim-kiem?category=dien-thoai' },
  { id: 'budget', label: 'Hàng Tiêu Dùng Rẻ', emoji: '🛒', bg: 'bg-[#eafaf1]', to: '/tim-kiem?sort=price-asc' },
  { id: 'trend', label: 'Xu Thương Mại Ngày', emoji: '🔮', bg: 'bg-[#e8f8fc]', to: '/tim-kiem?sort=popular' },
]

/** 4 cam kết cuối trang chủ */
export const commitments = [
  {
    id: 'c1',
    title: '100% Chính Hãng',
    desc: 'Cam kết đền bù gấp 2 nếu hàng giả',
    emoji: '🏅',
    bg: 'bg-[#fff1ec]',
  },
  {
    id: 'c2',
    title: '15 Ngày Đổi Trả',
    desc: 'Miễn phí hoàn tiền nhanh chóng',
    emoji: '↩️',
    bg: 'bg-[#e9fbf3]',
  },
  {
    id: 'c3',
    title: 'Giao Nhanh 2 Giờ',
    desc: 'Giao siêu tốc nội thành Hà Nội & HCM',
    emoji: '🚚',
    bg: 'bg-[#eef2ff]',
  },
  {
    id: 'c4',
    title: 'Hỗ Trợ 24/7',
    desc: 'Đội ngũ CSKH chuyên nghiệp tận tâm',
    emoji: '🎧',
    bg: 'bg-[#f3ecff]',
  },
]

/** Tabs khu vực "Gợi ý hôm nay" */
export const suggestTabs = [
  { id: 'suggest', label: 'GỢI Ý HÔM NAY' },
  { id: 'freeship', label: 'FREESHIP EXTRA ĐƠN ỚT' },
  { id: 'sale50', label: 'GIẢM GIÁ 50%' },
  { id: 'outlet', label: 'HÀNG HIỆU OUTLET' },
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
  { name: 'COD', color: 'text-emerald-700' },
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
  { id: 'momo', name: 'Ví điện tử MoMo', emoji: '🟣' },
  { id: 'zalopay', name: 'Ví điện tử ZaloPay', emoji: '🔵' },
  { id: 'card', name: 'Thẻ Tín dụng / Ghi nợ (VISA, Master, JCB)', emoji: '💳' },
  { id: 'bank', name: 'Chuyển khoản ngân hàng', emoji: '🏦' },
]

/** Đơn vị vận chuyển mock */
export const shippingUnits = [
  { id: 'nhanh', name: 'Hoả Tốc ShopNova', note: 'Nhận hàng trong 2 giờ', fee: 32000, emoji: '⚡' },
  { id: 'tietkiem', name: 'Tiết Kiệm', note: 'Nhận hàng 3-5 ngày', fee: 16500, emoji: '📦' },
  { id: 'hoatoc', name: 'Nhanh', note: 'Nhận hàng 1-2 ngày', fee: 22000, emoji: '🚀' },
]
