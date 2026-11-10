import '../models/flash_sale_item.dart';
import '../models/product.dart';

/// Thông tin chiến dịch Flash Sale theo khung giờ
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

/// Bộ điều phối hiển thị sản phẩm Flash Sale từ dữ liệu thật Backend API
class FlashSaleRotator {
  /// Khung giờ Flash Sale hiện tại (2 tiếng/phiên dựa theo giờ thực tế)
  static String getSessionLabel() {
    final hour = DateTime.now().hour;
    final slotHour = (hour ~/ 2) * 2;
    return '${slotHour.toString().padLeft(2, '0')}:00';
  }

  static FlashSaleCampaign getCurrentCampaign() {
    final now = DateTime.now();
    final day = now.day;
    final month = now.month;

    if (day == month || (day >= month - 1 && day <= month + 1 && month <= 12)) {
      return FlashSaleCampaign(
        title: '$month.$month SIÊU SALE',
        subtitle: 'Đại tiệc ngày đôi · Săn deal hấp dẫn',
        badge: 'ĐẠI LỄ',
      );
    }

    if (day >= 14 && day <= 16) {
      return const FlashSaleCampaign(
        title: 'SALE GIỮA THÁNG',
        subtitle: 'Lương về rộn ràng · Deal ưu đãi',
        badge: 'LƯƠNG VỀ',
      );
    }

    if (day >= 25 && day <= 28) {
      return const FlashSaleCampaign(
        title: 'SALE CUỐI THÁNG',
        subtitle: 'Xả kho cuối tháng · Giảm giá thật',
        badge: 'CUỐI THÁNG',
      );
    }

    return const FlashSaleCampaign(
      title: 'FLASH SALE',
      subtitle: 'Khung giờ săn deal từ cửa hàng trên NovaShop',
      badge: 'FLASH SALE',
    );
  }

  /// Chọn sản phẩm Flash Sale thực tế từ Backend API (không dùng dữ liệu tĩnh)
  static List<FlashSaleItem> rotateItems({
    List<Product>? apiProducts,
    int count = 6,
  }) {
    if (apiProducts == null || apiProducts.isEmpty) {
      return [];
    }

    final flashCandidates = apiProducts
        .where((p) => p.price > 0 && (p.isFlashSale || p.discount > 0))
        .toList();
    final pool = flashCandidates.isNotEmpty
        ? flashCandidates
        : apiProducts.where((p) => p.price > 0).toList();

    if (pool.isEmpty) return [];

    final selected = pool.take(count).toList();
    return selected.map((p) {
      final soldPct = (p.soldPercent / 100.0).clamp(0.0, 1.0);
      final soldLabel = p.soldCount.isNotEmpty
          ? p.soldCount
          : (p.soldPercent > 0 ? 'ĐÃ BÁN ${p.soldPercent}%' : 'ĐANG MỞ BÁN');

      return FlashSaleItem(
        id: p.id,
        name: p.name,
        imageUrl: p.effectiveImageUrl,
        price: p.price,
        discount: p.discount,
        soldPercentage: soldPct,
        soldLabel: soldLabel,
        emoji: p.emoji.isNotEmpty ? p.emoji : '⚡',
      );
    }).toList();
  }
}
