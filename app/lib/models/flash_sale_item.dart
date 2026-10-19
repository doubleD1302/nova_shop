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

    return FlashSaleItem(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      price: price,
      discount: discount,
      soldPercentage: soldPct,
      soldLabel: label,
      emoji: json['emoji']?.toString() ?? '⚡',
    );
  }
}
