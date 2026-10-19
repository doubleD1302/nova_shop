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
  final bool isFlashSale;
  final bool isFeatured;
  final String shopName;
  final String categoryName;
  final String description;
  final List<String> images;
  final Map<String, dynamic> specs;

  final String emoji;
  final String location;
  final int soldPercent;
  final String categoryId;
  final String shopId;

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
    this.isFlashSale = false,
    this.isFeatured = false,
    this.shopName = '',
    this.categoryName = '',
    this.description = '',
    this.images = const [],
    this.specs = const {},
    this.emoji = '🛍️',
    this.location = 'TP. Hồ Chí Minh',
    this.soldPercent = 50,
    this.categoryId = '',
    this.shopId = '',
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawBadges = json['badges'];
    List<String> badges = [];
    if (rawBadges is List) {
      badges = rawBadges.map((e) => e.toString()).toList();
    }

    final rawImages = json['images'];
    List<String> images = [];
    if (rawImages is List) {
      images = rawImages.map((e) => e.toString()).toList();
    }

    final rawSpecs = json['specs'];
    Map<String, dynamic> specs = {};
    if (rawSpecs is Map) {
      specs = Map<String, dynamic>.from(rawSpecs);
    }

    final price = (json['price'] as num?)?.toDouble() ?? 0.0;
    final origPrice = (json['originalPrice'] as num?)?.toDouble() ?? price;
    final discount = (json['discount'] as num?)?.toInt() ?? 0;
    final rating = (json['rating'] as num?)?.toDouble() ?? 4.9;

    return Product(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? (images.isNotEmpty ? images.first : ''),
      price: price,
      originalPrice: origPrice,
      discount: discount,
      rating: rating,
      soldCount: json['soldCount']?.toString() ?? 'Đã bán 1.2k',
      badges: badges,
      isFlashSale: json['isFlashSale'] == true || badges.contains('flash') || badges.contains('Flash Sale'),
      isFeatured: json['isFeatured'] == true,
      shopName: json['shopName']?.toString() ?? '',
      categoryName: json['categoryName']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      images: images,
      specs: specs,
      emoji: json['emoji']?.toString() ?? '🛍️',
      location: json['location']?.toString() ?? 'TP. Hồ Chí Minh',
      soldPercent: (json['soldPercent'] as num?)?.toInt() ?? 50,
      categoryId: json['categoryId']?.toString() ?? '',
      shopId: json['shopId']?.toString() ?? '',
    );
  }
}
