import '../models/flash_sale_item.dart';
import '../models/product.dart';
import '../data/website_data.dart';
import 'product_image_resolver.dart';

/// Thông tin chiến dịch ngày lễ / sự kiện
class FlashSaleCampaign {
  final String title;
  final String subtitle;
  final String badge;
  final int bonusDiscount;

  const FlashSaleCampaign({
    required this.title,
    required this.subtitle,
    required this.badge,
    this.bonusDiscount = 0,
  });
}

/// Bộ điều phối xoay tua sản phẩm Flash Sale theo thời gian thực và sự kiện ngày lễ kiểu Shopee
class FlashSaleRotator {
  /// Xác định sự kiện ngày lễ / dịp sale hiện tại theo lịch thực tế
  static FlashSaleCampaign getCurrentCampaign() {
    final now = DateTime.now();
    final day = now.day;
    final month = now.month;

    // 1. Ngày Đôi Siêu Sale (1.1, 2.2, 3.3, ..., 11.11, 12.12)
    if (day == month || (day >= month - 1 && day <= month + 1 && month <= 12)) {
      return FlashSaleCampaign(
        title: '$month.$month SIÊU SALE',
        subtitle: 'Đại tiệc ngày đôi · Săn deal hủy diệt',
        badge: 'ĐẠI LỄ',
        bonusDiscount: 10,
      );
    }

    // 2. Siêu Sale Giữa Tháng (Ngày 14 - 16 hàng tháng)
    if (day >= 14 && day <= 16) {
      return const FlashSaleCampaign(
        title: 'SALE GIỮA THÁNG',
        subtitle: 'Lương về rộn ràng · Săn sale nửa giá',
        badge: 'LƯƠNG VỀ',
        bonusDiscount: 8,
      );
    }

    // 3. Sale Cuối Tháng / Lương Đã Về (Ngày 25 - 28 hàng tháng)
    if (day >= 25 && day <= 28) {
      return const FlashSaleCampaign(
        title: 'SALE CUỐI THÁNG',
        subtitle: 'Lương đã về · Xả kho sập giá sàn',
        badge: 'XẢ KHO',
        bonusDiscount: 7,
      );
    }

    // 4. Các sự kiện lễ hội lớn
    if (month == 11 && day >= 18 && day <= 21) {
      return const FlashSaleCampaign(
        title: 'TRI ÂN 20.11',
        subtitle: 'Ngập tràn quà tặng và ưu đãi tri ân',
        badge: 'TRI ÂN',
        bonusDiscount: 8,
      );
    }
    if (month == 11 && day >= 22 && day <= 30) {
      return const FlashSaleCampaign(
        title: 'BLACK FRIDAY',
        subtitle: 'Bão giảm giá công nghệ & thời trang lớn nhất',
        badge: 'SIÊU DEAL',
        bonusDiscount: 15,
      );
    }
    if (month == 12 && day >= 20 && day <= 25) {
      return const FlashSaleCampaign(
        title: 'GIÁNG SINH NOEL',
        subtitle: 'Mùa lễ hội rực rỡ · Săn deal quà tặng',
        badge: 'NOEL 2026',
        bonusDiscount: 12,
      );
    }
    if ((month == 1 && day >= 20) || (month == 2 && day <= 10)) {
      return const FlashSaleCampaign(
        title: 'TẾT RỘN RÀNG',
        subtitle: 'Sắm tết thả ga · Vạn deal may mắn',
        badge: 'TẾT 2026',
        bonusDiscount: 10,
      );
    }
    if (month == 3 && day >= 6 && day <= 9) {
      return const FlashSaleCampaign(
        title: 'QUỐC TẾ PHỤ NỮ 8.3',
        subtitle: 'Tôn vinh phái đẹp · Trao gửi yêu thương',
        badge: 'QUÀ TẶNG',
        bonusDiscount: 10,
      );
    }

    // 5. Cuối tuần
    if (now.weekday == DateTime.saturday || now.weekday == DateTime.sunday) {
      return const FlashSaleCampaign(
        title: 'SIÊU SALE CUỐI TUẦN',
        subtitle: 'Cuối tuần thảnh thơi · Săn deal chớp nhoáng',
        badge: 'WEEKEND',
        bonusDiscount: 5,
      );
    }

    // 6. Mặc định ngày thường
    return const FlashSaleCampaign(
      title: 'GIỜ VÀNG GIÁ SỐC',
      subtitle: 'Xoay tua sản phẩm mới mỗi 2 giờ',
      badge: 'CHỚP NHOÁNG',
      bonusDiscount: 0,
    );
  }

  /// Tên và khung giờ của phiên hiện tại (Shopee Time-slot)
  static String getSessionLabel() {
    final hour = DateTime.now().hour;
    final start = (hour ~/ 2) * 2;
    final end = start + 2;
    final startStr = start.toString().padLeft(2, '0');
    final endStr = (end % 24).toString().padLeft(2, '0');

    const slotNames = {
      0: 'Đêm Cuồng Nhiệt',
      2: 'Săn Deal Nửa Đêm',
      4: 'Bình Minh Đón Deal',
      6: 'Khởi Đầu Ngày Mới',
      8: 'Hàng Hiệu Buổi Sáng',
      10: 'Giờ Vàng Giá Rẻ',
      12: 'Nửa Ngày Săn Sale',
      14: 'Deal Chớp Nhoáng',
      16: 'Giờ Vàng Công Nghệ',
      18: 'Top Deal Bán Chạy',
      20: 'Đại Tiệc Tối Siêu Giảm',
      22: 'Xả Kho Cuối Ngày',
    };

    final title = slotNames[start] ?? 'Deal Chớp Nhoáng';
    return '$startStr:00 - $endStr:00 · $title';
  }

  /// Tính phần trăm hàng đã bán động theo tiến trình thời gian của phiên 2 tiếng
  static double calculateSoldPercentage(int index) {
    final now = DateTime.now();
    final minuteInSlot = (now.hour % 2) * 60 + now.minute; // 0 - 119 phút
    final slotProgress = minuteInSlot / 120.0; // 0.0 -> 1.0

    // Cơ sở bán từ 30% đến 85% + tiến trình thời gian + chênh lệch giữa các sản phẩm
    final base = 0.35 + (index % 4) * 0.08;
    final progressBoost = slotProgress * 0.45;
    double total = base + progressBoost;
    if (total > 0.96) total = 0.96;
    if (total < 0.25) total = 0.25;
    return double.parse(total.toStringAsFixed(2));
  }

  /// Xoay tua chọn 6-8 sản phẩm Flash Sale tốt nhất từ kho sản phẩm có sẵn
  static List<FlashSaleItem> rotateItems({
    List<Product>? apiProducts,
    int count = 6,
  }) {
    final now = DateTime.now();
    final campaign = getCurrentCampaign();

    // Thu thập tất cả sản phẩm hợp lệ, loại trừ sản phẩm lỗi/test
    final List<Product> pool = [];

    if (apiProducts != null && apiProducts.isNotEmpty) {
      for (final p in apiProducts) {
        final nameLower = p.name.toLowerCase();
        if (nameLower.contains('lỗi') ||
            nameLower.contains('test seller') ||
            nameLower.contains('ao test') ||
            p.price <= 0) {
          continue;
        }
        pool.add(p);
      }
    }

    // Kết hợp thêm sản phẩm chất lượng từ WebsiteData để đảm bảo pool luôn phong phú (63+ sản phẩm)
    for (final p in WebsiteData.products) {
      if (!pool.any((item) => item.id == p.id)) {
        pool.add(p);
      }
    }

    if (pool.isEmpty) {
      return WebsiteData.flashSales;
    }

    // Tính chỉ số xoay tua theo ngày và phiên 2 tiếng (12 phiên / ngày)
    // Mỗi 2 tiếng, shift sẽ thay đổi và chọn bộ sản phẩm hoàn toàn khác
    final daySeed = now.year * 372 + now.month * 31 + now.day;
    final slot = now.hour ~/ 2; // 0 đến 11
    final sessionSeed = daySeed * 12 + slot;

    // Xoay vòng danh sách pool theo sessionSeed
    final rotatedPool = List<Product>.from(pool);
    final offset = sessionSeed % pool.length;
    final List<Product> selected = [];

    // Chọn đa dạng các ngành hàng khác nhau trong 1 phiên
    final Set<String> usedCategories = {};
    for (int i = 0; i < pool.length; i++) {
      final p = rotatedPool[(offset + i) % pool.length];
      final cat = p.categoryId.isNotEmpty ? p.categoryId : p.categoryName;
      if (!usedCategories.contains(cat) || usedCategories.length >= 5) {
        selected.add(p);
        usedCategories.add(cat);
        if (selected.length >= count) break;
      }
    }

    // Nếu vẫn chưa đủ, bổ sung tuần tự
    if (selected.length < count) {
      for (int i = 0; i < pool.length && selected.length < count; i++) {
        final p = rotatedPool[(offset + i) % pool.length];
        if (!selected.any((s) => s.id == p.id)) {
          selected.add(p);
        }
      }
    }

    return selected.asMap().entries.map((entry) {
      final idx = entry.key;
      final p = entry.value;

      // Áp dụng mức giảm giá Flash Sale sâu: 30% - 65% + bonus của ngày lễ
      int flashDiscount = p.discount;
      if (flashDiscount < 25) {
        flashDiscount = 30 + ((idx * 7 + slot * 3) % 35);
      }
      flashDiscount = (flashDiscount + campaign.bonusDiscount).clamp(25, 75);

      final origPrice = p.originalPrice > p.price
          ? p.originalPrice
          : (p.price / (1 - (flashDiscount / 100)));
      final salePrice = (origPrice * (1 - flashDiscount / 100)).roundToDouble();

      final soldPct = calculateSoldPercentage(idx);
      final soldLabel = soldPct >= 0.88
          ? 'SẮP CHÁY HÀNG'
          : 'ĐÃ BÁN ${(soldPct * 100).toInt()}%';

      return FlashSaleItem(
        id: p.id,
        name: p.name,
        imageUrl: p.effectiveImageUrl,
        price: salePrice > 0 ? salePrice : p.price,
        discount: flashDiscount,
        soldPercentage: soldPct,
        soldLabel: soldLabel,
        emoji: p.emoji.isNotEmpty ? p.emoji : '⚡',
      );
    }).toList();
  }
}

