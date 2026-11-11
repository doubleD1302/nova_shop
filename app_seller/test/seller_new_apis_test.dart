import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova_seller/config/api_config.dart';
import 'package:shopnova_seller/screens/seller_chat_notifications_screen.dart';
import 'package:shopnova_seller/screens/seller_marketing_screen.dart';
import 'package:shopnova_seller/screens/seller_payout_screen.dart';
import 'package:shopnova_seller/screens/seller_reports_returns_screen.dart';
import 'package:shopnova_seller/screens/seller_vouchers_screen.dart';
import 'package:shopnova_seller/services/api_client.dart';
import 'package:shopnova_seller/services/payout_service.dart';
import 'package:shopnova_seller/services/seller_feature_service.dart';

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
    ApiConfig.setBaseUrl('http://127.0.0.1:3000');
    await ApiClient().clearToken();
    await ApiClient().saveToken('seller-jwt');
  });

  tearDown(() async {
    await ApiClient().clearToken();
    ApiConfig.resetBaseUrl();
  });

  test('PayoutService uses real Escrow payout endpoints cleanly', () async {
    final calls = <String>[];
    ApiClient().setHttpClientForTest(
      MockClient((req) async {
        calls.add('${req.method} ${req.url.path}');
        if (req.url.path == '/api/v1/seller/payout/balance') {
          return _jsonRes({
            'success': true,
            'data': {
              'shopId': '5',
              'balance': {'available': 450000, 'pendingEscrow': 120000, 'withdrawing': 0, 'totalPaidOut': 1000000},
              'hasLinkedBank': true,
              'bankAccount': {'bankCode': 'VCB', 'bankName': 'Vietcombank', 'maskedAccountNumber': '****6789', 'accountHolder': 'NGUYEN VAN A'},
            },
          });
        }
        if (req.url.path == '/api/v1/seller/payout/history') {
          return _jsonRes({
            'success': true,
            'data': [
              {'id': '1', 'payoutCode': 'PO-001', 'amount': 200000, 'status': 'completed', 'bankName': 'Vietcombank', 'maskedAccountNumber': '****6789'},
            ],
          });
        }
        if (req.url.path == '/api/v1/seller/payout/request') {
          return _jsonRes({'success': true, 'data': {'payoutCode': 'PO-002', 'amount': 100000, 'status': 'pending'}}, 201);
        }
        return _jsonRes({'success': true});
      }),
    );

    final tooSmall = await PayoutService().requestWithdrawal(10000);
    expect(tooSmall['success'], false);

    final overview = await PayoutService().getPayoutOverview();
    expect(overview?['balance'], 450000);
    expect(overview?['hasLinkedBank'], true);
    expect((overview?['withdrawals'] as List).length, 1);

    final reqRes = await PayoutService().requestWithdrawal(100000);
    expect(reqRes['success'], true);
    expect(calls, containsAll(['GET /api/v1/seller/payout/balance', 'GET /api/v1/seller/payout/history', 'POST /api/v1/seller/payout/request']));
  });

  test('SellerFeatureService connects dashboard, 3PL, returns, vouchers, marketing, reports', () async {
    final calls = <String>[];
    ApiClient().setHttpClientForTest(
      MockClient((req) async {
        calls.add('${req.method} ${req.url.path}');
        if (req.url.path == '/api/v1/seller/dashboard') {
          return _jsonRes({'success': true, 'data': {'summary': {'todayOrders': 3, 'totalRevenue': 900000}, 'chart': []}});
        }
        if (req.url.path == '/api/v1/seller/vouchers' && req.method == 'GET') {
          return _jsonRes({'success': true, 'data': [{'id': '1', 'code': 'NOVA20', 'name': 'Giảm 20k', 'discountAmount': 20000, 'isActive': true}]});
        }
        if (req.url.path == '/api/v1/seller/marketing/campaigns') {
          return _jsonRes({'success': true, 'data': {'items': [{'id': '7', 'name': 'Siêu Sale 11.11'}]}});
        }
        if (req.url.path == '/api/v1/seller/reports/revenue') {
          return _jsonRes({'success': true, 'data': {'summary': {'totalOrders': 12, 'totalPayout': 3200000}, 'orders': []}});
        }
        if (req.url.path == '/api/v1/seller/reports/inventory') {
          return _jsonRes({'success': true, 'data': {'summary': {'totalProducts': 8}, 'items': []}});
        }
        if (req.url.path == '/api/v1/seller/returns') {
          return _jsonRes({'success': true, 'data': [{'id': '21', 'orderId': '88', 'reason': 'Sai size', 'status': 'requested'}]});
        }
        return _jsonRes({'success': true});
      }),
    );

    final fs = SellerFeatureService();
    final dash = await fs.getDashboard();
    expect(dash?['summary']['totalRevenue'], 900000);
    expect((await fs.dispatchOrder3Pl('50', carrier: 'GHN')).success, true);
    expect((await fs.updateOrderTracking('50', trackingCode: 'GHN123')).success, true);
    expect((await fs.getVouchers()).first['code'], 'NOVA20');
    expect((await fs.createVoucher(code: 'TEST50', name: 'Test', discountAmount: 50000)).success, true);
    expect((await fs.toggleVoucherStatus('1', false)).success, true);
    expect((await fs.deleteVoucher('1')).success, true);
    expect((await fs.getCampaigns()).first['name'], 'Siêu Sale 11.11');
    expect((await fs.registerCampaign(campaignId: '7', productId: '1', discountPrice: 99000)).success, true);
    expect((await fs.buyProductBoost(productId: '1', packageType: 'basic_1d')).success, true);
    expect((await fs.getRevenueReport())?['summary']['totalPayout'], 3200000);
    expect((await fs.getInventoryReport())?['summary']['totalProducts'], 8);
    expect((await fs.getSellerReturns()).first['status'], 'requested');
    expect((await fs.updateSellerReturnStatus('21', status: 'approved')).success, true);
  });

  testWidgets('Seller new feature screens render without overflow', (tester) async {
    ApiClient().setHttpClientForTest(
      MockClient((_) async => _jsonRes({'success': true, 'data': {}})),
    );
    for (final widget in const [
      SellerPayoutScreen(),
      SellerVouchersScreen(),
      SellerMarketingScreen(),
      SellerReportsReturnsScreen(),
      SellerChatNotificationsScreen(),
    ]) {
      await tester.pumpWidget(MaterialApp(home: widget));
      await tester.pumpAndSettle();
    }
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
