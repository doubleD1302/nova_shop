import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova_admin/config/api_config.dart';
import 'package:shopnova_admin/screens/admin_operations_sections.dart';
import 'package:shopnova_admin/services/admin_feature_service.dart';
import 'package:shopnova_admin/services/api_client.dart';

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
    await ApiClient().saveToken('admin-jwt');
  });

  tearDown(() async {
    await ApiClient().clearToken();
    ApiConfig.resetBaseUrl();
  });

  test('AdminFeatureService connects settings, cron jobs, returns, payouts & payments APIs', () async {
    final calls = <String>[];
    ApiClient().setHttpClientForTest(
      MockClient((req) async {
        calls.add('${req.method} ${req.url.path}');
        if (req.url.path == '/api/v1/admin/settings' && req.method == 'GET') {
          return _jsonRes({'success': true, 'data': {'maintenanceMode': false, 'commissionRate': 6.5, 'platformFee': 2000}});
        }
        if (req.url.path == '/api/v1/admin/returns') {
          return _jsonRes({'success': true, 'data': [{'id': '4', 'orderId': '99', 'status': 'disputed', 'reason': 'Hàng hỏng'}]});
        }
        if (req.url.path == '/api/v1/admin/payouts') {
          return _jsonRes({'success': true, 'data': [{'id': '11', 'payoutCode': 'PO-11', 'amount': 500000, 'status': 'pending'}]});
        }
        if (req.url.path == '/api/v1/admin/payments/review-queue') {
          return _jsonRes({'success': true, 'data': {'attempts': [{'id': '1', 'provider': 'vnpay', 'reference': 'SN99', 'amount': 150000, 'status': 'review'}]}});
        }
        return _jsonRes({'success': true, 'message': 'OK'});
      }),
    );

    final svc = AdminFeatureService();
    final settings = await svc.getSettings();
    expect(settings?['commissionRate'], 6.5);
    expect((await svc.updateSettings(maintenanceMode: true, commissionRate: 7.0, platformFee: 3000)).success, true);
    expect((await svc.runCronJob('cancel-expired-orders')).success, true);

    final returns = await svc.getAdminReturns();
    expect(returns.first['status'], 'disputed');
    expect((await svc.resolveReturnDispute('4', resolution: 'approve', adminNote: 'Hoàn tiền cho khách')).success, true);

    final payouts = await svc.getAdminPayouts();
    expect(payouts.first['payoutCode'], 'PO-11');
    expect((await svc.updatePayoutStatus('11', status: 'completed', transactionReference: 'VCB123')).success, true);

    final queue = await svc.getPaymentReviewQueue();
    expect(queue.first['provider'], 'vnpay');
    expect((await svc.reconcilePayments()).success, true);
    expect((await svc.refundPayment(orderId: '99', amount: 150000)).success, true);

    expect(
      calls,
      containsAll([
        'GET /api/v1/admin/settings',
        'PUT /api/v1/admin/settings',
        'POST /api/v1/admin/jobs/run',
        'PATCH /api/v1/admin/returns/4/resolve',
        'PATCH /api/v1/admin/payouts/11',
        'POST /api/v1/admin/payments/reconcile',
        'POST /api/v1/payments/refund',
      ]),
    );
  });

  testWidgets('Admin new operation modules render cleanly without overflow', (tester) async {
    ApiClient().setHttpClientForTest(
      MockClient((_) async => _jsonRes({'success': true, 'data': []})),
    );
    for (final section in const [
      AdminReturnsSection(),
      AdminPayoutsSection(),
      AdminPaymentsSection(),
    ]) {
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: section)));
      await tester.pumpAndSettle();
    }
    expect(find.byType(AdminPaymentsSection), findsOneWidget);
  });
}
