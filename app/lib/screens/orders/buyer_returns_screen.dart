import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/order_service.dart';
import '../../theme/app_colors.dart';

/// Màn hình Quản Lý Yêu Cầu Trả Hàng / Hoàn Tiền & Khiếu Nại (Buyer)
class BuyerReturnsScreen extends StatefulWidget {
  const BuyerReturnsScreen({super.key});

  @override
  State<BuyerReturnsScreen> createState() => _BuyerReturnsScreenState();
}

class _BuyerReturnsScreenState extends State<BuyerReturnsScreen> {
  final OrderService _orderService = OrderService();
  List<Map<String, dynamic>> _returns = [];
  bool _isLoading = true;
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!AuthService().isAuthenticated) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }
    setState(() => _isLoading = true);
    final list = await _orderService.getAllBuyerReturns(status: _statusFilter);
    if (mounted) {
      setState(() {
        _returns = list;
        _isLoading = false;
      });
    }
  }

  String _formatVND(num amount) {
    final str = amount.round().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (m) => '${m[1]}.')}₫';
  }

  (String, Color, Color) _statusBadge(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return ('Shop đã duyệt', const Color(0xFF15803D), const Color(0xFFF0FDF4));
      case 'rejected':
        return ('Shop từ chối', const Color(0xFFDC2626), const Color(0xFFFEF2F2));
      case 'disputed':
        return ('Đang khiếu nại Admin', const Color(0xFFB45309), const Color(0xFFFFFBEB));
      case 'completed':
        return ('Đã hoàn tiền', const Color(0xFF0F766E), const Color(0xFFF0FDFA));
      case 'cancelled':
        return ('Đã hủy yêu cầu', const Color(0xFF6B7280), const Color(0xFFF3F4F6));
      default:
        return ('Chờ shop duyệt', AppColors.primary, AppColors.surfaceAlt);
    }
  }

  Future<void> _cancelReturn(String returnId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Hủy yêu cầu trả hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text('Bạn chắc chắn muốn rút lại yêu cầu hoàn hàng / hoàn tiền này?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Đóng')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            child: const Text('Xác nhận hủy'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final res = await _orderService.cancelBuyerReturn(returnId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : (res.success ? 'Đã hủy yêu cầu.' : 'Không thể hủy yêu cầu.')),
        backgroundColor: res.success ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
      ),
    );
    if (res.success) _load();
  }

  Future<void> _disputeReturn(String returnId) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Khiếu nại lên Quản Trị Viên', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: TextField(
          controller: ctrl,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Lý do & bằng chứng khiếu nại',
            hintText: 'Mô tả chi tiết lý do bạn không đồng ý với quyết định từ chối của shop...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
            child: const Text('Gửi khiếu nại'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    final res = await _orderService.disputeBuyerReturn(returnId, disputeReason: reason);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : (res.success ? 'Đã gửi khiếu nại lên Admin.' : 'Không thể gửi khiếu nại.')),
        backgroundColor: res.success ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
      ),
    );
    if (res.success) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Trả Hàng & Khiếu Nại',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 17),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                _chip('Tất cả', null),
                _chip('Chờ duyệt', 'requested'),
                _chip('Đã duyệt', 'approved'),
                _chip('Từ chối', 'rejected'),
                _chip('Khiếu nại', 'disputed'),
                _chip('Hoàn tất', 'completed'),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.primary,
                    child: _returns.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 90),
                              Icon(Icons.assignment_return_outlined, size: 54, color: AppColors.textSecondary),
                              SizedBox(height: 12),
                              Center(
                                child: Text(
                                  'Chưa có yêu cầu trả hàng / hoàn tiền nào.',
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                                ),
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                            itemCount: _returns.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (_, i) {
                              final r = _returns[i];
                              final status = (r['status'] ?? 'requested').toString().toLowerCase();
                              final (label, fg, bg) = _statusBadge(status);
                              final id = r['id']?.toString() ?? '';
                              final refundAmount = num.tryParse(r['refundAmount']?.toString() ?? '0') ?? 0;
                              final sellerNote = r['sellerNote']?.toString() ?? '';
                              final adminNote = r['adminNote']?.toString() ?? '';

                              return Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            'Đơn #${r['orderCode'] ?? r['orderId'] ?? id} • ${r['shopName'] ?? 'ShopNova'}',
                                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.textPrimary),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
                                          child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text('Lý do: ${r['reason'] ?? '-'}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    if ((r['detail']?.toString() ?? '').isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(r['detail'].toString(), style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5)),
                                    ],
                                    const SizedBox(height: 8),
                                    Text(
                                      'Số tiền đề nghị hoàn: ${_formatVND(refundAmount)}',
                                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                    if (sellerNote.isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      Text('Phản hồi Shop: $sellerNote', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                    ],
                                    if (adminNote.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text('Kết luận Admin: $adminNote', style: const TextStyle(fontSize: 12, color: Color(0xFF0F766E), fontWeight: FontWeight.w600)),
                                    ],
                                    if (status == 'requested' || status == 'rejected') ...[
                                      const SizedBox(height: 10),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          if (status == 'requested')
                                            OutlinedButton(
                                              onPressed: () => _cancelReturn(id),
                                              style: OutlinedButton.styleFrom(
                                                foregroundColor: const Color(0xFFDC2626),
                                                side: const BorderSide(color: Color(0xFFFCA5A5)),
                                              ),
                                              child: const Text('Hủy yêu cầu', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                            ),
                                          if (status == 'rejected')
                                            ElevatedButton.icon(
                                              onPressed: () => _disputeReturn(id),
                                              icon: const Icon(Icons.gavel_rounded, size: 16),
                                              label: const Text('Khiếu nại lên Admin', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: AppColors.primary,
                                                foregroundColor: Colors.white,
                                              ),
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
      ),
    );
  }

  Widget _chip(String label, String? status) {
    final selected = _statusFilter == status;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label, style: TextStyle(fontSize: 12, color: selected ? Colors.white : AppColors.textPrimary)),
        selected: selected,
        selectedColor: AppColors.primary,
        backgroundColor: AppColors.surface,
        side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
        onSelected: (_) {
          setState(() => _statusFilter = status);
          _load();
        },
      ),
    );
  }
}

