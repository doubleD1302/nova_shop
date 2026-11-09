import 'package:shared_preferences/shared_preferences.dart';
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

/// Service tương tác với Backend Shop API (/api/v1/shops/* và /api/v1/seller/shop*)
class ShopService {
  static final ShopService _instance = ShopService._internal();
  factory ShopService() => _instance;
  ShopService._internal();

  final ApiClient _client = ApiClient();
  static const String _followedShopsKey = 'shopnova_followed_shops';

  /// Lấy danh sách gian hàng trên sàn kèm bộ lọc, sắp xếp và phân trang
  /// GET /api/v1/shops (hỗ trợ: limit, offset, q, mall, featured)
  Future<ShopListResult> getShops({
    int page = 1,
    int limit = 20,
    bool? mall,
    bool? featured,
    String? keyword,
    String? province,
    String? sort,
  }) async {
    final safePage = page > 0 ? page : 1;
    final offset = (safePage - 1) * limit;
    final queryParams = <String, String>{
      'offset': offset.toString(),
      'limit': limit.toString(),
    };

    if (mall == true) queryParams['mall'] = '1';
    if (featured == true) queryParams['featured'] = '1';
    if (keyword != null && keyword.trim().isNotEmpty) queryParams['q'] = keyword.trim();

    final response = await _client.get('/api/v1/shops', queryParams: queryParams);

    if (response.success && response.data != null) {
      List<dynamic> rawList = [];
      int total = 0;
      if (response.data is List) {
        rawList = response.data as List;
        total = rawList.length;
      } else if (response.data is Map) {
        final m = response.data as Map;
        if (m['shops'] is List) rawList = m['shops'] as List;
        total = (m['total'] is num) ? (m['total'] as num).toInt() : rawList.length;
      }

      var list = rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => Shop.fromJson(item))
          .toList();

      if (province != null && province.trim().isNotEmpty) {
        final targetProv = province.trim().toLowerCase();
        list = list.where((s) => s.province.toLowerCase().contains(targetProv)).toList();
      }

      return ShopListResult(
        shops: list,
        total: total,
        page: page,
        limit: limit,
        totalPages: (total / (limit > 0 ? limit : 1)).ceil(),
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

  /// Lấy danh sách sản phẩm của gian hàng qua API chuẩn của Backend
  /// GET /api/v1/products?shopId=:shopId
  Future<ProductListResult> getShopProducts(
    String shopId, {
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? sort,
  }) async {
    final safePage = page > 0 ? page : 1;
    final offset = (safePage - 1) * limit;
    final queryParams = <String, String>{
      'shopId': shopId,
      'offset': offset.toString(),
      'limit': limit.toString(),
    };

    if (categoryId != null && categoryId.isNotEmpty) queryParams['categoryId'] = categoryId;
    if (sort != null && sort.isNotEmpty) queryParams['sort'] = sort;

    final response = await _client.get('/api/v1/products', queryParams: queryParams);

    if (response.success && response.data != null) {
      List<dynamic> rawList = [];
      int total = 0;
      if (response.data is List) {
        rawList = response.data as List;
        total = rawList.length;
      } else if (response.data is Map) {
        final m = response.data as Map;
        if (m['products'] is List) rawList = m['products'] as List;
        total = (m['total'] is num) ? (m['total'] as num).toInt() : rawList.length;
      }

      final list = rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => Product.fromJson(item))
          .toList();

      return ProductListResult(
        products: list,
        total: total,
        page: page,
        limit: limit,
        totalPages: (total / (limit > 0 ? limit : 1)).ceil(),
      );
    }

    return ProductListResult(products: [], total: 0, page: page, limit: limit, totalPages: 1);
  }

  /// Kiểm tra trạng thái theo dõi gian hàng
  Future<bool> getFollowStatus(String shopId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_followedShopsKey) ?? [];
      return list.contains(shopId);
    } catch (_) {
      return false;
    }
  }

  /// Theo dõi gian hàng
  Future<bool> followShop(String shopId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_followedShopsKey) ?? [];
      if (!list.contains(shopId)) {
        list.add(shopId);
        await prefs.setStringList(_followedShopsKey, list);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Hủy theo dõi gian hàng
  Future<bool> unfollowShop(String shopId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_followedShopsKey) ?? [];
      list.remove(shopId);
      await prefs.setStringList(_followedShopsKey, list);
      return true;
    } catch (_) {
      return false;
    }
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

  // ===================== SELLER SHOP APIS (Chủ sở hữu gian hàng) =====================

  /// Lấy thông tin hồ sơ gian hàng của chính seller hiện tại (kể cả pending/rejected)
  /// GET /api/v1/seller/shop
  Future<Shop?> getSellerShop() async {
    final response = await _client.get('/api/v1/seller/shop');
    if (response.success && response.data is Map<String, dynamic>) {
      final data = response.data as Map<String, dynamic>;
      if (data['shop'] is Map<String, dynamic>) {
        return Shop.fromJson(data['shop'] as Map<String, dynamic>);
      }
    }
    return null;
  }

  /// Cập nhật hồ sơ gian hàng của seller (pending, rejected hoặc active)
  /// PUT /api/v1/seller/shop
  Future<ApiResponse> updateSellerShop({
    required String name,
    String? tagline,
    String? description,
    required String province,
    String? address,
    String? logoUrl,
    String? bannerUrl,
  }) async {
    return await _client.put(
      '/api/v1/seller/shop',
      body: {
        'name': name.trim(),
        'tagline': tagline?.trim(),
        'description': description?.trim(),
        'province': province.trim(),
        'address': address?.trim(),
        if (logoUrl != null && logoUrl.trim().isNotEmpty) 'logoUrl': logoUrl.trim(),
        if (bannerUrl != null && bannerUrl.trim().isNotEmpty) 'bannerUrl': bannerUrl.trim(),
      },
    );
  }

  /// Gửi lại hồ sơ gian hàng sau khi bị từ chối (chuyển từ rejected -> pending)
  /// POST /api/v1/seller/shop/resubmit
  Future<ApiResponse> resubmitSellerShop() async {
    return await _client.post('/api/v1/seller/shop/resubmit');
  }
}
