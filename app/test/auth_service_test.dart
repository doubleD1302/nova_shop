import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/models/user.dart';
import 'package:shopnova/services/api_config.dart';
import 'package:shopnova/services/auth_service.dart';

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
        'username': 'demo_buyer',
        'fullName': 'Người mua mẫu',
        'email': 'buyer@example.test',
        'phone': '0900000000',
        'avatarUrl': null,
        'role': 'buyer',
        'status': 'active',
        'shopId': null,
      };

      final user = UserModel.fromJson(json);
      expect(user.id, equals('1'));
      expect(user.username, equals('demo_buyer'));
      expect(user.fullName, equals('Người mua mẫu'));
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
}
