import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/seller_feature_service.dart';
import '../theme/seller_theme.dart';

/// Màn hình Quản Lý Mã Giảm Giá Của Shop (/api/v1/seller/vouchers)
class SellerVouchersScreen extends StatefulWidget {
  const SellerVouchersScreen({super.key});

  @override
  State<SellerVouchersScreen> createState() => _SellerVouchersScreenState();
}

class _SellerVouchersScreenState extends State<SellerVouchersScreen> {
  final SellerFeatureService _service = SellerFeatureService();
  final NumberFormat _fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

  List<Map<String, dynamic>> _vouchers = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final list = await _service.getVouchers();
    if (mounted) {
      setState(() {
        _vouchers = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _showCreateDialog() async {
    final codeCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final discountCtrl = TextEditingController(text: '20000');
    final minSubCtrl = TextEditingController(text: '100000');
    final limitCtrl = TextEditingController(text: '50');

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Tạo Mã Giảm Giá Mới', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: codeCtrl,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(labelText: 'Mã Voucher (3-32 ký tự)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Tên chương trình ưu đãi', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: discountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Số tiền giảm (₫)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: minSubCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Đơn tối thiểu (₫)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: limitCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Tổng lượt sử dụng', border: OutlineInputBorder()),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Tạo mã')),
        ],
      ),
    );
    if (ok != true) return;

    final res = await _service.createVoucher(
      code: codeCtrl.text,
      name: nameCtrl.text,
      discountAmount: int.tryParse(discountCtrl.text.trim()) ?? 0,
      minSubtotal: int.tryParse(minSubCtrl.text.trim()),
      usageLimit: int.tryParse(limitCtrl.text.trim()),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : (res.success ? 'Tạo voucher thành công!' : 'Tạo voucher thất bại.')),
        backgroundColor: res.success ? SellerTheme.success : SellerTheme.danger,
      ),
    );
    if (res.success) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SellerTheme.background,
      appBar: AppBar(
        title: const Text('Mã Giảm Giá (Vouchers)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        actions: [
          IconButton(icon: const Icon(Icons.add_rounded), onPressed: _showCreateDialog),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateDialog,
        backgroundColor: SellerTheme.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Tạo Voucher'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: SellerTheme.primary))
          : RefreshIndicator(
              onRefresh: _load,
              color: SellerTheme.primary,
              child: _vouchers.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 90),
                        Icon(Icons.confirmation_number_outlined, size: 54, color: SellerTheme.textSecondary),
                        SizedBox(height: 12),
                        Center(child: Text('Shop chưa có mã giảm giá nào.', style: TextStyle(color: SellerTheme.textSecondary))),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                      itemCount: _vouchers.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        final v = _vouchers[i];
                        final id = v['id']?.toString() ?? '';
                        final isActive = v['isActive'] == true || v['isActive'] == 1;
                        final discount = num.tryParse(v['discountAmount']?.toString() ?? '0') ?? 0;
                        final minSub = num.tryParse(v['minSubtotal']?.toString() ?? '0') ?? 0;
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: SellerTheme.card,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: SellerTheme.border),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      v['code']?.toString() ?? '',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: SellerTheme.primary),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(v['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Giảm ${_fmt.format(discount)} • Đơn từ ${_fmt.format(minSub)}',
                                      style: const TextStyle(fontSize: 12, color: SellerTheme.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              Switch(
                                value: isActive,
                                activeColor: SellerTheme.primary,
                                onChanged: (val) async {
                                  final res = await _service.toggleVoucherStatus(id, val);
                                  if (res.success) _load();
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline_rounded, color: SellerTheme.danger),
                                onPressed: () async {
                                  final res = await _service.deleteVoucher(id);
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Đã xóa voucher.')),
                                  );
                                  if (res.success) _load();
                                },
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}

