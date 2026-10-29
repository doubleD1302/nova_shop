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
      variantId: json['variantId']?.toString() ?? json['id']?.toString() ?? '1',
      productId: json['productId']?.toString() ?? json['product_id']?.toString() ?? '',
      productName: json['productName'] ?? json['name'] ?? 'Sản phẩm',
      productSlug: json['productSlug'] ?? json['slug'] ?? '',
      variantName: json['variantName'] ?? json['sku_name'] ?? json['variant'] ?? 'Mặc định',
      price: (json['price'] != null) ? (double.tryParse(json['price'].toString()) ?? 0.0) : 0.0,
      originalPrice: json['originalPrice'] != null ? double.tryParse(json['originalPrice'].toString()) : null,
      qty: (json['qty'] != null) ? (int.tryParse(json['qty'].toString()) ?? 1) : 1,
      selected: json['selected'] ?? true,
      shopId: json['shopId']?.toString() ?? json['shop_id']?.toString() ?? '1',
      shopName: json['shopName'] ?? json['shop_name'] ?? 'ShopNova',
      shopMall: json['shopMall'] ?? json['shop_mall'] ?? false,
      imageUrl: json['imageUrl'] ?? json['image_url'] ?? json['image'] ?? '',
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
