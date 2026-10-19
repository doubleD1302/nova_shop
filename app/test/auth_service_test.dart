import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/models/user.dart';
import 'package:shopnova/services/api_config.dart';
import 'package:shopnova/services/auth_service.dart';

void main() {
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
  });
}
