import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/seller_feature_service.dart';
import '../theme/seller_theme.dart';

/// Màn hình Báo Cáo Doanh Thu, Tồn Kho (Xuất Excel .xlsx) & Xử Lý Trả Hàng
class SellerReportsReturnsScreen extends StatefulWidget {
  final int initialTab;
  const SellerReportsReturnsScreen({super.key, this.initialTab = 0});

  @override
  State<SellerReportsReturnsScreen> createState() => _SellerReportsReturnsScreenState();
}

class _SellerReportsReturnsScreenState extends State<SellerReportsReturnsScreen>
    with SingleTickerProviderStateMixin {
  final SellerFeatureService _service = SellerFeatureService();
  final NumberFormat _fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
  late TabController _tabCtrl;

  Map<String, dynamic>? _revReport;
  Map<String, dynamic>? _invReport;
  List<Map<String, dynamic>> _returns = [];
  bool _isLoading = true;
  bool _isExporting = false;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this, initialIndex: widget.initialTab);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final res = await Future.wait([
      _service.getRevenueReport(),
      _service.getInventoryReport(),
      _service.getSellerReturns(),
    ]);
    if (mounted) {
      setState(() {
        _revReport = res[0] as Map<String, dynamic>?;
        _invReport = res[1] as Map<String, dynamic>?;
        _returns = res[2] as List<Map<String, dynamic>>;
        _isLoading = false;
      });
    }
  }

  Future<void> _exportExcel(String endpoint, String filename) async {
    setState(() => _isExporting = true);
    final path = await _service.downloadExcelToTemp(endpoint: endpoint, fileName: filename);
    if (!mounted) return;
    setState(() => _isExporting = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          path != null
              ? 'Đã tải báo cáo Excel (.xlsx) thành công:\n$path'
              : 'Không tải được file Excel lúc này.',
        ),
        backgroundColor: path != null ? SellerTheme.success : SellerTheme.danger,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  Future<void> _handleReturnAction(String returnId, String status, String title) async {
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
            labelText: 'Ghi chú phản hồi gửi khách hàng',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xác nhận')),
        ],
      ),
    );
    if (ok != true) return;
    final res = await _service.updateSellerReturnStatus(
      returnId,
      status: status,
      sellerNote: noteCtrl.text,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : 'Cập nhật xử lý trả hàng hoàn tất.'),
        backgroundColor: res.success ? SellerTheme.success : SellerTheme.danger,
      ),
    );
    if (res.success) _load();
  }

  @override
  Widget build(BuildContext context) {
    final revSummary = _revReport?['summary'] is Map
        ? Map<String, dynamic>.from(_revReport!['summary'] as Map)
        : <String, dynamic>{};
    final revOrders = _revReport?['orders'] is List
        ? (_revReport!['orders'] as List).whereType<Map<String, dynamic>>().toList()
        : <Map<String, dynamic>>[];
    final invSummary = _invReport?['summary'] is Map
        ? Map<String, dynamic>.from(_invReport!['summary'] as Map)
        : <String, dynamic>{};
    final invItems = _invReport?['items'] is List
        ? (_invReport!['items'] as List).whereType<Map<String, dynamic>>().toList()
        : <Map<String, dynamic>>[];

    return Scaffold(
      backgroundColor: SellerTheme.background,
      appBar: AppBar(
        title: const Text('Báo Cáo & Xử Lý Trả Hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16.5)),
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: SellerTheme.primary,
          unselectedLabelColor: SellerTheme.textSecondary,
          indicatorColor: SellerTheme.primary,
          tabs: [
            const Tab(text: 'Doanh thu'),
            const Tab(text: 'Tồn kho'),
            Tab(text: 'Trả hàng (${_returns.length})'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: SellerTheme.primary))
          : TabBarView(
              controller: _tabCtrl,
              children: [
                RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      ElevatedButton.icon(
                        onPressed: _isExporting
                            ? null
                            : () => _exportExcel('/api/v1/seller/reports/revenue/export', 'baocao_doanhthu.xlsx'),
                        icon: const Icon(Icons.file_download_outlined),
                        label: Text(_isExporting ? 'ĐANG TẢI EXCEL...' : 'Xuất Báo Cáo Doanh Thu (.xlsx)'),
                      ),
                      const SizedBox(height: 12),
                      _summaryCard([
                        ('Tổng đơn hàng', '${revSummary['totalOrders'] ?? 0}'),
                        ('Đơn đã giao', '${revSummary['deliveredOrders'] ?? 0}'),
                        ('Doanh thu gộp', _fmt.format(num.tryParse(revSummary['totalSubtotal']?.toString() ?? '0') ?? 0)),
                        ('Phí hoa hồng sàn', _fmt.format(num.tryParse(revSummary['totalCommission']?.toString() ?? '0') ?? 0)),
                        ('Thực nhận Shop', _fmt.format(num.tryParse(revSummary['totalPayout']?.toString() ?? '0') ?? 0)),
                      ]),
                      const SizedBox(height: 12),
                      ...revOrders.map((o) => Card(
                            child: ListTile(
                              title: Text('#${o['orderCode'] ?? o['orderId']} • ${o['buyerName'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              subtitle: Text('Trạng thái: ${o['status']}'),
                              trailing: Text(
                                _fmt.format(num.tryParse(o['netPayout']?.toString() ?? o['subtotal']?.toString() ?? '0') ?? 0),
                                style: const TextStyle(fontWeight: FontWeight.bold, color: SellerTheme.primary),
                              ),
                            ),
                          )),
                    ],
                  ),
                ),
                RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      ElevatedButton.icon(
                        onPressed: _isExporting
                            ? null
                            : () => _exportExcel('/api/v1/seller/reports/inventory/export', 'baocao_tonkho.xlsx'),
                        icon: const Icon(Icons.file_download_outlined),
                        label: Text(_isExporting ? 'ĐANG TẢI EXCEL...' : 'Xuất Báo Cáo Tồn Kho (.xlsx)'),
                      ),
                      const SizedBox(height: 12),
                      _summaryCard([
                        ('Tổng sản phẩm', '${invSummary['totalProducts'] ?? 0}'),
                        ('Tổng phân loại SKU', '${invSummary['totalSKUs'] ?? 0}'),
                        ('Tổng tồn kho', '${invSummary['totalStock'] ?? 0}'),
                        ('Sắp hết hàng', '${invSummary['lowStockCount'] ?? 0}'),
                      ]),
                      const SizedBox(height: 12),
                      ...invItems.map((it) => Card(
                            child: ListTile(
                              title: Text(it['productName']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              subtitle: Text('${it['variantName'] ?? ''} • SKU: ${it['sku'] ?? '-'}'),
                              trailing: Text(
                                'Kho: ${it['stockQty'] ?? 0}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: (num.tryParse(it['stockQty']?.toString() ?? '0') ?? 0) <= 5
                                      ? SellerTheme.danger
                                      : SellerTheme.success,
                                ),
                              ),
                            ),
                          )),
                    ],
                  ),
                ),
                RefreshIndicator(
                  onRefresh: _load,
                  child: _returns.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Không có yêu cầu trả hàng nào.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _returns.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final r = _returns[i];
                            final id = r['id'].toString();
                            final status = r['status']?.toString() ?? 'requested';
                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: SellerTheme.card,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: SellerTheme.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('Đơn #${r['orderId']} • ${r['buyerName'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                                      Text(status.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: SellerTheme.primary)),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text('Lý do: ${r['reason'] ?? ''}', style: const TextStyle(fontSize: 13)),
                                  if ((r['detail']?.toString() ?? '').isNotEmpty)
                                    Text(r['detail'].toString(), style: const TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Số tiền hoàn: ${_fmt.format(num.tryParse(r['refundAmount']?.toString() ?? '0') ?? 0)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: SellerTheme.primary),
                                  ),
                                  if (status == 'requested' || status == 'approved') ...[
                                    const SizedBox(height: 10),
                                    Wrap(
                                      spacing: 8,
                                      children: [
                                        if (status == 'requested') ...[
                                          OutlinedButton(
                                            onPressed: () => _handleReturnAction(id, 'rejected', 'Từ chối yêu cầu hoàn hàng'),
                                            style: OutlinedButton.styleFrom(foregroundColor: SellerTheme.danger, side: const BorderSide(color: SellerTheme.danger)),
                                            child: const Text('Từ chối'),
                                          ),
                                          ElevatedButton(
                                            onPressed: () => _handleReturnAction(id, 'approved', 'Phê duyệt yêu cầu hoàn hàng'),
                                            child: const Text('Phê duyệt'),
                                          ),
                                        ],
                                        if (status == 'approved')
                                          ElevatedButton(
                                            onPressed: () => _handleReturnAction(id, 'completed', 'Xác nhận hoàn tất trả hàng'),
                                            style: ElevatedButton.styleFrom(backgroundColor: SellerTheme.success),
                                            child: const Text('Hoàn tất'),
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
              ],
            ),
    );
  }

  Widget _summaryCard(List<(String, String)> rows) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: SellerTheme.border),
      ),
      child: Column(
        children: rows
            .map((e) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(e.$1, style: const TextStyle(fontSize: 12.5, color: SellerTheme.textSecondary)),
                      Text(e.$2, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}

