import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/screens/nova_ai/nova_ai_screen.dart';
import 'package:shopnova/services/auth_service.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'novashop_current_user': jsonEncode({
        'id': '99',
        'username': 'buyer_history',
        'fullName': 'Người mua thử',
        'role': 'buyer',
        'status': 'active',
      }),
      'novashop_jwt_token': 'token-lich-su',
    });
    FlutterSecureStorage.setMockInitialValues({});
    NovaAIScreen.resetSession();
  });

  tearDown(() async {
    await AuthService().logout();
  });

  testWidgets(
    'Nova mở lại cuộc trò chuyện gần nhất, gửi conversationId, tạo cuộc mới và xóa cuộc cũ',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.runAsync(() => AuthService().restoreSession());
      expect(AuthService().token, isNotNull);

      final chatBodies = <Map<String, dynamic>>[];
      final deleted = <String>[];
      final now = DateTime.now().toUtc().toIso8601String();
      final client = MockClient((request) async {
        final path = request.url.path;
        if (request.method == 'GET' && path.endsWith('/ai/brain/profile')) {
          return _json({'success': true, 'data': {}});
        }
        if (request.method == 'GET' && path.endsWith('/ai/conversations')) {
          return _json({
            'success': true,
            'data': {
              'conversations': [
                {'id': '7', 'title': 'Tìm áo thun', 'messageCount': 2, 'lastMessageAt': now},
                {'id': '3', 'title': 'Hỏi về đổi trả', 'messageCount': 4, 'lastMessageAt': now},
              ],
              'total': 2,
            },
          });
        }
        if (request.method == 'GET' && path.endsWith('/ai/conversations/7/messages')) {
          return _json({
            'success': true,
            'data': {
              'conversation': {'id': '7', 'title': 'Tìm áo thun'},
              'messages': [
                {'id': '1', 'role': 'user', 'content': 'Tìm áo thun nam', 'createdAt': now},
                {
                  'id': '2',
                  'role': 'assistant',
                  'content': 'Nova gợi ý áo thun cotton.',
                  'createdAt': now,
                  'metadata': {
                    'products': [
                      {'id': '5', 'name': 'Áo thun cotton', 'price': 99000, 'imageUrl': ''},
                    ],
                    'catalog': {'page': 1, 'hasMore': true},
                  },
                },
              ],
              'hasMore': false,
            },
          });
        }
        if (request.method == 'DELETE' && path.contains('/ai/conversations/')) {
          deleted.add(path.split('/').last);
          return _json({'success': true, 'data': {'deleted': true}});
        }
        if (request.method == 'POST' && path.endsWith('/ai/chat')) {
          chatBodies.add(jsonDecode(request.body) as Map<String, dynamic>);
          return _json({
            'success': true,
            'data': {'reply': 'Đã trả lời.', 'conversationId': '${chatBodies.length == 1 ? 7 : 8}'},
          });
        }
        return _json({'success': false}, 404);
      });
      addTearDown(client.close);

      await tester.pumpWidget(MaterialApp(home: NovaAIScreen(httpClient: client)));
      await tester.pumpAndSettle();

      // Cuộc gần nhất (còn trong 12 giờ) được mở lại, kèm thẻ sản phẩm đã lưu
      expect(find.text('Tìm áo thun nam'), findsOneWidget);
      expect(find.text('Nova gợi ý áo thun cotton.'), findsOneWidget);
      expect(find.text('Áo thun cotton'), findsOneWidget);
      // Câu trả lời cuối còn trang tiếp theo thì dựng lại nút "Xem trang 2"
      expect(find.text('Xem trang 2'), findsOneWidget);

      // Tin mới gửi kèm đúng conversationId, không yêu cầu cuộc mới
      await tester.enterText(find.byType(TextField), 'Có màu đen không?');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi tin nhắn'));
      await tester.pumpAndSettle();
      expect(chatBodies.single['context']['conversationId'], '7');
      expect(chatBodies.single['context'].containsKey('newConversation'), isFalse);

      // Mở lịch sử, bắt đầu cuộc mới: màn hình sạch và lần gửi sau yêu cầu newConversation
      await tester.tap(find.byTooltip('Lịch sử trò chuyện'));
      await tester.pumpAndSettle();
      expect(find.text('Hỏi về đổi trả'), findsOneWidget);
      await tester.tap(find.text('Cuộc trò chuyện mới'));
      await tester.pumpAndSettle();
      expect(find.text('Tìm áo thun nam'), findsNothing);
      await tester.enterText(find.byType(TextField), 'Xin chào');
      await tester.pump();
      await tester.tap(find.byTooltip('Gửi tin nhắn'));
      await tester.pumpAndSettle();
      expect(chatBodies.last['context']['newConversation'], isTrue);
      expect(chatBodies.last['context'].containsKey('conversationId'), isFalse);

      // Xóa một cuộc trò chuyện sau khi xác nhận
      await tester.tap(find.byTooltip('Lịch sử trò chuyện'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Xóa cuộc trò chuyện').last);
      await tester.pumpAndSettle();
      expect(find.text('Xóa cuộc trò chuyện?'), findsOneWidget);
      await tester.tap(find.text('Xóa'));
      await tester.pumpAndSettle();
      expect(deleted, ['3']);
      expect(find.text('Hỏi về đổi trả'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Nova gửi productId từ trang sản phẩm, cho phép bỏ ngữ cảnh và bỏ qua ID không phải số', (tester) async {
    await tester.runAsync(() => AuthService().logout());
    final contexts = <Map<String, dynamic>>[];
    final client = MockClient((request) async {
      if (request.method == 'POST') {
        contexts.add((jsonDecode(request.body) as Map<String, dynamic>)['context'] as Map<String, dynamic>);
        return _json({'success': true, 'data': {'reply': 'Đã trả lời.'}});
      }
      return _json({'success': false}, 404);
    });
    addTearDown(client.close);

    await tester.pumpWidget(
      MaterialApp(
        home: NovaAIScreen(httpClient: client, productId: '42', initialQuery: 'Còn hàng không?'),
      ),
    );
    await tester.pumpAndSettle();
    expect(contexts.single['productId'], '42');
    expect(find.text('Đang hỏi về sản phẩm bạn vừa xem'), findsOneWidget);

    await tester.tap(find.byTooltip('Bỏ ngữ cảnh sản phẩm'));
    await tester.pump();
    expect(find.text('Đang hỏi về sản phẩm bạn vừa xem'), findsNothing);
    await tester.enterText(find.byType(TextField), 'Hỏi thêm');
    await tester.pump();
    await tester.tap(find.byTooltip('Gửi tin nhắn'));
    await tester.pumpAndSettle();
    expect(contexts.last.containsKey('productId'), isFalse);

    // ID không phải số (dữ liệu mẫu) bị bỏ qua vì Backend sẽ từ chối cả yêu cầu
    NovaAIScreen.resetSession();
    await tester.pumpWidget(
      MaterialApp(home: NovaAIScreen(httpClient: client, productId: 'p01', initialQuery: 'Tư vấn')),
    );
    await tester.pumpAndSettle();
    expect(contexts.last.containsKey('productId'), isFalse);
    expect(find.text('Đang hỏi về sản phẩm bạn vừa xem'), findsNothing);
  });

  testWidgets('Khách chưa đăng nhập không có nút lịch sử và không gọi API lịch sử', (tester) async {
    await tester.runAsync(() => AuthService().logout());
    final paths = <String>[];
    final client = MockClient((request) async {
      paths.add(request.url.path);
      return _json({'success': false}, 404);
    });
    addTearDown(client.close);
    await tester.pumpWidget(MaterialApp(home: NovaAIScreen(httpClient: client)));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Lịch sử trò chuyện'), findsNothing);
    expect(paths.where((path) => path.contains('/ai/conversations')), isEmpty);
  });
}
