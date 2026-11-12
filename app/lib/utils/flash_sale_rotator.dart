import 'dart:math';

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

/// Bộ điều phối hiển thị & tính giá Flash Sale đồng bộ với Website (`flashSaleRotator.js`)
class FlashSaleRotator {
  static const Map<int, String> _slotNames = {
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

  /// Khung giờ Flash Sale hiện tại dạng `HH:00` (giữ tương thích ngắn gọn)
  static String getSessionLabel([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    final slotHour = (hour ~/ 2) * 2;
    return '${slotHour.toString().padLeft(2, '0')}:00';
  }

  /// Nhãn khung giờ đầy đủ theo mẫu Website: `HH:00 - HH:00 · Tên khung giờ`
  static String getSessionRangeLabel([DateTime? now]) {
    final hour = (now ?? DateTime.now()).hour;
    final start = (hour ~/ 2) * 2;
    final end = (start + 2) % 24;
    final startStr = start.toString().padLeft(2, '0');
    final endStr = end.toString().padLeft(2, '0');
    final title = _slotNames[start] ?? 'Deal Chớp Nhoáng';
    return '$startStr:00 - $endStr:00 \u00b7 $title';
  }

  static FlashSaleCampaign getCurrentCampaign([DateTime? now]) {
    final current = now ?? DateTime.now();
    final day = current.day;
    final month = current.month;

    // 1. Ngày Đôi (1.1, 2.2, ..., 11.11, 12.12)
    if (day == month || (day >= month - 1 && day <= month + 1 && month <= 12)) {
      return FlashSaleCampaign(
        title: '$month.$month SIÊU SALE',
        subtitle: 'Đại tiệc ngày đôi \u00b7 Săn deal hủy diệt',
        badge: 'ĐẠI LỄ',
        bonusDiscount: 10,
      );
    }

    // 2. Siêu Sale Giữa Tháng (14 - 16)
    if (day >= 14 && day <= 16) {
      return const FlashSaleCampaign(
        title: 'SALE GIỮA THÁNG',
        subtitle: 'Lương về rộn ràng \u00b7 Săn sale nửa giá',
        badge: 'LƯƠNG VỀ',
        bonusDiscount: 8,
      );
    }

    // 3. Sale Cuối Tháng (25 - 28)
    if (day >= 25 && day <= 28) {
      return const FlashSaleCampaign(
        title: 'SALE CUỐI THÁNG',
        subtitle: 'Lương đã về \u00b7 Xả kho sập giá sàn',
        badge: 'XẢ KHO',
        bonusDiscount: 7,
      );
    }

    // 4. Cuối tuần
    if (current.weekday == DateTime.saturday || current.weekday == DateTime.sunday) {
      return const FlashSaleCampaign(
        title: 'SIÊU SALE CUỐI TUẦN',
        subtitle: 'Cuối tuần thảnh thơi \u00b7 Săn deal chớp nhoáng',
        badge: 'WEEKEND',
        bonusDiscount: 5,
      );
    }

    // 5. Ngày thường
    return const FlashSaleCampaign(
      title: 'GIỜ VÀNG GIÁ SỐC',
      subtitle: 'Xoay tua sản phẩm mới mỗi 2 giờ',
      badge: 'CHỚP NHOÁNG',
      bonusDiscount: 0,
    );
  }

  /// Xoay tua & tính giá Flash Sale đồng bộ 1:1 với Website (`rotateFlashProducts`)
  static List<Product> rotateProducts({
    List<Product>? apiProducts,
    int count = 6,
    DateTime? now,
  }) {
    if (apiProducts == null || apiProducts.isEmpty || count <= 0) {
      return [];
    }

    var validProducts = apiProducts.where((p) {
      final name = p.name.toLowerCase();
      return !name.contains('lỗi') &&
          !name.contains('test seller') &&
          !name.contains('ao test') &&
          p.price > 0;
    }).toList();

    if (validProducts.isEmpty) {
      validProducts = apiProducts.where((p) => p.price > 0).toList();
    }
    if (validProducts.isEmpty) return [];

    final current = now ?? DateTime.now();
    final daySeed = current.year * 372 + current.month * 31 + current.day;
    final slot = current.hour ~/ 2;
    final sessionSeed = daySeed * 12 + slot;

    final offset = sessionSeed % validProducts.length;
    final selected = <Product>[];
    final usedCats = <String>{};

    for (int i = 0; i < validProducts.length; i++) {
      final p = validProducts[(offset + i) % validProducts.length];
      final cat = p.categoryId.isNotEmpty
          ? p.categoryId
          : (p.categoryName.isNotEmpty ? p.categoryName : 'general');
      if (!usedCats.contains(cat) || usedCats.length >= 5) {
        selected.add(p);
        usedCats.add(cat);
        if (selected.length >= count) break;
      }
    }

    if (selected.length < count) {
      for (int i = 0; i < validProducts.length && selected.length < count; i++) {
        final p = validProducts[(offset + i) % validProducts.length];
        if (!selected.any((s) => s.id == p.id)) {
          selected.add(p);
        }
      }
    }

    final campaign = getCurrentCampaign(current);

    return List<Product>.generate(selected.length, (idx) {
      final p = selected[idx];
      // 1. Xác định giá gốc chuẩn của sản phẩm
      final double originalPrice = p.originalPrice > p.price ? p.originalPrice : p.price;

      // 2. Xác định % giảm mục tiêu (25% - 75%)
      int targetDiscount = p.discount;
      if (targetDiscount < 25) {
        targetDiscount = 30 + ((idx * 7 + slot * 3) % 35);
      }
      targetDiscount = (targetDiscount + campaign.bonusDiscount).clamp(25, 75);

      // 3. Tính giá đã giảm làm tròn hàng nghìn (1.000₫)
      double flashPrice =
          ((originalPrice * (1 - targetDiscount / 100.0)) / 1000.0).round() * 1000.0;
      if (flashPrice >= originalPrice && originalPrice > 10000) {
        flashPrice = originalPrice - 10000;
      } else if (flashPrice <= 0) {
        flashPrice = max(1000.0, (originalPrice * 0.5).roundToDouble());
      }

      // 4. Tính % giảm thực tế từ 2 mức giá để khớp tuyệt đối
      final int exactDiscount = originalPrice > 0
          ? (((originalPrice - flashPrice) / originalPrice) * 100).round().clamp(1, 99)
          : targetDiscount;

      // 5. Tiến độ bán hàng: nếu bằng 0 thì mô phỏng tỷ lệ bán tự nhiên xen kẽ VỪA MỞ BÁN
      int soldPercent = p.soldPercent;
      if (soldPercent == 0) {
        final simulated = (idx * 23 + slot * 17) % 85;
        soldPercent = idx % 2 == 0 ? 0 : max(8, simulated);
      }

      // 6. Cập nhật giá gốc & giá giảm cho danh sách biến thể
      final List<Map<String, dynamic>> scaledVariants = p.variants.isNotEmpty
          ? p.variants.map((v) {
              final rawV = v['price'];
              final rawVOrig = v['originalPrice'];
              final double vRaw = (rawV is num)
                  ? rawV.toDouble()
                  : (double.tryParse(rawV?.toString() ?? '') ?? originalPrice);
              final double vOrigCand = (rawVOrig is num)
                  ? rawVOrig.toDouble()
                  : (double.tryParse(rawVOrig?.toString() ?? '') ?? 0.0);
              final double vOrig = vOrigCand > vRaw ? vOrigCand : vRaw;
              double vFlash =
                  ((vOrig * (1 - exactDiscount / 100.0)) / 1000.0).round() * 1000.0;
              if (vFlash >= vOrig && vOrig > 10000) {
                vFlash = vOrig - 10000;
              } else if (vFlash <= 0) {
                vFlash = max(1000.0, (vOrig * 0.5).roundToDouble());
              }
              return {
                ...v,
                'price': vFlash,
                'originalPrice': vOrig,
              };
            }).toList()
          : [
              {
                'id': 'sku_flash_${p.id}',
                'name': 'Mặc định',
                'price': flashPrice,
                'originalPrice': originalPrice,
                'stock': p.stock > 0 ? p.stock : 50,
              }
            ];

      return p.copyWith(
        price: flashPrice,
        originalPrice: originalPrice,
        discount: exactDiscount,
        soldPercent: soldPercent,
        isFlashSale: true,
        variants: scaledVariants,
      );
    });
  }

  /// Chọn sản phẩm Flash Sale thực tế từ Backend API (không dùng dữ liệu tĩnh)
  static List<FlashSaleItem> rotateItems({
    List<Product>? apiProducts,
    int count = 6,
    DateTime? now,
  }) {
    final rotated = rotateProducts(apiProducts: apiProducts, count: count, now: now);
    return rotated.map((p) {
      final soldPctInt = p.soldPercent.clamp(0, 100);
      final soldPct = soldPctInt / 100.0;
      final soldLabel = soldPctInt == 0
          ? 'VỪA MỞ BÁN'
          : (soldPctInt >= 90 ? 'SẮP CHÁY HÀNG $soldPctInt%' : 'ĐÃ BÁN $soldPctInt%');

      return FlashSaleItem(
        id: p.id,
        name: p.name,
        imageUrl: p.effectiveImageUrl,
        price: p.price,
        originalPrice: p.originalPrice,
        discount: p.discount,
        soldPercentage: soldPct,
        soldPercentInt: soldPctInt,
        soldLabel: soldLabel,
        emoji: p.emoji.isNotEmpty ? p.emoji : '⚡',
        product: p,
      );
    }).toList();
  }
}
