import '../utils/product_image_resolver.dart';

class FlashSaleItem {
  final String id;
  final String name;
  final String imageUrl;
  final double price;
  final int discount;
  final double soldPercentage;
  final String soldLabel;
  final String emoji;

  const FlashSaleItem({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.price,
    required this.discount,
    required this.soldPercentage,
    required this.soldLabel,
    this.emoji = '⚡',
  });

  /// Luôn trả về hình ảnh thật sắc nét cho sản phẩm Flash Sale
  String get effectiveImageUrl => ProductImageResolver.resolve(
        id: id,
        imageUrl: imageUrl,
        name: name,
      );

  factory FlashSaleItem.fromJson(Map<String, dynamic> json) {
    final price = (json['price'] as num?)?.toDouble() ?? 0.0;
    final discount = (json['discount'] as num?)?.toInt() ?? 0;
    final totalStock = (json['totalStock'] as num?)?.toInt() ?? 100;

    double soldPct = 0.75;
    String label = 'ĐANG BÁN CHẠY';
    if (totalStock < 50) {
      soldPct = 0.90;
      label = 'SẮP CHÁY HÀNG';
    }

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
      discount: discount,
      soldPercentage: soldPct,
      soldLabel: label,
      emoji: json['emoji']?.toString() ?? '⚡',
    );
  }
}

