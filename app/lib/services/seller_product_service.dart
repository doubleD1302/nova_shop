import 'api_client.dart';

/// Dữ liệu sản phẩm trả về cho người bán
class SellerProductItem {
  final String id;
  final String shopId;
  final String categoryId;
  final String? categoryName;
  final String name;
  final String slug;
  final String? description;
  final String status;
  final double minPrice;
  final double maxPrice;
  final int totalStock;
  final String? imageUrl;
  final bool isFeatured;
  final bool isFlashSale;
  final bool freeShipping;
  final DateTime? createdAt;

  SellerProductItem({
    required this.id,
    required this.shopId,
    required this.categoryId,
    this.categoryName,
    required this.name,
    required this.slug,
    this.description,
    required this.status,
    required this.minPrice,
    required this.maxPrice,
    required this.totalStock,
    this.imageUrl,
    required this.isFeatured,
    required this.isFlashSale,
    required this.freeShipping,
    this.createdAt,
  });

  factory SellerProductItem.fromJson(Map<String, dynamic> json) {
    return SellerProductItem(
      id: json['id']?.toString() ?? '',
      shopId: json['shopId']?.toString() ?? '',
      categoryId: json['categoryId']?.toString() ?? '',
      categoryName: json['categoryName']?.toString(),
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      description: json['description']?.toString(),
      status: json['status']?.toString() ?? 'draft',
      minPrice: (json['minPrice'] as num?)?.toDouble() ?? 0.0,
      maxPrice: (json['maxPrice'] as num?)?.toDouble() ?? 0.0,
      totalStock: (json['totalStock'] as num?)?.toInt() ?? 0,
      imageUrl: json['imageUrl']?.toString(),
      isFeatured: json['isFeatured'] == true,
      isFlashSale: json['isFlashSale'] == true,
      freeShipping: json['freeShipping'] == true,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}

/// Service quản lý sản phẩm phía Người bán (Seller) của ShopNova
class SellerProductService {
  static final SellerProductService _instance = SellerProductService._internal();
  factory SellerProductService() => _instance;
  SellerProductService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách sản phẩm thuộc gian hàng của seller
  /// GET /api/v1/seller/products?status=...&page=...&limit=...
  Future<List<SellerProductItem>> getProducts({String? status, int page = 1, int limit = 20}) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null && status.isNotEmpty) queryParams['status'] = status;

    final response = await _client.get('/api/v1/seller/products', queryParams: queryParams);

    if (response.success && response.data is List) {
      return (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => SellerProductItem.fromJson(item))
          .toList();
    }

    return [];
  }

  /// Tạo mới sản phẩm cho gian hàng
  /// POST /api/v1/seller/products
  Future<ApiResponse> createProduct({
    required String name,
    required String categoryId,
    String? description,
    Map<String, dynamic>? specs,
    bool freeShipping = false,
    bool isFlashSale = false,
    bool isFeatured = false,
    List<String> images = const [],
    required List<Map<String, dynamic>> variants,
  }) async {
    return await _client.post(
      '/api/v1/seller/products',
      body: {
        'name': name,
        'categoryId': categoryId,
        'description': description,
        'specs': specs ?? {},
        'freeShipping': freeShipping,
        'isFlashSale': isFlashSale,
        'isFeatured': isFeatured,
        'images': images,
        'variants': variants,
      },
    );
  }

  /// Cập nhật sản phẩm
  /// PUT /api/v1/seller/products/:id
  Future<ApiResponse> updateProduct(String productId, Map<String, dynamic> updateData) async {
    return await _client.put(
      '/api/v1/seller/products/$productId',
      body: updateData,
    );
  }

  /// Xóa (lưu trữ) sản phẩm
  /// DELETE /api/v1/seller/products/:id
  Future<ApiResponse> deleteProduct(String productId) async {
    return await _client.delete('/api/v1/seller/products/$productId');
  }
}
