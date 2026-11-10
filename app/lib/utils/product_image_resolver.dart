import '../config/api_config.dart';

/// Bộ phân giải URL hình ảnh sản phẩm từ Backend API ShopNova.
/// Chỉ chuẩn hóa URL ảnh thật (HTTPS hoặc /uploads/...), KHÔNG gán ảnh tĩnh mẫu.
class ProductImageResolver {
  /// Kiểm tra xem URL có phải là URL giả lập / không hợp lệ không
  static bool isDummyUrl(String? url) {
    if (url == null || url.trim().isEmpty) return true;
    final u = url.toLowerCase().trim();
    if (u.contains('cdn.shopnova.vn') ||
        u.contains('example.com') ||
        u.contains('example.test') ||
        u.contains('test-image') ||
        u.contains('via.placeholder.com') ||
        u.contains('dummyimage.com') ||
        u.contains('placeholder') ||
        u.contains('demo-image') ||
        u.contains('invalid') ||
        u.endsWith('/null') ||
        u.endsWith('/undefined')) {
      return true;
    }
    return false;
  }

  /// Chuẩn hóa URL ảnh: tự động ghép ApiConfig.baseUrl nếu là đường dẫn tương đối (/uploads/...)
  static String resolveUrl(String? url) {
    if (url == null || isDummyUrl(url)) return '';
    final trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '${ApiConfig.baseUrl}$trimmed';
    }
    return trimmed;
  }

  /// Chỉ trả về URL ảnh thực tế từ sản phẩm trên Server (rỗng nếu không có)
  static String resolve({
    String? id,
    String? imageUrl,
    String? categoryId,
    String? name,
  }) {
    final cleanUrl = resolveUrl(imageUrl);
    if (cleanUrl.isNotEmpty && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
      return cleanUrl;
    }
    return '';
  }

  /// Trả về danh sách ảnh thực tế từ API (không tự sinh ảnh giả)
  static List<String> resolveGallery({
    String? id,
    List<String>? images,
    String? categoryId,
    String? name,
  }) {
    final validList = <String>[];
    if (images != null) {
      for (final img in images) {
        final r = resolveUrl(img);
        if (r.isNotEmpty && !validList.contains(r)) {
          validList.add(r);
        }
      }
    }
    return validList;
  }
}
