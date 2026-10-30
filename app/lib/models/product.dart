import '../utils/product_image_resolver.dart';

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
  final int stock;
  final List<Map<String, dynamic>> variants;

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
    this.stock = 120,
    this.variants = const [],
  });

  /// Luôn trả về hình ảnh thật chuẩn mực sắc nét của sản phẩm
  String get effectiveImageUrl => ProductImageResolver.resolve(
        id: id,
        imageUrl: imageUrl,
        categoryId: categoryId,
        name: name,
      );

  Product copyWith({
    String? id,
    String? name,
    String? imageUrl,
    double? price,
    double? originalPrice,
    int? discount,
    double? rating,
    String? soldCount,
    List<String>? badges,
    bool? isFavorite,
    bool? isFlashSale,
    bool? isFeatured,
    String? shopName,
    String? categoryName,
    String? description,
    List<String>? images,
    Map<String, dynamic>? specs,
    String? emoji,
    String? location,
    int? soldPercent,
    String? categoryId,
    String? shopId,
    int? stock,
    List<Map<String, dynamic>>? variants,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      imageUrl: imageUrl ?? this.imageUrl,
      price: price ?? this.price,
      originalPrice: originalPrice ?? this.originalPrice,
      discount: discount ?? this.discount,
      rating: rating ?? this.rating,
      soldCount: soldCount ?? this.soldCount,
      badges: badges ?? this.badges,
      isFavorite: isFavorite ?? this.isFavorite,
      isFlashSale: isFlashSale ?? this.isFlashSale,
      isFeatured: isFeatured ?? this.isFeatured,
      shopName: shopName ?? this.shopName,
      categoryName: categoryName ?? this.categoryName,
      description: description ?? this.description,
      images: images ?? this.images,
      specs: specs ?? this.specs,
      emoji: emoji ?? this.emoji,
      location: location ?? this.location,
      soldPercent: soldPercent ?? this.soldPercent,
      categoryId: categoryId ?? this.categoryId,
      shopId: shopId ?? this.shopId,
      stock: stock ?? this.stock,
      variants: variants ?? this.variants,
    );
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawPrice = json['price'];
    final rawOrig = json['originalPrice'];
    final priceVal = (rawPrice is num) ? rawPrice.toDouble() : double.tryParse(rawPrice?.toString() ?? '0') ?? 0.0;
    final origVal = (rawOrig is num) ? rawOrig.toDouble() : double.tryParse(rawOrig?.toString() ?? '0') ?? priceVal;

    final rawSold = json['soldCount'] ?? json['sold'];
    String soldStr = '0';
    if (rawSold is num) {
      if (rawSold >= 1000) {
        soldStr = 'Đã bán ${(rawSold / 1000).toStringAsFixed(1)}k';
      } else {
        soldStr = 'Đã bán $rawSold';
      }
    } else if (rawSold != null) {
      soldStr = rawSold.toString();
    } else {
      soldStr = 'Đã bán 1.2k';
    }

    final rawBadges = json['badges'];
    List<String> badges = [];
    if (rawBadges is List) {
      badges = rawBadges.where((e) => e != null).map((e) => e.toString()).toList();
    } else {
      if (json['isMall'] == true || json['mall'] == true) badges.add('MALL');
      if (json['freeShipping'] == true || json['freeship'] == true) badges.add('Freeship');
    }

    final rawImages = json['images'] ?? json['gallery'];
    List<String> images = [];
    if (rawImages is List) {
      images = rawImages.where((e) => e != null).map((e) {
        if (e is Map && e['url'] != null) return e['url'].toString();
        return e.toString();
      }).toList();
    }

    final rawSpecs = json['specs'];
    Map<String, dynamic> specs = {};
    if (rawSpecs is Map) {
      specs = Map<String, dynamic>.from(rawSpecs);
    } else if (rawSpecs is List) {
      for (final item in rawSpecs) {
        if (item is List && item.length >= 2) {
          specs[item[0].toString()] = item[1].toString();
        }
      }
    }

    final rawVariants = json['variants'];
    List<Map<String, dynamic>> variants = [];
    if (rawVariants is List) {
      variants = rawVariants.whereType<Map<String, dynamic>>().toList();
    }

    final rawStock = json['stock'];
    final stockVal = (rawStock is num) ? rawStock.toInt() : (int.tryParse(rawStock?.toString() ?? '') ?? 120);

    final discount = (json['discount'] as num?)?.toInt() ?? 0;
    final rating = (json['rating'] as num?)?.toDouble() ?? 4.9;
    
    final shopObj = json['shop'];
    final sName = (shopObj is Map && shopObj['name'] != null)
        ? shopObj['name'].toString()
        : (json['shopName']?.toString() ?? '');
    final sId = (shopObj is Map && shopObj['id'] != null)
        ? shopObj['id'].toString()
        : (json['shopId']?.toString() ?? '');

    final catObj = json['category'];
    final cName = (catObj is Map && catObj['name'] != null)
        ? catObj['name'].toString()
        : (json['categoryName']?.toString() ?? '');
    final cId = (catObj is Map && catObj['id'] != null)
        ? catObj['id'].toString()
        : (json['categoryId']?.toString() ?? '');

    final loc = (shopObj is Map && shopObj['province'] != null)
        ? shopObj['province'].toString()
        : (json['province']?.toString() ?? json['location']?.toString() ?? 'TP. Hồ Chí Minh');

    final prodId = json['id']?.toString() ?? '';
    final prodName = json['name']?.toString() ?? '';

    // Phân giải hình ảnh thật: ưu tiên imageUrl từ API, rồi images list, rồi phân giải tự động
    String img = json['imageUrl']?.toString() ?? (images.isNotEmpty ? images.first : '');
    img = ProductImageResolver.resolve(
      id: prodId,
      imageUrl: img,
      categoryId: cId,
      name: prodName,
    );

    return Product(
      id: prodId,
      name: prodName,
      imageUrl: img,
      price: priceVal,
      originalPrice: origVal > 0 ? origVal : priceVal,
      discount: discount,
      rating: rating,
      soldCount: soldStr,
      badges: badges,
      isFavorite: json['isFavorite'] == true,
      isFlashSale: json['isFlashSale'] == true || badges.contains('flash') || badges.contains('Flash Sale'),
      isFeatured: json['isFeatured'] == true,
      shopName: sName,
      categoryName: cName,
      description: json['description']?.toString() ?? '',
      images: images.isNotEmpty ? images : [img],
      specs: specs,
      emoji: json['emoji']?.toString() ?? '🛍️',
      location: loc,
      soldPercent: (json['soldPercent'] as num?)?.toInt() ?? 50,
      categoryId: cId,
      shopId: sId,
      stock: stockVal,
      variants: variants,
    );
  }
}

