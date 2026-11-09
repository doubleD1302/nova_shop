import '../models/order.dart';
import 'api_client.dart';

/// Service quản lý đơn hàng phía người bán (Seller) của ShopNova
class SellerOrderService {
  static final SellerOrderService _instance = SellerOrderService._internal();
  factory SellerOrderService() => _instance;
  SellerOrderService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách đơn hàng con thuộc shop của người bán
  /// GET /api/v1/seller/orders?limit=...&offset=...
  Future<List<ShopOrder>> getOrders({String? status, int page = 1, int limit = 20}) async {
    final safePage = page > 0 ? page : 1;
    final offset = (safePage - 1) * limit;
    final queryParams = <String, String>{
      'offset': offset.toString(),
      'limit': limit.toString(),
    };

    final response = await _client.get('/api/v1/seller/orders', queryParams: queryParams);

    if (response.success && response.data != null) {
      List<dynamic> rawList = [];
      if (response.data is List) {
        rawList = response.data as List;
      } else if (response.data is Map && response.data['orders'] is List) {
        rawList = response.data['orders'] as List;
      }

      var list = rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => ShopOrder.fromJson(item))
          .toList();

      if (status != null && status.isNotEmpty) {
        list = list.where((o) => o.status == status).toList();
      }
      return list;
    }

    return [];
  }

  /// Lấy kèm summary thống kê đơn hàng từ GET /api/v1/seller/orders
  Future<Map<String, dynamic>> getOrdersWithSummary({int limit = 50, int offset = 0}) async {
    final response = await _client.get(
      '/api/v1/seller/orders',
      queryParams: {'limit': limit.toString(), 'offset': offset.toString()},
    );
    if (response.success && response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    return {'orders': [], 'summary': {}, 'total': 0};
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
      'status': toStatus,
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

  /// Cập nhật mã vận đơn (Tracking Code & Carrier) cho đơn hàng của shop
  /// PATCH /api/v1/seller/orders/:shopOrderId/tracking
  Future<bool> updateOrderTracking(
    String shopOrderId, {
    required String trackingCode,
    String? carrier,
    bool autoAdvanceStatus = true,
  }) async {
    final response = await _client.patch(
      '/api/v1/seller/orders/$shopOrderId/tracking',
      body: {
        'trackingCode': trackingCode.trim(),
        if (carrier != null && carrier.isNotEmpty) 'carrier': carrier.trim(),
        'autoAdvanceStatus': autoAdvanceStatus,
      },
    );
    return response.success;
  }

  /// Lấy danh sách yêu cầu trả hàng / hoàn tiền của shop
  /// GET /api/v1/seller/returns
  Future<List<Map<String, dynamic>>> getSellerReturns({String? status, int limit = 20, int offset = 0}) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
      if (status != null && status.isNotEmpty) 'status': status,
    };
    final response = await _client.get('/api/v1/seller/returns', queryParams: queryParams);
    if (response.success && response.data != null) {
      if (response.data is Map && response.data['returns'] is List) {
        return (response.data['returns'] as List).whereType<Map<String, dynamic>>().toList();
      } else if (response.data is List) {
        return (response.data as List).whereType<Map<String, dynamic>>().toList();
      }
    }
    return [];
  }

  /// Phản hồi yêu cầu trả hàng / hoàn tiền (approve / reject)
  /// PATCH /api/v1/seller/returns/:returnId/status
  Future<bool> updateSellerReturnStatus(String returnId, {required String status, String? sellerNote}) async {
    final response = await _client.patch(
      '/api/v1/seller/returns/$returnId/status',
      body: {
        'status': status,
        if (sellerNote != null && sellerNote.isNotEmpty) 'sellerNote': sellerNote,
      },
    );
    return response.success;
  }
}
