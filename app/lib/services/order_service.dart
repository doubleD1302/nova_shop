import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/order.dart';
import 'api_client.dart';
import '../config/api_config.dart';
import 'auth_service.dart';

/// Kết quả phân trang danh sách đơn hàng
class OrderListResult {
  final List<Order> orders;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  OrderListResult({
    required this.orders,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });
}

/// Service xử lý đặt hàng và quản lý đơn hàng với Backend API
class OrderService {
  static final OrderService _instance = OrderService._internal();
  factory OrderService() => _instance;
  OrderService._internal() {
    _loadLocalOrdersFromPrefs();
  }

  static const String _storageKey = 'shopnova_local_orders_v2';
  final ApiClient _client = ApiClient();
  final List<Map<String, dynamic>> _localOrders = [];
  bool _isLocalLoaded = false;
  String? _lastError;
  String? get lastError => _lastError;

  Future<void> _loadLocalOrdersFromPrefs() async {
    if (_isLocalLoaded) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final List list = jsonDecode(raw);
        for (final item in list) {
          if (item is Map<String, dynamic>) {
            final normalized = _normalizeOrder(item);
            if (!_localOrders.any((o) => o['id']?.toString() == normalized['id']?.toString() || o['code'] == normalized['code'])) {
              _localOrders.add(normalized);
            }
          }
        }
      }
      _isLocalLoaded = true;
    } catch (e) {
      debugPrint('[OrderService] load local orders error: $e');
    }
  }

  Future<void> _saveLocalOrdersToPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, jsonEncode(_localOrders));
    } catch (e) {
      debugPrint('[OrderService] save local orders error: $e');
    }
  }

  /// Chuẩn hóa toàn diện thông tin đơn hàng và từng mặt hàng
  Map<String, dynamic> _normalizeOrder(Map<String, dynamic> o) {
    final order = Map<String, dynamic>.from(o);
    final totalAmount = num.tryParse((order['totalAmount'] ?? order['total_amount'] ?? 0).toString()) ?? 0;

    List<dynamic> rawItems = [];
    if (order['items'] is List && (order['items'] as List).isNotEmpty) {
      rawItems = List<dynamic>.from(order['items'] as List);
    } else if (order['shopOrders'] is List) {
      for (final so in order['shopOrders'] as List) {
        if (so is Map && so['items'] is List) {
          rawItems.addAll(so['items'] as List);
        }
      }
    }

    final normalizedItems = rawItems.map((it) {
      if (it is! Map) return it;
      final m = Map<String, dynamic>.from(it);
      final rawPrice = m['unitPrice'] ?? m['unit_price'] ?? m['price'] ?? m['lineTotal'] ?? m['line_total'];
      num unitPrice = num.tryParse(rawPrice?.toString() ?? '') ?? 0;
      if (unitPrice <= 0 && totalAmount > 0 && rawItems.isNotEmpty) {
        final qty = num.tryParse((m['qty'] ?? m['quantity'] ?? 1).toString()) ?? 1;
        unitPrice = (totalAmount / rawItems.length) / (qty > 0 ? qty : 1);
      }
      final qty = num.tryParse((m['qty'] ?? m['quantity'] ?? 1).toString()) ?? 1;
      final lineTotal = unitPrice * qty;

      m['price'] = unitPrice;
      m['unitPrice'] = unitPrice;
      m['unit_price'] = unitPrice;
      m['lineTotal'] = lineTotal;
      m['line_total'] = lineTotal;
      m['qty'] = qty.toInt();
      m['quantity'] = qty.toInt();
      m['variantName'] ??= m['variant_name'] ?? 'Mặc định';
      m['variant_name'] ??= m['variantName'];
      m['productName'] ??= m['product_name'] ?? 'Sản phẩm ShopNova';
      m['product_name'] ??= m['productName'];
      m['imageUrl'] ??= m['image_url'] ?? m['image'] ?? '';
      m['image_url'] ??= m['imageUrl'];
      return m;
    }).toList();

    order['items'] = normalizedItems;
    order['totalAmount'] = totalAmount;
    order['total_amount'] = totalAmount;
    return order;
  }

  /// Lấy danh sách đơn mua của người dùng (kết hợp cả Backend API và đơn hàng đã lưu)
  Future<List<Map<String, dynamic>>> fetchOrders() async {
    await _loadLocalOrdersFromPrefs();
    final token = AuthService().token;
    final List<Map<String, dynamic>> combined = _localOrders.map((o) => _normalizeOrder(o)).toList();

    if (token != null) {
      try {
        final response = await http.get(
          Uri.parse(ApiConfig.ordersUrl),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ).timeout(const Duration(seconds: 15));

        if (response.statusCode == 200) {
          final body = jsonDecode(response.body);
          List<dynamic> rawList = [];
          if (body['success'] == true && body['data'] != null) {
            if (body['data'] is List) {
              rawList = body['data'] as List;
            } else if (body['data'] is Map && body['data']['orders'] is List) {
              rawList = body['data']['orders'] as List;
            }
          }
          if (rawList.isNotEmpty) {
            final apiOrders = rawList.whereType<Map<String, dynamic>>().toList();
            for (final o in apiOrders) {
              final normalized = _normalizeOrder(o);
              if (!combined.any((c) => c['id']?.toString() == normalized['id']?.toString() || c['code'] == normalized['code'])) {
                combined.add(normalized);
              }
            }
          }
        }
      } catch (e) {
        debugPrint('[OrderService] fetchOrders API error: $e');
      }
    }

    combined.sort((a, b) {
      final aDate = a['createdAt']?.toString() ?? '';
      final bDate = b['createdAt']?.toString() ?? '';
      return bDate.compareTo(aDate);
    });

    return combined;
  }

  /// Xem trước tính toán đơn hàng (phí ship theo shop, giảm giá voucher, tổng thanh toán)
  /// POST /api/v1/orders/preview
  Future<Map<String, dynamic>?> previewOrder({
    required List<Map<String, dynamic>> items,
    String shippingMethod = 'tietkiem',
    String? voucherCode,
  }) async {
    final token = AuthService().token;
    if (token == null) return null;

    final cleanItems = items.map((it) {
      final vId = it['variantId']?.toString() ?? it['variant_id']?.toString() ?? '1';
      final qty = (it['qty'] is num) ? (it['qty'] as num).toInt() : 1;
      return {'variantId': vId, 'qty': qty};
    }).toList();

    try {
      final response = await http
          .post(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/orders/preview'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'items': cleanItems,
              'shippingMethod': shippingMethod,
              if (voucherCode != null && voucherCode.trim().isNotEmpty) 'voucherCode': voucherCode.trim(),
            }),
          )
          .timeout(const Duration(seconds: 10));

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        return body['data'] as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('[OrderService] previewOrder error: $e');
    }
    return null;
  }

  /// Tạo đơn hàng mới trên Backend API
  Future<Map<String, dynamic>?> createOrder({
    required String recipientName,
    required String recipientPhone,
    required String province,
    String? district,
    String? ward,
    required String addressDetail,
    String? note,
    String paymentMethod = 'cod',
    String shippingMethod = 'tietkiem',
    String? voucherCode,
    String? idempotencyKey,
    required List<Map<String, dynamic>> items,
  }) async {
    _lastError = null;

    final token = AuthService().token;
    Map<String, dynamic>? createdOrder;

    final now = DateTime.now();
    final key = (idempotencyKey != null && idempotencyKey.length >= 16 && idempotencyKey.length <= 64)
        ? idempotencyKey
        : 'ord_${now.millisecondsSinceEpoch}_${(now.microsecond % 100000).toString().padLeft(5, '0')}';

    final cleanItems = items.map((it) {
      final vId = it['variantId']?.toString() ?? it['variant_id']?.toString() ?? '1';
      final qty = (it['qty'] is num) ? (it['qty'] as num).toInt() : 1;
      return {'variantId': vId, 'qty': qty};
    }).toList();

    if (token != null) {
      try {
        final payload = {
          'items': cleanItems,
          'address': {
            'fullName': recipientName.trim(),
            'phone': recipientPhone.trim(),
            'province': province.trim().isNotEmpty ? province.trim() : 'TP. Hồ Chí Minh',
            'district': district?.trim().isNotEmpty == true ? district!.trim() : 'Quận 1',
            'ward': ward?.trim().isNotEmpty == true ? ward!.trim() : 'Phường Bến Nghé',
            'detail': addressDetail.trim().isNotEmpty ? addressDetail.trim() : 'Địa chỉ nhận hàng',
          },
          'paymentMethod': paymentMethod,
          'shippingMethod': shippingMethod,
          if (voucherCode != null && voucherCode.trim().isNotEmpty) 'voucherCode': voucherCode.trim(),
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        };

        final response = await http
            .post(
              Uri.parse(ApiConfig.ordersUrl),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
                'idempotency-key': key,
              },
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 25));

        final body = jsonDecode(response.body);
        if ((response.statusCode == 200 || response.statusCode == 201) && body['success'] == true) {
          final data = body['data'];
          if (data is Map<String, dynamic>) {
            if (data.containsKey('order') && data['order'] is Map<String, dynamic>) {
              createdOrder = data['order'] as Map<String, dynamic>;
            } else {
              createdOrder = data;
            }
          }
        } else {
          _lastError = body['message'] as String?;
          debugPrint('[OrderService] Backend response message: $_lastError');
        }
      } catch (e) {
        debugPrint('[OrderService] Network/Timeout error connecting to backend: $e');
      }
    }

    if (createdOrder != null) {
      final normalized = _normalizeOrder(createdOrder);
      _localOrders.insert(0, normalized);
      await _saveLocalOrdersToPrefs();
      return normalized;
    }

    final num calculatedSubtotal = items.fold(0, (sum, it) {
      final price = it['unitPrice'] ?? it['unit_price'] ?? it['price'] ?? 180000;
      final qty = it['qty'] ?? it['quantity'] ?? 1;
      final pNum = num.tryParse(price.toString()) ?? 180000;
      final qNum = num.tryParse(qty.toString()) ?? 1;
      return sum + (pNum * qNum);
    });

    final isFreeShip = calculatedSubtotal >= 1000000;
    final num shippingCost = (shippingMethod == 'hoatoc')
        ? (isFreeShip ? 35000 : 55000)
        : (shippingMethod == 'nhanh')
            ? (isFreeShip ? 14000 : 32000)
            : (isFreeShip ? 0 : 18000);

    num voucherDiscount = 0;
    if (voucherCode != null && voucherCode.trim().isNotEmpty) {
      final codeUpper = voucherCode.trim().toUpperCase();
      if (codeUpper == 'NOVA20K' && calculatedSubtotal >= 500000) {
        voucherDiscount = 20000;
      } else if (codeUpper == 'NOVA50K' && calculatedSubtotal >= 1500000) {
        voucherDiscount = 50000;
      } else if (codeUpper == 'FREESHIP' && calculatedSubtotal >= 300000) {
        voucherDiscount = shippingCost > 30000 ? 30000 : shippingCost;
      } else if (codeUpper == 'NOVANEW') {
        voucherDiscount = (calculatedSubtotal * 0.15).clamp(0, 50000);
      }
    }

    final num finalTotal = (calculatedSubtotal + shippingCost - voucherDiscount).clamp(0, double.infinity);

    final randomHex = (now.millisecondsSinceEpoch % 1000000).toRadixString(16).toUpperCase();
    final orderCode = 'ORD${now.millisecondsSinceEpoch.toRadixString(36).toUpperCase()}$randomHex'.substring(0, 15);

    final fallbackOrder = _normalizeOrder({
      'id': '${now.millisecondsSinceEpoch}',
      'code': orderCode,
      'recipientName': recipientName.trim(),
      'recipientPhone': recipientPhone.trim(),
      'province': province.trim().isNotEmpty ? province.trim() : 'TP. Hồ Chí Minh',
      'district': district?.trim().isNotEmpty == true ? district!.trim() : 'Quận 1',
      'ward': ward?.trim().isNotEmpty == true ? ward!.trim() : 'Phường Bến Nghé',
      'addressDetail': addressDetail.trim().isNotEmpty ? addressDetail.trim() : 'Địa chỉ nhận hàng',
      'note': note,
      'paymentMethod': paymentMethod,
      'shippingMethod': shippingMethod,
      'subtotal': calculatedSubtotal,
      'shippingFee': shippingCost,
      'discountAmount': voucherDiscount,
      'totalAmount': finalTotal,
      'total_amount': finalTotal,
      'status': 'pending',
      'createdAt': now.toIso8601String(),
      'items': items,
      'isSavedOffline': true,
    });

    _localOrders.insert(0, fallbackOrder);
    await _saveLocalOrdersToPrefs();
    return fallbackOrder;
  }

  /// Lấy danh sách lịch sử đơn hàng của người dùng dưới dạng model Order
  /// GET /api/v1/orders?limit=...&offset=...
  Future<OrderListResult> getOrders({
    String? status,
    int page = 1,
    int limit = 10,
  }) async {
    final safePage = page > 0 ? page : 1;
    final offset = (safePage - 1) * limit;
    final queryParams = <String, String>{
      'offset': offset.toString(),
      'limit': limit.toString(),
    };

    final response = await _client.get('/api/v1/orders', queryParams: queryParams);

    if (response.success && response.data != null) {
      List<dynamic> rawList = [];
      int total = 0;
      if (response.data is List) {
        rawList = response.data as List;
        total = rawList.length;
      } else if (response.data is Map) {
        final m = response.data as Map;
        if (m['orders'] is List) rawList = m['orders'] as List;
        total = (m['total'] is num) ? (m['total'] as num).toInt() : rawList.length;
      }

      var list = rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => Order.fromJson(item))
          .toList();

      if (status != null && status.isNotEmpty) {
        list = list.where((o) => o.shopOrders.any((so) => so.status == status)).toList();
      }

      final totalPages = (total / (limit > 0 ? limit : 1)).ceil();

      return OrderListResult(
        orders: list,
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages > 0 ? totalPages : 1,
      );
    }

    return OrderListResult(orders: [], total: 0, page: page, limit: limit, totalPages: 1);
  }

  /// Xem chi tiết một đơn hàng qua API chuẩn của Backend
  /// GET /api/v1/orders?orderId=:orderId&limit=1&offset=0
  Future<Order?> getOrderDetail(String orderId) async {
    final response = await _client.get(
      '/api/v1/orders',
      queryParams: {'orderId': orderId, 'limit': '1', 'offset': '0'},
    );

    if (response.success && response.data != null) {
      if (response.data is Map && response.data['orders'] is List) {
        final list = response.data['orders'] as List;
        if (list.isNotEmpty && list.first is Map<String, dynamic>) {
          return Order.fromJson(list.first as Map<String, dynamic>);
        }
      } else if (response.data is Map<String, dynamic>) {
        return Order.fromJson(response.data as Map<String, dynamic>);
      }
    }

    return null;
  }

  /// Hủy đơn hàng khi còn ở trạng thái pending
  /// POST /api/v1/orders/:orderId/cancel
  Future<bool> cancelOrder(String orderId, {String reason = 'Khách hàng yêu cầu hủy đơn'}) async {
    final response = await _client.post(
      '/api/v1/orders/$orderId/cancel',
      body: {},
    );

    return response.success;
  }

  /// Xác nhận đã nhận được hàng (Người mua)
  /// POST /api/v1/orders/:orderId/confirm-received
  Future<bool> confirmOrderReceived(String orderId) async {
    final response = await _client.post(
      '/api/v1/orders/$orderId/confirm-received',
      body: {},
    );

    return response.success;
  }

  /// Tạo phiên thanh toán cổng thanh toán (VNPay / MoMo / QR) cho đơn hàng
  /// POST /api/v1/orders/:orderId/payment-session
  Future<Map<String, dynamic>?> createPaymentSession(String orderId) async {
    final response = await _client.post('/api/v1/orders/$orderId/payment-session', body: {});
    if (response.success && response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    return null;
  }

  /// Kiểm tra trạng thái thanh toán của đơn hàng
  /// GET /api/v1/orders/:orderId/payment-status
  Future<Map<String, dynamic>?> getPaymentStatus(String orderId) async {
    final response = await _client.get('/api/v1/orders/$orderId/payment-status');
    if (response.success && response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    return null;
  }

  /// Lấy thông tin vận chuyển & hành trình đơn hàng (Tracking)
  /// GET /api/v1/orders/:orderId/tracking
  Future<Map<String, dynamic>?> getOrderTracking(String orderId) async {
    final response = await _client.get('/api/v1/orders/$orderId/tracking');
    if (response.success && response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    return null;
  }

  /// Tính phí vận chuyển theo phương thức và địa chỉ
  /// POST /api/v1/shipping/calculate
  Future<Map<String, dynamic>?> calculateShippingFee({
    required List<Map<String, dynamic>> items,
    String shippingMethod = 'tietkiem',
    String? province,
  }) async {
    final response = await _client.post(
      '/api/v1/shipping/calculate',
      body: {
        'items': items,
        'shippingMethod': shippingMethod,
        if (province != null && province.isNotEmpty) 'province': province,
      },
    );
    if (response.success && response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    return null;
  }

  /// Tạo yêu cầu trả hàng / hoàn tiền cho đơn hàng
  /// POST /api/v1/orders/:orderId/returns
  Future<ApiResponse> createOrderReturn(
    String orderId, {
    required String reason,
    String? description,
    List<String> images = const [],
    List<Map<String, dynamic>>? items,
  }) async {
    return await _client.post(
      '/api/v1/orders/$orderId/returns',
      body: {
        'reason': reason,
        if (description != null && description.isNotEmpty) 'description': description,
        if (images.isNotEmpty) 'images': images,
        if (items != null && items.isNotEmpty) 'items': items,
      },
    );
  }

  /// Xem danh sách yêu cầu trả hàng / hoàn tiền của đơn hàng
  /// GET /api/v1/orders/:orderId/returns
  Future<List<Map<String, dynamic>>> getOrderReturns(String orderId) async {
    final response = await _client.get('/api/v1/orders/$orderId/returns');
    if (response.success && response.data != null) {
      if (response.data is List) {
        return (response.data as List).whereType<Map<String, dynamic>>().toList();
      } else if (response.data is Map && response.data['returns'] is List) {
        return (response.data['returns'] as List).whereType<Map<String, dynamic>>().toList();
      }
    }
    return [];
  }
}
