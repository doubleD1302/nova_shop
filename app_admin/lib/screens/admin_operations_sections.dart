import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/admin_feature_service.dart';
import '../theme/admin_theme.dart';

/// Module 9: Phân xử Trả hàng & Khiếu nại (/api/v1/admin/returns)
class AdminReturnsSection extends StatefulWidget {
  const AdminReturnsSection({super.key});

  @override
  State<AdminReturnsSection> createState() => _AdminReturnsSectionState();
}

class _AdminReturnsSectionState extends State<AdminReturnsSection> {
  final AdminFeatureService _service = AdminFeatureService();
  final NumberFormat _fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

  List<Map<String, dynamic>> _items = [];
  String? _status;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await _service.getAdminReturns(status: _status);
    if (mounted) {
      setState(() {
        _items = list;
        _loading = false;
      });
    }
  }

  Future<void> _resolve(String id, String resolution, String title) async {
    final noteCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: TextField(
          controller: noteCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Ghi chú phân xử của Admin (bắt buộc)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xác nhận')),
        ],
      ),
    );
    if (ok != true || noteCtrl.text.trim().isEmpty) return;

    final res = await _service.resolveReturnDispute(
      id,
      resolution: resolution,
      adminNote: noteCtrl.text,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : 'Đã lưu kết quả phân xử.'),
        backgroundColor: res.success ? AdminTheme.success : AdminTheme.danger,
      ),
    );
    if (res.success) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              _chip('Tất cả', null),
              _chip('Tranh chấp', 'disputed'),
              _chip('Chờ duyệt', 'requested'),
              _chip('Shop từ chối', 'rejected'),
              _chip('Đã duyệt', 'approved'),
              _chip('Hoàn tất', 'completed'),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AdminTheme.primary))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _items.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Chưa có hồ sơ trả hàng / khiếu nại.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.all(14),
                          itemCount: _items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final r = _items[i];
                            final id = r['id'].toString();
                            final status = r['status']?.toString() ?? 'requested';
                            final canResolve = status == 'requested' || status == 'rejected' || status == 'disputed';
                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AdminTheme.card,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AdminTheme.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'Đơn #${r['orderCode'] ?? r['orderId']} • ${r['shopName'] ?? 'Shop'}',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                                        ),
                                      ),
                                      Text(status.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AdminTheme.primary)),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text('Khách hàng: ${r['buyerName'] ?? ''} (${r['buyerPhone'] ?? ''})', style: const TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
                                  const SizedBox(height: 4),
                                  Text('Lý do: ${r['reason'] ?? ''}', style: const TextStyle(fontSize: 13)),
                                  if ((r['detail']?.toString() ?? '').isNotEmpty)
                                    Text(r['detail'].toString(), style: const TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Số tiền đề nghị hoàn: ${_fmt.format(num.tryParse(r['refundAmount']?.toString() ?? '0') ?? 0)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: AdminTheme.primary),
                                  ),
                                  if (canResolve) ...[
                                    const SizedBox(height: 10),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        OutlinedButton(
                                          onPressed: () => _resolve(id, 'reject', 'Bác yêu cầu / Giữ nguyên giao dịch'),
                                          style: OutlinedButton.styleFrom(foregroundColor: AdminTheme.danger, side: const BorderSide(color: AdminTheme.danger)),
                                          child: const Text('Bác khiếu nại'),
                                        ),
                                        const SizedBox(width: 8),
                                        ElevatedButton(
                                          onPressed: () => _resolve(id, 'approve', 'Chấp thuận hoàn tiền cho Khách'),
                                          child: const Text('Duyệt hoàn tiền'),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Widget _chip(String label, String? val) {
    final sel = _status == val;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label, style: TextStyle(fontSize: 12, color: sel ? Colors.white : AdminTheme.textPrimary)),
        selected: sel,
        selectedColor: AdminTheme.primary,
        backgroundColor: AdminTheme.card,
        onSelected: (_) {
          setState(() => _status = val);
          _load();
        },
      ),
    );
  }
}

/// Module 10: Duyệt Chi Trả Doanh Thu Seller (/api/v1/admin/payouts)
class AdminPayoutsSection extends StatefulWidget {
  const AdminPayoutsSection({super.key});

  @override
  State<AdminPayoutsSection> createState() => _AdminPayoutsSectionState();
}

class _AdminPayoutsSectionState extends State<AdminPayoutsSection> {
  final AdminFeatureService _service = AdminFeatureService();
  final NumberFormat _fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

  List<Map<String, dynamic>> _items = [];
  String? _status;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await _service.getAdminPayouts(status: _status);
    if (mounted) {
      setState(() {
        _items = list;
        _loading = false;
      });
    }
  }

  Future<void> _updateStatus(String payoutId, String status) async {
    final noteCtrl = TextEditingController();
    final refCtrl = TextEditingController();
    final isReject = status == 'rejected';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Cập nhật lệnh chi trả -> ${status.toUpperCase()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15.5)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (status == 'completed')
              TextField(
                controller: refCtrl,
                decoration: const InputDecoration(labelText: 'Mã giao dịch ngân hàng', border: OutlineInputBorder()),
              ),
            const SizedBox(height: 10),
            TextField(
              controller: noteCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: isReject ? 'Lý do từ chối (bắt buộc)' : 'Ghi chú Admin',
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xác nhận')),
        ],
      ),
    );
    if (ok != true) return;
    if (isReject && noteCtrl.text.trim().isEmpty) return;

    final res = await _service.updatePayoutStatus(
      payoutId,
      status: status,
      transactionReference: refCtrl.text,
      rejectionReason: isReject ? noteCtrl.text : null,
      adminNote: !isReject ? noteCtrl.text : null,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : 'Cập nhật lệnh chi trả thành công.'),
        backgroundColor: res.success ? AdminTheme.success : AdminTheme.danger,
      ),
    );
    if (res.success) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              _chip('Tất cả', null),
              _chip('Chờ duyệt', 'pending'),
              _chip('Đã duyệt', 'approved'),
              _chip('Hoàn tất', 'completed'),
              _chip('Từ chối', 'rejected'),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AdminTheme.primary))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _items.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Không có yêu cầu rút tiền nào.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.all(14),
                          itemCount: _items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final p = _items[i];
                            final id = p['id'].toString();
                            final status = p['status']?.toString() ?? 'pending';
                            final bank = p['bankInfo'] is Map
                                ? Map<String, dynamic>.from(p['bankInfo'] as Map)
                                : <String, dynamic>{};
                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AdminTheme.card,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AdminTheme.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          '${p['payoutCode'] ?? id} • ${p['shopName'] ?? ''}',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                                        ),
                                      ),
                                      Text(status.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AdminTheme.primary)),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Số tiền: ${_fmt.format(num.tryParse(p['amount']?.toString() ?? '0') ?? 0)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AdminTheme.primary),
                                  ),
                                  Text(
                                    'NH: ${bank['bankCode'] ?? ''} - ${bank['accountNumber'] ?? p['maskedAccountNumber'] ?? ''} (${bank['accountHolder'] ?? p['accountHolder'] ?? ''})',
                                    style: const TextStyle(fontSize: 12, color: AdminTheme.textSecondary),
                                  ),
                                  const SizedBox(height: 10),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 6,
                                    children: [
                                      if (status == 'pending') ...[
                                        OutlinedButton(
                                          onPressed: () => _updateStatus(id, 'rejected'),
                                          style: OutlinedButton.styleFrom(foregroundColor: AdminTheme.danger, side: const BorderSide(color: AdminTheme.danger)),
                                          child: const Text('Từ chối'),
                                        ),
                                        ElevatedButton(
                                          onPressed: () => _updateStatus(id, 'approved'),
                                          child: const Text('Duyệt'),
                                        ),
                                      ],
                                      if (status == 'approved' || status == 'processing')
                                        ElevatedButton(
                                          onPressed: () => _updateStatus(id, 'completed'),
                                          style: ElevatedButton.styleFrom(backgroundColor: AdminTheme.success),
                                          child: const Text('Đánh dấu Đã chuyển khoản'),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Widget _chip(String label, String? val) {
    final sel = _status == val;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label, style: TextStyle(fontSize: 12, color: sel ? Colors.white : AdminTheme.textPrimary)),
        selected: sel,
        selectedColor: AdminTheme.primary,
        backgroundColor: AdminTheme.card,
        onSelected: (_) {
          setState(() => _status = val);
          _load();
        },
      ),
    );
  }
}

/// Module 11: Hàng Chờ Đối Soát Thanh Toán & Hoàn Tiền (/api/v1/admin/payments/*)
class AdminPaymentsSection extends StatefulWidget {
  const AdminPaymentsSection({super.key});

  @override
  State<AdminPaymentsSection> createState() => _AdminPaymentsSectionState();
}

class _AdminPaymentsSectionState extends State<AdminPaymentsSection> {
  final AdminFeatureService _service = AdminFeatureService();
  final NumberFormat _fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

  List<Map<String, dynamic>> _queue = [];
  bool _loading = true;
  bool _reconciling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await _service.getPaymentReviewQueue();
    if (mounted) {
      setState(() {
        _queue = list;
        _loading = false;
      });
    }
  }

  Future<void> _reconcileAll() async {
    setState(() => _reconciling = true);
    final res = await _service.reconcilePayments();
    if (!mounted) return;
    setState(() => _reconciling = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : 'Hoàn tất đối soát cổng thanh toán.'),
        backgroundColor: res.success ? AdminTheme.success : AdminTheme.danger,
      ),
    );
    if (res.success) _load();
  }

  Future<void> _refundOrderDialog() async {
    final orderCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final reasonCtrl = TextEditingController(text: 'Admin xử lý hoàn tiền thủ công');

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Hoàn Tiền Giao Dịch Đơn Hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: orderCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Mã Order ID', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Số tiền hoàn (bỏ trống = toàn đơn)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(labelText: 'Lý do hoàn tiền', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Thực hiện hoàn tiền')),
        ],
      ),
    );
    if (ok != true || orderCtrl.text.trim().isEmpty) return;

    final res = await _service.refundPayment(
      orderId: orderCtrl.text.trim(),
      amount: num.tryParse(amountCtrl.text.trim()),
      reason: reasonCtrl.text,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : 'Xử lý hoàn tiền hoàn tất.'),
        backgroundColor: res.success ? AdminTheme.success : AdminTheme.danger,
      ),
    );
    if (res.success) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _reconciling ? null : _reconcileAll,
                  icon: const Icon(Icons.sync_rounded, size: 18),
                  label: Text(_reconciling ? 'ĐANG ĐỐI SOÁT...' : 'Đối soát tự động'),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: _refundOrderDialog,
                icon: const Icon(Icons.currency_exchange_rounded, size: 18),
                label: const Text('Hoàn tiền'),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AdminTheme.primary))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _queue.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Không có giao dịch chờ đối soát.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(14, 0, 14, 20),
                          itemCount: _queue.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final a = _queue[i];
                            return ListTile(
                              tileColor: AdminTheme.card,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AdminTheme.border)),
                              title: Text(
                                '${(a['provider'] ?? '').toString().toUpperCase()} • ${a['reference'] ?? ''}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                              ),
                              subtitle: Text('Đơn #${a['orderCode'] ?? a['orderId']} • Trạng thái: ${a['status']} (${a['resultCode'] ?? '-'})'),
                              trailing: Text(
                                _fmt.format(num.tryParse(a['amount']?.toString() ?? '0') ?? 0),
                                style: const TextStyle(fontWeight: FontWeight.bold, color: AdminTheme.primary),
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }
}

/// Modal hộp thư thông báo hệ thống Admin (/api/v1/notifications)
class AdminNotificationsSheet extends StatefulWidget {
  const AdminNotificationsSheet({super.key});

  @override
  State<AdminNotificationsSheet> createState() => _AdminNotificationsSheetState();
}

class _AdminNotificationsSheetState extends State<AdminNotificationsSheet> {
  final AdminFeatureService _service = AdminFeatureService();
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await _service.getNotifications();
    if (mounted) {
      setState(() {
        _items = (res['items'] as List? ?? []).whereType<Map<String, dynamic>>().toList();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.78),
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AdminTheme.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Thông Báo Hệ Thống', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              TextButton(
                onPressed: () async {
                  await _service.markAllNotificationsRead();
                  _load();
                },
                child: const Text('Đọc tất cả'),
              ),
            ],
          ),
          const Divider(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _items.isEmpty
                    ? const Center(child: Text('Không có thông báo mới.'))
                    : ListView.separated(
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final n = _items[i];
                          final isRead = n['isRead'] == true || n['isRead'] == 1;
                          return ListTile(
                            onTap: () async {
                              if (!isRead) {
                                await _service.markNotificationRead(n['id'].toString());
                                _load();
                              }
                            },
                            tileColor: isRead ? AdminTheme.background : AdminTheme.surfaceSubtle,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            title: Text(n['title']?.toString() ?? '', style: TextStyle(fontWeight: isRead ? FontWeight.w500 : FontWeight.bold, fontSize: 13.5)),
                            subtitle: Text(n['content']?.toString() ?? '', style: const TextStyle(fontSize: 12)),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

