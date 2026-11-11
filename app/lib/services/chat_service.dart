import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import 'api_client.dart';

/// Mô hình cuộc hội thoại Live Chat giữa Người mua và Gian hàng
class ChatConversation {
  final String id;
  final String buyerId;
  final String shopId;
  final String buyerName;
  final String? buyerAvatar;
  final String shopName;
  final String? shopLogo;
  final String? lastMessage;
  final String? lastMessageAt;
  final int unreadCount;
  final String? createdAt;

  const ChatConversation({
    required this.id,
    required this.buyerId,
    required this.shopId,
    required this.buyerName,
    this.buyerAvatar,
    required this.shopName,
    this.shopLogo,
    this.lastMessage,
    this.lastMessageAt,
    this.unreadCount = 0,
    this.createdAt,
  });

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    return ChatConversation(
      id: json['id']?.toString() ?? '',
      buyerId: json['buyerId']?.toString() ?? '',
      shopId: json['shopId']?.toString() ?? '',
      buyerName: json['buyerName']?.toString() ?? 'Khách hàng',
      buyerAvatar: json['buyerAvatar']?.toString(),
      shopName: json['shopName']?.toString() ?? 'Cửa hàng ShopNova',
      shopLogo: json['shopLogo']?.toString(),
      lastMessage: json['lastMessage']?.toString(),
      lastMessageAt: json['lastMessageAt']?.toString(),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ??
          (json['buyerUnreadCount'] as num?)?.toInt() ??
          0,
      createdAt: json['createdAt']?.toString(),
    );
  }
}

/// Mô hình tin nhắn trong cuộc hội thoại
class ChatMessageItem {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final String? senderAvatar;
  final String senderRole;
  final String message;
  final List<dynamic> attachments;
  final bool isRead;
  final String? createdAt;

  const ChatMessageItem({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    this.senderAvatar,
    required this.senderRole,
    required this.message,
    this.attachments = const [],
    this.isRead = false,
    this.createdAt,
  });

  factory ChatMessageItem.fromJson(Map<String, dynamic> json) {
    return ChatMessageItem(
      id: json['id']?.toString() ?? '',
      conversationId: json['conversationId']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      senderName: json['senderName']?.toString() ?? '',
      senderAvatar: json['senderAvatar']?.toString(),
      senderRole: json['senderRole']?.toString() ?? 'buyer',
      message: json['message']?.toString() ?? '',
      attachments: json['attachments'] is List
          ? json['attachments'] as List
          : const [],
      isRead: json['isRead'] == true || json['isRead'] == 1,
      createdAt: json['createdAt']?.toString(),
    );
  }
}

/// Service Live Chat thời gian thực (REST API + WebSocket /ws/chat)
class ChatService {
  static final ChatService _instance = ChatService._internal();
  factory ChatService() => _instance;
  ChatService._internal();

  final ApiClient _client = ApiClient();
  final StreamController<Map<String, dynamic>> _wsController =
      StreamController<Map<String, dynamic>>.broadcast();
  WebSocket? _socket;
  StreamSubscription? _wsSub;
  bool _connecting = false;
  String? _lastError;

  String? get lastError => _lastError;
  Stream<Map<String, dynamic>> get events => _wsController.stream;
  bool get isSocketConnected =>
      _socket != null && _socket!.readyState == WebSocket.open;

  /// Lấy danh sách cuộc hội thoại của tài khoản (GET /api/v1/chat/conversations)
  Future<List<ChatConversation>> listConversations() async {
    _lastError = null;
    final res = await _client.get('/api/v1/chat/conversations');
    if (res.success && res.data is List) {
      return (res.data as List)
          .whereType<Map<String, dynamic>>()
          .map(ChatConversation.fromJson)
          .toList();
    }
    if (!res.success) _lastError = res.message;
    return [];
  }

  /// Mở hoặc tạo mới cuộc hội thoại với gian hàng (POST /api/v1/chat/conversations)
  Future<ChatConversation?> getOrCreateConversation(String shopId) async {
    _lastError = null;
    final res = await _client.post(
      '/api/v1/chat/conversations',
      body: {'shopId': shopId},
    );
    if (res.success && res.data is Map<String, dynamic>) {
      return ChatConversation.fromJson(res.data as Map<String, dynamic>);
    }
    _lastError = res.message.isNotEmpty
        ? res.message
        : 'Không thể mở cuộc trò chuyện với gian hàng.';
    return null;
  }

  /// Đọc danh sách tin nhắn và đánh dấu đã đọc (GET /api/v1/chat/conversations/:id/messages)
  Future<List<ChatMessageItem>> getMessages(
    String conversationId, {
    int limit = 50,
    int offset = 0,
  }) async {
    _lastError = null;
    final res = await _client.get(
      '/api/v1/chat/conversations/$conversationId/messages',
      queryParams: {'limit': limit.toString(), 'offset': offset.toString()},
    );
    if (res.success && res.data is Map<String, dynamic>) {
      final raw = res.data['messages'];
      if (raw is List) {
        return raw
            .whereType<Map<String, dynamic>>()
            .map(ChatMessageItem.fromJson)
            .toList();
      }
    }
    if (!res.success) _lastError = res.message;
    return [];
  }

  /// Gửi tin nhắn qua REST API (POST /api/v1/chat/conversations/:id/messages)
  Future<ChatMessageItem?> sendMessage(
    String conversationId,
    String message, {
    List<dynamic> attachments = const [],
  }) async {
    _lastError = null;
    final clean = message.trim();
    if (clean.isEmpty) {
      _lastError = 'Nội dung tin nhắn không được để trống.';
      return null;
    }
    final res = await _client.post(
      '/api/v1/chat/conversations/$conversationId/messages',
      body: {
        'message': clean,
        if (attachments.isNotEmpty) 'attachments': attachments,
      },
    );
    if (res.success && res.data is Map<String, dynamic>) {
      return ChatMessageItem.fromJson(res.data as Map<String, dynamic>);
    }
    _lastError = res.message.isNotEmpty
        ? res.message
        : 'Không thể gửi tin nhắn lúc này.';
    return null;
  }

  /// Kết nối WebSocket thời gian thực /ws/chat?token=...
  Future<void> connectSocket() async {
    if (_connecting || isSocketConnected) return;
    _connecting = true;
    try {
      final token = await _client.getToken();
      if (token == null || token.isEmpty) return;

      final wsUrl = ApiConfig.chatWsUrl(token);
      final socket = await WebSocket.connect(wsUrl);
      _socket = socket;
      _wsSub = socket.listen(
        (raw) {
          try {
            final decoded = jsonDecode(raw.toString());
            if (decoded is Map<String, dynamic>) {
              _wsController.add(decoded);
            }
          } catch (_) {}
        },
        onError: (_) => disconnectSocket(),
        onDone: () => disconnectSocket(),
      );
    } catch (e) {
      debugPrint('[ChatService] connectSocket warning: $e');
    } finally {
      _connecting = false;
    }
  }

  /// Gửi sự kiện tin nhắn qua WebSocket (nếu đang mở)
  bool sendSocketMessage({
    required String conversationId,
    required String message,
    List<dynamic> attachments = const [],
  }) {
    if (!isSocketConnected) return false;
    final clean = message.trim();
    if (clean.isEmpty) return false;
    try {
      _socket!.add(
        jsonEncode({
          'type': 'send_message',
          'conversationId': conversationId,
          'message': clean,
          if (attachments.isNotEmpty) 'attachments': attachments,
        }),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Đóng kết nối WebSocket
  Future<void> disconnectSocket() async {
    await _wsSub?.cancel();
    _wsSub = null;
    try {
      await _socket?.close();
    } catch (_) {}
    _socket = null;
  }
}

