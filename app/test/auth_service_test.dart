import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/models/user.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/screens/auth/login_screen.dart';
import 'package:shopnova/screens/auth/register_screen.dart';
import 'package:shopnova/screens/seller/seller_register_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ApiConfig Tests', () {
    test('Default endpoints are formatted correctly', () {
      ApiConfig.resetBaseUrl();
      expect(ApiConfig.baseUrl, isNotEmpty);
      expect(ApiConfig.healthUrl, contains('/api/v1/health'));
      expect(ApiConfig.readyUrl, contains('/api/v1/ready'));
      expect(ApiConfig.loginUrl, contains('/api/v1/auth/login'));
      expect(ApiConfig.meUrl, contains('/api/v1/auth/me'));
    });

    test('Custom baseUrl overrides endpoints', () {
      ApiConfig.setBaseUrl('http://192.168.1.100:3000/');
      expect(ApiConfig.baseUrl, equals('http://192.168.1.100:3000'));
      expect(ApiConfig.loginUrl, equals('http://192.168.1.100:3000/api/v1/auth/login'));
      ApiConfig.resetBaseUrl();
    });
  });

  group('UserModel Tests', () {
    test('UserModel parses backend JSON response correctly', () {
      final json = {
        'id': '1',
        'username': 'buyer_account',
        'fullName': 'Nguyễn Văn An',
        'email': 'buyer@example.test',
        'phone': '0900000000',
        'avatarUrl': null,
        'role': 'buyer',
        'status': 'active',
        'shopId': null,
      };

      final user = UserModel.fromJson(json);
      expect(user.id, equals('1'));
      expect(user.username, equals('buyer_account'));
      expect(user.fullName, equals('Nguyễn Văn An'));
      expect(user.email, equals('buyer@example.test'));
      expect(user.phone, equals('0900000000'));
      expect(user.avatarUrl, isNull);
      expect(user.role, equals('buyer'));
      expect(user.status, equals('active'));
    });
  });

  group('AuthService State Tests', () {
    test('AuthService initial state and logout', () {
      final auth = AuthService();
      auth.logout();
      expect(auth.isAuthenticated, isFalse);
      expect(auth.token, isNull);
      expect(auth.currentUser, isNull);
    });

    test('AuthService checkReadiness and checkFullConnectionStatus method structure', () async {
      final auth = AuthService();
      // Test when baseUrl is invalid or timeout
      ApiConfig.setBaseUrl('http://127.0.0.1:59999');
      final result = await auth.checkFullConnectionStatus();
      expect(result, isA<Map<String, dynamic>>());
      expect(result.containsKey('isOnline'), isTrue);
      expect(result.containsKey('isReady'), isTrue);
      expect(result.containsKey('backend'), isTrue);
      expect(result.containsKey('dataApi'), isTrue);
      expect(result.containsKey('database'), isTrue);
      expect(result.containsKey('latencyMs'), isTrue);
      ApiConfig.resetBaseUrl();
    });

    test('AuthService restoreSession preserves user from local storage without auto logout', () async {
      final dummyUser = {
        'id': '99',
        'username': 'buyer_persistent',
        'fullName': 'Người Dùng Bền Vững',
        'role': 'buyer',
        'status': 'active',
      };
      SharedPreferences.setMockInitialValues({
        'novashop_current_user': jsonEncode(dummyUser),
        'novashop_jwt_token': 'dummy_mock_jwt_token_for_session',
      });

      final auth = AuthService();
      final restored = await auth.restoreSession();
      expect(restored, isNotNull);
      expect(restored?.username, equals('buyer_persistent'));
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentUser?.fullName, equals('Người Dùng Bền Vững'));

      // Chỉ đăng xuất khi người dùng chủ động nhấn logout()
      auth.logout();
      expect(auth.isAuthenticated, isFalse);
      expect(auth.currentUser, isNull);
    });
  });

  group('LoginScreen Widget Tests', () {
    testWidgets('LoginScreen does not render sample or demo account quick picker', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
      await tester.pump();

      expect(find.textContaining('Dùng thử nhanh bằng tài khoản mẫu'), findsNothing);
      expect(find.textContaining('demo_buyer'), findsNothing);
      expect(find.textContaining('demo_seller'), findsNothing);
      expect(find.textContaining('demo_admin'), findsNothing);
      expect(find.text('Đăng Nhập Ngay'), findsOneWidget);
    });

    testWidgets('RegisterScreen is buyer-only without inline seller role toggle or static example placeholders', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
      await tester.pump();

      expect(find.text('Đăng Ký Tài Khoản'), findsNWidgets(2));
      expect(find.text('Tôi là Người Mua'), findsNothing);
      expect(find.text('Tôi là Người Bán'), findsNothing);
      expect(find.text('Thông tin gian hàng của bạn'), findsNothing);
      expect(find.textContaining('500.000đ'), findsNothing);
      expect(find.textContaining('email@example.com'), findsNothing);
      expect(find.textContaining('0912345678'), findsNothing);
      expect(find.text('Đăng ký mở gian hàng tại Kênh Người Bán'), findsOneWidget);
    });

    testWidgets('RegisterScreen with initialRole=seller redirects to SellerRegisterScreen', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: RegisterScreen(initialRole: 'seller')));
      await tester.pumpAndSettle();

      expect(find.byType(SellerRegisterScreen), findsOneWidget);
    });
  });
}
