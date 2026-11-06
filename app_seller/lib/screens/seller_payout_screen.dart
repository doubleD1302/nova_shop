import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/payout_service.dart';

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
    final balance = _payoutData?['balance'] is num ? (_payoutData!['balance'] as num).toInt() : 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Rút Tiền Doanh Thu (Mô Phỏng)',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: 'Nhập số tiền muốn rút (tối đa 1.000.000₫)',
              hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9E9E9E)),
              suffixText: '₫',
              suffixStyle: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
              filled: true,
              fillColor: const Color(0xFFF9F9FB),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: primaryColor, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Nút chọn nhanh số tiền
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildQuickAmountChip('100.000₫', 100000, primaryColor),
              _buildQuickAmountChip('200.000₫', 200000, primaryColor),
              _buildQuickAmountChip('500.000₫', 500000, primaryColor),
              _buildQuickAmountChip('Toàn bộ (${_currencyFormat.format(balance)})', balance, primaryColor),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _handleWithdrawal,
              icon: _isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.account_balance_wallet_outlined, size: 18),
              label: Text(_isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Rút Tiền'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickAmountChip(String label, int value, Color primaryColor) {
    return InkWell(
      onTap: () {
        _amountController.text = value.toString();
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F4F8),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFFD9E2EC)),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: primaryColor),
        ),
      ),
    );
  }

  Widget _buildHistorySection(Color primaryColor) {
    final rawList = _payoutData?['withdrawals'];
    final withdrawals = (rawList is List) ? rawList.whereType<Map<String, dynamic>>().toList() : [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Lịch Sử Rút Tiền',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
            ),
            Text(
              '${withdrawals.length} giao dịch',
              style: const TextStyle(fontSize: 12, color: Color(0xFF757575)),
            ),
          ],
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
            child: const Center(
              child: Text(
                'Chưa có lịch sử rút tiền nào.',
                style: TextStyle(color: Color(0xFF9E9E9E), fontSize: 13),
              ),
            ),
          )
        else
          ...withdrawals.map((item) {
            final id = item['id']?.toString() ?? '';
            final amount = item['amount'] is num ? (item['amount'] as num).toDouble() : 0.0;
            final balanceAfter = item['balanceAfter'] is num ? (item['balanceAfter'] as num).toDouble() : 0.0;
            final dateStr = item['createdAt']?.toString();
            String formattedDate = '';
            if (dateStr != null) {
              final d = DateTime.tryParse(dateStr)?.toLocal();
              if (d != null) {
                formattedDate = DateFormat('dd/MM/yyyy HH:mm').format(d);
              }
            }

            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEEEEF0)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0F2F1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.arrow_upward_rounded, color: Color(0xFF00796B), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Yêu cầu rút #$id',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF1E2022)),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          formattedDate.isNotEmpty ? formattedDate : 'Giao dịch mô phỏng',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF757575)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Số dư còn lại: ${_currencyFormat.format(balanceAfter)}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF00796B), fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '-${_currencyFormat.format(amount)}',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFD32F2F)),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Mô phỏng thành công',
                          style: TextStyle(color: Color(0xFF2E7D32), fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }
}

