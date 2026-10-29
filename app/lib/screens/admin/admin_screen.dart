import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> with SingleTickerProviderStateMixin {
  final ApiClient _client = ApiClient();
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

  late TabController _tabController;

  // Tab 1: Reports
  List<Map<String, dynamic>> _reports = [];
  bool _isLoadingReports = true;
  String _selectedReportFilter = 'all';

  // Tab 2: Products
  List<Map<String, dynamic>> _products = [];
  bool _isLoadingProducts = true;
  String _selectedProductFilter = 'pending';

  // Tab 3: Shops
  List<Map<String, dynamic>> _shops = [];
  bool _isLoadingShops = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadReports();
    _loadProducts();
    _loadShops();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // 1. Tải danh sách báo cáo vi phạm
  Future<void> _loadReports() async {
    setState(() => _isLoadingReports = true);
    final response = await _client.get('/api/v1/admin/reports');
    if (mounted) {
      if (response.success && response.data is List) {
        setState(() {
          _reports = List<Map<String, dynamic>>.from(response.data as List);
          _isLoadingReports = false;
        });
      } else {
        setState(() => _isLoadingReports = false);
      }
    }
  }

  // 2. Tải danh sách sản phẩm chờ duyệt / quản lý
  Future<void> _loadProducts() async {
    setState(() => _isLoadingProducts = true);
    final response = await _client.get('/api/v1/admin/products');
    if (mounted) {
      if (response.success && response.data is List) {
        setState(() {
          _products = List<Map<String, dynamic>>.from(response.data as List);
          _isLoadingProducts = false;
        });
      } else {
        setState(() => _isLoadingProducts = false);
      }
    }
  }

  // 3. Tải danh sách gian hàng
  Future<void> _loadShops() async {
    setState(() => _isLoadingShops = true);
    final response = await _client.get('/api/v1/admin/shops');
    if (mounted) {
      if (response.success && response.data is List) {
        setState(() {
          _shops = List<Map<String, dynamic>>.from(response.data as List);
          _isLoadingShops = false;
        });
      } else {
        setState(() => _isLoadingShops = false);
      }
    }
  }

  // Cập nhật trạng thái báo cáo vi phạm
  Future<void> _updateReportStatus(String reportId, String newStatus, {String? actionTaken}) async {
    final response = await _client.patch(
      '/api/v1/admin/reports/$reportId/status',
      body: {
        'status': newStatus,
        if (actionTaken != null) 'action': actionTaken,
      },
    );

    if (!mounted) return;

    if (response.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã cập nhật trạng thái báo cáo #$reportId!')),
      );
      _loadReports();
      _loadShops();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red, content: Text(response.message)),
      );
    }
  }

  // Cập nhật kiểm duyệt sản phẩm
  Future<void> _updateProductApproval(String productId, String approvalStatus) async {
    final response = await _client.patch(
      '/api/v1/admin/products/$productId/approval',
      body: {
        'approvalStatus': approvalStatus,
        if (approvalStatus == 'rejected') 'rejectionReason': 'Vi phạm tiêu chuẩn niêm yết sàn',
      },
    );

    if (!mounted) return;

    if (response.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã cập nhật duyệt sản phẩm #$productId thành "$approvalStatus"!')),
      );
      _loadProducts();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red, content: Text(response.message)),
      );
    }
  }

  // Cập nhật trạng thái shop (Khóa / Mở)
  Future<void> _updateShopStatus(String shopId, String status) async {
    final response = await _client.patch(
      '/api/v1/admin/shops/$shopId/status',
      body: {'status': status},
    );

    if (!mounted) return;

    if (response.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã cập nhật trạng thái gian hàng sang "$status"!')),
      );
      _loadShops();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red, content: Text(response.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FA),
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.admin_panel_settings_rounded, color: AppColors.primary),
            SizedBox(width: 8),
            Text(
              'Trung Tâm Quản Trị Admin',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
          ],
        ),
        elevation: 0,
        backgroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.grey,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Báo Cáo Vi Phạm', icon: Icon(Icons.shield_outlined, size: 20)),
            Tab(text: 'Duyệt Sản Phẩm', icon: Icon(Icons.verified_outlined, size: 20)),
            Tab(text: 'Quản Lý Shop', icon: Icon(Icons.storefront_rounded, size: 20)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildReportsTab(),
          _buildProductsTab(),
          _buildShopsTab(),
        ],
      ),
    );
  }

  // TAB 1: BÁO CÁO VI PHẠM & HÀNG GIẢ
  Widget _buildReportsTab() {
    if (_isLoadingReports) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    final filtered = _reports.where((r) {
      if (_selectedReportFilter == 'all') return true;
      return r['status'] == _selectedReportFilter;
    }).toList();

    return Column(
      children: [
        // Thanh bộ lọc trạng thái
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('all', 'Tất cả (${_reports.length})', _selectedReportFilter, (v) => setState(() => _selectedReportFilter = v)),
                _buildFilterChip('open', 'Chờ xử lý', _selectedReportFilter, (v) => setState(() => _selectedReportFilter = v)),
                _buildFilterChip('investigating', 'Đang xác minh', _selectedReportFilter, (v) => setState(() => _selectedReportFilter = v)),
                _buildFilterChip('confirmed_violation', 'Đã xác nhận vi phạm', _selectedReportFilter, (v) => setState(() => _selectedReportFilter = v)),
                _buildFilterChip('dismissed', 'Bác bỏ', _selectedReportFilter, (v) => setState(() => _selectedReportFilter = v)),
              ],
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline_rounded, size: 48, color: Colors.grey),
                      SizedBox(height: 10),
                      Text('Không có báo cáo nào trong danh mục này', style: TextStyle(color: Colors.grey)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadReports,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      final id = (item['id'] ?? '').toString();
                      final reason = item['reason'] ?? 'Không rõ lý do';
                      final details = item['details'] ?? '';
                      final status = item['status'] ?? 'open';
                      final targetType = item['target_type'] ?? 'product';
                      final shopName = item['shop_name'] ?? item['shopName'] ?? '';

                      return Card(
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: Color(0xFFEEEEEE)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: targetType == 'product' ? AppColors.surfaceAlt : const Color(0xFFE8F5E9),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      targetType == 'product' ? 'SẢN PHẨM' : 'GIAN HÀNG',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: targetType == 'product' ? AppColors.primary : Colors.green.shade700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Báo cáo #$id',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  const Spacer(),
                                  _buildStatusBadge(status),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                reason,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022)),
                              ),
                              if (details.toString().isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  details.toString(),
                                  style: const TextStyle(fontSize: 12, color: Color(0xFF666666)),
                                ),
                              ],
                              if (shopName.toString().isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  'Gian hàng liên quan: $shopName',
                                  style: const TextStyle(fontSize: 12, color: Color(0xFF2C3E50), fontWeight: FontWeight.w600),
                                ),
                              ],
                              const Divider(height: 20),
                              // Thao tác xử lý của Admin
                              Wrap(
                                spacing: 8,
                                runSpacing: 6,
                                children: [
                                  if (status == 'open')
                                    OutlinedButton(
                                      onPressed: () => _updateReportStatus(id, 'investigating'),
                                      style: OutlinedButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        foregroundColor: Colors.blue.shade700,
                                      ),
                                      child: const Text('Tiến hành xác minh'),
                                    ),
                                  if (status != 'confirmed_violation')
                                    ElevatedButton.icon(
                                      icon: const Icon(Icons.lock_outline_rounded, size: 14),
                                      label: const Text('Khóa Shop Vi Phạm'),
                                      onPressed: () => _updateReportStatus(id, 'confirmed_violation', actionTaken: 'shop_suspended'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.red.shade700,
                                        foregroundColor: Colors.white,
                                        visualDensity: VisualDensity.compact,
                                      ),
                                    ),
                                  if (status != 'dismissed')
                                    TextButton(
                                      onPressed: () => _updateReportStatus(id, 'dismissed'),
                                      style: TextButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        foregroundColor: Colors.grey.shade700,
                                      ),
                                      child: const Text('Bác bỏ báo cáo'),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  // TAB 2: DUYỆT SẢN PHẨM
  Widget _buildProductsTab() {
    if (_isLoadingProducts) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    final filtered = _products.where((p) {
      if (_selectedProductFilter == 'all') return true;
      return p['approval_status'] == _selectedProductFilter || p['approvalStatus'] == _selectedProductFilter;
    }).toList();

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('pending', 'Chờ duyệt', _selectedProductFilter, (v) => setState(() => _selectedProductFilter = v)),
                _buildFilterChip('approved', 'Đã duyệt', _selectedProductFilter, (v) => setState(() => _selectedProductFilter = v)),
                _buildFilterChip('rejected', 'Bị từ chối', _selectedProductFilter, (v) => setState(() => _selectedProductFilter = v)),
                _buildFilterChip('all', 'Tất cả (${_products.length})', _selectedProductFilter, (v) => setState(() => _selectedProductFilter = v)),
              ],
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Text('Không có sản phẩm nào cần duyệt.', style: TextStyle(color: Colors.grey)),
                )
              : RefreshIndicator(
                  onRefresh: _loadProducts,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      final id = (item['id'] ?? '').toString();
                      final name = item['name'] ?? 'Sản phẩm';
                      final price = num.tryParse((item['price'] ?? 0).toString()) ?? 0;
                      final approval = item['approval_status'] ?? item['approvalStatus'] ?? 'pending';
                      final shopName = item['shop_name'] ?? item['shopName'] ?? '';

                      return Card(
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: Color(0xFFEEEEEE)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 60,
                                height: 60,
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.image_outlined, color: Colors.grey),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                                      maxLines: 2,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _currencyFormat.format(price),
                                      style: const TextStyle(
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                    if (shopName.toString().isNotEmpty)
                                      Text(
                                        'Shop: $shopName',
                                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                                      ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        if (approval == 'pending') ...[
                                          ElevatedButton(
                                            onPressed: () => _updateProductApproval(id, 'approved'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.green.shade600,
                                              foregroundColor: Colors.white,
                                              visualDensity: VisualDensity.compact,
                                            ),
                                            child: const Text('Phê Duyệt'),
                                          ),
                                          const SizedBox(width: 8),
                                          OutlinedButton(
                                            onPressed: () => _updateProductApproval(id, 'rejected'),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: Colors.red.shade700,
                                              visualDensity: VisualDensity.compact,
                                            ),
                                            child: const Text('Từ Chối'),
                                          ),
                                        ] else ...[
                                          _buildStatusBadge(approval),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  // TAB 3: QUẢN LÝ GIAN HÀNG
  Widget _buildShopsTab() {
    if (_isLoadingShops) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    return RefreshIndicator(
      onRefresh: _loadShops,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _shops.length,
        itemBuilder: (context, index) {
          final shop = _shops[index];
          final id = (shop['id'] ?? '').toString();
          final name = shop['name'] ?? 'Gian hàng';
          final status = shop['status'] ?? 'active';
          final isSuspended = status == 'suspended';

          return Card(
            elevation: 0,
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFEEEEEE)),
            ),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: isSuspended ? Colors.red.shade100 : AppColors.surfaceAlt,
                child: Icon(
                  Icons.storefront_rounded,
                  color: isSuspended ? Colors.red : AppColors.primary,
                ),
              ),
              title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: Text(
                'Mã: #$id • Trạng thái: ${isSuspended ? "Đang bị khóa" : "Hoạt động"}',
                style: TextStyle(
                  fontSize: 12,
                  color: isSuspended ? Colors.red.shade700 : Colors.grey.shade600,
                ),
              ),
              trailing: ElevatedButton(
                onPressed: () => _updateShopStatus(id, isSuspended ? 'active' : 'suspended'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isSuspended ? Colors.green.shade600 : Colors.red.shade700,
                  foregroundColor: Colors.white,
                  visualDensity: VisualDensity.compact,
                ),
                child: Text(isSuspended ? 'Mở Khóa' : 'Khóa Shop'),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildFilterChip(String value, String label, String currentGroup, Function(String) onSelect) {
    final isSelected = currentGroup == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => onSelect(value),
        selectedColor: AppColors.surfaceAlt,
        labelStyle: TextStyle(
          color: isSelected ? AppColors.primary : Colors.black87,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.grey.shade100;
    Color text = Colors.grey.shade800;
    String label = status;

    switch (status) {
      case 'open':
      case 'pending':
        bg = const Color(0xFFFFF3E0);
        text = const Color(0xFFE65100);
        label = 'Chờ xử lý';
        break;
      case 'investigating':
        bg = const Color(0xFFE3F2FD);
        text = const Color(0xFF1565C0);
        label = 'Đang xác minh';
        break;
      case 'confirmed_violation':
      case 'rejected':
      case 'suspended':
        bg = const Color(0xFFFFEBEE);
        text = const Color(0xFFC62828);
        label = status == 'confirmed_violation' ? 'Đã xác nhận vi phạm' : (status == 'rejected' ? 'Bị từ chối' : 'Đã khóa');
        break;
      case 'dismissed':
        bg = Colors.grey.shade100;
        text = Colors.grey.shade700;
        label = 'Không vi phạm';
        break;
      case 'approved':
      case 'active':
        bg = const Color(0xFFE8F5E9);
        text = const Color(0xFF2E7D32);
        label = status == 'approved' ? 'Đã duyệt' : 'Hoạt động';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: text, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }
}
