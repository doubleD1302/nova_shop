import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/screens/account/notifications_screen.dart';
import 'package:shopnova/screens/chat/chat_list_screen.dart';
import 'package:shopnova/screens/orders/buyer_returns_screen.dart';
import 'package:shopnova/services/api_client.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/catalog_service.dart';
import 'package:shopnova/services/chat_service.dart';
import 'package:shopnova/services/favorite_service.dart';
import 'package:shopnova/services/notification_service.dart';
import 'package:shopnova/services/order_service.dart';
import 'package:shopnova/services/shop_service.dart';

http.Response _jsonRes(dynamic body, [int status = 200]) {
  return http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    ApiConfig.setBaseUrl('http://127.0.0.1:3000');
    await ApiClient().clearToken();
  });

  tearDown(() async {
    await ApiClient().clearToken();
    ApiConfig.resetBaseUrl();
  });

  group('Buyer App New Backend APIs Tests', () {
    test('CatalogService getBanners, getFeaturedShowcase & getSystemConfig parse API JSON', () async {
      final mockClient = MockClient((req) async {
        if (req.url.path == '/api/v1/banners') {
          return _jsonRes({
            'success': true,
            'data': [
              {
                'id': 'b1',
                'title': 'Mega Flash Sale',
                'subtitle': 'Giảm sốc 50%',
                'imageUrl': 'https://cdn.example.com/b1.jpg',
                'linkUrl': '/tim-kiem',
                'backgroundColor': '#BD6E49',
              },
            ],
          });
        }
        if (req.url.path == '/api/v1/products/featured') {
          return _jsonRes({
            'success': true,
            'data': {
              'flashSale': [
                {'id': '101', 'name': 'Áo khoác Nova', 'price': 299000, 'imageUrl': ''},
              ],
              'featuredProducts': [
                {'id': '102', 'name': 'Giày Sneaker Pro', 'price': 599000, 'imageUrl': ''},
              ],
            },
          });
        }
        if (req.url.path == '/api/v1/system/config') {
          return _jsonRes({
            'success': true,
            'data': {'maintenanceMode': false, 'platformFee': 5000},
          });
        }
        return _jsonRes({'success': false}, 404);
      });

      final catalog = CatalogService(client: mockClient);
      final banners = await catalog.getBanners();
      expect(banners.length, 1);
      expect(banners.first.title, 'Mega Flash Sale');
      expect(banners.first.linkUrl, '/tim-kiem');

      final showcase = await catalog.getFeaturedShowcase();
      expect(showcase['flashSale']!.length, 1);
      expect(showcase['featuredProducts']!.first.name, 'Giày Sneaker Pro');

      final sys = await catalog.getSystemConfig();
      expect(sys?['maintenanceMode'], false);
      expect(sys?['platformFee'], 5000);
    });

    test('FavoriteService & ShopService call authenticated REST endpoints', () async {
      final calls = <String>[];
      ApiClient().setHttpClientForTest(
        MockClient((req) async {
          calls.add('${req.method} ${req.url.path}');
          if (req.url.path == '/api/v1/favorites' && req.method == 'GET') {
            return _jsonRes({
              'success': true,
              'data': [
                {'id': '55', 'name': 'Son dưỡng Cocoon', 'price': 99000, 'imageUrl': ''},
              ],
            });
          }
          if (req.url.path == '/api/v1/favorites/55' && req.method == 'POST') {
            return _jsonRes({'success': true, 'data': {'isFavorite': true}});
          }
          if (req.url.path == '/api/v1/favorites/55' && req.method == 'DELETE') {
            return _jsonRes({'success': true, 'data': {'isFavorite': false}});
          }
          if (req.url.path == '/api/v1/shops/10/follow' && req.method == 'GET') {
            return _jsonRes({'success': true, 'data': {'isFollowing': true}});
          }
          if (req.url.path == '/api/v1/shops/10/follow' && req.method == 'POST') {
            return _jsonRes({'success': true, 'message': 'Followed'});
          }
          return _jsonRes({'success': true});
        }),
      );
      await ApiClient().saveToken('jwt-token');

      final favs = await FavoriteService().getFavorites();
      expect(favs.length, 1);
      expect(favs.first.name, 'Son dưỡng Cocoon');
      expect(await FavoriteService().addFavorite('55'), true);
      expect(await FavoriteService().removeFavorite('55'), true);

      expect(await ShopService().getFollowStatus('10'), true);
      expect(await ShopService().followShop('10'), true);
      expect(calls, containsAll(['GET /api/v1/favorites', 'POST /api/v1/favorites/55', 'DELETE /api/v1/favorites/55', 'GET /api/v1/shops/10/follow', 'POST /api/v1/shops/10/follow']));
    });

    test('OrderService returns, 3PL rates & refund work with Backend contracts', () async {
      ApiClient().setHttpClientForTest(
        MockClient((req) async {
          if (req.url.path == '/api/v1/shipping/rates-3pl') {
            return _jsonRes({
              'success': true,
              'data': {
                'carriers': [
                  {'carrier': 'GHN', 'carrierName': 'Giao Hàng Nhanh', 'fee': 22000, 'estimatedDeliveryDays': 2},
                ],
              },
            });
          }
          if (req.url.path == '/api/v1/returns' && req.method == 'GET') {
            return _jsonRes({
              'success': true,
              'data': [
                {'id': '9', 'orderId': '100', 'status': 'rejected', 'reason': 'Lỗi kỹ thuật', 'refundAmount': 120000},
              ],
            });
          }
          if (req.url.path == '/api/v1/returns/9/cancel' && req.method == 'PATCH') {
            return _jsonRes({'success': true, 'message': 'Cancelled'});
          }
          if (req.url.path == '/api/v1/returns/9/dispute' && req.method == 'POST') {
            return _jsonRes({'success': true, 'message': 'Disputed'});
          }
          if (req.url.path == '/api/v1/payments/refund' && req.method == 'POST') {
            return _jsonRes({'success': true, 'message': 'Refunded'});
          }
          return _jsonRes({'success': true});
        }),
      );
      await ApiClient().saveToken('jwt-token');

      final rates = await OrderService().calculate3PlRates(toProvince: 'Hà Nội', subtotal: 250000);
      expect(rates.length, 1);
      expect(rates.first['carrier'], 'GHN');

      final returns = await OrderService().getAllBuyerReturns();
      expect(returns.length, 1);
      expect(returns.first['status'], 'rejected');

      expect((await OrderService().cancelBuyerReturn('9')).success, true);
      expect((await OrderService().disputeBuyerReturn('9', disputeReason: 'Sản phẩm vẫn lỗi')).success, true);
      expect((await OrderService().requestPaymentRefund(orderId: '100', amount: 120000)).success, true);
    });

    test('NotificationService & ChatService connect to live endpoints cleanly', () async {
      ApiClient().setHttpClientForTest(
        MockClient((req) async {
          if (req.url.path == '/api/v1/notifications' && req.method == 'GET') {
            return _jsonRes({
              'success': true,
              'data': {
                'items': [
                  {'id': '1', 'userId': '7', 'title': 'Đơn hàng mới', 'content': 'Đã xác nhận', 'type': 'order', 'link': '', 'isRead': false, 'createdAt': '2026-11-11'},
                ],
                'unreadCount': 1,
                'meta': {'page': 1, 'limit': 20, 'total': 1},
              },
            });
          }
          if (req.url.path == '/api/v1/chat/conversations' && req.method == 'GET') {
            return _jsonRes({
              'success': true,
              'data': [
                {'id': '12', 'buyerId': '7', 'shopId': '3', 'buyerName': 'An', 'shopName': 'Nova Tech', 'lastMessage': 'Còn hàng không ạ', 'unreadCount': 1},
              ],
            });
          }
          if (req.url.path == '/api/v1/chat/conversations/12/messages' && req.method == 'POST') {
            return _jsonRes({
              'success': true,
              'data': {'id': '99', 'conversationId': '12', 'senderId': '7', 'senderRole': 'buyer', 'message': 'Xin chào shop'},
            }, 201);
          }
          return _jsonRes({'success': true});
        }),
      );
      await ApiClient().saveToken('jwt-token');

      final notifPage = await NotificationService().fetchNotifications();
      expect(notifPage.unreadCount, 1);
      expect(notifPage.items.first.title, 'Đơn hàng mới');
      expect(await NotificationService().markAsRead('1'), true);
      expect(await NotificationService().markAllAsRead(), true);
      expect(await NotificationService().registerDeviceToken('fcm-tok-123'), true);
      expect(await NotificationService().unregisterDeviceToken('fcm-tok-123'), true);

      final convs = await ChatService().listConversations();
      expect(convs.length, 1);
      expect(convs.first.shopName, 'Nova Tech');
      final sent = await ChatService().sendMessage('12', 'Xin chào shop');
      expect(sent?.message, 'Xin chào shop');
      expect(ApiConfig.chatWsUrl('abc'), contains('/ws/chat?token=abc'));
    });

    testWidgets('New Buyer screens render empty states cleanly without overflow', (tester) async {
      await tester.runAsync(() async {
        await AuthService().logout();
      });
      ApiClient().setHttpClientForTest(
        MockClient((_) async => _jsonRes({'success': true, 'data': []})),
      );
      await tester.pumpWidget(const MaterialApp(home: NotificationsScreen()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Thông Báo'), findsOneWidget);

      await tester.pumpWidget(const MaterialApp(home: BuyerReturnsScreen()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Trả Hàng & Khiếu Nại'), findsOneWidget);

      await tester.pumpWidget(const MaterialApp(home: ChatListScreen()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Tin Nhắn Gian Hàng'), findsOneWidget);
    });
  });
}
