import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/seller_feature_service.dart';
import '../theme/seller_theme.dart';

/// Màn hình Chiến Dịch Marketing & Đẩy Sản Phẩm (Boost)
class SellerMarketingScreen extends StatefulWidget {
  final List<Map<String, dynamic>> sellerProducts;

  const SellerMarketingScreen({super.key, this.sellerProducts = const []});

  @override
  State<SellerMarketingScreen> createState() => _SellerMarketingScreenState();
}

class _SellerMarketingScreenState extends State<SellerMarketingScreen>
    with SingleTickerProviderStateMixin {
  final SellerFeatureService _service = SellerFeatureService();
  final NumberFormat _fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
  late TabController _tabCtrl;

  List<Map<String, dynamic>> _campaigns = [];
  List<Map<String, dynamic>> _registrations = [];
  List<Map<String, dynamic>> _boosts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
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
      _service.getCampaigns(),
      _service.getCampaignRegistrations(),
      _service.getProductBoosts(),
    ]);
    if (mounted) {
      setState(() {
        _campaigns = res[0];
        _registrations = res[1];
        _boosts = res[2];
        _isLoading = false;
      });
    }
  }

  Future<void> _registerCampaign(Map<String, dynamic> campaign) async {
    if (widget.sellerProducts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cần ít nhất 1 sản phẩm để đăng ký chiến dịch.')),
      );
      return;
    }
    String selectedProdId = widget.sellerProducts.first['id'].toString();
    final priceCtrl = TextEditingController(text: '99000');
    final noteCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: Text('Đăng ký: ${campaign['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15.5)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: selectedProdId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Chọn sản phẩm', border: OutlineInputBorder()),
                  items: widget.sellerProducts
                      .map((p) => DropdownMenuItem(
                            value: p['id'].toString(),
                            child: Text(p['name']?.toString() ?? '', overflow: TextOverflow.ellipsis),
                          ))
                      .toList(),
                  onChanged: (v) => setDlg(() => selectedProdId = v ?? selectedProdId),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Giá khuyến mãi chiến dịch (₫)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: noteCtrl,
                  decoration: const InputDecoration(labelText: 'Ghi chú (không bắt buộc)', border: OutlineInputBorder()),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Gửi đăng ký')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final res = await _service.registerCampaign(
      campaignId: campaign['id'].toString(),
      productId: selectedProdId,
      discountPrice: int.tryParse(priceCtrl.text.trim()) ?? 0,
      note: noteCtrl.text,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : 'Đăng ký chiến dịch hoàn tất.'),
        backgroundColor: res.success ? SellerTheme.success : SellerTheme.danger,
      ),
    );
    if (res.success) _load();
  }

  Future<void> _buyBoost() async {
    if (widget.sellerProducts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Shop chưa có sản phẩm nào để đẩy top.')),
      );
      return;
    }
    String selectedProdId = widget.sellerProducts.first['id'].toString();
    String pkg = 'basic_1d';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Text('Mua Gói Đẩy Sản Phẩm', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: selectedProdId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Sản phẩm', border: OutlineInputBorder()),
                items: widget.sellerProducts
                    .map((p) => DropdownMenuItem(
                          value: p['id'].toString(),
                          child: Text(p['name']?.toString() ?? '', overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                onChanged: (v) => setDlg(() => selectedProdId = v ?? selectedProdId),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: pkg,
                decoration: const InputDecoration(labelText: 'Gói đẩy top', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'basic_1d', child: Text('Gói Cơ Bản 24H (basic_1d)')),
                  DropdownMenuItem(value: 'standard_3d', child: Text('Gói Tiêu Chuẩn 3 Ngày (standard_3d)')),
                  DropdownMenuItem(value: 'premium_7d', child: Text('Gói Cao Cấp 7 Ngày (premium_7d)')),
                ],
                onChanged: (v) => setDlg(() => pkg = v ?? pkg),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Kích hoạt Boost')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final res = await _service.buyProductBoost(productId: selectedProdId, packageType: pkg);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message.isNotEmpty ? res.message : 'Mua gói đẩy top hoàn tất.'),
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
        title: const Text('Marketing & Quảng Cáo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: SellerTheme.primary,
          unselectedLabelColor: SellerTheme.textSecondary,
          indicatorColor: SellerTheme.primary,
          tabs: const [
            Tab(text: 'Chiến dịch'),
            Tab(text: 'Đã đăng ký'),
            Tab(text: 'Đẩy Top'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _buyBoost,
        backgroundColor: SellerTheme.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.rocket_launch_rounded),
        label: const Text('Đẩy sản phẩm'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: SellerTheme.primary))
          : TabBarView(
              controller: _tabCtrl,
              children: [
                RefreshIndicator(
                  onRefresh: _load,
                  child: _campaigns.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Hiện chưa có chiến dịch mở đăng ký.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                          itemCount: _campaigns.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final c = _campaigns[i];
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
                                  Text(c['name']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5)),
                                  const SizedBox(height: 4),
                                  Text(c['description']?.toString() ?? '', style: const TextStyle(fontSize: 12.5, color: SellerTheme.textSecondary)),
                                  const SizedBox(height: 10),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: ElevatedButton(
                                      onPressed: () => _registerCampaign(c),
                                      child: const Text('Đăng ký tham gia'),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
                RefreshIndicator(
                  onRefresh: _load,
                  child: _registrations.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Chưa có lượt đăng ký chiến dịch nào.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                          itemCount: _registrations.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final r = _registrations[i];
                            return ListTile(
                              tileColor: SellerTheme.card,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: SellerTheme.border)),
                              title: Text(r['productName']?.toString() ?? 'Sản phẩm #${r['productId']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                              subtitle: Text('Chiến dịch: ${r['campaignName'] ?? r['campaignId']} • Giá KM: ${_fmt.format(num.tryParse(r['discountPrice']?.toString() ?? '0') ?? 0)}'),
                              trailing: Text((r['status'] ?? 'pending').toString().toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: SellerTheme.primary)),
                            );
                          },
                        ),
                ),
                RefreshIndicator(
                  onRefresh: _load,
                  child: _boosts.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Chưa mua gói đẩy sản phẩm nào.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                          itemCount: _boosts.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final b = _boosts[i];
                            return ListTile(
                              tileColor: SellerTheme.card,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: SellerTheme.border)),
                              title: Text(b['productName']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                              subtitle: Text('${b['packageName'] ?? b['packageType']} • ${_fmt.format(num.tryParse(b['costVnd']?.toString() ?? '0') ?? 0)}'),
                              trailing: Text((b['status'] ?? 'active').toString().toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: SellerTheme.success)),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}

