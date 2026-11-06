import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/payout_service.dart';

class SellerPayoutScreen extends StatefulWidget {
  const SellerPayoutScreen({super.key});

  @override
  State<SellerPayoutScreen> createState() => _SellerPayoutScreenState();
}

class _SellerPayoutScreenState extends State<SellerPayoutScreen> {
  final PayoutService _payoutService = PayoutService();
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
  final TextEditingController _amountController = TextEditingController();

  Map<String, dynamic>? _payoutData;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchPayoutData();
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _fetchPayoutData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final data = await _payoutService.getPayoutStatus();

    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _payoutData = data;
    });
  }

  Future<void> _handleSetup() async {
    setState(() => _isSubmitting = true);
    final res = await _payoutService.setupPayout();
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res['message'] ?? ''),
        backgroundColor: res['success'] == true ? const Color(0xFF00796B) : Colors.red,
      ),
    );

    _fetchPayoutData();
  }

  Future<void> _handleWithdrawal() async {
    final rawText = _amountController.text.trim().replaceAll(RegExp(r'\D'), '');
    final amount = int.tryParse(rawText) ?? 0;

    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập số tiền hợp lệ.')),
      );
      return;
    }

    final currentBalance = _payoutData?['balance'] is num ? (_payoutData!['balance'] as num).toInt() : 0;
    if (amount > currentBalance) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Số dư ví không đủ để rút số tiền này.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final res = await _payoutService.requestWithdrawal(amount);
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res['success'] == true) {
      _amountController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? 'Rút tiền mô phỏng thành công!'),
          backgroundColor: const Color(0xFF00796B),
        ),
      );
      _fetchPayoutData();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? 'Rút tiền thất bại.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF00796B);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F9),
      appBar: AppBar(
        title: const Text('Ví Doanh Thu ShopNova', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E2022),
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới',
            onPressed: _fetchPayoutData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: primaryColor))
          : RefreshIndicator(
              onRefresh: _fetchPayoutData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildNoticeBanner(),
                    const SizedBox(height: 16),
                    _buildBalanceCard(primaryColor),
                    const SizedBox(height: 16),
                    if (_payoutData?['ready'] == true) ...[
                      _buildWithdrawalForm(primaryColor),
                      const SizedBox(height: 20),
                    ],
                    _buildHistorySection(primaryColor),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildNoticeBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2F1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFB2DFDB)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, color: Color(0xFF00796B), size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Tính năng Demo Payout: Đây là hệ thống nhận tiền và đối soát mô phỏng phục vụ đồ án ShopNova. Các giao dịch rút tiền được trừ trực tiếp trên số dư ảo trong cơ sở dữ liệu thật.',
              style: TextStyle(color: Color(0xFF004D40), fontSize: 12, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBalanceCard(Color primaryColor) {
    final isReady = _payoutData?['ready'] == true;
    final balance = _payoutData?['balance'] is num ? (_payoutData!['balance'] as num).toDouble() : 0.0;
    final destination = _payoutData?['destination']?.toString() ?? 'Tài khoản nhận tiền minh họa';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF00796B), Color(0xFF004D40)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF00796B).withValues(alpha: 0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                destination,
                style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isReady ? 'Đã kích hoạt' : 'Chưa kích hoạt',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Số dư khả dụng',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            isReady ? _currencyFormat.format(balance) : '0 ₫',
            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          if (!isReady)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _handleSetup,
                icon: const Icon(Icons.add_card_rounded, size: 18),
                label: const Text('Kích Hoạt Nhận 1.000.000₫ Khởi Tạo'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: primaryColor,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildWithdrawalForm(Color primaryColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE4E4EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.payments_outlined, color: Color(0xFF00796B), size: 20),
              SizedBox(width: 8),
              Text(
                'Yêu cầu rút tiền về tài khoản ngân hàng',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: 'Nhập số tiền muốn rút (ví dụ: 100000)',
              suffixText: '₫',
              suffixStyle: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF00796B)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [50000, 100000, 200000, 500000].map((amt) {
              return ActionChip(
                label: Text('${amt ~/ 1000}k', style: const TextStyle(fontSize: 12)),
                onPressed: () {
                  _amountController.text = amt.toString();
                },
                backgroundColor: const Color(0xFFF2F4F7),
                side: BorderSide.none,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _handleWithdrawal,
              icon: _isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send_rounded, size: 18),
              label: Text(_isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi Yêu Cầu Rút Tiền'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistorySection(Color primaryColor) {
    final withdrawals = (_payoutData?['withdrawals'] as List?) ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Lịch sử rút tiền gần đây',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E2022)),
        ),
        const SizedBox(height: 10),
        if (withdrawals.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFEEEEF0)),
            ),
            child: const Column(
              children: [
                Icon(Icons.receipt_long_outlined, size: 40, color: Color(0xFFB0B0C0)),
                SizedBox(height: 8),
                Text('Chưa có giao dịch rút tiền nào', style: TextStyle(color: Color(0xFF71717A), fontSize: 13)),
              ],
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: withdrawals.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final item = withdrawals[index] as Map<String, dynamic>;
              final amount = item['amount'] is num ? (item['amount'] as num).toDouble() : 0.0;
              final balanceAfter = item['balanceAfter'] is num ? (item['balanceAfter'] as num).toDouble() : null;
              final status = item['status']?.toString() ?? 'completed';
              final createdAt = item['createdAt']?.toString() ?? '';

              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFEEEEF0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE0F2F1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.arrow_upward_rounded, color: Color(0xFF00796B), size: 20),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '- ${_currencyFormat.format(amount)}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFFE53935)),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              createdAt.length >= 10 ? createdAt.substring(0, 10) : createdAt,
                              style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F5E9),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            status == 'completed' || status == 'simulated' ? 'Thành công' : status,
                            style: const TextStyle(color: Color(0xFF2E7D32), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                        if (balanceAfter != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            'Dư: ${_currencyFormat.format(balanceAfter)}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF71717A)),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

