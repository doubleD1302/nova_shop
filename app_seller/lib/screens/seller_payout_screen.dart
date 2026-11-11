import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/payout_service.dart';
import '../theme/seller_theme.dart';

/// Màn hình Ví Doanh Thu Escrow & Rút Tiền Ngân Hàng (Seller)
class SellerPayoutScreen extends StatefulWidget {
  const SellerPayoutScreen({super.key});

  @override
  State<SellerPayoutScreen> createState() => _SellerPayoutScreenState();
}

class _SellerPayoutScreenState extends State<SellerPayoutScreen> {
  final PayoutService _payoutService = PayoutService();
  final NumberFormat _currencyFormat = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: '₫',
    decimalDigits: 0,
  );
  final TextEditingController _amountController = TextEditingController();

  Map<String, dynamic>? _overview;
  bool _isLoading = true;
  bool _isSubmitting = false;

  static const List<Map<String, String>> _popularBanks = [
    {'code': 'VCB', 'name': 'Vietcombank'},
    {'code': 'TCB', 'name': 'Techcombank'},
    {'code': 'MB', 'name': 'MB Bank'},
    {'code': 'ACB', 'name': 'ACB'},
    {'code': 'BIDV', 'name': 'BIDV'},
    {'code': 'VPB', 'name': 'VPBank'},
    {'code': 'VTB', 'name': 'VietinBank'},
  ];

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
    setState(() => _isLoading = true);
    final data = await _payoutService.getPayoutOverview();
    if (!mounted) return;
    setState(() {
      _overview = data;
      _isLoading = false;
    });
  }

  Future<void> _showBankAccountDialog() async {
    final existing = _overview?['bankAccount'] is Map
        ? Map<String, dynamic>.from(_overview!['bankAccount'] as Map)
        : <String, dynamic>{};
    String selectedCode = existing['bankCode']?.toString() ?? 'VCB';
    final nameCtrl = TextEditingController(
      text: existing['bankName']?.toString() ?? 'Vietcombank',
    );
    final accCtrl = TextEditingController(
      text: existing['accountNumber']?.toString() ?? '',
    );
    final holderCtrl = TextEditingController(
      text: existing['accountHolder']?.toString() ?? '',
    );
    final branchCtrl = TextEditingController(
      text: existing['branch']?.toString() ?? '',
    );

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Text(
            'Liên Kết Tài Khoản Ngân Hàng',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: _popularBanks.any((b) => b['code'] == selectedCode)
                      ? selectedCode
                      : 'VCB',
                  decoration: const InputDecoration(
                    labelText: 'Ngân hàng',
                    border: OutlineInputBorder(),
                  ),
                  items: _popularBanks
                      .map((b) => DropdownMenuItem(
                            value: b['code'],
                            child: Text('${b['code']} - ${b['name']}'),
                          ))
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    final match = _popularBanks.firstWhere((b) => b['code'] == v);
                    setDlg(() {
                      selectedCode = v;
                      nameCtrl.text = match['name']!;
                    });
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: accCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Số tài khoản (6-30 chữ số)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: holderCtrl,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Tên chủ tài khoản (Không dấu IN HOA)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: branchCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Chi nhánh (không bắt buộc)',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Lưu tài khoản'),
            ),
          ],
        ),
      ),
    );

    if (ok != true) return;
    setState(() => _isSubmitting = true);
    final res = await _payoutService.saveBankAccount(
      bankName: nameCtrl.text,
      bankCode: selectedCode,
      accountNumber: accCtrl.text,
      accountHolder: holderCtrl.text,
      branch: branchCtrl.text,
    );
    if (!mounted) return;
    setState(() => _isSubmitting = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res['message']?.toString() ?? ''),
        backgroundColor: res['success'] == true ? SellerTheme.success : SellerTheme.danger,
      ),
    );
    if (res['success'] == true) _fetchPayoutData();
  }

  Future<void> _handleWithdrawal() async {
    final rawText = _amountController.text.trim().replaceAll(RegExp(r'\D'), '');
    final amount = int.tryParse(rawText) ?? 0;

    if (amount < 50000) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Số tiền rút tối thiểu là 50.000₫.')),
      );
      return;
    }

    final available = num.tryParse(_overview?['balance']?.toString() ?? '0') ?? 0;
    if (amount > available) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Số dư khả dụng không đủ để rút.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final res = await _payoutService.requestWithdrawal(amount);
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res['message']?.toString() ?? ''),
        backgroundColor: res['success'] == true ? SellerTheme.success : SellerTheme.danger,
      ),
    );
    if (res['success'] == true) {
      _amountController.clear();
      _fetchPayoutData();
    }
  }

  @override
  Widget build(BuildContext context) {
    final available = num.tryParse(_overview?['balance']?.toString() ?? '0') ?? 0;
    final pendingEscrow = num.tryParse(_overview?['pendingBalance']?.toString() ?? '0') ?? 0;
    final withdrawing = num.tryParse(_overview?['withdrawing']?.toString() ?? '0') ?? 0;
    final totalPaidOut = num.tryParse(_overview?['totalPaidOut']?.toString() ?? '0') ?? 0;
    final hasBank = _overview?['hasLinkedBank'] == true && _overview?['bankAccount'] is Map;
    final bank = hasBank ? Map<String, dynamic>.from(_overview!['bankAccount'] as Map) : null;
    final history = _overview?['withdrawals'] is List
        ? (_overview!['withdrawals'] as List).whereType<Map<String, dynamic>>().toList()
        : <Map<String, dynamic>>[];

    return Scaffold(
      backgroundColor: SellerTheme.background,
      appBar: AppBar(
        title: const Text('Ví Doanh Thu & Rút Tiền', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetchPayoutData),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: SellerTheme.primary))
          : RefreshIndicator(
              onRefresh: _fetchPayoutData,
              color: SellerTheme.primary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Balance card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF2C1810), Color(0xFF49352D)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Số dư khả dụng (Đã quyết toán)', style: TextStyle(color: Colors.white70, fontSize: 12)),
                        const SizedBox(height: 6),
                        Text(
                          _currencyFormat.format(available),
                          style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(child: _miniMetric('Chờ Escrow', _currencyFormat.format(pendingEscrow))),
                            Expanded(child: _miniMetric('Đang rút', _currencyFormat.format(withdrawing))),
                            Expanded(child: _miniMetric('Đã nhận', _currencyFormat.format(totalPaidOut))),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Bank Account Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: SellerTheme.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: SellerTheme.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.account_balance_rounded, color: SellerTheme.primary, size: 28),
                        const SizedBox(width: 12),
                        Expanded(
                          child: bank == null
                              ? const Text(
                                  'Chưa liên kết tài khoản ngân hàng nhận tiền',
                                  style: TextStyle(fontSize: 13, color: SellerTheme.textSecondary),
                                )
                              : Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${bank['bankCode'] ?? ''} - ${bank['bankName'] ?? ''}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                                    ),
                                    Text(
                                      '${bank['maskedAccountNumber'] ?? bank['accountNumber']} • ${bank['accountHolder'] ?? ''}',
                                      style: const TextStyle(fontSize: 12, color: SellerTheme.textSecondary),
                                    ),
                                  ],
                                ),
                        ),
                        TextButton(
                          onPressed: _isSubmitting ? null : _showBankAccountDialog,
                          child: Text(bank == null ? 'Liên kết' : 'Đổi TK'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Withdraw form
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: SellerTheme.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: SellerTheme.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Tạo Lệnh Rút Tiền', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(height: 4),
                        const Text('Tối thiểu 50.000₫ mỗi giao dịch. Admin duyệt & chuyển khoản.', style: TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _amountController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Số tiền muốn rút (₫)',
                            hintText: 'Từ 50.000 trở lên',
                            suffixText: '₫',
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          children: [50000, 100000, 500000, 1000000].map((amt) {
                            return ActionChip(
                              label: Text('${amt ~/ 1000}k'),
                              onPressed: () => _amountController.text = amt.toString(),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton(
                            onPressed: (!hasBank || _isSubmitting) ? null : _handleWithdrawal,
                            child: Text(
                              _isSubmitting
                                  ? 'ĐANG XỬ LÝ...'
                                  : (hasBank ? 'GỬI YÊU CẦU RÚT TIỀN' : 'HÃY LIÊN KẾT NGÂN HÀNG TRƯỚC'),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text('Lịch Sử Yêu Cầu Chi Trả', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5)),
                  const SizedBox(height: 10),
                  if (history.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: SellerTheme.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: SellerTheme.border),
                      ),
                      child: const Center(
                        child: Text('Chưa có yêu cầu rút tiền nào.', style: TextStyle(color: SellerTheme.textSecondary)),
                      ),
                    )
                  else
                    ...history.map((w) {
                      final amt = num.tryParse(w['amount']?.toString() ?? '0') ?? 0;
                      final status = w['status']?.toString() ?? 'pending';
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: SellerTheme.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: SellerTheme.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  w['payoutCode']?.toString() ?? '#${w['id']}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                Text(
                                  status.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: status == 'completed'
                                        ? SellerTheme.success
                                        : (status == 'rejected' ? SellerTheme.danger : SellerTheme.primary),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '-${_currencyFormat.format(amt)} → ${w['bankName'] ?? ''} (${w['maskedAccountNumber'] ?? ''})',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            if ((w['rejectionReason']?.toString() ?? '').isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text('Lý do từ chối: ${w['rejectionReason']}', style: const TextStyle(fontSize: 12, color: SellerTheme.danger)),
                              ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }

  Widget _miniMetric(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10.5)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
