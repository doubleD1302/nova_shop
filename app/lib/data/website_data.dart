import 'package:flutter/material.dart';
import '../models/banner_item.dart';

/// Cấu hình điều hướng & bố cục giao diện trang chủ (tương ứng src/data/homeContent.js trên Website).
/// Hoàn toàn KHÔNG chứa dữ liệu sản phẩm, danh mục, gian hàng hay tài khoản tĩnh.
class QuickLinkItem {
  final String id;
  final String label;
  final String emoji;
  final Color backgroundColor;
  final String link;

  const QuickLinkItem({
    required this.id,
    required this.label,
    required this.emoji,
    required this.backgroundColor,
    required this.link,
  });
}

class CommitmentItem {
  final String id;
  final String title;
  final String desc;
  final String emoji;
  final Color backgroundColor;

  const CommitmentItem({
    required this.id,
    required this.title,
    required this.desc,
    required this.emoji,
    required this.backgroundColor,
  });
}

class WebsiteData {
  // 1. BANNER CHÍNH (src/data/homeContent.js -> heroBanners)
  static const List<BannerItem> banners = [
    BannerItem(
      id: 'b1',
      title: 'MUA SẮM ĐA NGÀNH HÀNG',
      subtitle: 'Khám phá sản phẩm và ưu đãi đang có trên ShopNova.',
      backgroundColor: Color(0xFFBD6E49),
      imageUrl: 'https://novashop-web-delta.vercel.app/images/banners/banner-fashion-collection.jpg',
    ),
    BannerItem(
      id: 'b2',
      title: 'THỜI TRANG',
      subtitle: 'Tìm phong cách phù hợp với bạn.',
      backgroundColor: Color(0xFF80513B),
      imageUrl: '',
    ),
    BannerItem(
      id: 'b3',
      title: 'LÀM ĐẸP',
      subtitle: 'Khám phá sản phẩm chăm sóc cá nhân.',
      backgroundColor: Color(0xFFA95532),
      imageUrl: '',
    ),
    BannerItem(
      id: 'b4',
      title: 'NOVA MALL',
      subtitle: 'Xem các gian hàng được gắn nhãn Mall.',
      backgroundColor: Color(0xFF49352D),
      imageUrl: '',
    ),
    BannerItem(
      id: 'b5',
      title: 'FLASH SALE',
      subtitle: 'Xem sản phẩm đang tham gia Flash Sale.',
      backgroundColor: Color(0xFFA95532),
      imageUrl: '',
    ),
  ];

  // 2. TIỆN ÍCH LỌC NHANH (src/data/homeContent.js -> quickLinks)
  static const List<QuickLinkItem> quickLinks = [
    QuickLinkItem(
      id: 'flash',
      label: 'Flash Sale',
      emoji: '⚡',
      backgroundColor: Color(0xFFF5E7D4),
      link: '/tim-kiem?flash=1',
    ),
    QuickLinkItem(
      id: 'voucher',
      label: 'Đang giảm giá',
      emoji: '🎟️',
      backgroundColor: Color(0xFFF4E6D2),
      link: '/tim-kiem?sort=discount',
    ),
    QuickLinkItem(
      id: 'freeship',
      label: 'Sản phẩm\nFreeship',
      emoji: '🚚',
      backgroundColor: Color(0xFFF5E7D4),
      link: '/tim-kiem?freeship=1',
    ),
    QuickLinkItem(
      id: 'mall',
      label: 'Gian hàng\nMall',
      emoji: '💎',
      backgroundColor: Color(0xFFF4E6D2),
      link: '/tim-kiem?mall=1',
    ),
    QuickLinkItem(
      id: 'global',
      label: 'Hàng mới\nnhất',
      emoji: '✨',
      backgroundColor: Color(0xFFF5E7D4),
      link: '/tim-kiem?sort=newest',
    ),
    QuickLinkItem(
      id: 'topup',
      label: 'Công nghệ',
      emoji: '📱',
      backgroundColor: Color(0xFFF4E6D2),
      link: '/tim-kiem?category=phu-kien-cong-nghe',
    ),
    QuickLinkItem(
      id: 'budget',
      label: 'Giá thấp\ntrước',
      emoji: '🛒',
      backgroundColor: Color(0xFFF5E7D4),
      link: '/tim-kiem?sort=price-asc',
    ),
    QuickLinkItem(
      id: 'trend',
      label: 'Phổ biến',
      emoji: '🔎',
      backgroundColor: Color(0xFFF4E6D2),
      link: '/tim-kiem?sort=popular',
    ),
  ];

  // 3. THÔNG TIN SÀN (src/data/homeContent.js -> commitments)
  static const List<CommitmentItem> commitments = [
    CommitmentItem(
      id: 'c1',
      title: 'Đa dạng ngành hàng',
      desc: 'Khám phá danh mục sản phẩm đang bán',
      emoji: '🏅',
      backgroundColor: Color(0xFFF5E7D4),
    ),
    CommitmentItem(
      id: 'c2',
      title: 'Nhiều gian hàng',
      desc: 'Xem thông tin từ từng người bán',
      emoji: '↩️',
      backgroundColor: Color(0xFFF5E7D4),
    ),
    CommitmentItem(
      id: 'c3',
      title: 'Theo dõi đơn hàng',
      desc: 'Quản lý đơn sau khi đăng nhập',
      emoji: '🚚',
      backgroundColor: Color(0xFFF5E7D4),
    ),
    CommitmentItem(
      id: 'c4',
      title: 'Thông tin sản phẩm',
      desc: 'Ảnh, giá và tồn kho từ danh mục',
      emoji: '🎧',
      backgroundColor: Color(0xFFF5E7D4),
    ),
  ];

  // 4. TABS GỢI Ý HÔM NAY (src/data/homeContent.js -> suggestTabs)
  static const List<Map<String, String>> suggestTabs = [
    {'id': 'suggest', 'label': 'GỢI Ý HÔM NAY'},
    {'id': 'freeship', 'label': 'FREESHIP'},
    {'id': 'sale50', 'label': 'ĐANG GIẢM GIÁ'},
    {'id': 'outlet', 'label': 'MỚI NHẤT'},
  ];
}
