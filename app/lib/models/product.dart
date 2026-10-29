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
}
