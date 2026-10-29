import '../models/order.dart';
import 'api_client.dart';

/// Service quản lý đơn hàng phía người bán (Seller) của ShopNova
class SellerOrderService {
  static final SellerOrderService _instance = SellerOrderService._internal();
  factory SellerOrderService() => _instance;
  SellerOrderService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách đơn hàng con thuộc shop của người bán
  /// GET /api/v1/seller/orders?status=...&page=...&limit=...
  Future<List<ShopOrder>> getOrders({String? status, int page = 1, int limit = 20}) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null && status.isNotEmpty) {
      queryParams['status'] = status;
    }

    final response = await _client.get('/api/v1/seller/orders', queryParams: queryParams);

    if (response.success && response.data is List) {
      return (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => ShopOrder.fromJson(item))
          .toList();
    }

    return [];
  }

  /// Cập nhật trạng thái xử lý đơn hàng của shop
  /// PATCH /api/v1/seller/orders/:shopOrderId/status
  Future<bool> updateOrderStatus(
    String shopOrderId, {
    required String toStatus,
    String? note,
    String? cancelReason,
    String? trackingCode,
  }) async {
    final body = <String, dynamic>{
      'toStatus': toStatus,
    };
    if (note != null && note.isNotEmpty) body['note'] = note;
    if (cancelReason != null && cancelReason.isNotEmpty) body['cancelReason'] = cancelReason;
    if (trackingCode != null && trackingCode.isNotEmpty) body['trackingCode'] = trackingCode;

    final response = await _client.patch(
      '/api/v1/seller/orders/$shopOrderId/status',
      body: body,
    );

    return response.success;
  }
}
