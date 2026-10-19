class CartItemModel {
  final String id;
  final String variantId;
  final String productId;
  final String productName;
  final String productSlug;
  final String variantName;
  final double price;
  final double? originalPrice;
  int qty;
  bool selected;
  final String shopId;
  final String shopName;
  final bool shopMall;
  final String imageUrl;

  CartItemModel({
    required this.id,
    required this.variantId,
    required this.productId,
    required this.productName,
    required this.productSlug,
    required this.variantName,
    required this.price,
    this.originalPrice,
    required this.qty,
    this.selected = true,
    required this.shopId,
    required this.shopName,
    this.shopMall = false,
    required this.imageUrl,
  });

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    return CartItemModel(
      id: json['id']?.toString() ?? '',
      variantId: json['variantId']?.toString() ?? '1',
      productId: json['productId']?.toString() ?? '',
      productName: json['productName'] ?? 'Sản phẩm',
      productSlug: json['productSlug'] ?? '',
      variantName: json['variantName'] ?? '',
      price: (json['price'] != null) ? double.parse(json['price'].toString()) : 0.0,
      originalPrice: json['originalPrice'] != null ? double.parse(json['originalPrice'].toString()) : null,
      qty: (json['qty'] != null) ? int.parse(json['qty'].toString()) : 1,
      selected: json['selected'] ?? true,
      shopId: json['shopId']?.toString() ?? '1',
      shopName: json['shopName'] ?? 'ShopNova',
      shopMall: json['shopMall'] ?? false,
      imageUrl: json['imageUrl'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'variantId': variantId,
      'productId': productId,
      'productName': productName,
      'productSlug': productSlug,
      'variantName': variantName,
      'price': price,
      'originalPrice': originalPrice,
      'qty': qty,
      'selected': selected,
      'shopId': shopId,
      'shopName': shopName,
      'shopMall': shopMall,
      'imageUrl': imageUrl,
    };
  }
}
