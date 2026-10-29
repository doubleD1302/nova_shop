/// Model chi tiết từng sản phẩm trong đơn hàng
class OrderItem {
  final String id;
  final String productId;
  final String variantId;
  final String productName;
  final String productSlug;
  final String variantName;
  final String sku;
  final String? imageUrl;
  final int unitPrice;
  final int qty;
  final int lineTotal;

  OrderItem({
    required this.id,
    required this.productId,
    required this.variantId,
    required this.productName,
    required this.productSlug,
    required this.variantName,
    required this.sku,
    this.imageUrl,
    required this.unitPrice,
    required this.qty,
    required this.lineTotal,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    final priceVal = json['unitPrice'] ?? json['price'] ?? json['unit_price'];
    final unitPrice = (priceVal is num)
        ? priceVal.toInt()
        : (int.tryParse(priceVal?.toString() ?? '') ?? 0);
    final qtyVal = json['qty'] ?? json['quantity'];
    final qty = (qtyVal is num)
        ? qtyVal.toInt()
        : (int.tryParse(qtyVal?.toString() ?? '') ?? 1);
    final lineTotalVal = json['lineTotal'] ?? json['line_total'];
    final lineTotal = (lineTotalVal is num)
        ? lineTotalVal.toInt()
        : (int.tryParse(lineTotalVal?.toString() ?? '') ?? (unitPrice * qty));

    return OrderItem(
      id: json['id']?.toString() ?? '',
      productId: json['productId']?.toString() ?? json['product_id']?.toString() ?? '',
      variantId: json['variantId']?.toString() ?? json['variant_id']?.toString() ?? '',
      productName: json['productName'] as String? ?? json['product_name'] as String? ?? 'Sản phẩm',
      productSlug: json['productSlug'] as String? ?? json['product_slug'] as String? ?? '',
      variantName: json['variantName'] as String? ?? json['variant_name'] as String? ?? 'Mặc định',
      sku: json['sku'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? json['image_url'] as String?,
      unitPrice: unitPrice,
      qty: qty,
      lineTotal: lineTotal,
    );
  }
}

/// Model đơn hàng riêng của từng gian hàng (Shop Order)
class ShopOrder {
  final String id;
  final String shopId;
  final String shopName;
  final String status;
  final int subtotal;
  final int shippingFee;
  final int discountAmount;
  final int totalAmount;
  final String shippingMethod;
  final String shippingName;
  final List<OrderItem> items;

  ShopOrder({
    required this.id,
    required this.shopId,
    required this.shopName,
    required this.status,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    required this.totalAmount,
    required this.shippingMethod,
    required this.shippingName,
    required this.items,
  });

  factory ShopOrder.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List? ?? [];
    return ShopOrder(
      id: json['id']?.toString() ?? '',
      shopId: json['shopId']?.toString() ?? '',
      shopName: json['shopName'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      subtotal: (json['subtotal'] is num) ? (json['subtotal'] as num).toInt() : 0,
      shippingFee: (json['shippingFee'] is num) ? (json['shippingFee'] as num).toInt() : 0,
      discountAmount: (json['discountAmount'] is num) ? (json['discountAmount'] as num).toInt() : 0,
      totalAmount: (json['totalAmount'] is num) ? (json['totalAmount'] as num).toInt() : 0,
      shippingMethod: json['shippingMethod'] as String? ?? 'standard',
      shippingName: json['shippingName'] as String? ?? 'Giao hàng tiêu chuẩn',
      items: rawItems
          .whereType<Map<String, dynamic>>()
          .map((item) => OrderItem.fromJson(item))
          .toList(),
    );
  }
}

/// Model đơn tổng một lần checkout
class Order {
  final String id;
  final String code;
  final String recipientName;
  final String recipientPhone;
  final String province;
  final String? district;
  final String? ward;
  final String addressDetail;
  final String? note;
  final String paymentMethod;
  final int subtotal;
  final int shippingFee;
  final int discountAmount;
  final int totalAmount;
  final List<ShopOrder> shopOrders;
  final String? createdAt;

  Order({
    required this.id,
    required this.code,
    required this.recipientName,
    required this.recipientPhone,
    required this.province,
    this.district,
    this.ward,
    required this.addressDetail,
    this.note,
    required this.paymentMethod,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    required this.totalAmount,
    required this.shopOrders,
    this.createdAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    final rawShops = json['shopOrders'] as List? ?? [];
    return Order(
      id: json['id']?.toString() ?? '',
      code: json['code'] as String? ?? '',
      recipientName: json['recipientName'] as String? ?? '',
      recipientPhone: json['recipientPhone'] as String? ?? '',
      province: json['province'] as String? ?? '',
      district: json['district'] as String?,
      ward: json['ward'] as String?,
      addressDetail: json['addressDetail'] as String? ?? '',
      note: json['note'] as String?,
      paymentMethod: json['paymentMethod'] as String? ?? 'cod',
      subtotal: (json['subtotal'] is num) ? (json['subtotal'] as num).toInt() : 0,
      shippingFee: (json['shippingFee'] is num) ? (json['shippingFee'] as num).toInt() : 0,
      discountAmount: (json['discountAmount'] is num) ? (json['discountAmount'] as num).toInt() : 0,
      totalAmount: (json['totalAmount'] is num) ? (json['totalAmount'] as num).toInt() : 0,
      shopOrders: rawShops
          .whereType<Map<String, dynamic>>()
          .map((item) => ShopOrder.fromJson(item))
          .toList(),
      createdAt: json['createdAt'] as String?,
    );
  }
}
