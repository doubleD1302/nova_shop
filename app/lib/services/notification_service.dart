import 'package:flutter/foundation.dart';
import 'api_client.dart';

/// Mô hình thông báo trong hệ thống ShopNova
class NotificationItem {
  final String id;
  final String userId;
  final String title;
  final String content;
  final String type;
  final String link;
  final bool isRead;
  final String? readAt;
  final Map<String, dynamic> metadata;
  final String createdAt;

  const NotificationItem({
    required this.id,
    required this.userId,
    required this.title,
    required this.content,
    required this.type,
    required this.link,
    required this.isRead,
    this.readAt,
    this.metadata = const {},
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      type: json['type']?.toString() ?? 'system',
      link: json['link']?.toString() ?? '',
      isRead: json['isRead'] == true || json['isRead'] == 1,
      readAt: json['readAt']?.toString(),
      metadata: json['metadata'] is Map
          ? Map<String, dynamic>.from(json['metadata'] as Map)
          : const {},
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }

  NotificationItem copyWith({bool? isRead, String? readAt}) {
    return NotificationItem(
      id: id,
      userId: userId,
      title: title,
      content: content,
      type: type,
      link: link,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      metadata: metadata,
      createdAt: createdAt,
    );
  }
}

/// Kết quả phân trang thông báo
class NotificationPageResult {
  final List<NotificationItem> items;
  final int unreadCount;
  final int total;
  final int page;
  final int limit;

  const NotificationPageResult({
    required this.items,
    required this.unreadCount,
    required this.total,
    required this.page,
    required this.limit,
  });
}

/// Service quản lý Hộp thư Thông báo & Push Device Token
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final ApiClient _client = ApiClient();
  final ValueNotifier<int> unreadCountNotifier = ValueNotifier<int>(0);

  /// Lấy danh sách thông báo cá nhân (GET /api/v1/notifications)
  Future<NotificationPageResult> fetchNotifications({
    int page = 1,
    int limit = 20,
    bool? isRead,
    String? type,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (isRead != null) 'isRead': isRead.toString(),
      if (type != null && type.isNotEmpty) 'type': type,
    };

    final res = await _client.get('/api/v1/notifications', queryParams: query);
    if (res.success && res.data is Map<String, dynamic>) {
      final data = res.data as Map<String, dynamic>;
      final rawItems = data['items'] is List ? data['items'] as List : const [];
      final items = rawItems
          .whereType<Map<String, dynamic>>()
          .map(NotificationItem.fromJson)
          .toList();
      final unread = (data['unreadCount'] as num?)?.toInt() ?? 0;
      final meta = data['meta'] is Map
          ? data['meta'] as Map
          : const <String, dynamic>{};
      final total = (meta['total'] as num?)?.toInt() ?? items.length;
      final resPage = (meta['page'] as num?)?.toInt() ?? page;
      final resLimit = (meta['limit'] as num?)?.toInt() ?? limit;

      unreadCountNotifier.value = unread;
      return NotificationPageResult(
        items: items,
        unreadCount: unread,
        total: total,
        page: resPage,
        limit: resLimit,
      );
    }

    return NotificationPageResult(
      items: const [],
      unreadCount: unreadCountNotifier.value,
      total: 0,
      page: page,
      limit: limit,
    );
  }

  /// Đánh dấu một thông báo đã đọc (PATCH /api/v1/notifications/:id/read)
  Future<bool> markAsRead(String notificationId) async {
    final res = await _client.patch(
      '/api/v1/notifications/$notificationId/read',
      body: {},
    );
    if (res.success && unreadCountNotifier.value > 0) {
      unreadCountNotifier.value = unreadCountNotifier.value - 1;
    }
    return res.success;
  }

  /// Đánh dấu tất cả thông báo đã đọc (PATCH /api/v1/notifications/read-all)
  Future<bool> markAllAsRead() async {
    final res = await _client.patch('/api/v1/notifications/read-all', body: {});
    if (res.success) {
      unreadCountNotifier.value = 0;
    }
    return res.success;
  }

  /// Đăng ký device token nhận Push Notification (POST /api/v1/notifications/device-token)
  Future<bool> registerDeviceToken(
    String token, {
    String deviceType = 'android',
  }) async {
    final clean = token.trim();
    if (clean.isEmpty) return false;
    final res = await _client.post(
      '/api/v1/notifications/device-token',
      body: {'token': clean, 'deviceType': deviceType},
    );
    return res.success;
  }

  /// Hủy đăng ký device token khi đăng xuất (DELETE /api/v1/notifications/device-token)
  Future<bool> unregisterDeviceToken(String token) async {
    final clean = token.trim();
    if (clean.isEmpty) return false;
    final res = await _client.delete(
      '/api/v1/notifications/device-token',
      body: {'token': clean},
    );
    return res.success;
  }
}

