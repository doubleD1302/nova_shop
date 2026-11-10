/**
 * Danh sách Banner quảng cáo chính thức cho ShopNova Web & Mobile App
 */
const promoBanners = [
  {
    id: '1',
    title: 'MUA SẮM ĐA NGÀNH HÀNG',
    subtitle: 'Khám phá sản phẩm và ưu đãi đang có trên ShopNova.',
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
    linkUrl: '/tim-kiem',
    backgroundColor: '#BD6E49',
    sortOrder: 1,
  },
  {
    id: '2',
    title: 'THỜI TRANG CAO CẤP',
    subtitle: 'Tìm phong cách phù hợp với bạn.',
    imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    linkUrl: '/tim-kiem?category=thoi-trang-nam',
    backgroundColor: '#80513B',
    sortOrder: 2,
  },
  {
    id: '3',
    title: 'CÔNG NGHỆ & ĐIỆN TỬ',
    subtitle: 'Trải nghiệm âm thanh đỉnh cao cùng NovaAudio.',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    linkUrl: '/tim-kiem?category=dien-thoai',
    backgroundColor: '#2A4365',
    sortOrder: 3,
  },
  {
    id: '4',
    title: 'MỸ PHẨM CHÍNH HÃNG',
    subtitle: 'Chăm sóc sắc đẹp toàn diện với Nova Beauty.',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
    linkUrl: '/tim-kiem?category=my-pham',
    backgroundColor: '#702459',
    sortOrder: 4,
  },
]

export async function listBanners(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: promoBanners,
    })
  } catch (err) {
    return next(err)
  }
}
