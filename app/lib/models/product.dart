class Product {
  final String id;
  final String name;
  final String imageUrl;
  final double price;
  final double originalPrice;
  final int discount;
  final double rating;
  final String soldCount;
  final List<String> badges;
  final bool isFavorite;

  const Product({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.price,
    required this.originalPrice,
    required this.discount,
    required this.rating,
    required this.soldCount,
    required this.badges,
    this.isFavorite = false,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawPrice = json['price'];
    final rawOrig = json['originalPrice'];
    final priceVal = (rawPrice is num) ? rawPrice.toDouble() : double.tryParse(rawPrice?.toString() ?? '0') ?? 0.0;
    final origVal = (rawOrig is num) ? rawOrig.toDouble() : double.tryParse(rawOrig?.toString() ?? '0') ?? priceVal;

    final rawSold = json['soldCount'];
    String soldStr = '0';
    if (rawSold is num) {
      if (rawSold >= 1000) {
        soldStr = 'Đã bán ${(rawSold / 1000).toStringAsFixed(1)}k';
      } else {
        soldStr = 'Đã bán $rawSold';
      }
    } else if (rawSold is String) {
      soldStr = rawSold;
    }

    final badgesList = <String>[];
    if (json['badges'] is List) {
      for (final b in json['badges']) {
        if (b != null) badgesList.add(b.toString());
      }
    } else {
      if (json['isMall'] == true) badgesList.add('Mall');
      if (json['freeShipping'] == true) badgesList.add('Freeship');
    }

    return Product(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      price: priceVal,
      originalPrice: origVal > 0 ? origVal : priceVal,
      discount: (json['discount'] as num?)?.toInt() ?? 0,
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      soldCount: soldStr,
      badges: badgesList,
      isFavorite: json['isFavorite'] == true,
    );
  }
}
