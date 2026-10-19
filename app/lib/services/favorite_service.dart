import '../models/product.dart';
import 'api_client.dart';

/// Service quản lý sản phẩm yêu thích (Wishlist/Favorites) của người dùng
class FavoriteService {
  static final FavoriteService _instance = FavoriteService._internal();
  factory FavoriteService() => _instance;
  FavoriteService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách sản phẩm yêu thích của tài khoản đang đăng nhập
  /// GET /api/v1/favorites
  Future<List<Product>> getFavorites() async {
    final response = await _client.get('/api/v1/favorites');

    if (response.success && response.data is List) {
      return (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Product.fromJson(item))
          .toList();
    }

    return [];
  }

  /// Thêm một sản phẩm vào danh sách yêu thích
  /// POST /api/v1/favorites/:productId
  Future<bool> addFavorite(String productId) async {
    final response = await _client.post('/api/v1/favorites/$productId');
    return response.success;
  }

  /// Bỏ sản phẩm khỏi danh sách yêu thích
  /// DELETE /api/v1/favorites/:productId
  Future<bool> removeFavorite(String productId) async {
    final response = await _client.delete('/api/v1/favorites/$productId');
    return response.success;
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
