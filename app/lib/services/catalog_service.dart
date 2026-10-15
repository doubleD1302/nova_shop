import '../models/product.dart';
import 'api_client.dart';

/// Service xử lý lấy danh mục và danh sách sản phẩm từ Backend MySQL
class CatalogService {
  static final CatalogService _instance = CatalogService._internal();
  factory CatalogService() => _instance;
  CatalogService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách ngành hàng/danh mục từ Backend
  /// GET /api/v1/categories
  Future<List<Map<String, dynamic>>> getCategories() async {
    final response = await _client.get('/api/v1/categories');

    if (response.success && response.data is List) {
      return (response.data as List)
          .whereType<Map<String, dynamic>>()
          .toList();
    }

    return [];
  }

  /// Lấy danh sách sản phẩm công khai kèm phân trang và bộ lọc
  /// GET /api/v1/products?page=1&limit=24&categoryId=...&q=...&sort=...
  Future<ProductListResult> getProducts({
    int page = 1,
    int limit = 24,
    String? categoryId,
    String? shopId,
    String? q,
    String? sort,
    double? minPrice,
    double? maxPrice,
    String? province,
    bool? mall,
    bool? freeship,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (categoryId != null && categoryId.isNotEmpty) queryParams['categoryId'] = categoryId;
    if (shopId != null && shopId.isNotEmpty) queryParams['shopId'] = shopId;
    if (q != null && q.trim().isNotEmpty) queryParams['q'] = q.trim();
    if (sort != null && sort.isNotEmpty) queryParams['sort'] = sort;
    if (minPrice != null && minPrice >= 0) queryParams['minPrice'] = minPrice.toInt().toString();
    if (maxPrice != null && maxPrice > 0) queryParams['maxPrice'] = maxPrice.toInt().toString();
    if (province != null && province.isNotEmpty) queryParams['province'] = province;
    if (mall == true) queryParams['mall'] = 'true';
    if (freeship == true) queryParams['freeship'] = 'true';

    final response = await _client.get('/api/v1/products', queryParams: queryParams);

    if (response.success && response.data is List) {
      final list = (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Product.fromJson(item))
          .toList();

      return ProductListResult(
        products: list,
        page: (response.meta?['page'] as num?)?.toInt() ?? page,
        limit: (response.meta?['limit'] as num?)?.toInt() ?? limit,
        total: (response.meta?['total'] as num?)?.toInt() ?? list.length,
        totalPages: (response.meta?['totalPages'] as num?)?.toInt() ?? 1,
      );
    }

    return ProductListResult(products: [], page: page, limit: limit, total: 0, totalPages: 0);
  }

  /// Lấy thông tin chi tiết một sản phẩm kèm SKU biến thể và specs
  /// GET /api/v1/products/:idOrSlug
  Future<Map<String, dynamic>?> getProductDetail(String idOrSlug) async {
    final response = await _client.get('/api/v1/products/$idOrSlug');

    if (response.success && response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }

    return null;
  }
}

/// Kết quả phân trang danh sách sản phẩm
class ProductListResult {
  final List<Product> products;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const ProductListResult({
    required this.products,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });
}
