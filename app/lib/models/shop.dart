/// Model đại diện cho Gian hàng trên sàn ShopNova
class Shop {
  final String id;
  final String name;
  final String slug;
  final String? logoUrl;
  final String? bannerUrl;
  final String? tagline;
  final String? description;
  final String province;
  final bool isMall;
  final double rating;
  final int ratingCount;
  final int followersCount;
  final int productsCount;

  Shop({
    required this.id,
    required this.name,
    required this.slug,
    this.logoUrl,
    this.bannerUrl,
    this.tagline,
    this.description,
    required this.province,
    this.isMall = false,
    this.rating = 5.0,
    this.ratingCount = 0,
    this.followersCount = 0,
    this.productsCount = 0,
  });

  factory Shop.fromJson(Map<String, dynamic> json) {
    return Shop(
      id: json['id']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      logoUrl: json['logoUrl'] as String?,
      bannerUrl: json['bannerUrl'] as String?,
      tagline: json['tagline'] as String?,
      description: json['description'] as String?,
      province: json['province'] as String? ?? '',
      isMall: json['isMall'] as bool? ?? false,
      rating: (json['rating'] is num) ? (json['rating'] as num).toDouble() : 5.0,
      ratingCount: (json['ratingCount'] is num) ? (json['ratingCount'] as num).toInt() : 0,
      followersCount: (json['followersCount'] is num) ? (json['followersCount'] as num).toInt() : 0,
      productsCount: (json['productsCount'] is num) ? (json['productsCount'] as num).toInt() : 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      'logoUrl': logoUrl,
      'bannerUrl': bannerUrl,
      'tagline': tagline,
      'description': description,
      'province': province,
      'isMall': isMall,
      'rating': rating,
      'ratingCount': ratingCount,
      'followersCount': followersCount,
      'productsCount': productsCount,
    };
  }
}
