import 'package:shared_preferences/shared_preferences.dart';
import '../models/product.dart';
import 'api_client.dart';

/// Service quản lý sản phẩm yêu thích (Wishlist/Favorites) của người dùng
/// Truy vấn chi tiết sản phẩm trực tiếp qua GET /api/v1/products?ids=...
class FavoriteService {
  static final FavoriteService _instance = FavoriteService._internal();
  factory FavoriteService() => _instance;
  FavoriteService._internal();

  final ApiClient _client = ApiClient();
  static const String _favIdsKey = 'shopnova_favorite_product_ids';

  /// Lấy danh sách sản phẩm yêu thích từ Backend qua GET /api/v1/products?ids=...
  Future<List<Product>> getFavorites() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = prefs.getStringList(_favIdsKey) ?? [];
      if (ids.isEmpty) return [];

      final response = await _client.get(
        '/api/v1/products',
        queryParams: {'ids': ids.join(','), 'limit': ids.length.toString()},
      );

      if (response.success && response.data != null) {
        List<dynamic> rawList = [];
        if (response.data is List) {
          rawList = response.data as List;
        } else if (response.data is Map && response.data['products'] is List) {
          rawList = response.data['products'] as List;
        }
        return rawList
            .whereType<Map<String, dynamic>>()
            .map((item) => Product.fromJson(item))
            .toList();
      }
    } catch (_) {}

    return [];
  }

  /// Thêm một sản phẩm vào danh sách yêu thích
  Future<bool> addFavorite(String productId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = prefs.getStringList(_favIdsKey) ?? [];
      if (!ids.contains(productId)) {
        ids.add(productId);
        await prefs.setStringList(_favIdsKey, ids);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Bỏ sản phẩm khỏi danh sách yêu thích
  Future<bool> removeFavorite(String productId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final ids = prefs.getStringList(_favIdsKey) ?? [];
      ids.remove(productId);
      await prefs.setStringList(_favIdsKey, ids);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Bật / tắt trạng thái yêu thích
  Future<bool> toggleFavorite(String productId, bool currentStatus) async {
    if (currentStatus) {
      return await removeFavorite(productId);
    } else {
      return await addFavorite(productId);
    }
  }
}
