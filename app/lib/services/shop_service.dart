import '../models/product.dart';
import '../models/shop.dart';
import 'api_client.dart';
import 'catalog_service.dart';

/// Kết quả phân trang danh sách gian hàng
class ShopListResult {
  final List<Shop> shops;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  ShopListResult({
    required this.shops,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });
}

/// Service tương tác với Backend Shop API (/api/v1/shops/*)
class ShopService {
  static final ShopService _instance = ShopService._internal();
  factory ShopService() => _instance;
  ShopService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách gian hàng trên sàn kèm bộ lọc, sắp xếp và phân trang
  /// GET /api/v1/shops
  Future<ShopListResult> getShops({
    int page = 1,
    int limit = 20,
    bool? mall,
    String? keyword,
    String? province,
    String? sort,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (mall != null) queryParams['mall'] = mall ? 'true' : 'false';
    if (keyword != null && keyword.trim().isNotEmpty) queryParams['keyword'] = keyword.trim();
    if (province != null && province.trim().isNotEmpty) queryParams['province'] = province.trim();
    if (sort != null && sort.isNotEmpty) queryParams['sort'] = sort;

    final response = await _client.get('/api/v1/shops', queryParams: queryParams);

    if (response.success && response.data is List) {
      final list = (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Shop.fromJson(item))
          .toList();

      final meta = response.meta ?? {};
      final total = (meta['total'] is num) ? (meta['total'] as num).toInt() : list.length;
      final totalPages = (meta['totalPages'] is num) ? (meta['totalPages'] as num).toInt() : 1;

      return ShopListResult(
        shops: list,
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages,
      );
    }

    return ShopListResult(shops: [], total: 0, page: page, limit: limit, totalPages: 1);
  }

  /// Lấy chi tiết gian hàng theo ID hoặc Slug
  /// GET /api/v1/shops/:shopId
  Future<Shop?> getShopDetail(String shopId) async {
    final response = await _client.get('/api/v1/shops/$shopId');

    if (response.success && response.data is Map<String, dynamic>) {
      return Shop.fromJson(response.data as Map<String, dynamic>);
    }

    return null;
  }

  /// Lấy danh sách sản phẩm của gian hàng
  /// GET /api/v1/shops/:shopId/products
  Future<ProductListResult> getShopProducts(
    String shopId, {
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? sort,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (categoryId != null && categoryId.isNotEmpty) queryParams['categoryId'] = categoryId;
    if (sort != null && sort.isNotEmpty) queryParams['sort'] = sort;

    final response = await _client.get('/api/v1/shops/$shopId/products', queryParams: queryParams);

    if (response.success && response.data is List) {
      final list = (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Product.fromJson(item))
          .toList();

      final meta = response.meta ?? {};
      final total = (meta['total'] is num) ? (meta['total'] as num).toInt() : list.length;
      final totalPages = (meta['totalPages'] is num) ? (meta['totalPages'] as num).toInt() : 1;

      return ProductListResult(
        products: list,
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages,
      );
    }

    return ProductListResult(products: [], total: 0, page: page, limit: limit, totalPages: 1);
  }

  /// Kiểm tra trạng thái theo dõi gian hàng
  /// GET /api/v1/shops/:shopId/follow
  Future<bool> getFollowStatus(String shopId) async {
    final response = await _client.get('/api/v1/shops/$shopId/follow');
    if (response.success && response.data is Map<String, dynamic>) {
      return response.data['isFollowing'] == true;
    }
    return false;
  }

  /// Theo dõi gian hàng
  /// POST /api/v1/shops/:shopId/follow
  Future<bool> followShop(String shopId) async {
    final response = await _client.post('/api/v1/shops/$shopId/follow');
    return response.success;
  }

  /// Hủy theo dõi gian hàng
  /// DELETE /api/v1/shops/:shopId/follow
  Future<bool> unfollowShop(String shopId) async {
    final response = await _client.delete('/api/v1/shops/$shopId/follow');
    return response.success;
  }

  /// Bật / tắt theo dõi gian hàng
  Future<bool> toggleFollow(String shopId, bool isCurrentlyFollowing) async {
    if (isCurrentlyFollowing) {
      final ok = await unfollowShop(shopId);
      return ok ? false : true;
    } else {
      final ok = await followShop(shopId);
      return ok ? true : false;
    }
  }
}

