import 'product.dart';
import '../utils/product_image_resolver.dart';

class FlashSaleItem {
  final String id;
  final String name;
  final String imageUrl;
  final double price;
  final double originalPrice;
  final int discount;
  final double soldPercentage;
  final int soldPercentInt;
  final String soldLabel;
  final String emoji;
  final Product? product;

  const FlashSaleItem({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.price,
    this.originalPrice = 0,
    required this.discount,
    required this.soldPercentage,
    this.soldPercentInt = 0,
    required this.soldLabel,
    this.emoji = '⚡',
    this.product,
  });

  /// Luôn trả về hình ảnh thật sắc nét cho sản phẩm Flash Sale
  String get effectiveImageUrl => ProductImageResolver.resolve(
        id: id,
        imageUrl: imageUrl,
        name: name,
      );

  factory FlashSaleItem.fromJson(Map<String, dynamic> json) {
    final price = (json['price'] as num?)?.toDouble() ?? 0.0;
    final origPrice = (json['originalPrice'] as num?)?.toDouble() ?? 0.0;
    final rawDiscount = (json['discount'] as num?)?.toInt() ?? 0;
    final discount = rawDiscount > 0
        ? rawDiscount
        : (origPrice > price && origPrice > 0
            ? (((origPrice - price) / origPrice) * 100).round()
            : 0);
    final totalStock = (json['totalStock'] as num?)?.toInt() ?? 100;

    int soldPctInt = (json['soldPercent'] as num?)?.toInt() ?? (totalStock < 50 ? 90 : 75);
    soldPctInt = soldPctInt.clamp(0, 100);
    final double soldPct = soldPctInt / 100.0;
    final String label = soldPctInt == 0
        ? 'VỪA MỞ BÁN'
        : (soldPctInt >= 90 ? 'SẮP CHÁY HÀNG $soldPctInt%' : 'ĐÃ BÁN $soldPctInt%');

    final itemId = json['id']?.toString() ?? '';
    final itemName = json['name']?.toString() ?? '';
    final rawImg = json['imageUrl']?.toString() ?? '';
    final img = ProductImageResolver.resolve(
      id: itemId,
      imageUrl: rawImg,
      name: itemName,
    );

    return FlashSaleItem(
      id: itemId,
      name: itemName,
      imageUrl: img,
      price: price,
      originalPrice: origPrice,
      discount: discount,
      soldPercentage: soldPct,
      soldPercentInt: soldPctInt,
      soldLabel: label,
      emoji: json['emoji']?.toString() ?? '⚡',
    );
  }
}

